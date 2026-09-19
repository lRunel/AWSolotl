// INV-09: never roll back to a target image with a known critical CVE.
@id("INV-09")
forbid (principal, action == Action::"ecs.rollback_to_revision", resource)
when { context.image_max_severity == "CRITICAL" };
