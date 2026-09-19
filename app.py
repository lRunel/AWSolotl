import aws_cdk as cdk
from infra.iam_stack import IamStack
from infra.control_stack import ControlStack
from infra.demo_stack import DemoStack

app = cdk.App()
iam_stack = IamStack(app, "LockstepIamStack")
control_stack = ControlStack(app, "LockstepControlStack", control_plane_role=iam_stack.control_plane_role)
demo_stack = DemoStack(app, "LockstepDemoStack")

app.synth()
