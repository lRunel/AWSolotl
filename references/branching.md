# Branch and merge protocol

Two people, two branches, one `main`. The whole protocol exists to answer one question:
*can the other person pull `main` right now and still have a working system?* If the answer
is no, do not merge.

## Branch model

```
main                  always deployable, protected, no direct pushes
 ├── feat/a/<topic>    Person A, one branch per topic
 └── feat/b/<topic>    Person B, one branch per topic
```

Branch names: `feat/a/ledger`, `feat/a/broker`, `feat/b/gate2-cedar`,
`feat/b/rule-compiler`, `fix/a/token-expiry`, `chore/shared/schemas`.

One branch per topic, not per person per iteration. Short-lived branches (hours, not days)
keep merges trivial. A branch that lives longer than one iteration is a warning sign.

## The ownership map

Merge conflicts in a two-person project come almost entirely from two people editing the
same file. Path ownership is the cheapest prevention available.

| Path | Owner | Rule |
|---|---|---|
| `infra/iam_stack.py`, `demo_stack.py`, `observe_stack.py`, `ui_stack.py` | A | A only |
| `infra/control_stack.py` | A | A only; B requests a table or parameter via an issue |
| `infra/brain_stack.py` | B | B only |
| `services/demo-app/**` | A | A only |
| `control/orchestrator.py`, `gate1.py`, `gate3.py`, `gate5.py`, `broker.py`, `ledger.py` | A | A only |
| `control/registry.py`, `gate2.py`, `gate4.py`, `sensors.py` | B | B only |
| `memory/**`, `connectors/**`, `rules/**`, `invariants/**` | B | B only |
| `causal/**`, `agents/**` | B | B only |
| `brakebench/runner/**` | A | A only |
| `brakebench/plans/**` | B | B only |
| `ui/gates.js`, `ui/ledger.js` | A | A only |
| `ui/rules.js`, `ui/ask.js` | B | B only |
| `ui/index.html`, `ui/app.css` | shared | Append-only sections marked with owner comments |
| `schemas/**` | shared | Both must approve; see below |
| `docs/<component>.md` | whoever owns the component | One file per component, never one shared file |
| `README.md` | shared | Append-only sections; A owns setup, B owns the rule and invariant tables |

If a task needs a file you do not own, do not edit it. Open an issue titled
`[needs: A]` or `[needs: B]` describing the exact change, and work around it with a stub in
the meantime.

## Shared-path protocol (`schemas/`, `ui/index.html`, `README.md`)

1. Announce it in the standup channel before starting.
2. Branch from a fresh `main` (`chore/shared/<topic>`).
3. Make the change as small as possible, touching nothing else.
4. For `schemas/`: bump `schema_version`, update both producer and consumer, update the
   fixtures, and note the change in `docs/contracts.md`.
5. Open the PR, get the other person's approval, merge immediately.
6. Tell the other person to rebase.

Schema changes after Iteration 0 need a reason worth interrupting the other person for. A
new optional field with a default is usually fine; a renamed or removed field is not.

## Commit discipline

Conventional commits, scoped by component:

```
feat(gate2): enforce signed org rules with source citation
fix(broker): honour the 2048-char session policy limit
test(ledger): add tamper detection at record k
chore(schemas): bump action_plan to v3, add citation field
docs(gate3): note ECS has no DryRun
```

Keep commits small enough that the diff fits on one screen. A commit that touches more than
about ten files is almost always two commits.

## Daily loop on a feature branch

```bash
git checkout main && git pull origin main
git checkout -b feat/a/ledger

# ... work, committing often ...

git fetch origin
git rebase origin/main          # rebase, do not merge main into the branch
pytest -q                       # must pass after the rebase, not before
git push --force-with-lease origin feat/a/ledger
```

Rebase rather than merge so `main` keeps a linear history that is readable at 3 a.m. Always
`--force-with-lease`, never bare `--force`, so you cannot silently discard the other
person's push.

## Integration points

Merge to `main` at every iteration exit test, and any time a contract stub becomes real.
Both people merge at the same integration point, A first (platform and contracts move
first), then B rebases onto the new `main` and merges.

### Pull request checklist

Copy this into the PR body:

```markdown
## What and why
<one or two sentences>

## Iteration / task
I<n> · task <id>

## Checks
- [ ] Only my owned paths changed (or shared-path protocol followed)
- [ ] Rebased on current main; tests pass after the rebase
- [ ] Unit tests added, including the negative case
- [ ] Contract unchanged, or schema_version bumped and the other person approved
- [ ] Iteration exit test for this task passes
- [ ] docs/<component>.md updated (3 lines)
- [ ] No secrets, no credential logging, no LLM call added inside a gate

## How the other person verifies this
<exact command or curl they should run>
```

The last section matters most. A PR that the other person cannot verify in one command is
not ready.

### Review

Each person reviews every PR from the other. Reviews are fast (under 15 minutes) and look
for three things only: does it break a contract, does it touch my paths, does it violate
one of the five invariants? Style is not worth the hours.

Merge with squash so `main` has one commit per topic.

## Conflict resolution

| Conflict | Resolution |
|---|---|
| Same file, both edited | The owner's version wins; the non-owner reapplies their change on top and asks why they were editing it |
| Schema conflict | Stop, both people on a call, resolve in one commit on `chore/shared/*`, bump the version |
| Lockfile or dependency conflict | Regenerate rather than hand-merge |
| Both changed `ui/index.html` | Owner-marked sections should have prevented this; re-split the file into per-owner partials |
| Rebase gone wrong | `git rebase --abort`, then rebase again in smaller steps, or branch fresh and cherry-pick |

## Recovering a broken `main`

`main` must be deployable at all times, so fixing it outranks feature work.

```bash
git revert <merge-sha>     # revert first, diagnose after
git push origin main
```

Then fix forward on a branch. Never leave `main` broken while investigating, and never
force-push `main`.

## Tags

Tag at each integration point so there is always a known-good point to fall back to:

```bash
git tag -a i2-green -m "I2 exit test passed: broker + rollback + ingest"
git push origin i2-green
```

The demo runs from a tag, never from the tip of `main`.

## Stubs keep branches independent

Every cross-person interface has a stub from Iteration 0 that returns canned valid data:

- B's `gate2.check()` returns a fixed pass until I1, then a fixed deny for one sample.
- A's `POST /plans` runs mock gates that always pass until I1.
- B's `memory.lookup(tool, entity)` returns an empty list until I2.
- A's `broker.execute()` is a no-op that returns a fake result until I2.

Replace stubs with real implementations at the iteration that owns them. Never delete the
stub — keep it behind a `LOCKSTEP_STUB=1` environment flag, because it is what lets either
person keep working when the other's component is mid-refactor, and it is what the demo
falls back to if a live component fails on stage.
