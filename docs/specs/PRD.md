# PRD - Flashcards

| | |
| --- | --- |
| **Title** | Flashcards - Product Requirements Document |
| **Status** | Approved - version 1.1.1; open decisions remain recorded |
| **Version** | 1.1.1 |
| **Last updated** | 2026-11-02 |
| **Owner/Author** | Maria Lande (with Copilot) |

> This PRD draws its product intent from the
> [Flashcard Specification Brief](../Flashcard%20Spec%20Brief.md), its delivery
> constraints from the [Curious Reader container contract](../third-party-game-spec.md),
> and its proposed carousel-based release scope from the
> [project overview](../../README.md). It specifies the product, not an existing
> implementation. Detailed behavior, architecture, presentation, and verification
> belong in downstream specifications that reference this document.

---

## 1. Product summary

Flashcards is a children's literacy game for exploring connections between
images, written words, and spoken words. A learner browses a deck, taps a card
to reveal its word and hear it spoken, and revisits cards at their own pace.
The deck is presented as a carousel.

Beginning readers need opportunities to connect familiar objects and concepts
to unfamiliar written forms. An image provides meaning, a written word
provides its visual label, and spoken audio provides a pronunciation model.
Repeatable exploration lets the learner revisit those connections without
time pressure or penalties.

The game is distributed inside **Curious Reader**, an offline-first literacy
app that runs installed web games in an embedded WebView. The complete core
activity must remain playable without network access.

This is an exploratory learning activity, not a scored quiz. Its intended
outcome is greater familiarity with the relationship between a pictured
concept, its written name, and its pronunciation.

## 2. Goals

- Connect pictured concepts to their written names and spoken pronunciation.
- Encourage unrestricted repetition and learner-paced vocabulary exploration.
- Make flipping and browsing discoverable without written instructions,
  including on small touch screens.
- Keep the learning activity fully available offline within Curious Reader.
- Let content contributors supply ordered decks and language-appropriate media
  without changing the product's learning purpose.

### Product requirements and acceptance

These are approved product requirements for the first release. IDs are stable
anchors for downstream traceability; implementation requires resolution of
blocking open decisions and approved downstream specifications.

| ID | Product requirement | Product acceptance criterion |
| --- | --- | --- |
| PRD-001 | Connect each pictured concept to its written and spoken word. | Every released card has an image, a matching written target word, and matching spoken audio, reviewed for the intended language and audience. |
| PRD-002 | Let learners reveal and revisit an association at their own pace. | A learner can move between a card's image and word repeatedly; revealing the word plays its pronunciation. Repetition has no timer, score, or penalty. After a reload or app restart, the activity resumes at that learner's last viewed card and face; restoring the word face does not play audio until the learner activates replay. |
| PRD-003 | Let learners explore an ordered deck through a carousel. | A learner can move backward and forward through the supplied deck and revisit earlier cards without completing a challenge or unlocking content. |
| PRD-004 | Make the core activity approachable to beginning readers on touch devices. | Representative learners can discover card flipping and deck navigation without written instructions; core actions remain usable on the agreed small-screen devices. |
| PRD-005 | Support reliable use without connectivity after content is installed. | The complete core activity, including images and pronunciation audio, remains available in Curious Reader with the device offline. |
| PRD-006 | Allow vocabulary and language content to vary while preserving the same learning activity. | The game can present a supplied deck in its defined order with language-appropriate images, words, and audio; launch languages and content require separate approval. |
| PRD-007 | Fit the Curious Reader delivery and usage-reporting context. | The activity can be delivered within the container under its published contract, and required usage reporting does not interrupt learning or require a separate learner account. |

## 3. Personas

| Persona | Description | Needs |
| --- | --- | --- |
| **Learner** | A child beginning to associate pictures with written words; exact age and literacy range remain open | Concrete images, clear pronunciation, simple touch controls, and repeatable exploration without penalties |
| **Caregiver or educator** | An adult supporting a child's vocabulary exploration | A shared prompt for naming, listening, and discussing familiar concepts |
| **Content author** | A contributor preparing vocabulary decks and language-specific media | A predictable way to supply ordered card content with matching images, written words, and audio |
| **Container integrator** | The Curious Reader team delivering the activity | A self-contained game that meets offline delivery and usage-reporting requirements |

Independent exploration is the intended experience; adult assistance may
support introduction and use. The primary context is a touch device,
including small screens, in low-connectivity environments.

## 4. Key user scenarios

1. A learner with no saved progress opens the activity and sees a picture.
  They tap the card to reveal its written word and hear its pronunciation,
  then flip it back and repeat at their own pace.
2. A returning learner reopens the activity and resumes the last viewed card
  and face.
3. A learner browses forward and backward through the carousel and revisits
   an earlier card without answering a question or unlocking content.
4. A caregiver or educator explores a deck with a child, using its images
   and spoken words as prompts for vocabulary discussion.
5. A content author supplies card definitions, their display order, and
   matching media for the intended language.
6. A container integrator installs the game and its content, launches it
   inside Curious Reader offline, and verifies that the activity and required
   usage reporting work without interrupting learning.

## 5. KPIs / success signals

| Measure | Definition and evidence | Approval needed |
| --- | --- | --- |
| Discoverability | Proportion of representative learners who independently reveal a word, hear it, move to another card, and revisit a card in an observed session | Audience, sample size, observation window, and pass threshold |
| Content readiness | Proportion of launch cards whose image, word, and pronunciation have been approved together | Target: 100%; named language/content reviewer |
| Offline completeness | Availability of every core learning action and all released media during an offline session in Curious Reader | Target: 100%; supported device set |
| Repeat engagement | Card revisits and repeated word reveals during observed sessions | Baseline and interpretation; do not treat repetition as proof of learning |
| Learning signal | Change in recognition of the introduced image/word associations in a suitable learner evaluation | Evaluation design, consent arrangements, and target before making efficacy claims |

These are proposed evaluation measures, not authorization to add telemetry or
collect child data. Use observation or the container's permitted usage reporting
as appropriate; any additional data collection requires explicit review.

## 6. Scope tiers (from the source brief)

The historical workshop brief defines three progressively richer tiers.
They describe the interaction's evolution, not three separately authorized
releases. The proposed first release includes the **Great** carousel
experience, consistent with the current project overview.

### MVP

- A card presents an image and can reveal the corresponding written word.
- Revealing the word plays its pronunciation audio.
- Images fit within the card display area.
- A supplied JSON file defines the cards and their display order.
- Each card has an associated image, written target word, and audio.

### Better (adds to MVP)

- Learners can navigate to previous and next cards using arrows.
- Learners can flip each card back and forth as often as they want.

### Great (builds on Better, replacing arrow navigation)

- A carousel shows one full card and portions of its neighboring cards.
- Learners can tap a neighboring card or swipe to browse the deck.
- Tapping the current card animates its flip between image and word.
- Repetition and backward/forward browsing remain unrestricted.

Language-specific content is supported as a product capability; delivering
multiple launch languages is not assumed. Exact launch deck size and content
are not fixed by this draft.

## 7. Non-goals

- Quizzes, answer checking, scores, rewards, leaderboards, or timed challenges.
- Adaptive difficulty, spaced repetition, or personalized learning paths.
- Learner registration, social features, or a caregiver/teacher dashboard.
- In-game deck authoring, content downloads, or language selection.
- A complete reading curriculum or claims of demonstrated learning efficacy.
- Network-dependent gameplay, remote media, or direct network analytics.

## 8. Milestones (conceptual, not a build order)

1. **M1 - Product and specification agreement:** approve audience, learning
   purpose, release scope, and blocking decisions; derive and review behavior,
   presentation, and verification requirements against the product requirements.
2. **M2 - Core association activity:** demonstrate image-to-word flipping and
   pronunciation with a reviewed, content-supplied deck.
3. **M3 - Carousel exploration:** demonstrate repeatable flipping and
   backward/forward browsing through the proposed Great-tier experience.
4. **M4 - Container readiness and product acceptance:** demonstrate offline
   operation and required usage reporting in Curious Reader; review content,
   usability, and agreed success measures; obtain explicit human release approval.

No schedule, completion, or implementation authorization is implied.

## 9. Constraints inherited from the container

- The game runs as a self-contained HTML/CSS/JavaScript activity in an embedded
  WebView from a local `file://` origin, without a web server.
- All required content and assets are installed locally and use relative
  paths; gameplay must not depend on network availability or Service Workers.
- Language and the container-assigned learner identity come from the launch
  context; the game does not require separate learner registration.
- Required usage reporting uses the container's `cr_event` bridge, not direct
  network analytics, and must not interrupt the learning activity.
- Delivery packaging and compatibility must follow the published container
  contract; the packaging layout remains a downstream decision.

The historical brief's React Native workshop context does not override the
current Curious Reader web-game delivery contract.

## Open decisions and risks

- **Audience and usability:** agree age/literacy range, accessibility needs,
  representative participants, and supported devices before setting usability
  acceptance thresholds.
- **Launch content:** agree language, vocabulary, deck size, asset ownership
  and permissions, and a qualified content reviewer before release.
- **Learning evidence:** agree evaluation targets before interpreting outcomes
  or claiming educational effectiveness.
- **Interaction details:** resolve deck boundaries, card state when revisiting,
  and audio replay behavior in downstream specifications before implementation.
- **Delivery acceptance:** confirm container compatibility and required usage
  reporting before release; this PRD authorizes no upload, publication, or
  permanent game identity reservation.

## Sources

- [Project overview](../../README.md).
- [Flashcard Specification Brief](../Flashcard%20Spec%20Brief.md), Curious
  Learning, 2017-04-11: original pedagogical objective and interaction scope.
- [Curious Reader third-party game contract](../third-party-game-spec.md),
  v1.8: delivery context and offline constraints; technical details remain
  authoritative in that contract.
- [Spec-Driven AI Development: Engineering Discipline for the AI Coding Era](https://medium.com/@guruduth.banavar/spec-driven-ai-development-engineering-discipline-for-the-ai-coding-era-22a678067b1c),
  Guru Banavar: conceptual PRD scope, traceability, and deliberate revision.

## Change Log

2026-11-02 — Maria Lande (with Copilot) — Added restoration of each learner's last viewed card and face across reloads and app restarts.
2026-10-28 — Maria Lande (with Copilot) — Approved the first version of the Flashcards PRD with open decisions recorded.
