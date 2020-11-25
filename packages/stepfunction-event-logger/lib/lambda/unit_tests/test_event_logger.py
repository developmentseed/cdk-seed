from ..src.event_logger import generate_table_records
import pytest
import os


BASE = os.path.dirname(os.path.abspath(__file__))


@pytest.mark.parametrize(
    "filepath", [f"{BASE}/sqs_records.json"],
)
def test_generate_summary_table_records(json_data, mock_summary_logging_level_env_var):
    for sqs_message in json_data["Records"]:
        assert len(generate_table_records(sqs_message)) == 1


@pytest.mark.parametrize(
    "filepath", [f"{BASE}/sqs_records.json"],
)
def test_generate_full_table_records(json_data, mock_stepfunction_execution_arn):
    for sqs_message in json_data["Records"]:
        sqs_message["eventSourceArn"] = mock_stepfunction_execution_arn
        assert len(generate_table_records(sqs_message)) > 1


@pytest.mark.parametrize(
    "filepath", [f"{BASE}/sqs_failed_records.json"],
)
def test_generate_summary_failed_table_records(
    json_data, mock_stepfunction_execution_arn
):
    for sqs_message in json_data["Records"]:
        assert len(generate_table_records(sqs_message)) == 1


@pytest.mark.parametrize(
    "filepath", [f"{BASE}/sqs_failed_records.json"],
)
def test_generate_full_failed_table_records(
    json_data, mock_failed_stepfunction_execution_arn
):
    for sqs_message in json_data["Records"]:
        sqs_message["eventSourceArn"] = mock_failed_stepfunction_execution_arn
        assert len(generate_table_records(sqs_message)) > 1
