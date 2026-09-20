from aws_cdk import (
    Stack,
    aws_lambda as _lambda,
    aws_dynamodb as ddb,
    RemovalPolicy,
    Duration,
)
from constructs import Construct

class BrainStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # Incidents Table
        self.incidents_table = ddb.Table(
            self, "LockstepIncidentsTable",
            partition_key=ddb.Attribute(name="incident_id", type=ddb.AttributeType.STRING),
            billing_mode=ddb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.DESTROY
        )

        # Detector Lambda
        self.detector_lambda = _lambda.Function(
            self, "DetectorFunction",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="detector.lambda_handler",
            code=_lambda.Code.from_asset("causal"),
            memory_size=256,
            timeout=Duration.seconds(60),
            environment={
                "INCIDENTS_TABLE": self.incidents_table.table_name
            }
        )
        self.incidents_table.grant_read_write_data(self.detector_lambda)

        # Causal Container Lambda
        self.causal_lambda = _lambda.DockerImageFunction(
            self, "CausalFunction",
            code=_lambda.DockerImageCode.from_image_asset("causal"),
            memory_size=2048,
            timeout=Duration.seconds(120),
            environment={
                "INCIDENTS_TABLE": self.incidents_table.table_name
            }
        )
        self.incidents_table.grant_read_write_data(self.causal_lambda)

        # Agent Lambda (Bedrock connection)
        self.agent_lambda = _lambda.Function(
            self, "AgentFunction",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="router.lambda_handler",
            code=_lambda.Code.from_asset("agents"),
            memory_size=512,
            timeout=Duration.seconds(120),
            environment={
                "INCIDENTS_TABLE": self.incidents_table.table_name
            }
        )
        self.incidents_table.grant_read_data(self.agent_lambda)
        # In a real scenario, we grant Bedrock invoke permissions here
