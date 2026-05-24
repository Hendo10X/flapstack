"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { setProToken } from "@/lib/api";

export default function CheckoutSuccessPage() {
  const params = useSearchParams();
  const [stored, setStored] = useState(false);

  useEffect(() => {
    const token = params.get("token");
    if (token) {
      setProToken(token);
      setStored(true);
    }
  }, [params]);

  return (
    <main className="mx-auto grid min-h-[60vh] max-w-md place-items-center px-6">
      <Card className="w-full">
        <CardContent className="space-y-4 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-primary/10">
            <CheckCircle2 className="size-6 text-primary" />
          </div>
          <h1 className="font-display text-2xl font-semibold">
            You&apos;re on FlapStack Pro
          </h1>
          <p className="text-sm text-muted-foreground">
            {stored
              ? "Your Pro access has been linked to this browser. Unlimited AI is now active."
              : "We couldn't find a token in the URL. If you don't see Pro features, contact support."}
          </p>
          <Button asChild className="w-full">
            <Link href="/">
              <Sparkles />
              Back to FlapStack
            </Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
