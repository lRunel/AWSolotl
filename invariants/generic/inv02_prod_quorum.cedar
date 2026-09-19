// INV-02: a prod service may never be scaled below quorum. Cedar has no
// division operator, so the caller precomputes quorum_min in the context
// builder (control/gate2.py:_build_context) as floor(prev_count / 2) + 1.
@id("INV-02")
forbid (principal, action == Action::"ecs.scale", resource)
when { context.env == "prod" && context.new_count < context.quorum_min };
