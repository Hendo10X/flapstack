"use client";

import { Sparkles, Zap, Infinity as InfinityIcon, ShieldCheck } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const FEATURES = [
  { icon: InfinityIcon, label: "Unlimited AI explain" },
  { icon: Zap, label: "Priority Groq inference" },
  { icon: ShieldCheck, label: "Longer expirations and bigger snippets" },
];

export function Paywall({ open, onOpenChange }: Props) {
  const checkoutUrl = process.env.NEXT_PUBLIC_POLAR_CHECKOUT_URL || "#";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="grid size-9 place-items-center rounded-md bg-primary/10">
              <Sparkles className="size-5 text-primary" />
            </div>
            <DialogTitle className="font-display text-xl">
              You&apos;ve hit your free AI limit
            </DialogTitle>
          </div>
          <DialogDescription>
            You get 5 free AI explanations per month. Upgrade to FlapStack Pro
            to keep going.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 py-2">
          {FEATURES.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-3 text-sm">
              <Icon className="size-4 text-primary" />
              {label}
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Maybe later
          </Button>
          <Button asChild>
            <a href={checkoutUrl} target="_blank" rel="noopener noreferrer">
              <Sparkles />
              Upgrade with Polar
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
