import { Logo } from "@/components/logo";
import { MapView } from "@/components/map";
import { ThemeToggle } from "@/components/theme-toggle";
import { VehicleCount } from "@/components/vehicle-count";

export default function Home() {
  return (
    <div className="relative h-full w-full">
      <MapView />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-6">
        <div className="pointer-events-auto">
          <h1 className="flex items-center gap-2.5 text-2xl leading-none tracking-tight text-foreground">
            <Logo className="h-3.75 w-auto" />
            Bim
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Wiener Linien, <em className="text-brand italic">live</em>
          </p>
          <VehicleCount className="mt-0.5 text-sm text-muted-foreground" />
        </div>
        <ThemeToggle className="pointer-events-auto" />
      </header>
    </div>
  );
}
