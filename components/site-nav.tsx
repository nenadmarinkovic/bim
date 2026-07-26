"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const NAV_LINK =
  "cursor-pointer text-sm font-medium text-foreground transition-opacity hover:opacity-70";

const FIELD = "bg-field dark:bg-field";

const FIELD_LABEL = "text-xs";

const LINK =
  "cursor-pointer text-brand font-medium underline-offset-4 transition-opacity hover:opacity-70";

const SHEET = "glass-sheet gap-5 p-6";

const FOOTER = "-mx-6 -mb-6 bg-transparent p-6";

export function SiteNav({ className }: { className?: string }) {
  return (
    <nav className={cn("flex shrink-0 items-center gap-3", className)}>
      <Dialog>
        <DialogTrigger className={NAV_LINK}>About</DialogTrigger>
        <DialogContent className={cn(SHEET, "sm:max-w-md")}>
          <DialogHeader>
            <div className="grid gap-1">
              <DialogTitle className="text-xl font-semibold">Bim</DialogTitle>
              <p className="text-xs text-foreground">Wiener Linien, live</p>
            </div>
            <DialogDescription className="text-foreground">
              Wiener Linien publishes no vehicle positions. Every tram, bus and
              U-Bahn here is placed by taking its timetable, bending it by the
              delay reported at nearby stops, and sliding it along the real
              track geometry.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-foreground/10 bg-foreground/3 p-4">
            <p className="mb-2 text-xs font-medium tracking-wide text-foreground uppercase">
              How much to trust a vehicle
            </p>
            <p className="text-xs text-foreground">
              It varies — Wiener Linien only measures departures at part of the
              network. Click any vehicle to see whether its position was just
              measured at a stop, interpolated between reporting stops, or is
              running on the timetable alone.
            </p>
          </div>

          <p className="text-xs text-foreground">
            Positions are accurate to roughly one stop-to-stop segment — near
            exact on the U-Bahn, looser for a tram in traffic.
          </p>

          <DialogFooter showCloseButton className={FOOTER} />
        </DialogContent>
      </Dialog>

      <span className="h-4 w-px bg-foreground/20" />

      <Dialog>
        <DialogTrigger className={NAV_LINK}>Login</DialogTrigger>
        <DialogContent className={cn(SHEET, "sm:max-w-sm")}>
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Log in</DialogTitle>
            <DialogDescription>
              Accounts are not wired up yet — this form does nothing so far.
            </DialogDescription>
          </DialogHeader>

          <form
            className="grid gap-4"
            onSubmit={(event) => event.preventDefault()}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="login-email" className={FIELD_LABEL}>
                Email
              </Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className={cn(FIELD, "placeholder:text-xs")}
              />
            </div>

            <div className="grid gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="login-password" className={FIELD_LABEL}>
                  Password
                </Label>
                <button type="button" className={cn(LINK, "text-xs")}>
                  Forgot?
                </button>
              </div>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                className={FIELD}
              />
            </div>

            <Label
              htmlFor="login-remember"
              className="gap-2.5 text-sm font-normal text-foreground/80"
            >
              <Checkbox id="login-remember" defaultChecked />
              Remember me
            </Label>

            <Button type="submit" className="mt-0.5 w-full">
              Continue
            </Button>
          </form>

          <DialogFooter
            className={cn(FOOTER, "justify-center sm:justify-center")}
          >
            <p className="text-xs text-foreground/60">
              No account yet?{" "}
              <button type="button" className={cn(LINK, "text-xs")}>
                Create one
              </button>
            </p>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </nav>
  );
}
