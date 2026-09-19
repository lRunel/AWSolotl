// INV-12: defence in depth. Every target must be in the declared account and
// the single locked region, even if every other invariant somehow missed it.
@id("INV-12")
forbid (principal, action, resource)
when { context.account != context.declared_account || context.region != "us-east-1" };
