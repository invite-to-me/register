// sends every domain file to invite-to.me after a merge, so dns and redirects
// match the repo. runs in .github/workflows/sync.yml with:
//   API_URL, REGISTRY_SYNC_TOKEN, GITHUB_TOKEN (to look up owner ids)
//   FORCE=1 to allow a sync that removes a lot of names at once

import { annotate, API_URL, parseJson, postJson, readAllDomainFiles, summary } from "./lib.mjs";

const token = process.env.REGISTRY_SYNC_TOKEN;
if (!token) {
  annotate("error", "REGISTRY_SYNC_TOKEN secret is missing");
  process.exit(1);
}

const ids = new Map();
async function githubId(login) {
  const key = login.toLowerCase();
  if (ids.has(key)) return ids.get(key);
  const res = await fetch(`https://api.github.com/users/${encodeURIComponent(login)}`, {
    headers: {
      accept: "application/vnd.github+json",
      ...(process.env.GITHUB_TOKEN && { authorization: `Bearer ${process.env.GITHUB_TOKEN}` }),
    },
  });
  const id = res.ok ? String((await res.json()).id) : null;
  if (!id) annotate("warning", `couldn't find github user ${login} (${res.status})`);
  ids.set(key, id);
  return id;
}

const files = [];
for (const file of readAllDomainFiles()) {
  const parsed = parseJson(file.text);
  // broken files are still sent (as null) so the server keeps the name
  // instead of treating it as removed
  const content = parsed.error ? null : parsed.value;
  if (parsed.error) annotate("error", parsed.error, file.path);
  const login = content?.owner?.github;
  files.push({ name: file.name, content, githubId: typeof login === "string" ? await githubId(login) : null });
}

console.log(`syncing ${files.length} name(s) to ${API_URL}`);
const res = await postJson(
  `${API_URL}/api/registry/sync`,
  { files, force: process.env.FORCE === "1" },
  { authorization: `Bearer ${token}` },
).catch((err) => ({ ok: false, status: 0, text: err.message }));

if (!res.ok || !res.data) {
  annotate("error", `sync failed (${res.status || "network"}): ${res.data?.error?.message ?? res.text?.slice(0, 300)}`);
  process.exit(1);
}

const { created = [], updated = [], deleted = [], unchanged = 0, errors = [] } = res.data;
const line = (label, list) => (list.length ? `- ${label}: ${list.join(", ")}` : `- ${label}: none`);
summary(
  [
    "### sync",
    line("created", created),
    line("updated", updated),
    line("removed", deleted),
    `- unchanged: ${unchanged}`,
    ...(errors.length ? ["", "#### problems", ...errors.map((e) => `- \`${e.name}\`: ${e.message}`)] : []),
  ].join("\n"),
);
console.log(JSON.stringify({ created, updated, deleted, unchanged }, null, 2));

for (const e of errors) annotate("error", e.message, `domains/${e.name}.json`);
process.exit(errors.length ? 1 : 0);
