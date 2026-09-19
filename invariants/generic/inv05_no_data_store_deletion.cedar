// INV-05: an agent may never delete a data store. These tools are red-team
// tier only (never in an agent's tool list, ExecRole cannot perform them);
// this invariant is defence in depth so Gate 2 also blocks them outright.
@id("INV-05")
forbid (principal, action in [Action::"ddb.delete_table", Action::"s3.delete_bucket"], resource);
