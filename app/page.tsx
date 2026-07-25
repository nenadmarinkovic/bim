import { Map } from "@/components/map";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <div className="relative h-full w-full">
      <Map />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-6">
        <div className="pointer-events-auto">
          <h1 className="text-2xl leading-none tracking-tight text-foreground">
            bim
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Wiener Linien, <em className="text-brand italic">live</em>
          </p>
        </div>
        <ThemeToggle className="pointer-events-auto" />
      </header>
    </div>
  );
}
