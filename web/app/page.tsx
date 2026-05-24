import Link from "next/link";
import { Plus, KeyRound } from "lucide-react";
import { listSnippets } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function Home() {
  const snippets = await listSnippets().catch(() => []);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-10">
        <h1 className="text-5xl font-semibold tracking-tight">FlapStack</h1>
        <p className="mt-2 text-muted-foreground">
          Create, store, and share snippets, notes, and prompts.
        </p>
      </header>

      <section className="mb-10 flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/new">
            <Plus />
            New snippet
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/share-env">
            <KeyRound />
            Share env
          </Link>
        </Button>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-medium">Recent public snippets</h2>
        {snippets.length === 0 ? (
          <Card>
            <CardContent className="text-sm text-muted-foreground">
              No snippets yet. Make sure the API is running on{" "}
              <code className="rounded bg-muted px-1.5 py-0.5">
                {process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}
              </code>
              .
            </CardContent>
          </Card>
        ) : (
          <ul className="divide-y rounded-lg border">
            {snippets.map((s) => (
              <li key={s.id} className="p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <Link
                    href={`/s/${s.slug || s.id}`}
                    className="font-medium hover:underline"
                  >
                    {s.title || "Untitled"}
                  </Link>
                  {s.language && <Badge variant="secondary">{s.language}</Badge>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
