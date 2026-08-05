import { promisify } from "node:util";
import { brotliCompress, constants, gzip } from "node:zlib";

const gzipAsync = promisify(gzip);
const brotliAsync = promisify(brotliCompress);

export type Encoding = "br" | "gzip";

type Effort = "fast" | "best";

const GZIP_LEVEL: Record<Effort, number> = { fast: 1, best: 6 };
const BROTLI_QUALITY: Record<Effort, number> = { fast: 2, best: 5 };

export function negotiate(
  request: Request,
  prefer: Encoding = "br",
): Encoding | null {
  const header = request.headers.get("accept-encoding");
  if (!header) return null;

  const offered = new Set(
    header
      .toLowerCase()
      .split(",")
      .map((part) => part.split(";")[0]!.trim())
      .filter(Boolean),
  );

  const order: Encoding[] = prefer === "gzip" ? ["gzip", "br"] : ["br", "gzip"];
  return order.find((encoding) => offered.has(encoding)) ?? null;
}

export type Packed = Uint8Array<ArrayBuffer>;

const asBody = (buf: Buffer): Packed =>
  new Uint8Array(buf.buffer as ArrayBuffer, buf.byteOffset, buf.byteLength);

export async function compress(
  body: string | Uint8Array,
  encoding: Encoding,
  effort: Effort = "fast",
): Promise<Packed> {
  if (encoding === "gzip") {
    return asBody(await gzipAsync(body, { level: GZIP_LEVEL[effort] }));
  }
  return asBody(
    await brotliAsync(body, {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY[effort],
        [constants.BROTLI_PARAM_SIZE_HINT]: body.length,
      },
    }),
  );
}

function respond(
  body: string | Packed,
  headers: Record<string, string>,
  encoding: Encoding | null,
): Response {
  return new Response(body, {
    headers: {
      ...headers,
      ...(encoding ? { "content-encoding": encoding } : {}),
      vary: "accept-encoding",
    },
  });
}

export async function encoded(
  request: Request,
  body: string,
  headers: Record<string, string>,
): Promise<Response> {
  const encoding = negotiate(request, "gzip");
  if (!encoding) return respond(body, headers, null);
  return respond(await compress(body, encoding, "fast"), headers, encoding);
}

export function staticBody(headers: Record<string, string>) {
  const packed = new Map<Encoding, Packed>();
  const packing = new Map<Encoding, Promise<Packed>>();

  return async function send(
    request: Request,
    body: string,
  ): Promise<Response> {
    const encoding = negotiate(request);
    if (!encoding) return respond(body, headers, null);

    const ready = packed.get(encoding);
    if (ready) return respond(ready, headers, encoding);

    let job = packing.get(encoding);
    if (!job) {
      job = compress(body, encoding, "best").then((out) => {
        packed.set(encoding, out);
        packing.delete(encoding);
        return out;
      });
      packing.set(encoding, job);
    }

    return respond(await job, headers, encoding);
  };
}
