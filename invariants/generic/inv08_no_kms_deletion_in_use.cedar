// INV-08: no rotation or deletion of a KMS key that is currently in use.
@id("INV-08")
forbid (principal, action == Action::"kms.schedule_key_deletion", resource)
when { context.kms_key_in_use == true };
