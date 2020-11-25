import json
import os
from decimal import Decimal
from datetime import datetime
from typing import List
from .utils.types import (
    ExecutionDetails,
    CloudwatchEvent,
    SqsMessage,
    StepFunctionHistoryEvent,
)
from .utils.services import step_functions_client as sfn, dynamodb_resource as ddb

TIMESTAMP_FMT = "%Y-%m-%dT%H:%M%S.%f%z"


def get_steps_details(execution_arn: str) -> List[StepFunctionHistoryEvent]:

    response = sfn().get_execution_history(executionArn=execution_arn)
    execution_history: List[StepFunctionHistoryEvent] = response["events"]
    while "nextToken" in response:
        response = sfn().get_execution_history(executionArn=execution_arn)
        execution_history.extend(response["events"])

    return [
        {
            "execution_id": execution_arn.split(":")[-1],
            "stepfunction_name": execution_arn.split(":")[-2],
            "step_id": f"{i['timestamp'].strftime(TIMESTAMP_FMT)}_{i['id']}",
            "step_number": i["id"],
            **{k: v for k, v in i.items() if k != "id"},
        }
        for i in execution_history
    ]


def generate_table_records(sqs_message: SqsMessage):
    """
    Handler to process an SQS message generated by a StepFunction FAILED or SUCCEEDED
    EventBridge Rule. First the StepFunction execution history is queried and
    appropriate DynamoDB records are generated to store the successfull ingestion or
    the failure.

    """
    msg: CloudwatchEvent = json.loads(sqs_message["body"])
    detail: ExecutionDetails = msg["detail"]

    execution_id = detail["executionArn"].split(":")[-1]
    stepfunction_name = detail["executionArn"].split(":")[-2]

    items = [
        {
            "execution_id": execution_id,
            "step_id": f"{datetime.fromtimestamp(detail['startDate'] / 1000).strftime(TIMESTAMP_FMT)}_summary",
            "stepfunction_name": stepfunction_name,
            "status": detail["status"],
            "input": json.loads(detail["input"]),
            "output": json.loads(detail["output"]) if detail["output"] else "",
            "startDate": datetime.fromtimestamp(detail["startDate"] / 1000).strftime(
                TIMESTAMP_FMT
            ),
            "stopDate": datetime.fromtimestamp(detail["stopDate"] / 1000).strftime(
                TIMESTAMP_FMT
            ),
            "startDate_raw": detail["startDate"],
            "stopDate_raw": detail["stopDate"],
        }
    ]

    if os.environ.get("EVENT_LOGGING_LEVEL", "") == "SUMMARY":
        return items

    items.extend(get_steps_details(detail["executionArn"]))
    return items


def handle_dynamodb(event):
    table_name = os.environ["DATASTORE_ARN"].split("/")[-1]
    table = ddb().Table(table_name)

    with table.batch_writer() as batch:
        for sqs_message in event["Records"]:
            for item in generate_table_records(sqs_message):
                batch.put_item(
                    Item=json.loads(json.dumps(item, default=str), parse_float=Decimal)
                )


def handle_postgres(event):
    # TODO - implement
    raise NotImplementedError


def handler(event, context):
    if os.environ["DATASTORE_TYPE"] == "Dynamodb":
        return handle_dynamodb(event)
    if os.environ["DATASTORE_TYPE"] == "Postgres":
        return handle_postgres(event)
