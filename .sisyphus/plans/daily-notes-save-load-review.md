# Daily Notes Save/Load Review Plan

## Context

### Original Request
현재 데일리 노트를 저장하고 불러오는 방식을 재검토하여 동작상 오류가 있는지 판단하고, 아키텍쳐상 개선 가능한 부분을 찾는다.

### Interview Summary
**Key Discussions**:
- Daily note filenames are fixed to `yyyy-MM-dd.md`; `dateFormat` is display/template-only.
- The goal is review and recommendations, not implementation unless explicitly requested.

**Research Findings**:
- Core daily notes logic: `apps/desktop-app/src/features/daily-notes/store/dailyNotesStore.ts`.
- UI entry points: `apps/desktop-app/src/features/daily-notes/components/DailyNotesCalendar.tsx` and `apps/desktop-app/src/features/daily-notes/components/CalendarDayWithDot.tsx`.
- Vault IO bridge: `apps/desktop-app/src/features/vault/store/vaultStore.ts` and `apps/desktop-app/src-tauri/src/commands/file.rs`.
- Settings persistence: `apps/desktop-app/src/features/settings/store/settingsStore.ts` and `apps/desktop-app/src/lib/tauri-store.ts`.
- Time helpers: `packages/shared/time.ts` (KST date key formatting).

### Metis Review
**Identified Gaps** (addressed):
- No additional gaps returned by Metis; proceed with explicit scope guardrails and acceptance criteria in plan.

---

## Work Objectives

### Core Objective
Produce a structured review of daily notes save/load behavior that identifies functional errors and proposes architecture improvements, grounded in concrete code references.

### Concrete Deliverables
- A written review report (markdown) with:
  - Current flow map (UI → store → Tauri commands)
  - Functional issues and edge cases with evidence
  - Architecture improvement recommendations with trade-offs
  - Decision log (date filename policy, scope boundaries)

### Definition of Done
- [ ] Review report file exists and contains all required sections with file references.
- [ ] Each identified issue includes a “what/why/impact” summary and supporting code references.
- [ ] Recommendations are prioritized and explicitly scoped to file-based vault storage.

### Must Have
- Explicit confirmation that daily note filenames remain `yyyy-MM-dd.md`.
- Clear distinction between display formatting (`dateFormat`) and filename logic.

### Must NOT Have (Guardrails)
- No code changes in this review plan.
- No migration to alternative storage (DB/store plugin) unless explicitly requested later.
- No scope expansion into unrelated features (Jira/GitHub/secure storage).

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (repo has lint/typecheck/tests, but not required here)
- **User wants tests**: NO (analysis-only)
- **Framework**: N/A

### Manual Verification Only
Because this is an analysis-only task, verification is a structured content check:
- Confirm report sections exist and are complete.
- Validate each issue and recommendation has at least one concrete code reference.
- Confirm all scope guardrails are respected (no implementation tasks).

---

## Task Flow

```
Task 1 → Task 2 → Task 3 → Task 4
```

## Parallelization

| Group | Tasks | Reason |
|------|-------|--------|
| A | 1, 2 | Both rely on code reading and can be performed in parallel if multiple reviewers are available |

| Task | Depends On | Reason |
|------|------------|--------|
| 4 | 1, 2, 3 | Needs completed findings to summarize |

---

## TODOs

- [ ] 1. Map the current daily notes save/load flow and invariants

  **What to do**:
  - Document the end-to-end flow (UI trigger → store actions → Tauri commands → vault FS).
  - Capture invariants: filename policy (`yyyy-MM-dd.md`), vault dependency, KST date key usage.
  - Note where state is cached (e.g., `existingDates`) and how it updates.

  **Must NOT do**:
  - Do not change any code or settings.

  **Parallelizable**: YES (with 2)

  **References**:
  - `apps/desktop-app/src/features/daily-notes/store/dailyNotesStore.ts` - core scan/create logic and date handling.
  - `apps/desktop-app/src/features/daily-notes/components/DailyNotesCalendar.tsx` - UI entry point and scan trigger.
  - `apps/desktop-app/src/features/daily-notes/components/CalendarDayWithDot.tsx` - dot indicator uses date keys.
  - `apps/desktop-app/src/features/vault/store/vaultStore.ts` - read/write path for notes.
  - `apps/desktop-app/src-tauri/src/commands/file.rs` - filesystem command contract and path validation.
  - `packages/shared/time.ts` - KST date key and formatting helpers.

  **Acceptance Criteria**:
  - [ ] Report includes a flow map with each step referencing at least one file above.
  - [ ] Report explicitly states the filename policy and its implications.

  **Manual Execution Verification**:
  - [ ] Open the report file and confirm a “Flow Map” section exists and cites the references above.

- [ ] 2. Identify functional errors and edge cases in save/load behavior

  **What to do**:
  - Analyze dateFormat vs filename mismatch risks (scan/create/indicator consistency).
  - Review error handling differences (scan vs create) and vault lifecycle behavior.
  - Assess stale state risks (vault close, refresh timing).

  **Must NOT do**:
  - Do not propose storage migrations or refactors beyond review scope.

  **Parallelizable**: YES (with 1)

  **References**:
  - `apps/desktop-app/src/features/daily-notes/store/dailyNotesStore.ts` - scanDailyNotes/openOrCreateDailyNote/hasNoteForDate logic.
  - `apps/desktop-app/src/features/settings/store/settingsStore.ts` - daily notes settings persistence.
  - `apps/desktop-app/src/features/daily-notes/components/CalendarDayWithDot.tsx` - dateKey usage for dot display.

  **Acceptance Criteria**:
  - [ ] Report lists each issue with: symptom, cause, impact, and evidence.
  - [ ] Each issue includes a reproduction scenario or concrete conditions.

  **Manual Execution Verification**:
  - [ ] Confirm report “Functional Issues” section contains at least 3 evidence-backed findings.

- [ ] 3. Assess architecture improvements compatible with file-based vault storage

  **What to do**:
  - Propose improvements that keep file-based vault storage (e.g., unified date key, scan caching/indexing, error consistency, path normalization).
  - Include trade-offs (complexity vs reliability) and indicate any optional enhancements.

  **Must NOT do**:
  - No redesign into database/store plugin unless user requests later.

  **Parallelizable**: NO (depends on 1 and 2 for evidence)

  **References**:
  - `apps/desktop-app/src/features/daily-notes/store/dailyNotesStore.ts` - current scan and create logic.
  - `apps/desktop-app/src/features/vault/store/vaultStore.ts` - refresh, open, save flows for notes.
  - `apps/desktop-app/src-tauri/src/commands/file.rs` - file operations and path validation.

  **Acceptance Criteria**:
  - [ ] Report includes a “Architecture Improvements” section with at least 3 actionable recommendations.
  - [ ] Each recommendation includes impact and scope boundaries.

  **Manual Execution Verification**:
  - [ ] Confirm recommendations remain within file-based vault scope.

- [ ] 4. Produce the final review report

  **What to do**:
  - Create a report markdown file at `docs/reviews/daily-notes-save-load-review.md`.
  - Include sections: Flow Map, Functional Issues, Architecture Improvements, Decision Log.
  - Summarize prioritized recommendations and clearly mark non-goals.

  **Must NOT do**:
  - Do not modify runtime code.

  **Parallelizable**: NO (depends on 1, 2, 3)

  **References**:
  - `docs/` (create new folder if needed).
  - All references from tasks 1–3.

  **Acceptance Criteria**:
  - [ ] Report file exists at `docs/reviews/daily-notes-save-load-review.md`.
  - [ ] Sections are present and contain concrete evidence links to code files.
  - [ ] Decision log includes: filenames fixed to `yyyy-MM-dd.md` and scope boundaries.

  **Manual Execution Verification**:
  - [ ] Open the report file and verify all required sections are present.

  **Commit**: NO

---

## Commit Strategy

No commits expected for analysis-only report unless user requests a commit.

---

## Success Criteria

### Verification Commands
```bash
ls docs/reviews  # Expected: daily-notes-save-load-review.md
```

### Final Checklist
- [ ] Flow map includes UI → store → Tauri command → vault storage path.
- [ ] Functional issues list contains evidence and reproduction conditions.
- [ ] Architecture improvements are actionable and scoped.
- [ ] Decision log reflects filename policy and scope guardrails.
