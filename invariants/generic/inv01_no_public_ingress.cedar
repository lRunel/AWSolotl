// INV-01: never open a security group to the world, except port 443.
@id("INV-01")
forbid (principal, action == Action::"sg.authorize_ingress", resource)
when { context.cidr == "0.0.0.0/0" && context.port != 443 };
