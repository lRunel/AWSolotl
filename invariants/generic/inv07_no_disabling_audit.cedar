// INV-07: an agent may never disable or delete an audit source. Unconditional:
// there is no context in which turning off the ledger's own evidence trail
// is acceptable for an agent to do.
@id("INV-07")
forbid (principal, action == Action::"cloudtrail.stop_logging", resource);
