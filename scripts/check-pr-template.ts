/**
 * Validates that a pull request description follows the repository template.
 *
 * Run by the `PR template` workflow (`.github/workflows/pr-template.yml`) on
 * pull request events. It derives the required `##` section headings from
 * `.github/PULL_REQUEST_TEMPLATE.md`, drops the optional ones, and asserts each
 * remaining heading appears in the PR body read from `GITHUB_EVENT_PATH`.
 *
 * Local check against a saved event payload:
 * `GITHUB_EVENT_PATH=./event.json bun scripts/check-pr-template.ts`
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Sections that may legitimately be omitted from a PR description. */
const OPTIONAL_SECTIONS = new Set(["Screenshots / Recordings"]);

/** Minimal shape of the GitHub `pull_request` event payload that we read. */
interface PullRequestEvent {
  pull_request?: {
    body?: string | null;
  };
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Extracts the level-2 Markdown section headings from a document.
 *
 * @param markdown - Markdown source to scan.
 * @returns The heading texts, without the leading `##`.
 */
function sectionHeadings(markdown: string): string[] {
  return [...markdown.matchAll(/^##\s+(.+?)\s*$/gm)].map((match) =>
    match[1].trim(),
  );
}

/**
 * Escapes a string so it can be embedded in a regular expression.
 *
 * @param value - Raw string.
 * @returns The escaped string.
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const template = readFileSync(
  resolve(root, ".github/PULL_REQUEST_TEMPLATE.md"),
  "utf8",
);

const eventPath = process.env.GITHUB_EVENT_PATH;
const event: PullRequestEvent = eventPath
  ? (JSON.parse(readFileSync(eventPath, "utf8")) as PullRequestEvent)
  : {};

const body = event.pull_request?.body ?? "";

if (body.trim().length === 0) {
  console.error(
    "PR description is empty. Fill in .github/PULL_REQUEST_TEMPLATE.md.",
  );
  process.exit(1);
}

const requiredHeadings = sectionHeadings(template).filter(
  (heading) => !OPTIONAL_SECTIONS.has(heading),
);

const missingHeadings = requiredHeadings.filter(
  (heading) =>
    !new RegExp(`^##\\s+${escapeRegExp(heading)}\\s*$`, "m").test(body),
);

if (missingHeadings.length > 0) {
  console.error(
    `PR description is missing ${missingHeadings.length} required section(s) from ` +
      ".github/PULL_REQUEST_TEMPLATE.md:",
  );
  for (const heading of missingHeadings) {
    console.error(`  - ## ${heading}`);
  }
  process.exit(1);
}

console.log(
  `PR description contains all ${requiredHeadings.length} required template sections.`,
);
