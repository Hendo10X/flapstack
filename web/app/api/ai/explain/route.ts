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

  // Stream from Groq.
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

  return result.toTextStreamResponse();
}
