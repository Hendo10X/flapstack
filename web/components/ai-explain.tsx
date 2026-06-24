"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  content: string;
  language?: string;
  title?: string;
};

export function AIExplain({ content, language, title }: Props) {
  const [streaming, setStreaming] = useState(false);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function explain() {
    setStreaming(true);
    setOutput("");
    setError(null);

    try {
      const res = await fetch("/api/ai/explain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content, language, title }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed (${res.status})`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("no stream");
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        setOutput((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
    } finally {
      setStreaming(false);
    }
  }

  return (
    <>
      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <span className="text-sm font-medium">Explain with AI</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={explain}
                disabled={streaming || !content}
              >
                {streaming ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {streaming ? "Thinking…" : output ? "Explain again" : "Explain"}
              </Button>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {output && (
            <div className="prose prose-invert max-w-none rounded-md border bg-card/50 p-4 text-sm">
              <ReactMarkdown>{output}</ReactMarkdown>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
