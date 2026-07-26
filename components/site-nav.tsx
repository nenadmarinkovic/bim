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

/** Header nav: plain foreground, not brand — it sits beside the wordmark. */
const NAV_LINK =
  "cursor-pointer text-sm font-medium text-foreground transition-opacity hover:opacity-70";

/**
 * Fields need their own surface. shadcn's Input is `bg-transparent`, which on a
 * translucent dialog lets the map show straight through the box — `--field` is
 * the palette's token for exactly this: white in light, navy in dark.
 */
const FIELD = "bg-field dark:bg-field";

/** Field labels sit a step below body text so the input itself leads. */
const FIELD_LABEL = "text-xs";

/** Links inside dialogs, where an accent reads as an action rather than as chrome. */
const LINK =
  "cursor-pointer text-brand font-medium underline-offset-4 transition-opacity hover:opacity-70";

/** Same material as the control panels, a touch more opaque for body text. */
const SHEET = "glass-sheet gap-5 p-6";

/** The footer bleeds to the sheet edge, so its negative margins track the padding. */
const FOOTER = "-mx-6 -mb-6 bg-transparent p-6";

/** Mirrors the opacity tiers the map draws, so the legend cannot drift from it. */
const CERTAINTY = [
  {
    label: "Measured",
    opacity: "opacity-100",
    detail: "Just passed a stop that reported it",
  },
  {
    label: "Interpolated",
    opacity: "opacity-70",
    detail: "Live data, but between reporting stops",
  },
  {
    label: "Scheduled",
    opacity: "opacity-40",
    detail: "No live data — timetable only",
  },
];

export function SiteNav({ className }: { className?: string }) {
  return (
    <nav className={cn("flex shrink-0 items-center gap-3", className)}>
      <Dialog>
        <DialogTrigger className={NAV_LINK}>About</DialogTrigger>
        <DialogContent className={cn(SHEET, "sm:max-w-md")}>
          <DialogHeader>
            <div className="grid gap-1">
              <DialogTitle className="text-xl font-semibold">Bim</DialogTitle>
              <p className="text-xs text-foreground/50">Wiener Linien, live</p>
            </div>
            <DialogDescription>
              Wiener Linien publishes no vehicle positions. Every tram, bus and
              U-Bahn here is placed by taking its timetable, bending it by the
              delay reported at nearby stops, and sliding it along the real
              track geometry.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-foreground/10 bg-foreground/3 p-4">
            <p className="mb-3 text-xs font-medium tracking-wide text-foreground/50 uppercase">
              How much to trust a vehicle
            </p>
            <ul className="grid gap-2.5">
              {CERTAINTY.map((tier) => (
                <li key={tier.label} className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className={cn(
                      "size-2.5 shrink-0 rounded-full bg-brand",
                      tier.opacity,
                    )}
                  />
                  <span className="text-sm font-medium text-foreground">
                    {tier.label}
                  </span>
                  <span className="ml-auto text-right text-xs text-foreground/55">
                    {tier.detail}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-foreground/50">
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
