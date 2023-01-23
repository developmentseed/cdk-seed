import pytest
import json
from moto import mock_stepfunctions, mock_lambda
import boto3


@pytest.fixture(autouse=True)
def aws_credentials(monkeypatch):
    """Mocked AWS Credentials for moto."""
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setenv("AWS_SECURITY_TOKEN", "testing")
    monkeypatch.setenv("AWS_SESSION_TOKEN", "testing")


@pytest.fixture()
def stepfunction_client():
    with mock_stepfunctions():
        yield boto3.client("stepfunctions", region_name="us-east-1")


@pytest.fixture()
def lambda_client():
    with mock_lambda():
        yield boto3.client("lambda", region_name="us-east-1")


@pytest.fixture
def mock_failed_stepfunction_execution_arn(
    stepfunction_client, mock_failing_stepfunction_arn
):
    execution = stepfunction_client.start_execution(
        stateMachineArn=mock_failing_stepfunction_arn,
        input=json.dumps({"ping": "pong"}),
    )
    return execution["executionArn"]


@pytest.fixture
def mock_stepfunction_execution_arn(stepfunction_client, mock_stepfunction_arn):
    execution = stepfunction_client.start_execution(
        stateMachineArn=mock_stepfunction_arn, input=json.dumps({"ping": "pong"})
    )
    return execution["executionArn"]


@pytest.fixture
def mock_failing_stepfunction_arn(stepfunction_client):
    stepfunction = stepfunction_client.create_state_machine(
        name="TestFailStepFunction",
        roleArn="arn:aws:iam::123456789012:role/TestRole",
        definition=json.dumps(
            {
                "StartAt": "FirstState",
                "States": {
                    "FirstState": {"Type": "Pass", "Next": "SecondState"},
                    "SecondState": {"Type": "Fail", "End": True},
                },
            }
        ),
    )
    return stepfunction["stateMachineArn"]


@pytest.fixture
def mock_stepfunction_arn(stepfunction_client):
    stepfunction = stepfunction_client.create_state_machine(
        name="TestStepFunction",
        roleArn="arn:aws:iam::123456789012:role/TestRole",
        definition=json.dumps(
            {
                "StartAt": "FirstState",
                "States": {
                    "FirstState": {"Type": "Pass", "Next": "SecondState"},
                    "SecondState": {"Type": "Pass", "End": True},
                },
            }
        ),
    )
    return stepfunction["stateMachineArn"]


@pytest.fixture
def mock_summary_logging_level_env_var(monkeypatch):
    monkeypatch.setenv("EVENT_LOGGING_LEVEL", "SUMMARY")
    return "SUMMARY"


@pytest.fixture
def mock_full_logging_level_env_var(monkeypatch):
    monkeypatch.setenv("EVENT_LOGGING_LEVEL", "FULL")
    return "FULL"


@pytest.fixture
def json_data(filepath):
    """
    Opens a json file as a dictionary. Expects test to be parametrized with
    "filepath", e.g.:
    @pytest.mark.parametrize("filepath", [my_filepath])
    """
    with open(filepath, "rb") as f:
        yield json.load(f)
