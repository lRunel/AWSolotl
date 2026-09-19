// INV-11: never restart a primary while a write lock is held.
@id("INV-11")
forbid (principal, action == Action::"ecs.restart_service", resource)
when { context.write_lock_held == true };
