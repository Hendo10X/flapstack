"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { getSnippet, type Snippet } from "@/lib/api";
import { HighlightedCode } from "@/components/highlighted-code";

export default function EmbedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [snippet, setSnippet] = useState<Snippet | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSnippet(id)
      .then(setSnippet)
      .catch((e) => setError(e instanceof Error ? e.message : "failed"));
  }, [id]);

  return (
    <div className="bg-background p-3 font-body text-foreground">
      {error && <p className="text-xs text-destructive">{error}</p>}
      {snippet && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate font-display font-medium">
              {snippet.title || "Untitled"}
              {snippet.language && (
                <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                  {snippet.language}
                </span>
              )}
            </span>
            <Link
              href={`/s/${snippet.slug || snippet.id}`}
              target="_blank"
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              FlapStack <ExternalLink className="size-3" />
            </Link>
          </div>
          {snippet.content && (
            <HighlightedCode
              content={snippet.content}
              language={snippet.language}
            />
          )}
        </div>
      )}
    </div>
  );
}
