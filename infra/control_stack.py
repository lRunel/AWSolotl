from aws_cdk import (
    Stack,
    aws_lambda as _lambda,
    aws_apigateway as apigw,
    aws_iam as iam,
    aws_dynamodb as ddb,
    aws_s3 as s3,
    aws_ssm as ssm,
    RemovalPolicy,
    Duration,
)
from constructs import Construct

class ControlStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, control_plane_role: iam.IRole, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # Ledger DynamoDB Table
        self.ledger_table = ddb.Table(
            self, "LockstepLedgerTable",
            partition_key=ddb.Attribute(name="pk", type=ddb.AttributeType.STRING),
            billing_mode=ddb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.DESTROY
        )

        # Ledger S3 Bucket with Object Lock
        self.ledger_bucket = s3.Bucket(
            self, "LockstepLedgerBucket",
            object_ownership=s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            object_lock_enabled=True,
            object_lock_default_retention=s3.ObjectLockRetention.compliance(Duration.days(365)),
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True # Useful for hackathons, but technically contradicts object lock. We will see.
        )

        # Tokens Table
        self.tokens_table = ddb.Table(
            self, "LockstepTokensTable",
            partition_key=ddb.Attribute(name="pk", type=ddb.AttributeType.STRING),
            billing_mode=ddb.BillingMode.PAY_PER_REQUEST,
            time_to_live_attribute="expires_at",
            removal_policy=RemovalPolicy.DESTROY
        )

        # Idempotency Table
        self.idempotency_table = ddb.Table(
            self, "LockstepIdempotencyTable",
            partition_key=ddb.Attribute(name="pk", type=ddb.AttributeType.STRING),
            billing_mode=ddb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.DESTROY
        )

        # We will get ExecRole ARN from SSM parameter
        # But since we have iam_stack in app.py we could pass it directly if we wanted to.
        # Let's assume we read from SSM or it is passed.

        # Export names
        ssm.StringParameter(self, "LedgerTableNameParam",
                            parameter_name="/lockstep/ledger_table_name",
                            string_value=self.ledger_table.table_name)
        ssm.StringParameter(self, "LedgerBucketNameParam",
                            parameter_name="/lockstep/ledger_bucket_name",
                            string_value=self.ledger_bucket.bucket_name)

        # Grant access to ControlPlaneRole using a standalone Policy resource to avoid circular dependencies
        ledger_policy = iam.Policy(
            self, "ControlPlaneLedgerAccess",
            statements=[
                iam.PolicyStatement(
                    effect=iam.Effect.ALLOW,
                    actions=[
                        "dynamodb:BatchGetItem", "dynamodb:GetRecords", "dynamodb:GetShardIterator",
                        "dynamodb:Query", "dynamodb:GetItem", "dynamodb:Scan",
                        "dynamodb:ConditionCheckItem", "dynamodb:BatchWriteItem", "dynamodb:PutItem",
                        "dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:DescribeTable"
                    ],
                    resources=[self.ledger_table.table_arn, self.ledger_table.table_arn + "/index/*"]
                ),
                iam.PolicyStatement(
                    effect=iam.Effect.ALLOW,
                    actions=["s3:PutObject", "s3:PutObjectLegalHold", "s3:PutObjectRetention", "s3:PutObjectTagging", "s3:PutObjectVersionTagging", "s3:Abort*"],
                    resources=[self.ledger_bucket.bucket_arn + "/*"]
                )
            ]
        )
        ledger_policy.attach_to_role(control_plane_role)

        # Orchestrator Lambda
        self.orchestrator_lambda = _lambda.Function(
            self, "OrchestratorFunction",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="orchestrator.lambda_handler",
            code=_lambda.Code.from_asset("control"),
            role=control_plane_role,
            description="Mock Orchestrator for Lockstep Recall Iteration 0",
            environment={
                "LEDGER_TABLE": self.ledger_table.table_name,
                "LEDGER_BUCKET": self.ledger_bucket.bucket_name
            }
        )

        # Ledger Verify Lambda
        self.ledger_verify_lambda = _lambda.Function(
            self, "LedgerVerifyFunction",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="ledger.verify_handler",
            code=_lambda.Code.from_asset("control"),
            role=control_plane_role,
            description="Ledger verify endpoint",
            environment={
                "LEDGER_TABLE": self.ledger_table.table_name,
                "LEDGER_BUCKET": self.ledger_bucket.bucket_name
            }
        )

        # API Gateway
        self.api = apigw.RestApi(
            self, "LockstepControlPlaneAPI",
            rest_api_name="Lockstep Control Plane API",
            description="Control Plane API for Lockstep Recall"
        )

        # /plans
        plans = self.api.root.add_resource("plans")
        post_plans_integration = apigw.LambdaIntegration(self.orchestrator_lambda)
        plans.add_method("POST", post_plans_integration)

        # /ledger/verify
        ledger = self.api.root.add_resource("ledger")
        verify = ledger.add_resource("verify")
        get_verify_integration = apigw.LambdaIntegration(self.ledger_verify_lambda)
        verify.add_method("GET", get_verify_integration)
