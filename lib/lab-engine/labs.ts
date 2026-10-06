import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { labSchema, type LoadedLab } from "./lab-schema";

const LAB_ID = /^[a-z0-9-]+$/;

/** Reads labs/<id>/lab.yaml and its briefing. The folder name must equal the lab id. */
export async function loadLab(id: string, root = "labs"): Promise<LoadedLab> {
  if (!LAB_ID.test(id)) throw new Error(`invalid lab id ${JSON.stringify(id)}`);
  const folder = path.join(root, id);
  const file = path.join(folder, "lab.yaml");
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") throw new Error(`unknown lab ${id} (no ${file})`);
    throw err;
  }
  const parsed = labSchema.safeParse(parseYaml(raw));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`${file}: ${issue.path.join(".") || "lab"} — ${issue.message}`);
  }
  if (parsed.data.id !== id) throw new Error(`${file}: folder is ${id} but id is ${parsed.data.id}`);
  const briefingText = await fs.readFile(path.join(folder, parsed.data.briefing), "utf8");
  return { ...parsed.data, briefingText };
}

export async function listLabs(root = "labs"): Promise<LoadedLab[]> {
  let names: string[];
  try {
    names = (await fs.readdir(root, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const results = await Promise.allSettled(names.sort().map((n) => loadLab(n, root)));
  const errors = results.flatMap((r) => (r.status === "rejected" ? [String((r.reason as Error).message)] : []));
  if (errors.length) throw new Error(errors.join("\n"));
  return results.map((r) => (r as PromiseFulfilledResult<LoadedLab>).value);
}
