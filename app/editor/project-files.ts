import type { SupabaseClient } from "@supabase/supabase-js";

export const PROJECT_BUCKET = "project-assets";
const prefix = "storage://";
const sourceCache = new Map<string, string>();
function cacheSource(path: string, source: string) {
  if (source.length > 4000000) return;
  sourceCache.delete(path);
  while (sourceCache.size >= 12 || [...sourceCache.values()].reduce((sum, item) => sum + item.length, 0) + source.length > 16000000) {
    const oldest = sourceCache.keys().next().value;
    if (!oldest) break;
    sourceCache.delete(oldest);
  }
  sourceCache.set(path, source);
}

export async function imageBlob(source: string): Promise<Blob> {
  const match = /^data:([^;,]+)(;base64)?,([\s\S]*)$/.exec(source);
  if (!match || !match[1].startsWith("image/")) throw new Error("Unsupported project image data");
  if (!match[2]) return new Blob([decodeURIComponent(match[3])], { type: match[1] });
  const bytes = Uint8Array.from(atob(match[3]), char => char.charCodeAt(0));
  return new Blob([bytes], { type: match[1] });
}

export function blobSource(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("A project image could not be read"));
    reader.readAsDataURL(blob);
  });
}

export async function storeProjectAssets(client: SupabaseClient, userId: string, projectId: string, assets: Record<string, string>, maximumBytes = Infinity) {
  let plannedBytes = 0;
  for (const source of Object.values(assets)) plannedBytes += (await imageBlob(source)).size;
  if (plannedBytes > maximumBytes) throw new Error("40 MB storage limit reached. No image files were uploaded.");
  const stored: Record<string, string> = {};
  const seenPaths = new Set<string>();
  let bytes = 0;
  // Sequential uploads avoid a burst of requests and keep peak memory bounded.
  for (const [id, source] of Object.entries(assets)) {
    const blob = await imageBlob(source);
    const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
    const hash = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, "0")).join("");
    const path = `${userId}/${projectId}/${hash}`;
    if (!seenPaths.has(path)) { bytes += blob.size; seenPaths.add(path); }
    const { error: claimError } = await client.from("project_asset_claims").upsert({ path, user_id: userId, expires_at: new Date(Date.now() + 3600000).toISOString() });
    if (claimError) throw new Error(`Project upload could not be protected: ${claimError.message}`);
    const { data: present, error: checkError } = await client.storage.from(PROJECT_BUCKET).list(`${userId}/${projectId}`, { search: hash, limit: 1 });
    if (checkError) throw new Error(`Project file storage is unavailable: ${checkError.message}`);
    if (!present?.some(file => file.name === hash)) {
      const { error } = await client.storage.from(PROJECT_BUCKET).upload(path, blob, { contentType: blob.type, upsert: false });
      if (error && !/already exists|duplicate/i.test(error.message)) throw new Error(`Project image upload failed: ${error.message}`);
    }
    stored[id] = prefix + path;
    cacheSource(path, source);
  }
  return { assets: stored, bytes };
}

export async function loadProjectAssets(client: SupabaseClient, userId: string, assets: Record<string, string> = {}) {
  const loaded: Record<string, string> = {};
  for (const [id, source] of Object.entries(assets)) {
    if (!source.startsWith(prefix)) { loaded[id] = source; continue; }
    const path = source.slice(prefix.length);
    if (!path.startsWith(`${userId}/`) || path.includes("..")) throw new Error("Invalid saved project image path");
    let result = sourceCache.get(path);
    if (!result) {
      const { data, error } = await client.storage.from(PROJECT_BUCKET).download(path);
      if (error || !data) throw new Error(`Saved project image could not be loaded: ${error?.message || "missing file"}`);
      result = await blobSource(data);
      cacheSource(path, result);
    }
    loaded[id] = result;
  }
  return loaded;
}

// RLS additionally prevents deleting a file referenced by any saved project.
// A 24-hour grace period protects uploads from other tabs and interrupted saves.
export async function cleanProjectFiles(client: SupabaseClient, userId: string, projectId: string) {
  const { data: projects, error: indexError } = await client.from("projects").select("assets:data->assets").eq("user_id", userId);
  if (indexError) return;
  const live = new Set((projects || []).flatMap(project => Object.values(project.assets || {})).filter((value): value is string => typeof value === "string"));
  const folder = `${userId}/${projectId}`;
  let offset = 0;
  const candidates: string[] = [];
  for (;;) {
    const { data, error } = await client.storage.from(PROJECT_BUCKET).list(folder, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
    if (error) return;
    for (const file of data || []) {
      if (file.id && file.created_at && Date.parse(file.created_at) < Date.now() - 86400000 && !live.has(prefix + `${folder}/${file.name}`)) candidates.push(`${folder}/${file.name}`);
    }
    if (!data || data.length < 100) break;
    offset += data.length;
  }
  for (const path of candidates) await client.storage.from(PROJECT_BUCKET).remove([path]);
}

const lastCleanup = new Map<string, number>();
export async function cleanUserProjectFiles(client: SupabaseClient, userId: string) {
  if (Date.now() - (lastCleanup.get(userId) || 0) < 3600000) return;
  lastCleanup.set(userId, Date.now());
  await client.from("project_asset_claims").delete().eq("user_id", userId).lt("expires_at", new Date().toISOString());
  let offset = 0;
  for (;;) {
    const { data, error } = await client.storage.from(PROJECT_BUCKET).list(userId, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
    if (error) return;
    for (const folder of data || []) if (!folder.id && /^[a-f0-9-]{36}$/.test(folder.name)) await cleanProjectFiles(client, userId, folder.name);
    if (!data || data.length < 100) break;
    offset += data.length;
  }
}
