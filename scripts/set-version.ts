/**
 * Syncs the application version across the files that carry it.
 *
 * The release pipeline derives a version from the pushed git tag (`v0.1.0` ->
 * `0.1.0`) and runs this script before building, so the frontend bundle
 * (`package.json`), the Tauri bundle (`tauri.conf.json`) and the backend crate
 * (`Cargo.toml`) all report the same released version.
 *
 * Usage: `bun scripts/set-version.ts <version>`
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const version = process.argv[2] ?? "";
const semver = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

if (!semver.test(version)) {
  console.error(
    `set-version: expected a semantic version, received "${version}"`,
  );
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Files whose version field is synced, with the pattern that matches it. */
const targets = [
  { file: "package.json", pattern: /("version":\s*")[^"]+(")/ },
  { file: "src-tauri/tauri.conf.json", pattern: /("version":\s*")[^"]+(")/ },
  {
    file: "src-tauri/Cargo.toml",
    pattern: /(\[package\][\s\S]*?\nversion = ")[^"]+(")/,
  },
];

for (const { file, pattern } of targets) {
  const path = resolve(root, file);
  const contents = readFileSync(path, "utf8");

  if (!pattern.test(contents)) {
    console.error(`set-version: no version field matched in ${file}`);
    process.exit(1);
  }

  writeFileSync(path, contents.replace(pattern, `$1${version}$2`));
  console.log(`set-version: ${file} -> ${version}`);
}
