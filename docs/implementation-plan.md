# Flashcards implementation plan

Status: In progress; Phase 1 Step 1 is implemented and verified, awaiting review.
Created: 2026-11-02

## Approach

Build one complete, working flashcard first, then add navigation, and finally
the carousel. Each step is a small, verifiable increment, not a release on its
own.

At the time this plan was created, the repository contained specifications
only; no app code or tooling existed.

This plan tracks implementation order. It does not replace or change the
approved [PRD](specs/PRD.md), [DEVSPEC](specs/DEVSPEC.md),
[UISPEC](specs/UISPEC.md), or [TESTSPEC](specs/TESTSPEC.md). Resolve each
step's blocking decisions before implementing it.

## Phase 1 - Foundation

| Step | What to implement | Completion check |
| --- | --- | --- |
| 1. Set up the app | Create the React, TypeScript, and Vite project with relative asset paths. Agree on unit/component and browser test tools before adding them. | App starts; type-check and production build pass. |
| 2. Define card data | Add the typed JSON deck model, validation, and permitted local test media. Preserve supplied card order and Unicode words. | Valid decks pass; malformed decks and unsafe asset paths fail explicitly. |
| 3. Add local loading | Add bounded offline-compatible loading, loading feedback, and content-unavailable/retry states. Keep unresolved production content lookup separate. | Loading settles within 10 seconds; failed and stale requests are handled correctly. |

## Phase 2 - One complete flashcard

| Step | What to implement | Completion check |
| --- | --- | --- |
| 4. Add the card box | Build a centered, bordered card in a responsive, safe-area-aware shell. No navigation yet. | Card fits small portrait and landscape screens; keyboard focus is visible. |
| 5. Add the image | Display the first ordered card's image without stretching or cropping. Add an explicit image-failure state. | Tall/wide images fit; a missing image does not prevent interaction. |
| 6. Add the word face | Add the matching word in the same stable card region, preserving case and diacritics. | Long words wrap without truncation; the hidden word is not exposed on the image face. |
| 7. Add pronunciation | Implement a single audio controller with restart, cancellation, and explicit playback-failure handling. | Audio never overlaps; failed playback is reported and retryable. |
| 8. Add tap-to-flip | Wire pointer and keyboard activation to toggle image/word. Revealing the word plays it once; returning to the image stops audio. | At least 20 repeated flip cycles work without double activation or lockup. |
| 9. Add the replay button | Show a separate speaker control on the word face, with idle, playing, and unavailable states. | Replay restarts pronunciation without flipping the card. |
| 10. Remember progress | Save and restore card and face for the same container user and content, once content identity is approved. | Reload restores the face without autoplay; users do not share progress; storage failure leaves gameplay usable. |

Checkpoint: verify the complete single-card activity before starting navigation.

## Phase 3 - Explore the deck

| Step | What to implement | Completion check |
| --- | --- | --- |
| 11. Add previous/next controls | Introduce temporary arrow navigation following JSON order and wrapping in both directions. | Each action moves exactly one card, stops audio, and handles one- and two-card decks correctly. |
| 12. Add neighboring card previews | Replace visible arrows with tappable previous/next image peeks. | Both peeks have usable touch regions and distinct accessible names; focus survives navigation. |
| 13. Add swipe navigation | Recognize swipes separately from taps, including cancellation and multi-touch handling. | Test exact gesture thresholds; a swipe never also flips the card. |
| 14. Add flip and slide animations | Add 200 ms transitions, prevent overlapping actions, and support reduced motion. | Rapid mixed inputs do not double-act; reduced motion changes state immediately without locking controls. |

## Phase 4 - Container readiness

| Step | What to implement | Completion check |
| --- | --- | --- |
| 15. Add approved usage reporting | Wire only the agreed milestones through the container bridge. | No per-tap reporting; missing or failing bridge never interrupts gameplay. |
| 16. Package and verify offline delivery | Produce the agreed engine/content archives and test actual local-file WebView operation. | No external requests; complete offline activity, persistence, media, and reporting checks pass. |

## Specification and test coverage

| Phase | Requirements | Validation |
| --- | --- | --- |
| Foundation | PRD-005/006/007; DEV-001 through DEV-005, DEV-011; UI-005 | TEST-001 through TEST-005, TEST-014 |
| Single card | PRD-001/002/004; DEV-005/006/009/010; UI-001/002/004 through UI-007 | TEST-006, TEST-011 through TEST-014, applicable TEST-018 through TEST-022, TEST-024 |
| Navigation and carousel | PRD-003/004; DEV-007/008; UI-001/003/006 through UI-008 | TEST-007 through TEST-010, TEST-018 through TEST-024 |
| Container readiness | PRD-005 through PRD-007; DEV-011 through DEV-013 | TEST-014 through TEST-017, TEST-025 through TEST-028 |

Run focused automated tests and applicable manual checks for each increment.
Record actual commands, environment, results, and evidence as required by
TESTSPEC. Deferred or blocked checks are not passes; final acceptance requires
the complete applicable matrix.

## Decisions needed along the way

- Before tooling: approve the test tools.
- Before UI work: select the visual direction.
- Before production loading, persistence identity, and packaging: resolve
  content mapping and identity under DEC-007.
- Before reporting: resolve milestones and payload semantics under DEC-008.
- Before release: approve real content, devices, accessibility, and learner
  evaluation under DEC-009.

## Task completion workflow

After each completed and tested task, wait for explicit human approval, then
complete its separate Spec Update task before moving to unrelated work.
Follow the metadata, versioning, and changelog requirements in
[AGENTS.md](../AGENTS.md). Do not claim approval or update specification
changelogs for unapproved exploratory work.

## First implementation task

Step 1 only: set up the runnable app and verification tooling.

### Phase 1 Step 1 execution

- Approved test tools: Vitest with React Testing Library, and Playwright.
- Added React/TypeScript/Vite setup with Vite base `./`, plus focused component
  and built-app browser smoke tests.
- `npm run typecheck` — passed.
- `npm run test` — passed (1 test).
- `npm run build` — passed.
- `npm run audit:dist` — passed (2 relative asset references; no source maps).
- `npm run test:e2e` — passed (1 browser test; built app rendered with no
  external requests).
- Direct `file:` validation in target Curious Reader WebViews remains deferred
  to the packaging phase; the browser smoke test is not a substitute for it.
