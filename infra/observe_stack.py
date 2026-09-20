from aws_cdk import (
    Stack,
    aws_dynamodb as ddb,
    aws_events as events,
    aws_events_targets as targets,
    aws_cloudwatch as cw,
    RemovalPolicy,
)
from constructs import Construct

class ObserveStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # Events Table
        self.events_table = ddb.Table(
            self, "LockstepEventsTable",
            partition_key=ddb.Attribute(name="hour_bucket", type=ddb.AttributeType.STRING),
            sort_key=ddb.Attribute(name="ts_id", type=ddb.AttributeType.STRING),
            billing_mode=ddb.BillingMode.PAY_PER_REQUEST,
            time_to_live_attribute="ttl",
            removal_policy=RemovalPolicy.DESTROY
        )

        # CloudWatch Dashboard
        self.dashboard = cw.Dashboard(
            self, "LockstepDashboard",
            dashboard_name="Lockstep-ResiliAgent-Dashboard"
        )
        
        # Add some mock widgets for the hackathon
        self.dashboard.add_widgets(
            cw.TextWidget(
                markdown="# Lockstep Recall\\nControl plane metrics and telemetry.",
                width=24,
                height=2
            )
        )
