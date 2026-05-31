import { NextRequest } from "next/server";
import { streamText } from "ai";
import { groq } from "@ai-sdk/groq";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { content, language, title } = await req.json();

  if (!content || typeof content !== "string") {
    return Response.json({ error: "missing content" }, { status: 400 });
  }
  if (content.length > 50_000) {
    return Response.json({ error: "snippet too large" }, { status: 413 });
  }

  // 1) Claim a usage credit against the backend (it enforces the 5/mo limit).
  const proToken = req.headers.get("X-FlapStack-Pro") || "";
  const deviceId = req.headers.get("X-FlapStack-Device-ID") || "";
  const fwd =
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    "";

  const claim = await fetch(`${API}/api/v1/ai/usage/claim`, {
    method: "POST",
    headers: {
      "X-FlapStack-Pro": proToken,
      "X-FlapStack-Device-ID": deviceId,
      "X-Forwarded-For": fwd,
    },
  });
  const claimBody = await claim.json().catch(() => ({}));
  if (claim.status === 402) {
    return Response.json(
      { error: "paywall", ...claimBody },
      { status: 402, headers: { "X-FlapStack-Remaining": "0" } }
    );
  }
  if (!claim.ok) {
    return Response.json({ error: "usage check failed" }, { status: 502 });
  }

  // 2) Stream from Groq.
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "GROQ_API_KEY not configured" },
      { status: 503 }
    );
  }

  const result = streamText({
    model: groq("llama-3.3-70b-versatile"),
    system:
      "You are a senior engineer explaining code or text to a developer. " +
      "Be concise. Use short paragraphs and bullet lists. " +
      "Start with one sentence summarising what it does, then explain the important parts. " +
      "If it's not code, summarise its meaning and call out anything notable. " +
      "Use Markdown.",
    prompt: `Title: ${title || "(untitled)"}\nLanguage: ${language || "unknown"}\n\n---\n${content}`,
  });

  const response = result.toTextStreamResponse();
  // Forward the remaining-uses header so the client can update its badge.
  if (typeof claimBody.remaining === "number") {
    response.headers.set("X-FlapStack-Remaining", String(claimBody.remaining));
  }
  if (claimBody.pro) {
    response.headers.set("X-FlapStack-Pro", "1");
  }
  return response;
}
