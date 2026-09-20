import aws_cdk as cdk
from infra.iam_stack import IamStack
from infra.control_stack import ControlStack
from infra.demo_stack import DemoStack
from infra.brain_stack import BrainStack
from infra.observe_stack import ObserveStack
from infra.ui_stack import UiStack

app = cdk.App()
iam_stack = IamStack(app, "LockstepIamStack")
control_stack = ControlStack(app, "LockstepControlStack", control_plane_role=iam_stack.control_plane_role)
demo_stack = DemoStack(app, "LockstepDemoStack")
brain_stack = BrainStack(app, "LockstepBrainStack")
observe_stack = ObserveStack(app, "LockstepObserveStack")
ui_stack = UiStack(app, "LockstepUiStack")

app.synth()
