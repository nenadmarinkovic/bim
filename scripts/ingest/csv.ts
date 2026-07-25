import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === delimiter) {
      out.push(field);
      field = "";
    } else field += char;
  }

  out.push(field);
  return out;
}

function stripBom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

export type CsvRow = Record<string, string>;

export async function* readCsv(
  path: string,
  delimiter = ",",
): AsyncGenerator<CsvRow> {
  const lines = createInterface({
    input: createReadStream(path),
    crlfDelay: Infinity,
  });

  let header: string[] | null = null;

  for await (const line of lines) {
    if (!line) continue;

    if (!header) {
      header = splitLine(stripBom(line), delimiter).map((h) => h.trim());
      continue;
    }

    const values = splitLine(line, delimiter);
    const row: CsvRow = {};
    for (let i = 0; i < header.length; i++) row[header[i]] = values[i] ?? "";
    yield row;
  }
}
