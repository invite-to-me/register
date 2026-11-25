// shared helpers for the check and sync scripts. node 20+, no dependencies.

import { execFileSync } from "node:child_process";
import { appendFileSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

export const DOMAINS_DIR = "domains";
export const API_URL = (process.env.API_URL || "https://invite-to.me").replace(/\/$/, "");

export function git(...args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

/** "domains/mybot.json" -> "mybot", or null if it isn't a domain file path */
export function nameFromPath(path) {
  const m = /^domains\/([^/]+)\.json$/.exec(path);
  return m ? m[1] : null;
}

/** parses json, returning { value } or { error } */
export function parseJson(text) {
  try {
    return { value: JSON.parse(text) };
  } catch (err) {
    return { error: `not valid json: ${err.message}` };
  }
}

/** every domain file in the working tree: [{ name, path, text }] */
export function readAllDomainFiles(root = ".") {
  const dir = join(root, DOMAINS_DIR);
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => ({ name: basename(f, ".json"), path: `${DOMAINS_DIR}/${f}`, text: readFileSync(join(dir, f), "utf8") }));
}

export async function postJson(url, body, headers = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    // keep data null, caller shows the raw text
  }
  return { status: res.status, ok: res.ok, data, text };
}

/** github actions annotation + plain log line */
export function annotate(level, message, file) {
  const where = file ? ` file=${file}` : "";
  const safe = String(message).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
  if (process.env.GITHUB_ACTIONS) console.log(`::${level}${where}::${safe}`);
  else console.log(`${level}: ${file ? `${file}: ` : ""}${message}`);
}

/** markdown for the job summary page in github actions */
export function summary(markdown) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (file) appendFileSync(file, `${markdown}\n`);
}
