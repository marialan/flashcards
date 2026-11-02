# DEVSPEC - Flashcards

| | |
| --- | --- |
| **Title** | Flashcards - Development Specification |
| **Status** | Approved - version 0.2.0; provisional decisions and integration blockers remain recorded |
| **Version** | 0.2.0 |
| **Last updated** | 2026-11-02 |
| **Owner/Author** | Maria Lande (with Copilot) |

> Product authority: [PRD](PRD.md), approved version 1.1.1.
> Integration authority: [Curious Reader contract](../third-party-game-spec.md),
> version 1.8. This document defines target system behavior and architecture,
> and records a staged implementation plan; it does not describe an existing
> implementation. Selected requirements are approved; explicitly provisional
> decisions and integration blockers remain as recorded below.

---

## 1. Scope and authority

This specification describes the complete intended system. Unless explicitly
marked provisional, proposed, or blocked, its behavior requirements describe
the desired finished app, not any one implementation increment. The target
release experience is the Great-tier carousel described by the PRD.

Implementation may be staged to reduce complexity: build the core single-card
activity, add deck navigation, then replace arrow navigation with the carousel
experience. These are implementation increments, not separate product scopes
or independently authorized releases. An intermediate build may intentionally
omit features scheduled for later increments and is not release-complete. Do
not treat a deferred requirement as out of scope or as passed; verify each
increment against its applicable tests, and defer final acceptance until the
target app is complete.

No scoring, timed challenges, content editor, language picker, or learner
accounts are introduced.

Product changes require a deliberate PRD review; implementation details belong
here. Presentation and verification are derived downstream, not authoritative
sources for behavior. No code, scripts, schemas, fixtures, or packages described
below are claimed to exist.

## 2. Decisions and approval blockers

| ID | Decision | Status |
| --- | --- | --- |
| DEC-001 | Carousel navigation wraps continuously in both directions. | Selected by Maria Lande, 2026-10-28 |
| DEC-002 | Entering a card initially shows its image. Whether to remember each card's side remains open. | Provisional first-implementation choice requested by Maria Lande; not a permanent product requirement |
| DEC-003 | Revealing the word plays pronunciation; a separate replay control is available. | Selected by Maria Lande, 2026-10-28 |
| DEC-004 | Missing or unsupported `cr_lang` produces an explicit content-unavailable state, not language substitution. | Selected by Maria Lande, 2026-10-28 |
| DEC-005 | Restore the last viewed card and face from localStorage across reloads and app restarts, scoped to the container user and content. | Selected by Maria Lande, 2026-11-02 |
| DEC-006 | Final schema, gesture thresholds, failure recovery, and UI constants below. | Approved by Maria Lande, 2026-11-02 |
| DEC-007 | Packaging Layout A or B, content lookup mapping, engine slug, and any core slug. | Blocking integration decision; confirm shared-content model with Curious Reader |
| DEC-008 | Reporting milestone, event name, fields, aggregate policy, and stable `sub_app_id`. | Blocking reporting decision; agree with Curious Learning data team; no per-tap reporting |
| DEC-009 | Launch languages/deck, content rights/reviewer, device/WebView matrix, accessibility validation, and usability evaluation targets. | Required before release; still open in PRD |

The contract requires game-state persistence in localStorage. DEC-005 aligns
with this requirement. Scope saved state to the approved content identity and
the opaque container-provided `cr_user_id`; do not store learner identity in
the progress record or share progress between users. If `cr_user_id` is absent,
do not use a shared anonymous storage key.

## 3. Architecture and staged implementation plan

Use React, TypeScript, and Vite per repository guidance. Prefer native browser
capabilities, focused components, and small hooks; avoid new state, animation,
styling, or analytics frameworks unless an approved need emerges.

The following are logical module responsibilities, not committed file paths.
This sequence is an implementation plan, not a division of target requirements
or release scope. Implement in this order after the relevant specification and
decisions are approved. Complete and verify each increment's applicable checks
before beginning dependent later work; completing an earlier increment does
not complete the target system:

1. **Content model and validation:** typed deck data, safe local paths,
   fixtures, and structural validation.
2. **Launch and local loading:** query parsing, approved content lookup,
   bounded loading, and typed failure results.
3. **Core card state and audio:** first ordered card, image/word side, one
   active pronunciation, replay, cancellation, and explicit error state.
4. **Core interaction and rendering:** single-card image/word activity and
   application status surfaces composed over the previous modules; no deck
   navigation or carousel.
5. **Deck navigation increment:** previous/next controls and cyclic position
   transitions, including the defined one- and two-card behavior.
6. **Carousel increment:** neighbor previews, gesture recognition, carousel
   transitions, and flip animation composed over the existing modules.
7. **Container reporting:** isolated adapter and approved milestone wiring;
   blocked by DEC-008.
8. **Standalone build and packaging:** offline-compatible output and contract
   audits; final packaging blocked by DEC-007.

Test each module as it is introduced. The core activity increment must pass the
relevant content, loading, single-card, audio, and standalone checks in TESTSPEC
before later navigation work begins. Run navigation and carousel checks with
their respective increments; a deferred check is not a pass. Reporting failure
must never become a dependency of rendering or deck transitions.

## 4. Content model and validation

### DEV-001 - Deck contract (PRD-001, PRD-006)

Approved versioned JSON shape; this normalizes the brief's illustrative
definitions and order arrays without claiming they are a complete schema:

```json
{
  "schema_version": 1,
  "language": "example_language",
  "cards": [
    {
      "card_id": "example-card",
      "target_word": "Example",
      "image": "assets/images/example.png",
      "audio": "lang/example_language/audios/example.mp3"
    }
  ],
  "card_order": ["example-card"]
}
```

`example_language` and media are illustrative only, not a launch language,
permanent identity, or supplied asset. All media paths resolve relative to the
installed `index.html`, not the JSON file. The approved packaging mapping
determines the deck file's location; do not hardcode a layout before DEC-007.

Require version 1; a language matching the selected installed pack; nonempty
cards and order; unique, nonempty card IDs; nonblank words; and image/audio
paths. Every order entry must reference a defined card and appear once; every
defined card must appear in the order. Repetition means revisiting cards, not
duplicating IDs in the order. Render words as text, never HTML.

Preserve Unicode words, diacritics, and their authored order without changing
case or translating. Reject invalid data with a content error; do not silently
drop cards, reorder, or fabricate words/media.

### DEV-002 - Local asset integrity (PRD-001, PRD-005, PRD-006)

Validate paths before requesting them: reject URL schemes, leading slashes,
network-path references, backslashes, traversal segments (including encoded
traversal), and query/fragment components. Allow only normalized relative paths
within the extracted game directory. Resolve language lookup through the
approved installed-pack mapping, never direct query-string path concatenation.

Use real PNG/JPEG/WebP/SVG images and MP3/WAV audio as supported by contract
section 4. Per-language audio belongs under `lang/<language>/audios/`.
Asset bytes must match extensions. Release validation requires every referenced
file and reviewed image/word/audio association; runtime degradation is not
permission to release incomplete content.

## 5. Launch, loading, and failures

### DEV-003 - Launch selection (PRD-005, PRD-006, PRD-007)

Read `cr_lang` and opaque `cr_user_id` from `window.location.search`.
Select only an installed language from the approved mapping. Missing,
unsupported, or ambiguously repeated `cr_lang` results in content-unavailable
without requesting an arbitrary directory or substituting another language.
If Layout B is approved, specify and validate `cr_book` and core lookup before
implementing it. Do not invent learner identifiers; missing `cr_user_id` is
represented by `""` for the bridge contract.

For local development only (`npm run dev`), launch the English test fixture at
`./lang/english/deck.json` without requiring container query parameters. This
explicit development context does not select production content, approve a
launch language, or resolve DEC-007. Production builds, including built
previews, retain the unavailable state until production lookup is implemented;
they must not fall back to the development fixture.

### DEV-004 - Offline loader and lifecycle (PRD-005)

States are `loading`, `ready`, and `content_unavailable`; media failures in an
otherwise valid deck are separate recoverable states. Initial readiness needs
valid deck data and a settled image load for the restored card, or the first
card when no valid saved state exists; it does not wait for every audio decode.
Settle loading within 10 seconds of launch as ready or an explicit failure.
On the agreed valid release fixture, ready must be reached within 10 seconds.
Apply bounded local request timeouts; abort obsolete requests on retry/unmount.

For `file:` data/binary loading use local XMLHttpRequest, accepting status 0
or 200 on successful load; do not use local `fetch` or Cache Storage. HTTP
development may use fetch. Media elements may load relative image/audio URLs
as permitted by contract section 4. If preloading groups of assets, use
`Promise.allSettled`; no single rejected asset may strand loading.

### DEV-005 - Explicit recovery (PRD-001, PRD-004, PRD-005)

Invalid/missing deck data produces content-unavailable with retry of the same
launch context. An image failure preserves navigation and shows an image
unavailable state, not another card's image. Audio failure preserves word,
flipping, and navigation, marks audio unavailable, and permits user-initiated
retry. Retry must clear stale failures only upon an actual new success.
If Web Audio decoding is chosen, use the contract's one-frame silent buffer
fallback for safety, while still exposing and diagnosing the failure.

Report actionable diagnostics locally with error category and asset/card
reference; do not include learner identity in logs. No network error reporter,
silent content substitution, or success-shaped fallback. Bridge absence is the
contract-mandated exception, specified in DEV-012.

## 6. Deck behavior

### DEV-006 - Flipping and initial state (PRD-001, PRD-002)

State contains current order index and current side. Restore a valid saved card
and side under DEC-005; when no valid saved state exists, start at order index 0
and show its image side under provisional DEC-002. Activating the current card
toggles image/word. Each transition to word requests its pronunciation;
returning to image stops pronunciation. A tap never changes order position.

### DEV-007 - Cyclic navigation and small decks (PRD-003)

For `n > 1`, next is `(index + 1) % n`, previous is
`(index - 1 + n) % n`. Navigation moves exactly one position per accepted
activation, stops old audio, and enters the image side under provisional
DEC-002. There is no completion lock or automatic advancement.

For one card, omit neighboring controls; swipes do nothing and do not reset
the current side or audio. For two cards, both neighboring slots lead to the
other card, with distinct previous/next actions. A zero-card deck is invalid.

### DEV-008 - Gesture arbitration (PRD-002, PRD-003, PRD-004)

Use one pointer sequence per gesture. Approved thresholds in CSS pixels:
a swipe requires horizontal displacement at least 40 and greater than absolute
vertical displacement; a tap requires maximum displacement at most 10.
Anything between is neither tap nor navigation. Resolve at pointer release;
pointer cancellation or a second simultaneous pointer cancels the gesture.

A recognized swipe suppresses the synthetic click/flip from that same gesture.
Swiping left advances and right goes back in the initial physical-direction
model; language-specific direction conventions require review before launch.
The replay control must not bubble into card flipping. Serialize transitions:
ignore further flip/navigation inputs while their visual transition is active;
unlock when completed or cancelled, including reduced-motion and unmount cases.
No overlapping pointer, keyboard, or click action may advance twice.

### DEV-009 - Persisted learner progress (PRD-002, PRD-003)

Under DEC-005, persist the current card ID and side in localStorage after each
accepted flip or navigation. Scope the versioned entry to the approved content
identity and opaque `cr_user_id`. On launch, restore the card and side only when
the saved schema is valid and the card ID exists in the current `card_order`;
otherwise discard the stale entry and use the initial state in DEV-006. If the
user ID is absent or localStorage is unavailable, keep gameplay usable, do not
use a shared anonymous entry, and report an identity-free local diagnostic.
Never generate a user/device ID or include `cr_user_id` in the saved progress
record or diagnostics.

## 7. Audio behavior

### DEV-010 - Playback and replay (PRD-001, PRD-002, PRD-004)

Only one pronunciation plays at a time. Word reveal and replay are initiated
by user activation so autoplay permission is not assumed. Restoring a saved
word-side state restores its visible face only and does not request playback.
Replay restarts the
current word from the beginning without changing side/index. Stop and reset
audio on image reveal, navigation, document hidden, and unmount; do not resume
automatically when returning from the background.

Guard against stale asynchronous loads/play promises: old card audio must not
start after navigation or a newer playback request. A rejected playback request
or decode failure enters the explicit recoverable audio state in DEV-005.
Repeated replay is allowed and never layers sound. No startup or navigation
autoplay occurs while the image is shown.

## 8. Runtime, reporting, and distribution

### DEV-011 - Standalone runtime (PRD-005, PRD-007)

Produce local HTML/CSS/JavaScript with Vite base `./`, no runtime CDN imports,
root-relative assets, source maps in shipped artifacts, Service Workers,
network SDKs, or network-dependent initialization. The root element must exist
before script execution. Verify the emitted entry/scripts work from `file:`
in target WebViews; development-server success is insufficient. Adjust the
build deliberately if default Vite module output is incompatible.

### DEV-012 - Reporting adapter (PRD-007)

Use only `window.ReactNativeWebView.postMessage` when it is a function. When
absent, silently no-op with zero post attempts, per contract. Serialize one
`{ "type": "cr_event", "payload": ... }` JSON string per approved milestone.
Do not emit per flip, tap, frame, swipe, or replay.

Follow contract sections 6.2-6.5: fresh UUID v4 per payload (pure-JS fallback
when the supported crypto API is unavailable), opaque URL `cr_user_id` or `""`,
approved stable lowercase `sub_app_id`, `payload_version: 1`, whitelisted
collection, UTC ISO timestamp, and JSON-safe data. Include `type` and `lang`
in session-event data. Never invent user/device IDs. The opaque container
`cr_user_id` may scope local progress storage as specified by DEV-009; do not
include it in the saved progress value or event `data`. Include it in the
reporting envelope only as required by the contract, and never in diagnostics.

For `user_sessions_data`, omit `options`, following the more specific MUST NOT
rule in section 6.5 despite the generic envelope example's `{}`.
For `summary_data`, use approved per-field add/replace operations only.
Do not introduce a score; if later authorized, every score needs `max_score`.
Serialized UTF-8 messages must not exceed the contract's 64 KB limit.

Bridge errors produce identity-free local warnings but cannot block gameplay.
No awaits on gameplay paths, network transport, batching, queues, or retries.
Exactly-once application emission for each approved milestone is required;
container deduplication is separate. Event wiring and release compliance
remain blocked until DEC-008 defines the milestone and payload semantics.

### DEV-013 - Packaging and content lookup (PRD-005, PRD-006, PRD-007)

Follow contract section 5's content-based Layout A/B decision, not assumptions
from the game name. Engine archive has root `index.html`, no wrapping folder
and no `lang/`; language archives occupy separate language subtrees. Layout B
also has a shared core tier and validated `cr_book`. Archives must merge without
overwrites; language audio follows DEV-002.

Before implementation of distribution, resolve DEC-007 and add the exact
manifest/lookup, filename conventions, and extraction fixtures. Until then,
no package is claimed container-ready and no permanent slug is reserved.

## 9. Completion and change control

Use this approved specification as the behavior baseline before coding. Resolve blocking decisions for each
increment's modules, verify behavior against its IDs, and preserve the
distinction between target requirements, implementation stages, provisional
choices, and permanent requirements. Completion of an intermediate increment
does not complete later navigation/carousel requirements or authorize release.
Release also requires the intended final experience, approved launch content,
device/usability evidence, container verification, and human signoff. Changes
to DEC-002 or DEC-005 must update their affected behavior and downstream
acceptance together; do not silently change them in code.

## Change Log

2026-11-02 — Maria Lande (with Copilot) — Approved automatic English fixture loading for local development only while preserving production launch selection and integration blockers.
2026-11-02 — Maria Lande (with Copilot) — Replaced the no-persistence decision with per-user localStorage restoration across reloads and app restarts.
2026-10-28 — Maria Lande (with Copilot) — Clarified that the complete target is delivered incrementally, with the single-card MVP preceding navigation and carousel work.
2026-10-28 — Maria Lande (with Copilot) — Created the initial development-specification draft with PRD traceability, selected interactions, provisional state policies, and explicit integration blockers.
