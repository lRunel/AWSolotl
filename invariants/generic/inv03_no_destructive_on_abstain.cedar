// INV-03: nothing destructive may run on an abstained causal verdict. An
// honest "unknown" must block, not merely warn.
@id("INV-03")
forbid (principal, action, resource)
when { context.causal_abstained == true && context.data_destructive == true };
