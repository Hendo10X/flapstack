"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Code2, Copy, ExternalLink, GitFork, Link as LinkIcon, QrCode, Terminal } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiBase, forkSnippet } from "@/lib/api";

type Props = {
  id: string;
  content?: string;
  title?: string;
  forkable?: boolean;
};

export function SnippetActions({ id, content, title, forkable = true }: Props) {
  const router = useRouter();
  const [forking, setForking] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);

  const rawUrl = `${apiBase()}/api/v1/snippets/${id}`;
  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/s/${id}` : "";
  const embedUrl =
    typeof window !== "undefined" ? `${window.location.origin}/embed/${id}` : "";
  const iframeTag = `<iframe src="${embedUrl}" style="width:100%;height:420px;border:0" loading="lazy"></iframe>`;
  const curl = `curl -s ${rawUrl}`;
  const vscodeUri = content
    ? `vscode://file/${encodeURIComponent((title || "snippet") + ".txt")}?content=${encodeURIComponent(content)}`
    : "";

  async function fork() {
    setForking(true);
    try {
      const s = await forkSnippet(id);
      router.push(`/s/${s.slug || s.id}`);
    } catch {
      setForking(false);
    }
  }

  async function copy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      /* noop */
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-2">
        {content && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => copy(content, "content")}
          >
            {copied === "content" ? <Check /> : <Copy />}
            Copy
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => copy(shareUrl, "link")}>
          {copied === "link" ? <Check /> : <LinkIcon />}
          Copy link
        </Button>
        <Button size="sm" variant="outline" onClick={() => copy(rawUrl, "raw")}>
          {copied === "raw" ? <Check /> : <ExternalLink />}
          Raw URL
        </Button>
        <Button size="sm" variant="outline" onClick={() => copy(curl, "curl")}>
          {copied === "curl" ? <Check /> : <Terminal />}
          Copy as curl
        </Button>
        {content && (
          <Button size="sm" variant="outline" asChild>
            <a href={vscodeUri}>
              <ExternalLink />
              Open in VS Code
            </a>
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => copy(iframeTag, "iframe")}>
          {copied === "iframe" ? <Check /> : <Code2 />}
          Copy embed
        </Button>
        {forkable && (
          <Button size="sm" variant="outline" onClick={fork} disabled={forking}>
            <GitFork />
            {forking ? "Forking…" : "Fork"}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowQR((s) => !s)}
        >
          <QrCode />
          {showQR ? "Hide QR" : "Show QR"}
        </Button>
        {showQR && shareUrl && (
          <div className="mt-3 flex w-full justify-center rounded-md bg-white p-4">
            <QRCodeSVG value={shareUrl} size={160} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
