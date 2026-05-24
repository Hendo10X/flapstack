"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, KeyRound, Plus, ShieldCheck, Trash2 } from "lucide-react";

import { createSnippet, type CreateSnippetInput } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Row = { key: string; value: string };
type TTL = NonNullable<CreateSnippetInput["ttl"]>;

const TTL_OPTIONS: { value: TTL; label: string }[] = [
  { value: "1h", label: "1 hour" },
  { value: "1d", label: "1 day" },
  { value: "1w", label: "1 week" },
  { value: "30d", label: "30 days" },
  { value: "", label: "Never" },
];

function quoteValue(v: string): string {
  if (v === "" || /^[\w./:@-]+$/.test(v)) return v;
  return `"${v.replace(/(["\\$`])/g, "\\$1")}"`;
}

function rowsToEnv(rows: Row[]): string {
  return rows
    .filter((r) => r.key.trim() !== "")
    .map((r) => `${r.key.trim()}=${quoteValue(r.value)}`)
    .join("\n");
}

export default function ShareEnvPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [rows, setRows] = useState<Row[]>([{ key: "", value: "" }]);
  const [raw, setRaw] = useState("");
  const [mode, setMode] = useState<"structured" | "raw">("structured");
  const [ttl, setTtl] = useState<TTL>("1d");
  const [burn, setBurn] = useState(true);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const content = useMemo(() => (mode === "raw" ? raw : rowsToEnv(rows)), [mode, raw, rows]);
  const canSubmit = content.trim() !== "" && password.length >= 4;

  function setRow(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((rs) => [...rs, { key: "", value: "" }]);
  }
  function removeRow(i: number) {
    setRows((rs) => (rs.length === 1 ? rs : rs.filter((_, idx) => idx !== i)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const s = await createSnippet({
        title: name || "Shared .env",
        content,
        language: "Bash",
        visibility: "unlisted",
        ttl,
        burnAfterRead: burn,
        password,
        isEncrypted: true,
      });
      router.push(`/s/${s.slug || s.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to create");
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Button asChild variant="ghost" size="icon" aria-label="Back">
        <Link href="/">
          <ChevronLeft />
        </Link>
      </Button>

      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Share env <span className="text-muted-foreground">vault</span>
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Send a teammate a one-shot, password-protected{" "}
        <code className="rounded bg-muted px-1 py-0.5">.env</code> file —
        without sending it over Slack. AES-256 encrypted at rest, burns after
        first read by default.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-1">
          <ShieldCheck className="size-3.5" /> AES-256 at rest
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-1">
          <KeyRound className="size-3.5" /> Passphrase required
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-1">
          Burn after read
        </span>
      </div>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="staging .env, prod secrets…"
          />
        </div>

        <div>
          <Label>Variables</Label>
          <Tabs
            value={mode}
            onValueChange={(v) => setMode(v as typeof mode)}
            className="mt-1.5"
          >
            <TabsList>
              <TabsTrigger value="structured">Structured</TabsTrigger>
              <TabsTrigger value="raw">Raw</TabsTrigger>
            </TabsList>
            <TabsContent value="structured">
              <Card>
                <CardContent className="space-y-2">
                  {rows.map((row, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        placeholder="KEY"
                        value={row.key}
                        onChange={(e) =>
                          setRow(i, { key: e.target.value.toUpperCase().replace(/\s+/g, "_") })
                        }
                        className="font-mono w-1/3"
                      />
                      <span className="text-muted-foreground">=</span>
                      <Input
                        placeholder="value"
                        value={row.value}
                        onChange={(e) => setRow(i, { value: e.target.value })}
                        className="font-mono flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRow(i)}
                        aria-label="Remove row"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addRow}
                  >
                    <Plus /> Add variable
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="raw">
              <Textarea
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                rows={8}
                placeholder={`DATABASE_URL=postgres://...\nAPI_KEY=...`}
                className="font-mono text-sm"
              />
            </TabsContent>
          </Tabs>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Expires</Label>
            <Select value={ttl} onValueChange={(v) => setTtl(v as TTL)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TTL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value || "never"} value={opt.value || "never"}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Card className="py-3">
            <CardContent className="flex items-center justify-between gap-4">
              <div>
                <Label>Burn after read</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Recommended for secrets.
                </p>
              </div>
              <Switch checked={burn} onCheckedChange={setBurn} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pw" className="flex items-center gap-2">
            <KeyRound className="size-4" /> Passphrase (required)
          </Label>
          <Input
            id="pw"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 4 characters"
            required
          />
          <p className="text-xs text-muted-foreground">
            Share this passphrase out-of-band (Signal, password manager, etc.) — not in the same channel as the link.
          </p>
        </div>

        {content.trim() !== "" && (
          <div>
            <Label>Preview</Label>
            <pre className="mt-1.5 overflow-x-auto rounded-md border bg-card p-3 text-xs">
              <code>{content}</code>
            </pre>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={!canSubmit || submitting}>
          <KeyRound />
          {submitting ? "Creating…" : "Create secret link"}
        </Button>
      </form>
    </main>
  );
}
