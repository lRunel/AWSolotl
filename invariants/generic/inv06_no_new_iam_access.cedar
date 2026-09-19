// INV-06: an IAM change may not grant access the old policy did not. I1 cuts
// the live IAM Access Analyzer call (references/iterations.md cut order #5)
// in favour of this Cedar rule: the orchestrator or a future adapter
// precomputes new_access_beyond_declared and passes it in as context, and
// Gate 2 stays a pure function either way.
@id("INV-06")
forbid (principal, action == Action::"iam.attach_policy", resource)
when { context.new_access_beyond_declared == true };
