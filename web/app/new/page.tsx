"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, Plus, Flame, KeyRound } from "lucide-react";
import ReactMarkdown from "react-markdown";

import { createSnippet, type CreateSnippetInput, type Visibility } from "@/lib/api";
import { LANGUAGES } from "@/lib/languages";
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

type TTL = NonNullable<CreateSnippetInput["ttl"]>;

const TTL_OPTIONS: { value: TTL; label: string }[] = [
  { value: "", label: "Never" },
  { value: "1h", label: "1 hour" },
  { value: "1d", label: "1 day" },
  { value: "1w", label: "1 week" },
  { value: "30d", label: "30 days" },
];

export default function NewSnippetPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState<string>("Plain Text");
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [ttl, setTtl] = useState<TTL>("");
  const [burn, setBurn] = useState(false);
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMarkdown = language === "Markdown";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const s = await createSnippet({
        title,
        content,
        language,
        visibility,
        ttl,
        burnAfterRead: burn,
        password: usePassword ? password : "",
      });
      router.push(`/s/${s.slug || s.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to create");
      setSubmitting(false);
    }
  }

  const contentField = useMemo(
    () => (
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        required
        rows={8}
        placeholder="Paste or write your snippet here…"
        className="font-mono text-sm resize-y"
      />
    ),
    [content]
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Button asChild variant="ghost" size="icon" aria-label="Back">
        <Link href="/">
          <ChevronLeft />
        </Link>
      </Button>

      <h1 className="mt-2 text-3xl font-semibold tracking-tight">New snippet</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Create a snippet, note, log, or prompt. Configure visibility, expiration, and protection.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Language</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang} value={lang}>
                    {lang}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Visibility</Label>
            <Select value={visibility} onValueChange={(v) => setVisibility(v as Visibility)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="unlisted">Unlisted</SelectItem>
                <SelectItem value="private">Private</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
        </div>

        <div>
          <Label>Content</Label>
          {isMarkdown ? (
            <Tabs defaultValue="edit" className="mt-1.5">
              <TabsList>
                <TabsTrigger value="edit">Edit</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
              <TabsContent value="edit">{contentField}</TabsContent>
              <TabsContent value="preview">
                <Card>
                  <CardContent className="prose prose-invert max-w-none">
                    {content.trim() ? (
                      <ReactMarkdown>{content}</ReactMarkdown>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Nothing to preview yet.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="mt-1.5">{contentField}</div>
          )}
        </div>

        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label className="flex items-center gap-2">
                  <Flame className="size-4" /> Burn after read
                </Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Deletes the snippet the first time it&apos;s viewed. Great for secrets.
                </p>
              </div>
              <Switch checked={burn} onCheckedChange={setBurn} />
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Label className="flex items-center gap-2">
                  <KeyRound className="size-4" /> Password protect
                </Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Viewers must enter this passphrase before content is revealed.
                </p>
                {usePassword && (
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Choose a passphrase"
                    className="mt-2"
                    required
                  />
                )}
              </div>
              <Switch checked={usePassword} onCheckedChange={setUsePassword} />
            </div>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          type="submit"
          disabled={submitting || content.trim() === "" || (usePassword && !password)}
        >
          <Plus />
          {submitting ? "Creating…" : "Create snippet"}
        </Button>
      </form>
    </main>
  );
}
