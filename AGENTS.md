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

1. `docs/specs/PRD.md` for product goals and scope.
2. `docs/specs/DEVSPEC.md` for authoritative system behavior and architecture.
3. `docs/specs/UISPEC.md` for user-facing layout, state, and accessibility requirements.
4. `docs/specs/TESTSPEC.md` for required verification.

When specifications and code differ, do not silently choose code. Identify the discrepancy, propose the required spec or code change, and get approval before intentionally changing behavior.

## Required Task Workflow

1. Before coding, create a task plan that names the relevant requirement IDs or sections in the four specifications and defines the validation method from `TESTSPEC.md`.
2. Implement behavior covered by approved specs. If the requested implementation would add to, contradict, or differ from the specs, explain the discrepancy and proposed change and obtain explicit approval before implementation. Update affected specs to reflect the approved change.
3. Run the required automated and manual checks from `docs/specs/TESTSPEC.md` and report results in the task response.
4. Do not update specs merely because an implementation step is completed, tested, or human-approved. Specs define requirements, not implementation progress or execution logs. Do not update the implementation plan unless requested.

## Change Summaries

When fixing an error or making a code change, include a concise summary in the
response explaining what changed and what caused or justified the fix. Include
the relevant coding details, such as added, modified, or removed variables,
functions, components, styles, or tests, and describe their effect.

## When a Spec Update Is Necessary

Update specs only for an approved requirements/behavior change or a necessary, approved clarification or correction. Routine implementation of existing requirements does not require a separate Spec Update task.

When a spec update is necessary, for every affected spec:

1. Update `Status`.
2. Update `Last updated` to the current date in `YYYY-MM-DD` format.
3. Increment semantic versioning: patch for clarifications, minor for meaningful additions or behavior changes, and major for a replacement document.
4. Add a newest-first changelog entry at the bottom using exactly:

```text
YYYY-MM-DD — <author> — <one-sentence description of change>
```

5. Return a concise list of all spec changes, explicitly identifying additions, removals, and modified requirements.

Do not update changelogs for unapproved exploratory work. Do not claim human approval; wait for it to be stated by the user or review process.