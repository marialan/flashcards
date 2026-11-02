# UISPEC - Flashcards

| | |
| --- | --- |
| **Title** | Flashcards - User Interface Specification |
| **Status** | Approved - version 0.1.5; open presentation and release decisions remain recorded |
| **Version** | 0.1.5 |
| **Last updated** | 2026-11-02 |
| **Owner/Author** | Maria Lande (with Copilot) |

> Product authority: [PRD](PRD.md), approved version 1.1.1.
> Behavior authority: [DEVSPEC](DEVSPEC.md), approved version 0.1.6.
> This document defines presentation, accessibility, and observable acceptance,
> not alternative system behavior. Its defined UI targets are approved; open
> presentation and release decisions remain recorded below.

---

## 1. Experience and scope

A calm, mobile-first, single-activity surface lets a beginning reader discover
image/word flipping and carousel browsing without written instructions.
It has no menus, scoring, rewards, language picker, or end-of-deck screen.
The replay control is part of the word-side surface.

Every `UI-*` ID traces to product and behavior authority below. Image-first
navigation remains provisional under DEC-002. Restoring the last viewed card
and face across reloads and app restarts is selected behavior under DEC-005.
Numeric visual values are approved acceptance targets; final visual direction
remains open.

## 2. Layout and components

### UI-001 - Responsive activity shell

**Trace:** PRD-003, PRD-004; DEV-007, DEV-011.

Use a viewport-filling shell respecting device safe areas. Center one complete
rectangular bordered card with visible portions of its previous and next cards
when the deck has at least two cards. Neighbor peeks are actionable regions,
not full additional learning cards. No visible arrow navigation is required.

Layout-test range: 320 x 568 through 1024 x 768 CSS pixels and their
landscape orientations. This is a layout test range, not a confirmed device
support list. At least 48 CSS pixels of each neighbor's hit region must remain
visible and at least 8 pixels separate independent controls. Core controls must
not overlap, clip into safe areas, or require page-level horizontal scrolling.
At 200% text zoom, vertical scrolling is preferable to clipping or hiding words
and controls. The normal unzoomed shell fits the visual viewport.

### UI-002 - Current card and content faces

**Trace:** PRD-001, PRD-002, PRD-004; DEV-001, DEV-005, DEV-006.

The current card is the primary flip control. Image and word occupy the same
stable display region, with a visible boundary and no card-size jump on flip.
Fit the image without stretching or cropping meaningful content. Display only
the current face; the hidden word must not be exposed visually or to assistive
technology on the image side.

Render the target word in a clear, language-appropriate locally available
font with authored case/diacritics preserved. Target word size is
32 CSS pixels or larger; permit wrapping at appropriate language boundaries.
Never truncate a word with an ellipsis. Very long content must remain readable
through wrapping/reflow and content review, not arbitrarily tiny text.

The flip control and replay control must be semantic sibling controls, not
nested buttons. A presentational card surface may surround them.

### UI-003 - Neighbor cards and direction

**Trace:** PRD-003, PRD-004; DEV-007, DEV-008.

Neighbor previews show image-side content and a consistent card boundary.
Tapping a peek selects it; swiping left advances and right goes back according
to DEV-008. Do not expose previews as additional copies of the current target
word or as separate full-content screen-reader cards.

With one card, show no peeks or disabled arrow placeholders. With two cards,
both peeks may show the same other image; their accessible names distinguish
previous and next. Wrapping must not imply a quiz completion or reward.

### UI-004 - Pronunciation control

**Trace:** PRD-001, PRD-002, PRD-004; DEV-005, DEV-010.

Show a speaker replay button only on the word side, adjacent to but distinct
from the flip target. Its activation restarts pronunciation without flipping.
Provide visually distinct idle, playing, and unavailable states without relying
on color alone. Keep replay available while playing, since restart is allowed.
An audio error must not disable browsing or hide the word.

Use a speaker-with-warning cue and a short accessible status for failed audio;
activation retries. Do not represent silence as successful playback.

## 3. Application states

### UI-005 - Loading and fatal content failure

**Trace:** PRD-004, PRD-005, PRD-006, PRD-007; DEV-003, DEV-004, DEV-005.

| State | Visible surface | Available actions |
| --- | --- | --- |
| Loading | Simple non-flashing activity indicator in the shell; no interactive placeholder cards | Wait for bounded local load |
| Content unavailable | Clear unavailable-content icon, concise status, and retry icon/button | Retry the same launch context |
| Ready, image | Current image and any neighbor peeks | Flip or navigate |
| Ready, word | Written word, speaker button, and any neighbor peeks | Flip, replay, or navigate |
| Image unavailable | Broken-image/status cue in that card region; no substitute picture | Flip to the available word or navigate |
| Audio unavailable | Word retained with speaker warning and retry action | Retry audio, flip, or navigate |

Error states may use short supporting text for caregivers, but must have
non-text cues and identifiable actions for the learner. Loading and errors
must never claim successful learning, select another language, expose raw
stack traces, or display learner identifiers.

Accessible status copy must describe the actual state. Exact chrome language,
localized copy, fonts, and final icon assets remain review items before release;
do not assume English is suitable for every launch language.

## 4. Accessibility and motion

### UI-006 - Equivalent input and semantics

**Trace:** PRD-002, PRD-003, PRD-004; DEV-006, DEV-007, DEV-008, DEV-010.

Use focusable semantic controls for flip, previous/next peeks, replay, and
retry. Enter/Space activate the focused control once. Left/Right arrow keys
may browse when focus is within the carousel, following the physical direction
model in DEV-008; do not intercept keys outside it.

Provide accessible names equivalent to "Show word", "Show picture",
"Previous card", "Next card", "Play word again", and "Retry content".
Names are examples of meaning, not finalized English-only copy.
Do not include the hidden target word in the image-side control name.
Use non-answer-revealing image-face semantics such as "Picture card".

On navigation retain a stable logical focus target rather than losing focus
with replaced DOM. Announce card position and side politely, without forcing
automatic word speech in addition to the authored pronunciation. Audio never
replaces accessible controls. Hide off-face content and preview imagery from
the accessibility tree while retaining the named neighbor controls.

### UI-007 - Visual accessibility

**Trace:** PRD-004; DEV-005, DEV-008.

Targets are at least 48 x 48 CSS pixels, including exposed peek regions.
Normal text contrast is at least 4.5:1; large text at least 3:1. Control
boundaries, meaningful icons, and focus indicators have at least 3:1 contrast
against adjacent colors. Provide a visible keyboard focus ring not clipped
by the carousel. Do not rely on color, sound, or swipe alone to communicate
an available action or failure.

Final palette and illustrations require review; no third-party remote fonts,
icons, or imagery may be loaded at runtime.

### UI-008 - Transitions and reduced motion

**Trace:** PRD-002, PRD-003, PRD-004; DEV-008, DEV-010.

Target flip duration: 200 ms; carousel transition: 200 ms. Animate between
stable faces/positions without flashing or exposing mirrored unreadable text.
Apply DEV-008's input serialization across both transition types.
With `prefers-reduced-motion: reduce`, remove spatial flip/slide motion and
commit the same state change immediately. Reduced motion must not leave the
controls locked or alter audio and navigation semantics.

## 5. Observable acceptance scenarios

Each scenario inherits the traced `UI-*` definitions and DEVSPEC behavior;
it does not define a competing rule. Verification cases are derived separately.

### UI-AC-001 - Reveal and repeat (UI-002, UI-004, UI-006)

```gherkin
Given a valid deck is ready on the image side
When the learner activates the current card
Then the matching word is shown and its pronunciation is requested once
When the learner activates the replay button
Then pronunciation restarts without changing the card or side
When the learner activates the current card again
Then its image is shown and pronunciation stops
```

### UI-AC-002 - Browse and wrap (UI-001, UI-003)

```gherkin
Given a deck with at least three cards is showing its last card
When the learner activates the next neighbor
Then the first card becomes current
And it enters the image side under provisional DEC-002
When the learner performs a recognized right swipe
Then the last card becomes current without a flip from the same gesture
```

### UI-AC-003 - Missing language and media failures (UI-004, UI-005)

```gherkin
Given the launch language is missing or unsupported
When loading settles
Then content unavailable and retry are presented without language substitution
Given a valid deck has a failed pronunciation asset
When the learner reveals that word
Then the word remains visible and the audio-unavailable cue is presented
And flipping and browsing remain available
```

### UI-AC-004 - Keyboard and reduced motion (UI-006, UI-007, UI-008)

```gherkin
Given reduced motion is enabled and focus is on the current card
When the learner presses Enter once
Then the word side appears without spatial animation
And the control remains usable with visible focus
When the learner focuses replay and presses Space once
Then audio restarts without flipping the card
```

### UI-AC-005 - Small decks (UI-002, UI-003, UI-005)

```gherkin
Given a one-card deck is ready on the word side
When the learner swipes
Then no neighbor is shown and the card side does not change
```

### UI-AC-006 - Progress restoration (UI-002, UI-005)

```gherkin
Given the last viewed card and side were saved for this container user and content
When the WebView reloads or the app restarts
Then the saved card and side are restored
And pronunciation does not play until the learner activates replay
Given no valid saved state exists
When the activity opens
Then the first card is shown on its image side under DEC-002
```

## 6. Approval and unresolved presentation questions

The accessibility/layout values are approved. Select the final visual direction
before UI implementation. Resolve launch-language typography/direction and
chrome copy before content acceptance. Confirm actual device/WebView coverage
and learner usability protocol before claiming PRD-004 is met.
Revisit image-first navigation with Maria Lande; it remains provisional under
DEC-002. Verify localStorage restoration across reload and app restart in the
target WebViews. Do not add a visible completion concept to solve the still-open
reporting milestone.

## Change Log

2026-11-02 — Maria Lande (with Copilot) — Split small-deck and progress-restoration UI acceptance into separate scenarios.
2026-11-02 — Maria Lande (with Copilot) — Updated UI acceptance to restore the last viewed card and face across reloads and app restarts.
2026-10-28 — Maria Lande (with Copilot) — Created the initial UI-specification draft with PRD and behavior traceability, interface states, accessibility targets, and observable acceptance scenarios.
