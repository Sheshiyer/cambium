```markdown
# cambium Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill introduces the core development patterns, coding conventions, and workflows used in the **cambium** TypeScript codebase. The repository is organized for modular development, with a focus on visual engine features, project evidence/quests logic, and thorough documentation. It uses conventional commits, strict file naming, and a clear separation between implementation and testing.

## Coding Conventions

- **Language:** TypeScript
- **Framework:** None detected
- **File Naming:**  
  Use **kebab-case** for all file and directory names.
  ```
  // Good
  scene-manager.ts
  project-evidence.test.ts

  // Bad
  SceneManager.ts
  projectEvidenceTest.ts
  ```
- **Import Style:**  
  Use **relative imports** for modules within the project.
  ```typescript
  import { updateScene } from './scene-manager';
  ```
- **Export Style:**  
  Use **named exports** rather than default exports.
  ```typescript
  // scene-manager.ts
  export function updateScene() { /* ... */ }

  // Usage
  import { updateScene } from './scene-manager';
  ```
- **Commit Messages:**  
  Follow the **conventional commit** format with prefixes like `feat`, `fix`, `docs`.
  ```
  feat: add new lighting system to cambium-r3f engine
  fix: correct quest validation logic in hyphae
  docs: update verification plan for phase 2
  ```

## Workflows

### Add or Upgrade R3F Feature
**Trigger:** When adding or upgrading a visual feature in the cambium-r3f engine  
**Command:** `/add-r3f-feature`

1. Edit or add implementation files in `apps/cambium-r3f/src/scene/` and/or `apps/cambium-r3f/src/world/`.
2. Add or update corresponding test files (`*.test.ts`) in the same directories.
3. Update or add documentation or verification artifacts in `docs/plans/assets/cambium-r3f-game-engine-realignment/verification/`.
4. Update `tasks/todo.md` or `tasks/lessons.md` as needed.

**Example:**
```typescript
// apps/cambium-r3f/src/scene/lighting.ts
export function addLighting(scene) { /* ... */ }

// apps/cambium-r3f/src/scene/lighting.test.ts
import { addLighting } from './lighting';
test('adds lighting', () => { /* ... */ });
```

### Add or Update Project Evidence & Quests
**Trigger:** When implementing or updating project evidence and quests logic  
**Command:** `/update-project-evidence`

1. Edit or add implementation files in `bin/quine/hyphae/` (e.g., `project-evidence.ts`, `quests.ts`).
2. Add or update corresponding test files (`*.test.ts`) in the same directories.
3. Edit or add `bin/operator/quests/quests.ts` and its tests.
4. Update `package.json` if dependencies or scripts are changed.

**Example:**
```typescript
// bin/quine/hyphae/project-evidence.ts
export function validateEvidence(evidence) { /* ... */ }

// bin/quine/hyphae/project-evidence.test.ts
import { validateEvidence } from './project-evidence';
test('validates evidence', () => { /* ... */ });
```

### Document Feature or Phase
**Trigger:** When documenting a new feature, phase, or verification effort  
**Command:** `/add-docs-phase`

1. Add or update markdown documentation in `docs/plans/` or `docs/plans/assets/`.
2. Add or update verification images or JSON artifacts in `docs/plans/assets/`.
3. Update `tasks/todo.md` as needed.

**Example:**
```
docs/plans/phase-2-verification.md
docs/plans/assets/phase-2/diagram.png
docs/plans/assets/phase-2/verification-results.json
```

## Testing Patterns

- **Test Files:**  
  Test files are named with the `.test.ts` suffix and are located alongside their implementation files.
  ```
  scene-manager.ts
  scene-manager.test.ts
  ```
- **Framework:**  
  The specific testing framework is not detected, but tests follow standard TypeScript patterns.

- **Example Test:**
  ```typescript
  import { someFunction } from './some-module';

  test('should perform expected behavior', () => {
    expect(someFunction()).toBe(true);
  });
  ```

## Commands

| Command                | Purpose                                                        |
|------------------------|----------------------------------------------------------------|
| /add-r3f-feature       | Add or upgrade a visual feature in the cambium-r3f engine      |
| /update-project-evidence | Implement or update project evidence and quests logic         |
| /add-docs-phase        | Add or update documentation and verification artifacts         |
```
