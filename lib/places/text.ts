const CONTROL = new RegExp("[\\u0000-\\u001f\\u007f]", "g");

const QUOTES = new RegExp("[\"\\u201c\\u201d\\u201e]", "g");

const KIND = new RegExp("^\\p{L}[\\p{L} &'.-]*$", "u");

export const clean = (value: unknown, max: number) =>
  typeof value === "string"
    ? value.replace(CONTROL, " ").replace(/\s+/g, " ").trim().slice(0, max)
    : "";

export const cleanName = (value: unknown, max: number) =>
  clean(value, max).replace(QUOTES, "").trim();

export const cleanKind = (value: unknown, max: number) => {
  const kind = clean(value, max);
  return KIND.test(kind) ? kind : "";
};
