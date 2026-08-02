import { roadworks } from "@/lib/roadworks";

export async function GET() {
  try {
    return new Response(await roadworks(), {
      headers: {
        "content-type": "application/geo+json",
        "cache-control": "public, max-age=900",
      },
    });
  } catch {
    return Response.json(
      { error: "roadworks unavailable — Stadt Wien did not answer" },
      { status: 503 },
    );
  }
}
