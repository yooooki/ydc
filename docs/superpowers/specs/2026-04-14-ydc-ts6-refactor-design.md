# YDC TS 6 Refactor Design

**Date:** 2026-04-14

**Goal**

Refactor `src/index.ts` into multiple focused modules, preserve existing runtime behavior, and eliminate the TypeScript 6.0.2 diagnostics currently reported for the plugin.

**Constraints**

- Existing command behavior must remain unchanged.
- The public plugin surface stays the same: `name`, `inject`, `Config`, and `apply()`.
- Refactoring should reduce coupling and implicit state instead of only silencing diagnostics.
- Type fixes should prefer explicit narrowing, domain types, and small helpers over broad `as any` casts or blanket non-null assertions.

**Current Problems**

- `src/index.ts` mixes configuration, schema, module augmentation, filesystem setup, shared runtime state, command registration, message parsing, and image helpers in one file.
- Koishi command callbacks access `argv.session` and `argv.options` directly even though Koishi types model them as optional.
- Several data structures are typed as `object` or inferred as `{}`, which breaks under TypeScript 6 indexed-access checks.
- Message element parsing assumes fields such as `attrs.id`, `attrs.src`, and `attrs.file` always exist.
- Shared mutable state such as generation locks is hidden inside a single large function, which makes reasoning and testing harder.

**Recommended Approach**

Perform a conservative modular refactor:

1. Keep command semantics and data flow intact.
2. Introduce a small runtime layer that owns shared paths, config, and locks.
3. Move commands into grouped modules by responsibility.
4. Introduce narrow helper functions for common Koishi invariants and parsed message elements.
5. Replace weak object types with explicit interfaces and `Record<string, ...>` structures.

This approach keeps the change set behaviorally safe while still improving maintainability.

**Target File Structure**

- `src/index.ts`
  Plugin entry only. Exports plugin metadata, schema, and `apply()`. Delegates setup and command registration.
- `src/config.ts`
  Shared plugin config interface and schema.
- `src/runtime.ts`
  Runtime context builder for paths, locks, and config-derived values.
- `src/koishi-augment.ts`
  Koishi module augmentation currently embedded in `index.ts`.
- `src/commands/admin.ts`
  `review`, `accept`, `deny`, `dummy`, and small hidden management commands.
- `src/commands/statistics.ts`
  `dcw`, `dcstatistics`, and `csm`.
- `src/commands/records.ts`
  `ydc` and `dccr`.
- `src/utils/argv.ts`
  Helpers to narrow required `session` and optional `options`.
- `src/utils/message.ts`
  Message parsing helpers for `at` and `img` elements.
- `src/utils/files.ts`
  Path helpers and image MIME helpers.
- `src/utils/collections.ts`
  Typed helpers for grouped counters and range parsing if needed.

The exact split can be adjusted during implementation, but `index.ts` should end as a thin composition root rather than a command container.

**Type Strategy**

For the TypeScript 6 issues:

- Guard or narrow `argv.session` before use in each command path that requires it.
- Guard or normalize `argv.options` access where command options are used.
- Replace `object`-typed maps with named interfaces or `Record<string, number>`.
- Replace ad-hoc tuple and union usage with named local types when the meaning matters.
- Use helper functions for parsed message elements so the rest of the command code can operate on validated values.
- Only use non-null assertions when the invariant is enforced immediately above and cannot be represented more clearly.

**Behavior Preservation Rules**

- Keep command names, aliases, help text, and hidden flags unchanged.
- Keep database table names, payload shapes, and field names unchanged.
- Keep file layout on disk unchanged, including temp and permanent image paths.
- Keep asynchronous ordering unchanged unless current ordering is only re-expressed more clearly.
- Keep user-facing returned text and sent message content unchanged unless a type fix requires an impossible path to be handled explicitly.

**Testing And Verification**

Primary verification is type-level because the reported regression is type-checking related.

- Add a repeatable verification command that checks the plugin with TypeScript 6.0.2.
- Keep the existing project TypeScript check passing as well.
- If practical, add a small focused test around pure helpers introduced during the refactor, but do not invent broad runtime tests unrelated to the current problem.

Minimum success criteria:

- TypeScript 6.0.2 reports zero diagnostics for `external/ydc/tsconfig.json`.
- The project-local TypeScript version still reports zero diagnostics for the same config.
- The plugin exports and command registrations remain intact after the split.

**Risks**

- Moving command code across files can accidentally change closure-captured state or initialization order.
- Type guards can unintentionally alter behavior if they reject states that Koishi previously tolerated.
- Extracted helpers can hide logic changes if they do more than validation.

These risks are controlled by preserving current data flow, keeping helpers small and explicit, and verifying type checks against both TypeScript versions.

**Implementation Outline**

1. Extract configuration and module augmentation into dedicated files.
2. Introduce runtime and helper modules without changing command behavior.
3. Move command groups into separate files.
4. Fix TypeScript 6 diagnostics with explicit narrowing and stronger local types.
5. Run both TypeScript verification paths and inspect any residual diagnostics.
