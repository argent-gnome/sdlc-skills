# Research digest — `house --version`

Question: where does `house --version` currently land, and where should the version come from?

Findings
- Entry point: `cli/bin/house.js`. `const [cmd, ...rest] = process.argv.slice(2)` — so `house --version`
  parses `--version` as the command name, misses the `commands` table, prints usage, exits 2.
- Version source of truth: `cli/package.json` `"version": "0.1.0"`. No other version constant exists in
  `cli/lib/`.
- The bin script already imports `readFileSync` from `node:fs`; resolving `../package.json` relative to
  `import.meta.url` is the standard ESM pattern (package is `"type": "module"`).
- Tests: `cli/test/*.test.js` via `npm test` (`node --test`).

Options
1. Special-case `--version` before the `commands` lookup (read package.json, print, exit 0).
2. Add a `version` command to the `commands` table and alias `--version` to it.

Recommendation: option 1 — smallest diff, matches convention (`--version` is a flag, not a subcommand),
avoids widening the command table. Print the bare semver (`0.1.0`) to stdout, exit 0.
