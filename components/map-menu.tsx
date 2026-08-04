"use client";

import type React from "react";
import { ListIcon, MapTrifoldIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SiteNav } from "./site-nav";
import { useDict } from "./locale-provider";
import { cn } from "@/lib/utils";

// Everything the wide layout parks around the edges of the map — the settings
// card, the About and Contribute links — folds into this one sheet, because a
// phone screen is the map and nothing else.
export function MapMenu({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const dict = useDict();

  return (
    <Sheet>
      <SheetTrigger
        aria-label={dict.nav.menu}
        className={cn(
          "glass pointer-events-auto flex size-9 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-foreground/10 active:bg-foreground/15",
          className,
        )}
      >
        <ListIcon size={16} weight="bold" />
      </SheetTrigger>

      {/* Installed, the sheet runs the full height of the screen, so its own
          top edge is behind the Dynamic Island. The inset goes on the panel
          rather than on the header because an absolute child is placed against
          the padding edge — the close button clears the island for free. The
          width grows by the same amount it is padded, so the panel is the same
          size in the hand whichever way the phone is turned. */}
      <SheetContent
        side="right"
        className="glass-sheet w-[calc(min(21rem,100vw-2.5rem)+env(safe-area-inset-right))] gap-0 p-0 pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] sm:max-w-none"
      >
        <SheetHeader className="gap-1 border-b border-foreground/10 px-5 pt-5 pr-14 pb-4">
          <SheetTitle className="text-base font-semibold">
            {dict.nav.menu}
          </SheetTitle>
          <SheetDescription>{dict.nav.menuHint}</SheetDescription>
        </SheetHeader>

        <ScrollArea
          className="min-h-0 flex-1"
          viewportClassName="px-5 pt-1 pb-5"
        >
          {children}

          <Separator className="my-4" />

          <SiteNav
            className="flex-col items-stretch gap-1"
            itemClassName="-mx-2 flex min-h-12 w-full items-center rounded-lg px-2 text-left transition-colors hover:bg-foreground/5 hover:opacity-100 active:bg-foreground/10"
          />
        </ScrollArea>

        <SheetFooter className="border-t border-foreground/10 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <SheetClose
            render={<Button variant="secondary" size="lg" className="w-full" />}
          >
            <MapTrifoldIcon size={15} weight="bold" aria-hidden />
            {dict.nav.showMap}
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
