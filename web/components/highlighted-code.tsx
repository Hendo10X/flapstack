"use client";

import { useEffect, useState } from "react";
import { codeToHtml } from "shiki";

// Map our human language names → Shiki's grammar IDs.
const LANG_MAP: Record<string, string> = {
  "plain text": "text",
  "c++": "cpp",
  "c#": "csharp",
  "f#": "fsharp",
  "objective-c": "objc",
  "vim script": "vim",
  jsx: "jsx",
  tsx: "tsx",
  markdown: "md",
  yaml: "yaml",
  toml: "toml",
  bash: "bash",
  shell: "shell",
  powershell: "powershell",
  batch: "bat",
  dockerfile: "docker",
  go: "go",
  rust: "rust",
  python: "python",
  ruby: "ruby",
  javascript: "javascript",
  typescript: "typescript",
  java: "java",
  kotlin: "kotlin",
  swift: "swift",
  php: "php",
  sql: "sql",
  json: "json",
  html: "html",
  css: "css",
  scss: "scss",
  less: "less",
  graphql: "graphql",
  hcl: "hcl",
  ini: "ini",
  lua: "lua",
  nginx: "nginx",
  elixir: "elixir",
  elm: "elm",
  haskell: "haskell",
  ocaml: "ocaml",
  scala: "scala",
  julia: "julia",
  matlab: "matlab",
  perl: "perl",
  zig: "zig",
  nim: "nim",
  solidity: "solidity",
  svelte: "svelte",
  vue: "vue",
  dart: "dart",
  r: "r",
  prolog: "prolog",
  scheme: "scheme",
  lisp: "lisp",
  protobuf: "proto",
};

function resolveLang(name?: string): string {
  if (!name) return "text";
  return LANG_MAP[name.toLowerCase()] || "text";
}

type Props = {
  content: string;
  language?: string;
};

export function HighlightedCode({ content, language }: Props) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rendered = await codeToHtml(content, {
          lang: resolveLang(language),
          theme: "github-dark-dimmed",
        });
        if (!cancelled) setHtml(rendered);
      } catch {
        // Unknown grammar → fall through to plain pre rendering.
        if (!cancelled) setHtml(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [content, language]);

  if (html) {
    return (
      <div
        className="overflow-x-auto rounded-lg border text-sm [&_pre]:!bg-card [&_pre]:!p-4 [&_pre]:!m-0"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <pre className="overflow-x-auto rounded-lg border bg-card p-4 text-sm">
      <code>{content}</code>
    </pre>
  );
}
