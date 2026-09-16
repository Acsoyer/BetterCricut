export function savedProjectDisplayName(current: string, saved: string, autosave: boolean) {
  // A name typed while a background save is pending must not be overwritten.
  if (autosave && current !== "Untitled Project" && !/^Autosave(?:-| - )/.test(current)) return current;
  return saved;
}
