// Gate 1 already restricted the caller to a known, schema-valid tool before
// Gate 2 ever runs, so Gate 2's job is resource-state proof, not authority.
// This blanket permit is the base; every invariant below is a `forbid`,
// which always overrides a `permit` in Cedar, and the twelve of them are
// where all of Gate 2's actual deny power lives.
permit (principal, action, resource);
