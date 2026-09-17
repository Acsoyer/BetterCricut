/** Replace references once: a new ID must never be rewritten as an old ID. */
export function remapSvgReference(value: string, ids: ReadonlyMap<string, string>) {
  if (value.startsWith('#') && ids.has(value.slice(1))) return `#${ids.get(value.slice(1))}`;
  return value.replace(/url\(\s*(['"]?)#([^\s)'"\u0028]+)\1\s*\)/g,
    (original, _quote, id: string) => ids.has(id) ? `url(#${ids.get(id)})` : original);
}
