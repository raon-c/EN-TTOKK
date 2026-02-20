---
title: "feat: Define project CLAUDE.md operating guide"
type: feat
status: completed
date: 2026-02-20
---

# feat: Define project CLAUDE.md operating guide

## Overview

`CLAUDE.md` is currently empty, and `AGENTS.md` is a symlink to it. This plan defines how to author a project-specific operating guide so human contributors and coding agents can execute work consistently in this repository.

## Problem Statement / Motivation

Without a filled `CLAUDE.md`, core expectations are implicit:
- setup prerequisites are scattered across config and source files
- command usage and verification steps are not documented in one place
- runtime dependencies for Claude/GitHub/Jira/Google integrations are easy to miss
- agent behavior may drift because guardrails are undocumented

## Research Findings (Local)

### Brainstorm / Learnings availability
- No relevant brainstorm documents found in `docs/brainstorms/`.
- No institutional learnings repository found (`docs/solutions/` missing).

### Repository & architecture signals
- `CLAUDE.md` is empty and `AGENTS.md` points to it: `CLAUDE.md`, `AGENTS.md`.
- Frontend+desktop stack and core scripts:
  - `package.json:6` (scripts), `package.json:12`, `package.json:13`, `package.json:14`
  - `src-tauri/tauri.conf.json:7` to `src-tauri/tauri.conf.json:10`
- Code style conventions (Biome + TypeScript strict mode):
  - `biome.json:22` to `biome.json:27`
  - `biome.json:50` to `biome.json:55`
  - `tsconfig.json:17` to `tsconfig.json:24`
- Tauri IPC command surface and generated bindings flow:
  - `src-tauri/src/lib.rs:19` to `src-tauri/src/lib.rs:56`
  - `src-tauri/src/lib.rs:63` to `src-tauri/src/lib.rs:71`
- Frontend runtime flow depends on backend health before rendering app UX:
  - `src/hooks/useBackend.ts:32` to `src/hooks/useBackend.ts:45`
  - `src/App.tsx:140` to `src/App.tsx:155`
- Chat flow depends on local `claude` CLI and stream-json parsing:
  - `src/features/chat/store/chatStore.ts:107` to `src/features/chat/store/chatStore.ts:133`
  - `src-tauri/src/commands/chat_ipc.rs:293` to `src-tauri/src/commands/chat_ipc.rs:323`
- Vault/file operations rely on path safety checks:
  - `src-tauri/src/commands/file.rs:15` to `src-tauri/src/commands/file.rs:57`
- Google Calendar integration requires env and localhost callback:
  - `.env:2`
  - `src/features/google-calendar/config.ts:1` to `src/features/google-calendar/config.ts:3`
  - `src-tauri/src/commands/google_calendar.rs:11`
  - `src-tauri/src/commands/google_calendar.rs:277` to `src-tauri/src/commands/google_calendar.rs:299`
- Jira integration requires secure keyring + strict Atlassian Cloud URL validation:
  - `src/lib/secure-store.ts:3` to `src/lib/secure-store.ts:14`
  - `src-tauri/src/commands/secure.rs:3` to `src-tauri/src/commands/secure.rs:4`
  - `src-tauri/src/commands/jira.rs:61` to `src-tauri/src/commands/jira.rs:94`
- GitHub activity depends on local `gh` auth state:
  - `src-tauri/src/commands/github.rs:124` to `src-tauri/src/commands/github.rs:131`
  - `src-tauri/src/commands/github.rs:303` to `src-tauri/src/commands/github.rs:327`

### External research decision
- Skipped external research.
- Reason: this is a repo-specific documentation plan with strong local signals and low external-risk surface.

## Proposed Solution

Create `CLAUDE.md` as a practical operating guide with these sections:

1. **Project Snapshot**
- product intent and current scope
- high-level frontend/tauri/runtime architecture

2. **Environment & Prerequisites**
- required binaries (`bun`, `tauri`, `claude`, `gh`)
- env vars (names only, no secret values)
- OS/runtime assumptions

3. **Daily Commands**
- dev/build/check/lint commands
- when to use each command and expected outcome

4. **Codebase Map & Ownership Hints**
- key directories and what belongs where
- where to add new feature/store/IPC command

5. **Implementation Guardrails**
- styling/lint rules and formatting expectations
- generated file policy (`src/bindings.ts`)
- security notes for vault path handling and credential storage

6. **Integration Playbooks**
- Chat (Claude CLI) failure handling and prerequisites
- GitHub (`gh auth`) dependency
- Jira secure token flow
- Google Calendar OAuth callback behavior

7. **Definition of Done**
- minimum validation steps before commit/PR
- documentation sync rules (`CLAUDE.md` vs related docs)

## System-Wide Impact

- **Interaction graph**: Updating `CLAUDE.md` also updates effective agent instruction surface because `AGENTS.md` symlinks to it.
- **Error propagation**: Missing/incorrect command docs lead to setup failures (`claude` not found, `gh` auth missing, env misconfig), then runtime feature failures in chat/GitHub/Jira/calendar.
- **State lifecycle risks**: Drift between real behavior and docs can cause repeated misconfiguration and inconsistent issue triage.
- **API surface parity**: Guidance must cover both frontend stores and Tauri command layer to avoid “frontend-only” documentation gaps.
- **Integration test scenarios**:
  - fresh machine setup (no secrets/config)
  - machine without `claude` CLI
  - machine without `gh` auth
  - Google OAuth callback port conflict
  - Jira token present in keyring but missing URL/email in persisted state

## SpecFlow Analysis

### User Flow Overview

1. **New contributor onboarding**
- open `CLAUDE.md` → install prerequisites → set env vars → run `bun run dev`/`bun run tauri:dev` → verify app boots.

2. **Agent implementing feature**
- read project rules → locate feature module/store/command area → implement → run `bun run check` + `bun run build`.

3. **Agent debugging integration**
- identify integration-specific playbook (Chat/GitHub/Jira/Google) → validate local dependency/auth/env → reproduce and fix.

4. **Pre-PR validation**
- execute documented verification checklist → ensure docs are updated if behavior changed.

### Flow Permutations Matrix

| Flow | First-time machine | Existing dev machine | Missing credential/tool |
|---|---|---|---|
| Onboarding | Full setup path needed | Mostly command reminders | Must provide explicit fail-fast checks |
| Feature work | Needs codebase map | Quick path to module conventions | Needs troubleshooting section |
| Integration debug | Needs auth/env primer | Focus on logs + command checks | Must include recovery steps |

### Missing Elements & Gaps to Resolve in CLAUDE.md

- **Category**: Workflow policy
  - **Gap**: Branch/commit/PR conventions are not discoverable in repo docs.
  - **Impact**: inconsistent collaboration hygiene.
- **Category**: Testing strategy
  - **Gap**: No explicit minimum test/build matrix documented per change type.
  - **Impact**: uneven quality gates.
- **Category**: Environment management
  - **Gap**: `.env` variable purpose/usage boundaries are undocumented.
  - **Impact**: setup friction and accidental secret mishandling.

### Critical Questions Requiring Clarification

1. **Critical**: Is there a required branch naming/commit convention for this repo?
- Why it matters: should be codified in `CLAUDE.md` to avoid workflow divergence.
- Default assumption if unanswered: keep current behavior and only require meaningful branch names.

2. **Important**: What is the minimum pre-merge validation gate?
- Why it matters: determines `Definition of Done` section.
- Default assumption if unanswered: require `bun run check` and `bun run build`.

3. **Important**: Should `CLAUDE.md` include a project tracker preference (GitHub/Linear) for issue creation?
- Why it matters: downstream planning and automation commands depend on this.
- Default assumption if unanswered: keep tracker unspecified.

## Acceptance Criteria

### Functional Requirements
- [x] `CLAUDE.md` includes project snapshot, setup, commands, architecture map, guardrails, integration playbooks, and DoD.
- [x] All commands and environment variables in `CLAUDE.md` are verifiable from current repository files.
- [x] Secrets are never documented as raw values; only variable names and usage guidance are included.

### Quality Gates
- [x] Every high-risk integration section (Chat/GitHub/Jira/Google) includes failure symptoms and first-response checks.
- [x] `CLAUDE.md` references generated-file policy for `src/bindings.ts`.
- [x] A final self-review confirms no contradiction with `package.json`, `biome.json`, and Tauri config.

## Success Metrics

- New contributor can run app locally using only `CLAUDE.md` in under 30 minutes.
- Fewer repeated setup questions about `claude` CLI/`gh` auth/env vars in team chat.
- At least one implementation cycle completes end-to-end using only `CLAUDE.md` as operational reference.

## Dependencies & Risks

### Dependencies
- Accurate command inventory (`package.json`).
- Current runtime assumptions in frontend/tauri source.
- Agreement on workflow policy defaults (branching, validation gate, tracker).

### Risks
- **Doc drift**: runtime behavior changes without docs update.
- **Overfitting**: too-detailed machine-specific instructions become brittle.
- **Security leakage**: accidental inclusion of secret values.

### Mitigation
- Keep sections concise and source-linked.
- Add explicit “update this doc when command/env/integration behavior changes” note.
- Add a final redaction pass before merging.

## Implementation Plan

### Phase 1: Scaffold `CLAUDE.md`
- Create section skeleton and table of contents.
- Add strict placeholder structure where policy decisions are pending.

### Phase 2: Populate from source-of-truth files
- Fill commands and conventions from `package.json`, `biome.json`, `tsconfig.json`, Tauri configs.
- Fill integration playbooks from store + command layers.

### Phase 3: Validate and tighten
- Run documented commands locally.
- Resolve wording ambiguity and remove stale assumptions.
- Confirm AGENTS symlink behavior remains intentional.

## MVP Draft Structure

### `CLAUDE.md` (pseudo structure)

```md
# Project Overview
# Tech Stack & Runtime Model
# Prerequisites
# Environment Variables (Names Only)
# Development Commands
# Code Organization
# Integration Playbooks (Chat/GitHub/Jira/Google)
# Guardrails (Formatting, Generated Files, Security)
# Definition of Done
# Troubleshooting Quick Checks
```

## References & Research

### Internal References
- `CLAUDE.md`
- `AGENTS.md`
- `package.json:6`
- `biome.json:22`
- `tsconfig.json:17`
- `vite.config.ts:22`
- `src/App.tsx:140`
- `src/hooks/useBackend.ts:32`
- `src/features/chat/store/chatStore.ts:107`
- `src/features/google-calendar/config.ts:1`
- `src/features/google-calendar/store/googleCalendarStore.ts:163`
- `src/features/jira/store/jiraStore.ts:144`
- `src/features/github/store/githubStore.ts:53`
- `src-tauri/tauri.conf.json:7`
- `src-tauri/Cargo.toml:20`
- `src-tauri/src/lib.rs:19`
- `src-tauri/src/commands/chat_ipc.rs:293`
- `src-tauri/src/commands/file.rs:15`
- `src-tauri/src/commands/google_calendar.rs:11`
- `src-tauri/src/commands/jira.rs:61`
- `src-tauri/src/commands/github.rs:124`
- `src-tauri/src/commands/secure.rs:3`
- `.env:1`

### External References
- None (intentionally skipped for this plan).

### Related Work
- Related issue: N/A
- Related PR: N/A
