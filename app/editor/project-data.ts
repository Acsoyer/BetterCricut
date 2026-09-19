// Saving operates on a detached copy: the open editing session stays untouched.
export function compactProjectValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(compactProjectValue);
  if (!value || typeof value !== "object") return value;
  const copy = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, compactProjectValue(item)]));
  if (Array.isArray(copy.steps)) {
    const steps = copy.steps as Record<string, unknown>[];
    const removals = steps.map((step, index) => step.type === "remove-bg" ? index : -1).filter(index => index >= 0);
    if (removals.length > 1) {
      const active = typeof copy.activeStep === "number" ? copy.activeStep : steps.length - 1;
      const last = removals.filter(index => index <= active).at(-1) ?? removals.at(-1)!;
      const retained = steps.filter((step, index) => step.type !== "remove-bg" || index === last);
      const finalRemoval = retained.find(step => step === steps[last])!;
      finalRemoval.before = steps[removals[0]].before;
      finalRemoval.baked = true;
      delete finalRemoval.removalSettings;
      copy.activeStep = retained.filter(step => steps.indexOf(step) <= active).length - 1;
      copy.steps = retained;
    }
  }
  return copy;
}

export function packProjectLayers<T>(layers: T[]) {
  const assets: Record<string, string> = {};
  const ids = new Map<string, string>();
  function visit(value: unknown): unknown {
    if (typeof value === "string" && value.startsWith("data:image/")) {
      let id = ids.get(value);
      if (!id) { id = `asset-${ids.size + 1}`; ids.set(value, id); assets[id] = value; }
      return `asset://${id}`;
    }
    if (Array.isArray(value)) return value.map(visit);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, visit(item)]));
    return value;
  }
  return { layers: visit(compactProjectValue(layers)) as T[], assets };
}

export function unpackProjectLayers<T>(data: { layers?: T[]; assets?: Record<string, string> }): T[] {
  function visit(value: unknown): unknown {
    if (typeof value === "string" && value.startsWith("asset://")) {
      const asset = data.assets?.[value.slice(8)];
      if (!asset) throw new Error("A saved project image is missing. Original cloud data was not changed.");
      return asset;
    }
    if (Array.isArray(value)) return value.map(visit);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, visit(item)]));
    return value;
  }
  return visit(data.layers || []) as T[];
}

export function projectSaveError(message: string) {
  if (/STORAGE_LIMIT|40 MB/i.test(message)) return "Storage limit reached. Delete an old project or reduce its size, then retry.";
  if (/PROJECT_LIMIT/i.test(message)) return "Project limit reached. Delete an old project before creating a copy.";
  if (/jwt|session|token|permission|row.level/i.test(message)) return "Your session could not save this project. Sign in again; keep this editing tab open.";
  return `Project could not be saved: ${message || "Connection interrupted. Please retry; your work remains open."}`;
}
