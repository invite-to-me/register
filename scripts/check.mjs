// checks a pull request against the rules.
//
// in ci (see .github/workflows/check.yml) this file comes from the base
// branch, never from the pr, and runs inside the pr's checkout:
//   BASE_SHA, HEAD_SHA, PR_AUTHOR_LOGIN, PR_AUTHOR_ID, MAINTAINERS, API_URL
//
// locally, `node scripts/check.mjs` only checks that every file parses,
// so you can catch typos before opening a pr.

import { readFileSync } from "node:fs";
import { annotate, API_URL, git, nameFromPath, parseJson, postJson, readAllDomainFiles, summary } from "./lib.mjs";

const inCi = Boolean(process.env.BASE_SHA);
const errors = [];
const fail = (message, file) => errors.push({ message, file });

if (!inCi) {
  for (const file of readAllDomainFiles()) {
    const parsed = parseJson(file.text);
    if (parsed.error) fail(parsed.error, file.path);
  }
  finish("local check");
}

const { BASE_SHA, HEAD_SHA = "HEAD", PR_AUTHOR_LOGIN = "", PR_AUTHOR_ID = "" } = process.env;
const maintainers = (process.env.MAINTAINERS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
const isMaintainer = maintainers.includes(PR_AUTHOR_LOGIN.toLowerCase());

// what the pr changes, renames split into delete + add
const diff = git("diff", "--name-status", "--no-renames", `${BASE_SHA}...${HEAD_SHA}`)
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((line) => {
    const [status, path] = line.split("\t");
    return { status: status[0], path };
  });

const changes = [];
for (const { status, path } of diff) {
  const name = nameFromPath(path);
  if (!name) {
    if (!isMaintainer) fail("only files in domains/ can be changed in a pr (domains/<name>.json)", path);
    continue;
  }

  // the owner in the base version decides who may edit or remove a file
  if (status !== "A") {
    const before = parseJson(git("show", `${BASE_SHA}:${path}`));
    const owner = before.value?.owner?.github;
    if (!isMaintainer && owner && owner.toLowerCase() !== PR_AUTHOR_LOGIN.toLowerCase()) {
      fail(`only ${owner} can change or remove this name`, path);
      continue;
    }
  }

  if (status === "D") {
    changes.push({ name, content: null });
    continue;
  }

  const parsed = parseJson(readFileSync(path, "utf8"));
  if (parsed.error) {
    fail(parsed.error, path);
    continue;
  }
  changes.push({ name, content: parsed.value });
}

if (changes.length === 0 && errors.length === 0) {
  if (!isMaintainer) fail("this pr doesn't add, change or remove any domains/<name>.json file");
  finish("no domain changes");
}

if (changes.length > 0) {
  const res = await postJson(`${API_URL}/api/registry/validate`, {
    author: { login: PR_AUTHOR_LOGIN, id: PR_AUTHOR_ID },
    changes,
  }).catch((err) => ({ ok: false, status: 0, text: err.message }));

  if (!res.ok || !res.data) {
    fail(`couldn't reach ${API_URL} (${res.status || "network"}): ${res.data?.error?.message ?? res.text?.slice(0, 200)}. a maintainer will rerun the check`);
  } else {
    for (const e of res.data.errors ?? []) {
      fail(e.message, e.name ? `domains/${e.name}.json` : undefined);
    }
  }
}

finish(`checked ${changes.length} file(s) for @${PR_AUTHOR_LOGIN}`);

function finish(label) {
  if (errors.length === 0) {
    console.log(`ok: ${label}`);
    summary(`### all good\n${label}. a maintainer will review and merge.`);
    process.exit(0);
  }
  for (const e of errors) annotate("error", e.message, e.file);
  summary(
    `### ${errors.length} thing(s) to fix\n` +
      errors.map((e) => `- ${e.file ? `\`${e.file}\`: ` : ""}${e.message}`).join("\n"),
  );
  process.exit(1);
}
