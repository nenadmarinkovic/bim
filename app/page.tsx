import { Logo } from "@/components/logo";
import { MapView } from "@/components/map";
import { SiteNav } from "@/components/site-nav";
import { VehicleCount } from "@/components/vehicle-count";

export default function Home() {
  return (
    <div className="relative h-full w-full">
      <MapView />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-center gap-2 px-4 pt-4">
        <div className="glass pointer-events-auto flex max-w-full items-center gap-3 rounded-full px-4 py-2">
          <h1 className="flex shrink-0 items-center gap-2.5 text-lg font-bold tracking-tight text-foreground">
            <Logo className="h-3 w-auto shrink-0" />
            Bim
          </h1>
          <span className="h-5 w-px shrink-0 bg-foreground/20" />
          <span className="shrink-0 text-sm font-medium text-foreground">
            Live transit map for Vienna
          </span>
          <span className="h-5 w-px shrink-0 bg-foreground/20" />
          <SiteNav />
        </div>

        <VehicleCount className="glass pointer-events-auto rounded-full px-3 py-1 text-xs font-medium text-foreground" />
      </header>
    </div>
  );
}
