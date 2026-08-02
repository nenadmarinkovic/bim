"use client";

import { useEffect, useRef, useState } from "react";
import { PaperPlaneRightIcon, SparkleIcon } from "@phosphor-icons/react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useDict, useLocale } from "./locale-provider";
import { cn } from "@/lib/utils";

export type ChatPlace = { title: string; kind: string; summary: string };

type Turn = { role: "user" | "assistant"; content: string };

export function PlaceChat({
  place,
  onClose,
}: {
  place: ChatPlace | null;
  onClose: () => void;
}) {
  const { locale } = useLocale();
  const dict = useDict();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const thread = useRef<HTMLDivElement>(null);

  useEffect(() => {
    thread.current?.scrollTo({
      top: thread.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns, busy]);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy || !place) return;

    const next: Turn[] = [...turns, { role: "user", content: text }];
    setTurns(next);
    setDraft("");
    setError(null);
    setBusy(true);

    try {
      const response = await fetch("/api/place/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: place.title,
          kind: place.kind,
          summary: place.summary,
          lang: locale,
          messages: next,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "no answer");
      setTurns([...next, { role: "assistant", content: body.answer }]);
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message !== "no answer"
          ? cause.message
          : dict.chat.failed,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={Boolean(place)} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="glass-sheet flex max-h-[85dvh] flex-col gap-4 p-4 sm:max-w-lg sm:p-6">
        <DialogHeader className="gap-1">
          <DialogTitle className="text-xl font-semibold">
            {place?.title}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">{place?.kind}</p>
        </DialogHeader>

        <div
          ref={thread}
          className="-mx-1 flex min-h-32 flex-1 flex-col gap-3 overflow-y-auto px-1"
        >
          {place?.summary && (
            <p className="text-sm leading-relaxed text-foreground">
              {place.summary}
            </p>
          )}

          <p className="text-sm text-muted-foreground">{dict.chat.prompt}</p>

          {!turns.length && (
            <div className="flex flex-wrap gap-2">
              {dict.chat.openers.map((opener) => (
                <button
                  key={opener}
                  type="button"
                  onClick={() => ask(opener)}
                  className="cursor-pointer rounded-full border border-foreground/15 px-3 py-1 text-xs text-foreground transition-opacity hover:opacity-70"
                >
                  {opener}
                </button>
              ))}
            </div>
          )}

          {turns.map((turn, i) => (
            <p
              key={i}
              className={cn(
                "text-sm leading-relaxed",
                turn.role === "user"
                  ? "self-end rounded-2xl bg-foreground/10 px-3 py-2 text-foreground"
                  : "text-foreground",
              )}
            >
              {turn.content}
            </p>
          ))}

          {busy && (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <SparkleIcon size={14} weight="fill" className="animate-pulse" />
              {dict.chat.thinking}
            </p>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            ask(draft);
          }}
          className="relative"
        >
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                ask(draft);
              }
            }}
            rows={2}
            placeholder={dict.chat.placeholder}
            aria-label={dict.chat.ariaAsk}
            // The placeholder carries the same size as what gets typed over it;
            // a step smaller read as an afterthought.
            className="bg-field dark:bg-field max-h-32 min-h-18 resize-none rounded-xl pr-11 text-sm leading-relaxed placeholder:text-sm"
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            aria-label={dict.chat.send}
            className="absolute right-2 bottom-2 cursor-pointer rounded-md p-1.5 text-foreground transition-opacity hover:opacity-70 disabled:cursor-default disabled:opacity-30"
          >
            <PaperPlaneRightIcon size={16} />
          </button>
        </form>

        <p className="text-xs text-muted-foreground">{dict.chat.disclaimer}</p>
      </DialogContent>
    </Dialog>
  );
}
