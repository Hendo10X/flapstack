"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Send } from "lucide-react";

import { apiBase } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

type Comment = {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
};

const NICK_KEY = "flapstack:nickname";

export function Comments({ snippetId }: { snippetId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(localStorage.getItem(NICK_KEY) || "");
    fetch(`${apiBase()}/api/v1/snippets/${snippetId}/comments`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((rows: Comment[]) => setComments(rows ?? []))
      .catch(() => setComments([]));
  }, [snippetId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPosting(true);
    try {
      const trimmedName = name.trim();
      if (trimmedName) localStorage.setItem(NICK_KEY, trimmedName);
      const res = await fetch(
        `${apiBase()}/api/v1/snippets/${snippetId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ authorName: trimmedName, body }),
        }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Failed (${res.status})`);
      }
      const created = (await res.json()) as Comment;
      setComments((prev) => [...prev, created]);
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
    } finally {
      setPosting(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <MessageSquare className="size-4" />
          Comments
          {comments.length > 0 && (
            <span className="text-muted-foreground">({comments.length})</span>
          )}
        </div>

        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No comments yet. Be the first.
          </p>
        ) : (
          <ul className="space-y-3">
            {comments.map((c) => (
              <li key={c.id} className="rounded-md border bg-card/50 p-3">
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {c.authorName || "anon"}
                  </span>{" "}
                  · {new Date(c.createdAt).toLocaleString()}
                </div>
                <p className="mt-1 text-sm whitespace-pre-wrap">{c.body}</p>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={submit} className="space-y-2 border-t pt-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[160px_1fr]">
            <div className="space-y-1.5">
              <Label htmlFor="comment-name" className="text-xs">
                Name
              </Label>
              <Input
                id="comment-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="anon"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="comment-body" className="text-xs">
                Comment
              </Label>
              <Textarea
                id="comment-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                required
                placeholder="Add a comment…"
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={posting || !body.trim()}>
              <Send />
              {posting ? "Posting…" : "Post"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
