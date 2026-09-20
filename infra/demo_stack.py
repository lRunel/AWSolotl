import aws_cdk as cdk
from aws_cdk import (
    Stack,
    aws_ec2 as ec2,
    aws_ecs as ecs,
    aws_ecs_patterns as ecs_patterns,
    aws_dynamodb as ddb,
    aws_xray as xray,
    aws_iam as iam,
)
from constructs import Construct

class DemoStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # VPC
        vpc = ec2.Vpc(
            self, "DemoVpc",
            max_azs=2,
            nat_gateways=0, # No NAT gateway as requested ($25 cost)
            subnet_configuration=[
                ec2.SubnetConfiguration(
                    name="Public",
                    subnet_type=ec2.SubnetType.PUBLIC,
                    cidr_mask=24
                )
            ]
        )

        # DynamoDB Table
        table = ddb.Table(
            self, "LockstepDemoTable",
            partition_key=ddb.Attribute(name="pk", type=ddb.AttributeType.STRING),
            billing_mode=ddb.BillingMode.PAY_PER_REQUEST,
            removal_policy=cdk.RemovalPolicy.DESTROY
        )

        # ECS Cluster
        cluster = ecs.Cluster(self, "DemoCluster", vpc=vpc)

        # Payments Service
        payments_task = ecs.FargateTaskDefinition(
            self, "PaymentsTask",
            memory_limit_mib=512,
            cpu=256,
        )
        # Add AWS Distro for OpenTelemetry (ADOT) sidecar
        adot_container = payments_task.add_container(
            "aws-otel-collector",
            image=ecs.ContainerImage.from_registry("public.ecr.aws/aws-observability/aws-otel-collector:latest"),
            command=["--config=/etc/ecs/ecs-default-config.yaml"],
            essential=True,
            logging=ecs.LogDrivers.aws_logs(stream_prefix="ecs")
        )

        payments_container = payments_task.add_container(
            "payments-api",
            image=ecs.ContainerImage.from_asset("services/demo-app/payments"),
            environment={
                "DYNAMODB_TABLE": table.table_name,
                "AWS_XRAY_DAEMON_ADDRESS": "127.0.0.1:2000"
            },
            logging=ecs.LogDrivers.aws_logs(stream_prefix="ecs")
        )
        payments_container.add_port_mappings(ecs.PortMapping(container_port=8080))
        table.grant_read_write_data(payments_task.task_role)
        payments_task.task_role.add_managed_policy(iam.ManagedPolicy.from_aws_managed_policy_name("AWSXRayDaemonWriteAccess"))

        payments_service = ecs.FargateService(
            self, "PaymentsService",
            cluster=cluster,
            task_definition=payments_task,
            assign_public_ip=True,
            vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PUBLIC),
            desired_count=2
        )

        # Web Service
        web_task = ecs.FargateTaskDefinition(
            self, "WebTask",
            memory_limit_mib=512,
            cpu=256,
        )
        web_container = web_task.add_container(
            "web-api",
            image=ecs.ContainerImage.from_asset("services/demo-app/web"),
            environment={
                "PAYMENTS_API_URL": f"http://{payments_service.service_name}:8080", # Use service discovery in a real app, but for now we'll put them behind ALB
                "AWS_XRAY_DAEMON_ADDRESS": "127.0.0.1:2000"
            },
            logging=ecs.LogDrivers.aws_logs(stream_prefix="ecs")
        )
        web_container.add_port_mappings(ecs.PortMapping(container_port=8080))
        web_task.task_role.add_managed_policy(iam.ManagedPolicy.from_aws_managed_policy_name("AWSXRayDaemonWriteAccess"))
        
        web_task.add_container(
            "aws-otel-collector",
            image=ecs.ContainerImage.from_registry("public.ecr.aws/aws-observability/aws-otel-collector:latest"),
            command=["--config=/etc/ecs/ecs-default-config.yaml"],
            essential=True,
            logging=ecs.LogDrivers.aws_logs(stream_prefix="ecs")
        )

        # ALB
        self.web_service = ecs_patterns.ApplicationLoadBalancedFargateService(
            self, "WebService",
            cluster=cluster,
            task_definition=web_task,
            public_load_balancer=True,
            assign_public_ip=True,
            task_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PUBLIC)
        )
        

