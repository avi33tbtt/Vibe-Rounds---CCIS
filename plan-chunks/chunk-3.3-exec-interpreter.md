# Chunk 3.3-exec-interpreter: Executor part 1, the whitelist expression interpreter

_Phase 3, Stage 2 (written 2026-11-24). Needs: 3.2 (done). This chunk file is docs only; the interpreter is built at the next "do next" after the owner approves it. No schema change and no spec amendment is proposed._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis/SPEC.md` CCIS-REQ-062 to 070, 072, 073, 075 (section "What the engine may and may not do"); `ccis/schemas/analytics.schema.json` (`$defs.expr`, `operatorSet`, `computation`, `parameters`, `executionProfile`); `ccis-compile.js` (`canonicalize`, `checksumOf`, `verifyChecksum`); `ccis-compat.js` (the `runtime` shape and `limits`, which this module must be able to fill); the four snake analytics files in `ccis/examples/snake/` (0.1.0 and 0.1.1); `ccis-demo-exec.js` for prior art only (its `prescan`, three-valued rules and `SUPPORTED` table; it is replaced, not copied).

## What this row is for

Build the **engine core** that 3.4 and 3.5 stand on: a pure interpreter that evaluates one declarative expression tree to one value, using a fixed set of permitted operations, three-valued logic and enforced limits (REQ-063, 066, 067, 068, 069). It does not read the context, does not walk decision nodes, does not build run results and does not touch units or time arithmetic. Those are 3.4 and 3.5. Pure functions: no file access, no network, no clock, no randomness, no `eval`, `Function`, dynamic import or computed property dispatch on package-supplied names.

## What earlier rows found (the build must handle each)

1. **The schema has 18 operators; the 3.4 brief names others.** The `expr` enum is: `and or not is-present state-of eq ne lt le gt ge add sub time-diff convert if count select`. The plan's 3.4 brief lists "first/last/min/max, coalesce", which are not in that enum, so no valid package can use them. Recorded as finding F-9 (D-115). The enum is not changed here. 3.4's chunk file must decide between an amendment and expressing them with the existing operators.
2. **This row implements 12 of the 18** (the ones that need no units, no time and no tables): `and or not is-present state-of eq ne lt le gt ge if`. `add sub time-diff convert count select` are on the whitelist but **not yet implemented**; a tree using one is refused as a whole (X-002) before anything runs. Result: the four snake analytics all use `time-diff`, `convert`, `count` or `select`, so they prepare with refusal X-002 until 3.4. That is expected and is tested.
3. **Nothing in a package says what a missing or conflicting input means in words.** The demo keeps warning and missing-data wording in tables (D-047). Not this row; finding for 3.4.
4. **3.1 sorts records by id and drops rejected ones.** This module never sees records. It receives already-bound values (below). Binding the context to inputs is 3.4's job and must not depend on record order.
5. **Parameters are disabled by default (D-112).** The interpreter takes parameter values and an `enabled` flag per parameter from its caller; how a clinician's enabled values reach a run is the open D-112 item for 3.5. Here a parameter with `enabled: false` is **unknown, because parameter-not-enabled**, never a default value (REQ-072).
6. **Demo semantics are the guide, not the law.** Where `ccis-demo-exec.js` and the schema agree, keep them. Where the demo patched package meaning (D-047, D-050, F-6), this row does not.

## The design (owner approves by approving the chunk file; at most three rows in `DECISIONS.md`)

**Module** `ccis-exec.js` (pure; imports only `./ccis-compile.js` for `canonicalize`, `checksumOf`). Exports `prepareAnalytic`, `evaluateOutput`, `UNKNOWN_KIND`, `EXEC_REFUSALS`, `IMPLEMENTED_OPS`, `WHITELIST_OPS`, `ENGINE`, `OPERATOR_SET`, `RUNTIME_LIMIT_FIELDS`. Constants: `ENGINE = { name: 'ccis-exec', version: '0.1.0' }`, `OPERATOR_SET = { name: 'ccis-core-ops', version: '0.1.0' }`. 3.2's `runtime` is filled from these by the caller.

**Two calls, because the engine runs only a prepared, pinned form (REQ-064).**
1. `prepareAnalytic({ analytic, checksum, runtime })`: recomputes the canonical checksum of `analytic` with 2.4's code and refuses (X-012) when it differs from `checksum`. It then runs **static checks over every computation tree before anything is evaluated** and lists **all** static refusals, sorted by output id then path, not just the first. On success it returns a deep-frozen prepared object, registered in a module-level `WeakSet`; `evaluateOutput` accepts nothing else (an authoring document, a plain copy or a mutated clone gives X-012).
   Static checks: operator on the whitelist (X-001) and implemented (X-002); argument count (X-003); every `ref` names a declared input, parameter or conversion (X-004); structure rules (X-005: `is-present` takes one input or parameter reference, `state-of` one input reference, a `conversion` reference only as the second argument of `convert`, a `set` parameter only inside `select` or `is-present`); tree depth within the package's `maxDepth` (X-006); operator set name and major equal to `OPERATOR_SET` (X-007); package limits valid and not above `runtime.limits` (X-008); no output with two computations or a computation for an undeclared output (X-004).
2. `evaluateOutput({ prepared, outputId, inputs, parameters })`: evaluates one output's tree. Returns `{ ok: true, value, steps }` or `{ ok: false, refusal: { id, meaning } }`. **Never a partial value** (REQ-069): any limit or type refusal discards everything.

**Value model** (all plain frozen objects, JSON-serialisable, canonical form safe):
- `{ t: 'bool', v }`, `{ t: 'text', v }` (a label or an epistemic state name), `{ t: 'instant', ms }` (integer UTC milliseconds; produced by 3.4, compared here), `{ t: 'number', v, unit }` (finite only; unit a string).
- `{ t: 'unknown', because: [...] }`. `because` lists `{ kind: 'input' | 'parameter', id, state }`, deduplicated and sorted by kind, id, state, so the **reason and the distinct state survive** (absent, unknown, not-collected, conflicting, parameter-not-enabled, unreadable). Unknown never becomes false, a value or a default (REQ-066).
- **Inputs arrive bound:** `inputs[key]` is `{ state, value? }` where `state` is one of the six epistemic states plus `conflicting`; `value` is a value-model object and exists only when `state` is `present`. A `present` input without a usable value is unknown with state `unreadable`, never zero or empty. `entered-in-error` is not a state here (3.1 already removed it, REQ-034).
- **Parameters arrive bound:** `parameters[id]` is `{ enabled: boolean, value? }`. Disabled or missing: unknown, `parameter-not-enabled`.

**Operator rules (implemented set).**
- `and`, `or`, `not`: Kleene three-valued logic. `and`: false if any argument is false, else unknown if any is unknown, else true; `or` dually; `not` of unknown is unknown. **All arguments are always evaluated** (no short-circuit), so step counts and `because` lists do not depend on argument order. Non-boolean argument: X-010.
- `is-present(ref)`: a statement about the record, so always true or false, never unknown: true only for an input in state `present` (with a usable value) or an enabled parameter; false for every other state. `state-of(input)`: the state name as `text`. Use `eq` against a state name to ask for a specific state; this is how the snake trees tell "explicitly negative" from "absent".
- `eq`, `ne`: both sides must be the same type (and, for numbers, the same unit); otherwise X-010. An unknown on either side gives unknown. No coercion between text, number and instant.
- `lt le gt ge`: numbers of the same unit, or instants. Anything else X-010. Unknown in gives unknown out. **No implicit unit conversion** (convert is 3.4).
- `if(cond, then, else)`: evaluates `cond` only; true takes `then`, false takes `else`; **unknown condition gives unknown without evaluating either branch** (it never picks a branch). The unknown carries the condition's `because`.
- Anything else on the whitelist: X-002 at prepare. Anything off it: X-001.

**Limits (REQ-069).** `maxSteps` counts every node visited (operators and leaves); exceeding it gives X-009 and no value. `maxDepth` is checked at prepare (X-006) and defended at run. `maxOutputBytes`: the canonical JSON of the returned value must not exceed it, else X-011. The package's `executionProfile` applies; a profile above `runtime.limits` is X-008 at prepare. No timers, no recursion on package-controlled data beyond the checked depth (the walker is iterative or depth-bounded).

**Refusal catalogue** `EXEC_REFUSALS` (frozen; id, meaning; meanings are fixed sentences that never echo package or patient content): X-001 operator not on the whitelist; X-002 operator on the whitelist but not implemented in this engine version; X-003 wrong number of arguments; X-004 a name is not declared by the package (or an output has no or two computations); X-005 a reference used where its kind is not allowed; X-006 expression deeper than the limit; X-007 operator set not supported; X-008 limits invalid or above the runtime ceilings; X-009 step limit exceeded; X-010 operands of unlike type or unit; X-011 output larger than the limit; X-012 not a prepared analytic (unprepared, copied, mutated, or checksum mismatch); X-013 a number would be not finite; X-014 a bound input or parameter is malformed.

## Build

1. `ccis-exec.js` as above.
2. `test/ccis-exec.test.js`, with these checks:
   - (a) **Truth tables.** `and`, `or`, `not` over true, false, unknown, hand-written for every pair; `if` with unknown condition evaluates no branch (proved by a step count and by a branch that would be refused if visited).
   - (b) **Unknown stays unknown.** Each of absent, unknown, not-collected, conflicting, a disabled parameter and an unreadable present value gives unknown with its own state in `because`; none gives false, zero, empty or a default; `is-present` is false (not unknown) for each; merged `because` lists are deduplicated and sorted.
   - (c) **Comparison rules.** Same-type same-unit only; text against number, number against instant, and two different units each give X-010; `ne` is the negation of `eq` and keeps unknown.
   - (d) **Static checks.** One tree per refusal X-001 to X-008 and X-012 (an unprepared copy, a mutated clone, a checksum that does not match); all refusals listed together, sorted; nothing evaluated when any exists.
   - (e) **Real packages.** The four snake analytics (0.1.0 and 0.1.1) prepare with exactly X-002 refusals naming the not-yet-implemented operators and no other id, checksums taken from 2.4's `canonicalize`; a hand-built tree in the shape of the interval analytic's outer `if` chain (presence and state tests only) evaluates to the hand-calculated outputs for each input-state combination.
   - (f) **Limits.** A tree one step over `maxSteps` gives X-009 and no value; one level over `maxDepth` gives X-006; a value over `maxOutputBytes` gives X-011; a profile above the runtime ceilings gives X-008; no partial value in any case.
   - (g) **Determinism and safety.** Same bytes twice; argument and key order of `inputs` and `parameters` irrelevant; inputs, parameters and the prepared object not mutated (frozen); a package-supplied name such as `__proto__`, `constructor` or `toString` is refused or read as an undeclared name (X-004), never dispatched; a pure-library scan (imports: `./ccis-compile.js` only; no `eval`, `Function`, `import(`, `Date`, `Math.random`, `process`, `fs`).
3. `README.md` ("Executor" paragraph: what is implemented, what is refused until 3.4), `DECISIONS.md`, tracker.

**Not in this row:** binding the context to inputs; `add sub time-diff convert count select`; any new operator; decision-node walking; run results, output-contract checks and run records (3.4, 3.5); the CLI; the demo executor (kept as is until replaced in 3.7); disabled-parameter wording; any schema or spec change.

## Questions for the owner (defaults apply if you only say "approve")

1. No short-circuit in `and` and `or`: all arguments are always evaluated, so cost and reasons are order-independent? Default: yes.
2. `is-present` is always true or false (a statement about the record), and a disabled parameter is "not present"? Default: yes.
3. `prepareAnalytic` requires the pinned checksum and refuses a mismatch, so only compiled, pinned artefacts run (REQ-064)? Default: yes.
4. A tree using an operator that is on the whitelist but not yet implemented refuses the **whole** analytic at prepare, so the snake packages cannot run until 3.4? Default: yes (no half-evaluated analytics, as in D-049).
5. No implicit unit conversion in comparisons: unlike units are X-010, not unknown and not converted? Default: yes.

**Done when:** the truth tables, unknown-state, comparison, static-check, real-package, limit and determinism checks pass, every refusal id X-001 to X-012 is reached once by a test, and three deliberate breakages (let `and` return false when one argument is unknown and none is false; pick the `then` branch on an unknown condition; skip the checksum comparison in prepare) are each seen failing a test. The owner runs or skips `npm test` as instructed in that session.

**Size guard:** 1 new module, 1 test file, README, DECISIONS, tracker; no CLI, no schema change. If more is needed, split the limits and the pinned-form check into row `3.3a`.
