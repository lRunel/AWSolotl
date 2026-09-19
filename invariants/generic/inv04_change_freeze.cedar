// INV-04: no action during a declared change freeze without a human override.
@id("INV-04")
forbid (principal, action, resource)
when { context.change_freeze == true && context.human_override == false };
