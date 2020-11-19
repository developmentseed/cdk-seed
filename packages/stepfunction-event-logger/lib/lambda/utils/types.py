from typing import TypedDict, List, Optional
from datetime import datetime


class StepFunctionHistoryEvent(TypedDict):
    timestamp: datetime
    id: str
    previousEventId: str
    type: str
    execution_arn: Optional[str]


class ExecutionDetails(TypedDict):
    executionArn: str
    stateMachineArn: str
    name: str
    status: str
    startDate: int
    stopDate: int
    input: str
    output: str


# Create a base object to avoid error due to the hyphenated key
# `detail-type` in the actual CloudwatchEvent Class
_CloudwatchEventBase = TypedDict("CloudwatchEventBase", {"detail-type": str})


class CloudwatchEvent(_CloudwatchEventBase):
    version: str
    id: str
    source: str
    account: str
    time: str
    region: str
    resources: List[str]
    detail: ExecutionDetails


_SqsMessageAttributesBase = TypedDict(
    "SqsMessageAttributesBase",
    {
        "ApproximateReceiveCount": str,
        "SentTimestamp": str,
        "SenderId": str,
        "ApproximateFirstReceiveTimestamp": str,
    },
)


class SqsMessageAttributes(_SqsMessageAttributesBase):
    pass


class SqsMessage(TypedDict):
    messageId: str
    receiptHandle: str
    body: str
    attributes: SqsMessageAttributes
    messageAttributes: dict
    md5OfBody: str
    eventSource: str
    eventSourceARN: str
    awsRegion: str


_SqsStdQueueEventBase = TypedDict("SqsStdQueueEventBase", {"Records": List[SqsMessage]})


class SqsStdQueueEvent(_SqsStdQueueEventBase):
    """ https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html """

    pass


class StepFunctionInput(TypedDict):
    key: str


class FailedEvent(TypedDict):
    error: str
    cause: str


class EventsTableRecord(TypedDict):
    partition_key: str
    sort_key: str

    sfn_name: str
    sfn_exec_start_ts: int
    event_id: str
    status: str
    record_type: str


class FailedStepDetails(TypedDict):
    failed_step_name: str
    failed_step_input: str
    failed_step_error_message: str
    failed_step_error_name: str


class EventsTableFailedRecord(EventsTableRecord, FailedStepDetails):
    pass


class EventsTableSnapshotRecord(EventsTableRecord):
    sfn_exec_name: str


class EventsTableHistoryRecord(EventsTableRecord):
    stac_item_id: str


class FailedEventsTableSnapshotRecord(
    EventsTableFailedRecord, EventsTableSnapshotRecord
):
    pass