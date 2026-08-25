# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Stack: Nuxt (see `nuxt.config.ts`, `package.json`). No architecture/domain documentation has been written for this project yet — this file currently carries only cross-project workflow conventions (see mychess and sportbet for the shape a fuller version could take). Consider running the `init` skill here to fill in stack/commands/architecture once the project is actively being worked on.

## Workflow notes

- **Log substantive requests as GitHub issues, and close them again on completion.** When the user's request is a real feature, bug, or task (not a trivial reply/confirmation/clarification), file it as a GitHub issue via `gh issue create --title "..." --body "..."` (gh infers the repo — `tomyka/padelis` — from the working directory) as part of handling the request, with a clean title/description reflecting the actual ask, not a raw prompt dump. Skip this for one-word replies, "yes"/"looks good" confirmations, or answers to Claude's own clarifying questions. A lightweight body (Problem, Proposed Solution, Acceptance Criteria) is enough — there's no issue-template/label scheme set up here. Once an issue's own criteria are met, close it (`gh issue close <n> --comment "..."`) rather than leaving finished work sitting open.
- Push directly to `main` without asking for confirmation first. This does not extend to destructive git operations (force-push, history rewrites) — those still require asking.
