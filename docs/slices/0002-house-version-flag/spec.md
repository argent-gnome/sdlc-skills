---
id: "0002-house-version-flag"
kind: spec
slice: "0002-house-version-flag"
title: "house --version flag"
status: "shaped 2026-07-28; user-approved"
state: approved
---
# Spec — house --version flag

## Problem
`house --version` is parsed as an unknown command: the CLI prints its usage line to stderr and exits 2.
Every mainstream CLI answers `--version`; ours cannot report what build is on PATH, which makes
"which kernel am I running?" unanswerable during smoke tests and bug reports.

## Appetite
1 session (patch tier). This is one function in one file plus one test.

## Solution
Special-case `--version` in `cli/bin/house.js` before the `commands` table lookup: read `version` from
`cli/package.json` (resolved relative to `import.meta.url`, not cwd), print the bare semver to stdout,
exit 0. Works outside a house repo — no `need(root)` check.

## Rabbit Holes
- Do not add a general flag-parsing layer or a `version` subcommand; this is a single pre-dispatch check.
- Do not invent a version constant in `cli/lib/` — `cli/package.json` stays the single source of truth.

## No-Gos
- NOT `-v` or `house version` aliases.
- NOT version output in `house status` / `house --help` / usage text.
- NOT any change to other commands' parsing or exit codes.

## Requirements

### R-1: `house --version` prints the CLI version
`house --version` prints the exact `version` string from `cli/package.json` (currently `0.1.0`) to
stdout, followed by a newline, and exits 0. It must work from any cwd, including outside a house repo.

#### Scenario: version flag in a house repo
- Given the `house` CLI is on PATH
- When I run `house --version` in a house-tracked repo
- Then stdout is the package.json version (e.g. `0.1.0`) and the exit code is 0

#### Scenario: version flag outside a house repo
- Given a cwd that is not inside any house-tracked repo
- When I run `house --version`
- Then stdout is the package.json version and the exit code is 0 (no `not a house repo` error)

### R-2: unknown-command behavior is unchanged
Any other unrecognized invocation still prints the usage line to stderr and exits 2.

#### Scenario: unknown command still fails closed
- When I run `house bogus`
- Then stderr contains `usage: house <` and the exit code is 2
