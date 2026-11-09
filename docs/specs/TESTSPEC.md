# TESTSPEC - Flashcards

| | |
| --- | --- |
| **Title** | Flashcards - Test Specification |
| **Status** | Approved - version 0.2.1; release checks remain blocked or outstanding as marked |
| **Version** | 0.2.1 |
| **Last updated** | 2026-11-04 |
| **Owner/Author** | Maria Lande (with Copilot) |

> Product authority: [PRD](PRD.md), approved version 1.1.1.
> Behavior authority: [DEVSPEC](DEVSPEC.md), approved version 0.3.0.
> Presentation authority: [UISPEC](UISPEC.md), approved version 0.1.5.
> Container checks derive from the [integration contract](../third-party-game-spec.md),
> version 1.8, especially section 7. Tests verify those sources; they do not
> independently invent behavior or settle their open decisions.

---

## 1. Verification status and scope

This document defines acceptance checks, not release sign-off. The repository
now includes the React implementation, automated test runner, production build,
and package fixtures. Automated checks cover code-level behavior and extracted
archives; they do not establish actual Curious Reader WebView compatibility,
approved content, reporting semantics, or educational effectiveness. DEC-008
and release checks that depend on external approval or target devices remain
blocked as identified below.

Automated tests cover data/state/audio/interaction behavior and measurable UI
targets. Manual checks cover actual offline WebViews, assistive technology,
media quality, and learner discoverability. A development server or mocked
bridge alone cannot establish container compatibility.

## 2. Planned verification layers and commands

1. Schema/validator and pure state-transition unit tests.
2. Component and interaction tests with controlled audio and loading failures.
3. Browser checks of the built output, layout, keyboard access, and gestures.
4. Direct `file:` and target WebView offline checks.
5. Extraction/ZIP and native container reporting checks.
6. Content review and representative-learner usability evaluation.

When implementation is authorized, configure a TypeScript-compatible unit/
component runner and a browser runner appropriate to React/Vite; select and
approve actual tools before adding dependencies. Prefer existing tooling if
introduced by an earlier authorized task.

No `npm` script names or test filenames are assumed to exist. The implementation
task must record the actual commands for type-check, focused tests, production
build, and artifact audit once defined. Run focused tests for the changed
module, then affected integration checks; release runs the complete approved
matrix. Missing tools, devices, assets, or commands are blockers, not passes.

## 3. Planned fixtures

These are fixture requirements, not files already supplied:

- Valid three-card ordered deck with distinguishable images and audio; an
  alternate language fixture with Unicode/diacritics; long-word and tall/wide
  image variants.
- One-card and two-card decks; deliberately reordered valid definitions.
- Valid, malformed, stale, and cross-user localStorage progress records.
- Empty deck/order, duplicate IDs/order entries, unknown ordered ID, unlisted
  card, blank word, missing field, unsupported schema, malformed JSON, and
  language mismatch.
- Local-path attacks: absolute URL, protocol-relative URL, leading slash,
  backslash, `..` segment, encoded traversal, query/fragment suffix, and an
  unrecognized language value. Validation must precede any asset request.
- Missing/corrupt image, missing/undecodable audio, rejected audio play,
  stalled request, stale response, and retry success/failure.
- Recording bridge stub, absent bridge, throwing bridge, UUID fallback, missing
  user ID, oversized payload, and a non-ASCII payload for UTF-8 byte sizing.
- Extracted artifacts at a nested directory with spaces; approved language
  pack(s) and, only if selected, a shared core fixture.

Synthetic test content does not establish launch-content quality. Use locally
owned/permitted fixture media; do not upload fixtures or child data externally.

## 4. Behavior verification matrix

All cases are planned. For each automated case assert exact index, side,
request count, stop/play calls, or failure state rather than a screenshot alone.

| ID | Authority | Required check and pass condition | Layer |
| --- | --- | --- | --- |
| TEST-001 | PRD-001, PRD-006; DEV-001 | Valid deck preserves authored order, Unicode words, and ID/media association; every malformed fixture is rejected explicitly without dropping or inventing cards. | Unit |
| TEST-002 | PRD-001, PRD-005, PRD-006; DEV-002 | Every unsafe path fixture is rejected before I/O; legitimate relative media resolve under the installed root even when JSON is nested. File bytes match allowed extensions; all release references exist. | Unit + artifact audit |
| TEST-003 | PRD-005, PRD-006, PRD-007; DEV-003 | Installed language is selected exactly; absent, unknown, repeated, and unsafe language values show unavailable with no fallback/request to unapproved paths. Missing identity remains empty, not generated. | Unit + integration |
| TEST-004 | PRD-005; DEV-004 | On `file:`, local data uses XHR, accepts successful status 0/200, never local fetch/Cache Storage. HTTP path remains usable. Group preload rejection cannot hang loading; retry/unmount abort stale loads. | Unit + WebView |
| TEST-005 | PRD-004, PRD-005; DEV-004, DEV-005; UI-005 | Valid offline release fixture is ready within 10 seconds from launch. Missing/stalled/invalid data exits loading to explicit failure within 10 seconds. Failed image/audio does not strand startup. | Integration + timed device check |
| TEST-006 | PRD-001, PRD-002; DEV-006; UI-002, UI-AC-001 | With no valid saved progress, initial index is 0/image; a valid saved state restores its card and side. Activating flips both ways without changing index; each word reveal requests one matching pronunciation; image reveal stops it. Repeat at least 20 cycles with no lock or score. | Unit + component |
| TEST-007 | PRD-003; DEV-007; UI-001, UI-003, UI-AC-002 | Next/previous follow order and wrap last/first both ways; each action moves one position and stops prior audio. Entering image side is checked as provisional DEC-002, not a permanent requirement. | Unit + component |
| TEST-008 | PRD-003; DEV-007; UI-003, UI-AC-005 | One-card swipe is inert and preserves side/audio; no peeks. Two-card peeks both reach the other card with distinct names. Empty deck is rejected. | Unit + component |
| TEST-009 | PRD-002, PRD-003, PRD-004; DEV-008; UI-003 | Test 39/40/41 px horizontal displacement; horizontal equal to vertical does not swipe. Maximum travel 10 px can tap, 11 px cannot. Intermediate drag does neither; recognized swipe never also flips. | Unit + browser pointer tests |
| TEST-010 | PRD-002, PRD-003, PRD-004; DEV-008; UI-004, UI-008 | Pointer cancellation, second pointer, replay bubbling, rapid clicks, and mixed keyboard/pointer input cause no double action. At most one transition runs; completion/cancellation/reduced motion unlocks controls. | Component + browser |
| TEST-011 | PRD-002, PRD-003; DEV-009; UI-AC-006 | Save the current card ID and side; restore them for the same user and content after reload and app restart. Different users or content do not share progress. Missing `cr_user_id`, malformed state, or an ID absent from `card_order` uses the initial state without blocking gameplay; localStorage failure does not crash the activity. | Browser + WebView |
| TEST-012 | PRD-001, PRD-002, PRD-004; DEV-010; UI-004, UI-AC-001, UI-AC-006 | Reveal plays once; replay restarts, does not flip, and never overlaps sound. Restoring a saved word-side state makes no playback request; replay starts audio only after learner activation. No startup/image-navigation autoplay. Stale play/load after navigation cannot sound. Image reveal, navigation, hidden document, and unmount stop/reset; return does not autoplay. | Component + actual audio device |
| TEST-013 | PRD-001, PRD-004, PRD-005; DEV-005, DEV-010; UI-004, UI-005, UI-AC-003 | Missing images show explicit placeholder, not a wrong image; failed audio retains word and retry. Retry failure stays explicit and success clears it. Navigation remains possible. Diagnostics exclude learner identity. | Component + browser |
| TEST-014 | PRD-005, PRD-007; DEV-011 | Built `file:` entry runs in agreed WebViews with no external requests, root-relative assets, runtime CDN code, service workers, or shipped source maps; Vite base is relative. | Artifact audit + device |
| TEST-015 | PRD-007; DEV-012 | Absent bridge makes zero post attempts; throwing bridge only warns locally. Approved envelope uses fresh UUID v4, exact field semantics, safe data, UTC time, the pre-CMS `sub_app_id` (currently `flashcard`, reconfirm before upload), and empty missing user ID. Session events omit options. UTF-8 byte size respects 64 KB; no batching/retry/network. | Blocked: reporting semantics and Curious Learning approval |
| TEST-016 | PRD-007; DEV-012, DEC-008 | Each approved milestone emits exactly once; repeated flip/swipe/replay emits nothing by itself; approved summary operations are correct. Native logs receive events and replayed payload IDs deduplicate. | Blocked: reporting semantics and container access |
| TEST-017 | PRD-005, PRD-006, PRD-007; DEV-013, DEC-007 | Selected Layout A archives use `flashcard-core.zip` with root entry and no `lang/`, plus `flashcard-lang-english.zip` with only the English deck/audio; extraction has no overlaps, and the installed language lookup selects the correct deck. | Archive audit + Chromium `file:`; actual target WebView and approved release content remain outstanding |

## 5. UI and accessibility matrix

| ID | Authority | Required check and pass condition | Layer |
| --- | --- | --- | --- |
| TEST-018 | PRD-003, PRD-004; UI-001, UI-003 | At 320 x 568, 568 x 320, 768 x 1024, and 1024 x 768 CSS px, one full card and usable 48 px neighbor regions fit without overlapping controls, safe-area clipping, or horizontal page scroll; one-card exception holds. | Browser + device |
| TEST-019 | PRD-001, PRD-004; UI-002 | Images retain aspect ratio/meaningful content; long/Unicode words remain intact, readable, and untruncated; face dimensions remain stable. At 200% text zoom, all content/actions remain reachable. | Browser + manual content review |
| TEST-020 | PRD-004; UI-005, UI-006 | Loading, unavailable, image failure, and audio failure expose truthful accessible statuses; no raw stack/identity; image face does not expose hidden word; inactive faces/preview imagery are absent from accessibility tree. | Component + screen reader |
| TEST-021 | PRD-002, PRD-003, PRD-004; UI-004, UI-006, UI-AC-004 | Tab order is coherent; Enter/Space act exactly once; arrows work only within carousel; replay is not nested in flip. Focus survives navigation and status announcements do not duplicate pronunciation. | Browser + screen reader |
| TEST-022 | PRD-004; UI-001, UI-007 | Targets at least 48 x 48 px, distinct controls separated at least 8 px, text contrast 4.5:1 normal/3:1 large, meaningful UI/focus 3:1. Focus is visible/unclipped; errors/actions have non-color cues. | Measurements + manual |
| TEST-023 | PRD-002, PRD-003, PRD-004; UI-008, UI-AC-004 | Normal flip/slide duration is 200 ms each within timer/render tolerance recorded by the test. Reduced-motion mode removes spatial animation, commits state, preserves audio semantics, and never leaves controls locked. | Browser |
| TEST-024 | PRD-004; UI-AC-001, UI-AC-002, UI-AC-003, UI-AC-004, UI-AC-005, UI-AC-006 | Execute all six UI scenarios with actual pointer and keyboard input, including selected DEC-005 reload behavior and provisional DEC-002 image-first behavior; outcomes match their authority. | Browser + manual |

The proposed CSS-pixel range is not evidence that every physical device or
WebView is supported. Confirm devices, fonts, directionality, and assistive
technology combinations under DEC-009 before release signoff.

## 6. Offline and container protocol

### TEST-025 - Complete offline session

**Trace:** PRD-001, PRD-005, PRD-007; DEV-004, DEV-009, DEV-010, DEV-011, DEV-013;
UI-001, UI-005; contract section 7.

1. Build approved standalone output and audit emitted asset references, JSON,
   media formats, and source-map/SDK exclusions.
2. Extract `flashcard-core.zip` and `flashcard-lang-english.zip` into a clean
   nested directory, checking for overwrites and root `index.html`.
3. Open the local entry with `cr_lang=english` in Chromium with network blocked,
   then repeat inside the agreed actual container WebViews.
4. Disable network before launch. Time launch to playable; limit is 10 seconds
   on the valid fixture. No attempted external calls or `NETGUARD_BLOCK` entries
   are allowed during loading or the full session.
5. Reveal/replay each card; browse both directions and wrap. Verify every
  written word, image, and pronunciation; test background/return, reload, and
  app restart, confirming saved card and side restore for the same user/content.
6. Confirm no bridge post attempts/errors outside the container; in-container
   verify approved milestones in diagnostic logs.
7. With Curious Learning, verify offline event storage, payload deduplication,
   and later synchronization. The game itself must perform no network sync.

**Blocked portions:** target-WebView and app-restart verification require the
device/container matrix and access; milestone/native checks require DEC-008 and
container-team access. A browser file-origin check does not establish actual
container compatibility or app-restart behavior.

## 7. Content, usability, and learning evidence

### TEST-026 - Launch content review

**Trace:** PRD-001, PRD-006; DEV-001, DEV-002; UI-002.

A named qualified language/content reviewer must approve 100% of launch card
image/word/audio associations, pronunciation, typography, asset rights, and
authored order. Record language, deck version, card IDs, reviewer, actual date,
and issues. Synthetic fixtures or runtime fallback do not count as approval.
Blocked until real launch content and reviewer are chosen.

### TEST-027 - Learner discoverability

**Trace:** PRD-004; UI-001 through UI-008.

Observe representative learners attempting reveal, listen, replay, move, and
revisit without written control instructions or adult demonstration. Record
independent success, assistance, errors, and access barriers. Audience, consent
arrangements, sample size, observation window, and threshold must be approved
before recruiting or declaring a pass. No child-identifiable data may be added
to analytics. Blocked by DEC-009; informal developer use is not a substitute.

### TEST-028 - Learning and engagement signals

**Trace:** PRD section 5.

Only under an approved evaluation protocol, assess recognition change and
repeat exploration as separately defined outcomes. Report repetition as
engagement, not proof of literacy improvement. No efficacy claim, data upload,
or additional collection is authorized by this test plan. Blocked pending
evaluation design, consent arrangements, and agreed targets.

## 8. Specification consistency checks

### TEST-029 - Documentation traceability

Before initial approval and after revisions:

- Resolve local source links and cross-document `PRD-*`, `DEV-*`, `UI-*`,
  `UI-AC-*`, `DEC-*`, and `TEST-*` references.
- Ensure requirement/test IDs are unique within their definitions; preserve IDs
  through revisions and explicitly record any retirement.
- Cover every PRD requirement with behavior, presentation where applicable,
  and verification. Every DEV/UI requirement must have an identified test.
- Check constants and semantics agree: cyclic movement, persisted-state and
  provisional state policies, replay, unavailable language, gesture thresholds, loading deadline,
  layout/contrast targets, and reduced motion.
- Check metadata, authorship, actual dates, and approval states. Draft creation
  is not implementation approval; selected decisions are not final approval
  of the whole downstream document.
- Distinguish planned tools/files from existing artifacts and mark unresolved
  packaging/reporting/persistence/device checks as blocked.

## 9. Coverage summary and release gate

| Product requirement | Behavior | Presentation | Verification |
| --- | --- | --- | --- |
| PRD-001 | DEV-001, DEV-002, DEV-005, DEV-006, DEV-010 | UI-002, UI-004 | TEST-001, TEST-002, TEST-006, TEST-012, TEST-013, TEST-019, TEST-026 |
| PRD-002 | DEV-006, DEV-008, DEV-009, DEV-010 | UI-002, UI-004, UI-006, UI-008 | TEST-006, TEST-009, TEST-010, TEST-011, TEST-012, TEST-021, TEST-023 |
| PRD-003 | DEV-007, DEV-008, DEV-009 | UI-001, UI-003, UI-006, UI-008 | TEST-007, TEST-008, TEST-009, TEST-010, TEST-011, TEST-018, TEST-021, TEST-023 |
| PRD-004 | DEV-005, DEV-008, DEV-010 | UI-001 through UI-008 | TEST-005, TEST-009, TEST-010, TEST-012, TEST-013, TEST-018 through TEST-024, TEST-027 |
| PRD-005 | DEV-002, DEV-003, DEV-004, DEV-005, DEV-011, DEV-013 | UI-005 | TEST-002 through TEST-005, TEST-013, TEST-014, TEST-017, TEST-025 |
| PRD-006 | DEV-001, DEV-002, DEV-003, DEV-013 | UI-002, UI-005 | TEST-001, TEST-002, TEST-003, TEST-017, TEST-026 |
| PRD-007 | DEV-003, DEV-011, DEV-012, DEV-013 | UI-005 | TEST-003, TEST-014 through TEST-017, TEST-025 |

For each execution record actual command/procedure, artifact/fixture version,
environment/device, result (`Pass`, `Fail`, `Blocked`, `Not run`, or justified
`Not applicable`), and evidence. Do not invent a test run or reviewer signoff.
Release requires all applicable approved checks passed, blockers resolved,
content/usability review completed, and explicit human approval. A spec-only
task may validate TEST-029 without claiming any game case passed.

## Change Log

2026-11-04 — Maria Lande (with Copilot) — Clarified that `flashcard` is the current pre-CMS reporting identifier and must be reconfirmed before upload.
2026-11-04 — Maria Lande (with Copilot) — Added the resolved Layout A package paths and executable archive/file-origin verification while retaining external release blockers.
2026-11-02 — Maria Lande (with Copilot) — Retargeted small-deck and progress-restoration tests to separate UI acceptance scenarios.
2026-11-02 — Maria Lande (with Copilot) — Added localStorage persistence and cross-user verification for restored card position and side.
2026-10-28 — Maria Lande (with Copilot) — Created the initial test-specification draft with traceable behavior and UI checks, offline/container protocols, fixtures, and explicit execution blockers.
