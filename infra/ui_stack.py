from aws_cdk import (
    Stack,
    aws_s3 as s3,
    aws_s3_deployment as s3_deploy,
    RemovalPolicy,
    CfnOutput,
)
from constructs import Construct

class UiStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # UI Bucket configured for Static Website Hosting
        self.ui_bucket = s3.Bucket(
            self, "LockstepUIBucket",
            public_read_access=True,
            block_public_access=s3.BlockPublicAccess(
                block_public_acls=False,
                block_public_policy=False,
                ignore_public_acls=False,
                restrict_public_buckets=False
            ),
            website_index_document="index.html",
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True
        )

        # Deploy React App
        s3_deploy.BucketDeployment(
            self, "DeployLockstepUI",
            sources=[s3_deploy.Source.asset("services/demo-app/web/awsolotl-dashboard/dist")],
            destination_bucket=self.ui_bucket
        )

        CfnOutput(self, "WebsiteURL", value=self.ui_bucket.bucket_website_url)
