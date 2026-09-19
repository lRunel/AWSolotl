// INV-10: no single action may touch more than one availability zone at once.
@id("INV-10")
forbid (principal, action, resource)
when { context.az_count > 1 };
