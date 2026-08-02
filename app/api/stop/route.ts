import { cachedBoard, loadBoard, station } from "@/lib/vehicles/board";
import { MissingArtifactError } from "@/lib/vehicles/schedule";
import { clientKey, retryAfter } from "@/lib/places/rate-limit";

const BOARDS_PER_MINUTE = 90;

const send = (board: unknown) =>
  Response.json(board, { headers: { "cache-control": "no-store" } });

export async function GET(request: Request) {
  const id = Number(new URL(request.url).searchParams.get("id"));

  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "id must be a station id" }, { status: 400 });
  }

  let target;
  try {
    target = await station(id);
  } catch (error) {
    if (error instanceof MissingArtifactError) {
      return Response.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }

  if (!target) {
    return Response.json({ error: "unknown station" }, { status: 404 });
  }

  const known = cachedBoard(id);
  if (known) return send(await known);

  const wait = retryAfter("stop", clientKey(request), BOARDS_PER_MINUTE);
  if (wait) {
    return Response.json(
      { error: "too many requests" },
      { status: 429, headers: { "retry-after": String(wait) } },
    );
  }

  try {
    return send(await loadBoard(target));
  } catch {
    return Response.json({ error: "monitor unavailable" }, { status: 502 });
  }
}
