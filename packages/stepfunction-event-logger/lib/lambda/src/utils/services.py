def step_functions_client():
    import boto3
    from botocore.config import Config

    return boto3.client(
        "stepfunctions", config=Config(retries={"max_attempts": 10, "mode": "standard"})
    )


def dynamodb_resource():
    import boto3

    return boto3.resource("dynamodb")
