"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useDict } from "./locale-provider";
import { cn } from "@/lib/utils";

const NAV_LINK =
  "cursor-pointer text-sm font-medium text-foreground transition-opacity hover:opacity-70";

const LINK =
  "cursor-pointer text-brand font-medium underline-offset-4 transition-opacity hover:opacity-70";

const SHEET = "glass-sheet gap-5 p-6";

const FOOTER = "-mx-6 -mb-6 bg-transparent p-6";

export function SiteNav({ className }: { className?: string }) {
  const dict = useDict();

  return (
    <nav className={cn("flex shrink-0 items-center gap-3", className)}>
      <Dialog>
        <DialogTrigger className={NAV_LINK}>{dict.nav.about}</DialogTrigger>
        <DialogContent className={cn(SHEET, "sm:max-w-md")}>
          <DialogHeader>
            <div className="grid gap-1">
              <DialogTitle className="text-xl font-semibold">
                {dict.about.title}
              </DialogTitle>
              <p className="text-sm font-medium text-foreground">
                {dict.about.subtitle}
              </p>
            </div>
            <DialogDescription className="text-foreground">
              {dict.about.lead}
            </DialogDescription>
          </DialogHeader>

          <p className="text-sm text-foreground">{dict.about.purpose}</p>

          <div className="rounded-xl border border-foreground/10 bg-foreground/3 p-4">
            <p className="mb-2 text-sm font-medium tracking-wide text-foreground uppercase">
              {dict.about.trustTitle}
            </p>
            <p className="text-sm text-foreground">{dict.about.trustBody}</p>
          </div>

          <p className="text-sm text-foreground">{dict.about.accuracy}</p>

          <div className="grid gap-2 border-t border-foreground/10 pt-4">
            <p className="text-sm text-foreground/70">{dict.about.dataNote}</p>
            <p className="text-sm text-foreground">
              <a
                href="https://github.com/nenadmarinkovic/bim"
                target="_blank"
                rel="noreferrer noopener"
                className={LINK}
              >
                {dict.about.openSource}
              </a>{" "}
              {dict.about.projectBy}{" "}
              <a
                href="https://nenadmarinkovic.com"
                target="_blank"
                rel="noreferrer noopener"
                className={LINK}
              >
                Nenad Marinković
              </a>
              .
            </p>
          </div>

          <DialogFooter showCloseButton className={FOOTER} />
        </DialogContent>
      </Dialog>
    </nav>
  );
}
