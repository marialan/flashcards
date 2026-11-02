# Agent Instructions

## Project Overview

This project is a children's literacy flashcard game that teaches image-to-word associations. Learners browse cards, flip between each image and its target word, hear the word audio, and navigate the deck as a carousel. 

A JSON file contains card definitions and the order in which they should be displayed.

Curious Reader delivery follows the third-party game contract: a self-contained, offline-capable HTML/CSS/JavaScript game with relative local assets, packaged for an embedded WebView and using its `cr_event` bridge for usage reporting.

## Technology Stack

- React
- Typescript
- Vite

## Development Philosophy

- Prefer simple solutions.
- Prefer readable code over clever code.
- Minimize dependencies.
- Refactor only when necessary.

## User Experience Principles

- Mobile first.
- Large touch targets.
- Support small screens.
- Avoid cluttered interfaces.
- Interactions should be understandable without instructions.

## Architecture Rules

- Keep components focused on a single responsibility.
- Extract reusable logic into hooks.
- Avoid deeply nested component trees.
- Prefer composition over inheritance.

## Styling

- Keep styling consistent.
- Reuse existing design patterns.
- Avoid introducing additional styling frameworks.

# Spec-Driven Delivery Instructions

## Source of Truth

For every implementation, bug fix, refactor, dependency, build, data, test, or UI task in this repository, read and use these documents before making a plan:

1. `docs/PRD.md` for product goals and scope.
2. `docs/DEVSPEC.md` for authoritative system behavior and architecture.
3. `docs/UISPEC.md` for user-facing layout, state, and accessibility requirements.
4. `docs/TESTSPEC.md` for required verification.

These are stored under `docs/specs`.

When specifications and code differ, do not silently choose code. Identify the discrepancy, propose the required spec or code change, and get approval before intentionally changing behavior.

## Required Task Workflow

1. Before coding, create a task plan that names the relevant requirement IDs or sections in the four specifications and defines the validation method from `TESTSPEC.md`.
2. Implement only behavior covered by approved specs. For new behavior, update the appropriate specs before implementation or explicitly obtain approval to do so as part of the task.
3. Run the required automated and manual checks from `TESTSPEC.md`.
4. After a task is complete, tested, and human-approved, create and complete a separate **Spec Update** task before beginning unrelated work.

## Spec Update Task

For every affected spec, the task must:

1. Update `Status`.
2. Update `Last updated` to the current date in `YYYY-MM-DD` format.
3. Increment semantic versioning: patch for clarifications, minor for meaningful additions or behavior changes, and major for a replacement document.
4. Add a newest-first changelog entry at the bottom using exactly:

```text
YYYY-MM-DD — <author> — <one-sentence description of change>
```

5. Return a concise list of all spec changes, explicitly identifying additions, removals, and modified requirements.

Do not update changelogs for unapproved exploratory work. Do not claim human approval; wait for it to be stated by the user or review process.