"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ChevronLeft, Flame, GitFork, KeyRound, Lock, ShieldCheck } from "lucide-react";
import ReactMarkdown from "react-markdown";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ApiError, getSnippet, verifySnippet, type Snippet } from "@/lib/api";
import { SnippetActions } from "@/components/snippet-actions";
import { AIExplain } from "@/components/ai-explain";
import { HighlightedCode } from "@/components/highlighted-code";
import { Comments } from "@/components/comments";

export default function SnippetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [snippet, setSnippet] = useState<Snippet | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [expired, setExpired] = useState(false);
  const [burnedNotice, setBurnedNotice] = useState(false);
  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await getSnippet(id);
        if (!cancelled) {
          setSnippet(s);
          if (s.burnAfterRead && s.content) setBurnedNotice(true);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          if (err.status === 404) setNotFound(true);
          else if (err.status === 410) setExpired(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setVerifying(true);
    setVerifyError(null);
    try {
      const s = await verifySnippet(id, password);
      setSnippet(s);
      if (s.burnAfterRead) setBurnedNotice(true);
    } catch (err) {
      setVerifyError(
        err instanceof ApiError && err.status === 401
          ? "Incorrect password"
          : err instanceof Error
            ? err.message
            : "Failed"
      );
    } finally {
      setVerifying(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Button asChild variant="ghost" size="icon" aria-label="Back">
        <Link href="/">
          <ChevronLeft />
        </Link>
      </Button>

      {loading && (
        <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
      )}

      {notFound && (
        <div className="mt-6">
          <h1 className="text-2xl font-semibold">Not found</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This snippet doesn&apos;t exist, or it was burned after read.
          </p>
        </div>
      )}

      {expired && (
        <div className="mt-6">
          <h1 className="text-2xl font-semibold">Expired</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This snippet&apos;s expiration time has passed.
          </p>
        </div>
      )}

      {snippet && (
        <>
          <header className="mt-2 flex flex-wrap items-baseline justify-between gap-4">
            <h1 className="text-3xl font-semibold tracking-tight">
              {snippet.title || "Untitled"}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              {snippet.language && <Badge variant="secondary">{snippet.language}</Badge>}
              <Badge variant="outline">{snippet.visibility}</Badge>
              {snippet.burnAfterRead && (
                <Badge variant="destructive">
                  <Flame /> Burn after read
                </Badge>
              )}
              {snippet.passwordLocked && (
                <Badge variant="outline">
                  <KeyRound /> Locked
                </Badge>
              )}
              {snippet.isEncrypted && (
                <Badge variant="secondary">
                  <ShieldCheck /> Encrypted
                </Badge>
              )}
              {snippet.forkOfId && (
                <Badge variant="outline">
                  <GitFork /> Fork
                </Badge>
              )}
              {snippet.forkCount ? (
                <Badge variant="outline">{snippet.forkCount} forks</Badge>
              ) : null}
            </div>
          </header>

          {burnedNotice && (
            <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <strong>Heads up:</strong> this snippet is burn-after-read. Viewing it just
              deleted it from the server — this is your only copy.
            </div>
          )}

          {snippet.passwordLocked && !snippet.content && (
            <Card className="mt-6">
              <CardContent>
                <div className="flex items-center gap-2 text-sm">
                  <Lock className="size-4" />
                  This snippet is password-protected.
                </div>
                <form onSubmit={onVerify} className="mt-4 space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="pw">Passphrase</Label>
                    <Input
                      id="pw"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoFocus
                      required
                    />
                  </div>
                  {verifyError && (
                    <p className="text-sm text-destructive">{verifyError}</p>
                  )}
                  <Button type="submit" disabled={verifying || !password}>
                    {verifying ? "Verifying…" : "Unlock"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {snippet.content && (
            <>
              <div className="mt-6">
                {snippet.language === "Markdown" ? (
                  <Card>
                    <CardContent className="prose prose-invert max-w-none">
                      <ReactMarkdown>{snippet.content}</ReactMarkdown>
                    </CardContent>
                  </Card>
                ) : (
                  <HighlightedCode
                    content={snippet.content}
                    language={snippet.language}
                  />
                )}
              </div>
              <div className="mt-4 space-y-4">
                <SnippetActions
                  id={snippet.id}
                  content={snippet.content}
                  title={snippet.title}
                  forkable={!snippet.burnAfterRead && !snippet.passwordLocked}
                />
                <AIExplain
                  content={snippet.content}
                  language={snippet.language}
                  title={snippet.title}
                />
                <Comments snippetId={snippet.id} />
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
