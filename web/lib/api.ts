export type Visibility = "public" | "unlisted" | "private";

export type Snippet = {
  id: string;
  slug?: string;
  title: string;
  content?: string;
  isEncrypted?: boolean;
  language: string;
  visibility: Visibility;
  expiresAt?: string;
  burnAfterRead: boolean;
  passwordLocked: boolean;
  forkOfId?: string;
  forkCount?: number;
  createdAt: string;
};

export type CreateSnippetInput = {
  title?: string;
  content: string;
  language?: string;
  visibility?: Visibility;
  ttl?: "" | "1h" | "1d" | "1w" | "30d";
  burnAfterRead?: boolean;
  password?: string;
  isEncrypted?: boolean;
};

export async function forkSnippet(id: string): Promise<Snippet> {
  return jsonOrThrow(
    await fetch(`${API}/api/v1/snippets/${id}/fork`, { method: "POST" })
  );
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.code || "error", body.error || res.statusText);
  }
  return res.json();
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export async function listSnippets(): Promise<Snippet[]> {
  return jsonOrThrow(await fetch(`${API}/api/v1/snippets`, { cache: "no-store" }));
}

export async function getSnippet(id: string): Promise<Snippet> {
  return jsonOrThrow(await fetch(`${API}/api/v1/snippets/${id}`, { cache: "no-store" }));
}

export async function verifySnippet(id: string, password: string): Promise<Snippet> {
  return jsonOrThrow(
    await fetch(`${API}/api/v1/snippets/${id}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    })
  );
}

export async function createSnippet(input: CreateSnippetInput): Promise<Snippet> {
  return jsonOrThrow(
    await fetch(`${API}/api/v1/snippets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}

export function apiBase() {
  return API;
}


