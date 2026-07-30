"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDict, useLocale } from "./locale-provider";
import { cn } from "@/lib/utils";

type State = "idle" | "sending" | "sent" | "error";

const FIELD = "bg-field dark:bg-field";

export function ContactForm({ className }: { className?: string }) {
  const dict = useDict();
  const { locale } = useLocale();

  const [state, setState] = useState<State>("idle");
  const [problem, setProblem] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "sending") return;

    const form = new FormData(event.currentTarget);
    setState("sending");
    setProblem(null);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          message: form.get("message"),
          website: form.get("website"),
          locale,
        }),
      });

      if (response.ok) {
        setState("sent");
        return;
      }

      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      const errors = dict.contact.errors;
      const known: Record<string, string> = {
        email: errors.email,
        message: errors.message,
        rate: errors.rate,
        unconfigured: errors.unconfigured,
      };
      setProblem(known[body?.error ?? ""] ?? errors.failed);
      setState("error");
    } catch {
      setProblem(dict.contact.errors.failed);
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <p className={cn("text-sm text-foreground", className)}>
        {dict.contact.sent}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className={cn("grid gap-3", className)}>
      <div className="grid gap-1.5">
        <Label htmlFor="contact-email" className="text-sm">
          {dict.contact.email}
        </Label>
        <Input
          id="contact-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder={dict.contact.emailPlaceholder}
          className={FIELD}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="contact-message" className="text-sm">
          {dict.contact.message}
        </Label>
        <Textarea
          id="contact-message"
          name="message"
          required
          minLength={10}
          maxLength={2000}
          rows={4}
          placeholder={dict.contact.messagePlaceholder}
          className={cn(FIELD, "max-h-48 min-h-24 resize-none text-sm")}
        />
      </div>

      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="pointer-events-none absolute left-[-9999px] h-0 w-0 opacity-0"
      />

      {problem && (
        <p role="alert" className="text-xs text-destructive">
          {problem}
        </p>
      )}

      <Button
        type="submit"
        disabled={state === "sending"}
        className="justify-self-start"
      >
        {state === "sending" ? dict.contact.sending : dict.contact.send}
      </Button>
    </form>
  );
}
