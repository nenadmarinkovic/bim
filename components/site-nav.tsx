"use client";

import type React from "react";
import {
  ArrowUpRightIcon,
  CursorClickIcon,
  DatabaseIcon,
  GaugeIcon,
  GithubLogoIcon,
  MapTrifoldIcon,
  PaperPlaneTiltIcon,
  PathIcon,
} from "@phosphor-icons/react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ContactForm } from "./contact-form";
import { useDict } from "./locale-provider";
import { cn } from "@/lib/utils";

const NAV_LINK =
  "cursor-pointer text-sm font-medium text-foreground transition-opacity hover:opacity-70";

const LINK =
  "cursor-pointer text-brand font-medium underline-offset-4 transition-opacity hover:opacity-70";

const SHEET =
  "glass-sheet flex max-h-[calc(100dvh-2rem)] flex-col gap-4 overflow-hidden p-4 sm:gap-5 sm:p-6";

const SHEET_BODY = "-mx-4 min-h-0 flex-1 sm:-mx-6";

const SHEET_VIEWPORT = "px-4 sm:px-6";

const FOOTER = "-mx-4 -mb-4 bg-transparent p-4 sm:-mx-6 sm:-mb-6 sm:p-6";

const CHIP =
  "flex size-6 shrink-0 items-center justify-center rounded-md bg-foreground/8 text-foreground";

const REPO = "https://github.com/nenadmarinkovic/bim";

const ISSUES = `${REPO}/issues`;

const SITE = "https://nenadmarinkovic.com";

const OSM_EDIT = "https://www.openstreetmap.org/edit#map=13/48.2082/16.3738";

function Panel({
  icon,
  title,
  children,
  action,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  action?: string;
  href?: string;
}) {
  return (
    <section className="grid gap-1.5">
      <div className="flex items-center gap-2">
        <span className={CHIP}>{icon}</span>
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
      </div>
      {children}
      {action && href && (
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className={cn(LINK, "inline-flex items-center gap-1 text-sm")}
        >
          {action}
          <ArrowUpRightIcon size={13} weight="bold" />
        </a>
      )}
    </section>
  );
}

const BODY = "text-sm text-foreground/80";

export function SiteNav({
  className,
  itemClassName,
}: {
  className?: string;
  itemClassName?: string;
}) {
  const dict = useDict();

  return (
    <nav className={cn("flex shrink-0 items-center gap-3", className)}>
      <Dialog>
        <DialogTrigger className={cn(NAV_LINK, itemClassName)}>
          {dict.nav.about}
        </DialogTrigger>
        <DialogContent className={cn(SHEET, "sm:max-w-2xl")}>
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              {dict.about.title}
            </DialogTitle>
            <DialogDescription className="text-sm font-medium text-foreground">
              {dict.about.subtitle}
            </DialogDescription>
            <p className="text-sm font-medium text-foreground">
              {dict.about.estimate}
            </p>
          </DialogHeader>

          <ScrollArea className={SHEET_BODY} viewportClassName={SHEET_VIEWPORT}>
            <div className="flex flex-col gap-5">
              <Panel
                icon={<PathIcon size={16} weight="bold" />}
                title={dict.about.howTitle}
              >
                <p className={BODY}>{dict.about.lead}</p>
                <p className={BODY}>{dict.about.accuracy}</p>
              </Panel>

              <Panel
                icon={<GaugeIcon size={16} weight="bold" />}
                title={dict.about.trustTitle}
              >
                <p className={BODY}>{dict.about.trustBody}</p>
                <p className={BODY}>{dict.about.trustSbahn}</p>
              </Panel>

              <Panel
                icon={<CursorClickIcon size={16} weight="bold" />}
                title={dict.about.exploreTitle}
              >
                <p className={BODY}>{dict.about.exploreBody}</p>
                <p className={BODY}>{dict.about.exploreLayers}</p>
              </Panel>

              <Panel
                icon={<DatabaseIcon size={16} weight="bold" />}
                title={dict.about.dataTitle}
              >
                <p className={BODY}>{dict.about.dataNote}</p>
                <p className={BODY}>{dict.about.purpose}</p>
              </Panel>

              <div className={cn(BODY, "grid gap-0.5 pt-1")}>
                <p>
                  <a
                    href={REPO}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={LINK}
                  >
                    {dict.about.openSource}
                  </a>{" "}
                  {dict.about.projectBy} Nenad Marinković.
                </p>
                <p>
                  {dict.about.moreInfo}{" "}
                  <a
                    href={SITE}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={LINK}
                  >
                    {SITE.replace("https://", "")}
                  </a>
                </p>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter showCloseButton className={FOOTER} />
        </DialogContent>
      </Dialog>

      <Dialog>
        <DialogTrigger className={cn(NAV_LINK, itemClassName)}>
          {dict.nav.contribute}
        </DialogTrigger>
        <DialogContent className={cn(SHEET, "sm:max-w-3xl")}>
          <DialogHeader>
            <div className="grid gap-1">
              <DialogTitle className="text-xl font-semibold">
                {dict.contribute.title}
              </DialogTitle>
              <p className="text-sm font-medium text-foreground">
                {dict.contribute.subtitle}
              </p>
            </div>
            <DialogDescription className="text-foreground">
              {dict.contribute.lead}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className={SHEET_BODY} viewportClassName={SHEET_VIEWPORT}>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="flex flex-col gap-5">
                <Panel
                  icon={<MapTrifoldIcon size={16} weight="bold" />}
                  title={dict.contribute.osmTitle}
                  action={dict.contribute.editOsm}
                  href={OSM_EDIT}
                >
                  <p className={BODY}>{dict.contribute.osmBody}</p>
                </Panel>
                <Panel
                  icon={<GithubLogoIcon size={16} weight="bold" />}
                  title={dict.contribute.codeTitle}
                  action={dict.contribute.openIssues}
                  href={ISSUES}
                >
                  <p className={BODY}>{dict.contribute.codeBody}</p>
                </Panel>
              </div>

              <div className="grid content-start gap-3 border-t border-foreground/10 pt-5 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6">
                <div className="flex items-center gap-2">
                  <span className={CHIP}>
                    <PaperPlaneTiltIcon size={16} weight="bold" />
                  </span>
                  <p className="text-sm font-medium text-foreground">
                    {dict.contribute.writeTitle}
                  </p>
                </div>

                <p className="text-sm text-foreground/80">
                  {dict.contribute.askBody}
                </p>

                <ContactForm className="mt-1" />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter showCloseButton className={FOOTER} />
        </DialogContent>
      </Dialog>
    </nav>
  );
}
