from aws_cdk import (
    Stack,
    aws_iam as iam,
    aws_ssm as ssm,
)
from constructs import Construct

class IamStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # 1. DetectorRole
        # Reads metrics, traces, writes incidents to DDB
        self.detector_role = iam.Role(
            self, "DetectorRole",
            assumed_by=iam.ServicePrincipal("lambda.amazonaws.com"),
            description="Role for the Detector Lambda (Plane 1)"
        )

        # 2. CausalRole
        # Reads metrics, CloudTrail, EventBridge, reads/writes DDB
        self.causal_role = iam.Role(
            self, "CausalRole",
            assumed_by=iam.ServicePrincipal("lambda.amazonaws.com"),
            description="Role for the Causal Engine Lambda (Plane 1)"
        )

        # 3. AgentRole
        # Calls Bedrock, reads experience DDB, calls Control Plane API
        # MUST NEVER HAVE MUTATING ACCESS TO APP
        self.agent_role = iam.Role(
            self, "AgentRole",
            assumed_by=iam.ServicePrincipal("lambda.amazonaws.com"),
            description="Role for the Bedrock Agent (Plane 2)"
        )

        # 4. ControlPlaneRole
        # Evaluates Cedar (local), runs Access Analyzer, CFN change sets, assumes ExecRole
        self.control_plane_role = iam.Role(
            self, "ControlPlaneRole",
            assumed_by=iam.ServicePrincipal("lambda.amazonaws.com"),
            description="Role for the Control Plane Lambdas (Plane 3)"
        )

        # 5. ExecRole
        # The narrow mutating set. Only assumable by ControlPlaneRole with an incident ExternalId.
        self.exec_role = iam.Role(
            self, "ExecRole",
            assumed_by=iam.ArnPrincipal(self.control_plane_role.role_arn).with_conditions({
                "StringLike": {
                    "sts:ExternalId": "inc_*"
                }
            }),
            description="Bounded execution role assumed by the Broker"
        )

        # Export Role ARNs to SSM Parameter Store for other stacks to use
        ssm.StringParameter(self, "DetectorRoleParam",
                            parameter_name="/lockstep/iam/detector_role_arn",
                            string_value=self.detector_role.role_arn)
        
        ssm.StringParameter(self, "CausalRoleParam",
                            parameter_name="/lockstep/iam/causal_role_arn",
                            string_value=self.causal_role.role_arn)
        
        ssm.StringParameter(self, "AgentRoleParam",
                            parameter_name="/lockstep/iam/agent_role_arn",
                            string_value=self.agent_role.role_arn)
        
        ssm.StringParameter(self, "ControlPlaneRoleParam",
                            parameter_name="/lockstep/iam/control_plane_role_arn",
                            string_value=self.control_plane_role.role_arn)
        
        ssm.StringParameter(self, "ExecRoleParam",
                            parameter_name="/lockstep/iam/exec_role_arn",
                            string_value=self.exec_role.role_arn)
