import { Logo } from "@/components/logo";
import { MapView } from "@/components/map";
import { ThemeToggle } from "@/components/theme-toggle";
import { VehicleCount } from "@/components/vehicle-count";

export default function Home() {
  return (
    <div className="relative h-full w-full">
      <MapView />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-center gap-2 px-4 pt-4">
        <div className="glass pointer-events-auto flex max-w-full items-center gap-3 rounded-full py-2 pr-2 pl-4">
          <h1 className="flex shrink-0 items-center gap-2.5 text-lg font-bold tracking-tight text-foreground">
            <Logo className="h-3 w-auto shrink-0" />
            Bim
          </h1>
          <span className="shrink-0 text-sm font-medium text-foreground">
            Wiener Linien Live Map
          </span>
          <span className="h-5 w-px shrink-0 bg-foreground/20" />
          <ThemeToggle className="shrink-0 border-transparent bg-transparent" />
        </div>

        <VehicleCount className="glass pointer-events-auto rounded-full px-3 py-1 text-xs font-medium text-foreground" />
      </header>
    </div>
  );
}
