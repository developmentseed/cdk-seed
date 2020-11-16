import { Construct, Duration } from "@aws-cdk/core";
import * as sqs from "@aws-cdk/aws-sqs";
import * as events from "@aws-cdk/aws-events";
import * as events_targets from "@aws-cdk/aws-events-targets";
import * as lambda from "@aws-cdk/aws-lambda";
import * as lambda_event_sources from "@aws-cdk/aws-lambda-event-sources";
import * as dynamodb from "@aws-cdk/aws-dynamodb";
import { StateMachine } from "@aws-cdk/aws-stepfunctions";


enum EventLoggingLevel {
    full = "FULL",
    summary = "SUMMARY"
}
enum Datastore {
    dynamodb = "Dynamodb",
    postgres = "Postgres"
}
export interface EventLoggerProps {
    eventLogginLevel: EventLoggingLevel
    datastore: Datastore
    lambda?: lambda.IFunction
    stepfunctionArns: Array<StateMachine['stateMachineArn']>
}

export class StepFunctionEventLogger extends Construct {
    constructor(scope: Construct, id: string, props: EventLoggerProps) {
        super(scope, id);



        const deadLetterQueue = new sqs.Queue(
            this, "EventLoggerDeadLetterQueue", {
            retentionPeriod: Duration.days(14)
        });

        const mainQueue = new sqs.Queue(
            this, "EventLoggingQueue", {
            deadLetterQueue: {
                maxReceiveCount: 6,
                queue: deadLetterQueue
            },
            retentionPeriod: Duration.days(1),
            visibilityTimeout: Duration.minutes(1)
        });

        const eventRule = new events.Rule(
            this, "EventNotificationToSQSRule",
            {
                ruleName: "SendNewStepFunctionEventToQueue",
                description: "Captures status changed events from StepFunction and creates a message in SQS",
                eventPattern: {
                    detail: {
                        status: ["SUCCEEDED", "FAILED", "ABORTED", "TIMED_OUT"],
                        stateMachineArn: props.stepfunctionArns
                    },
                    detailType: ["Step Functions Execution Status Change"],
                    source: ["aws.states"],
                },
                targets: [new events_targets.SqsQueue(mainQueue)]
            }
        )
        var datastoreArn;
        // If a lambda is provided to the construct, it's the user's responsibility 
        // to build a datastore and ensure the lambda is connected to it.
        // Otherwise - generate the DynamoDB/Postgre table
        if (props.lambda === undefined && props.datastore === "Dynamodb") {
            const dynamodb_datastore = new dynamodb.Table(
                this, "EventsDatastore", {
                partitionKey: {
                    name: "execution_arn",
                    type: dynamodb.AttributeType.STRING
                },
                sortKey: {
                    name: "timestamp",
                    type: dynamodb.AttributeType.STRING
                }
            });

            datastoreArn = dynamodb_datastore.tableArn;
        } else if (props.lambda === undefined && props.datastore === "Postgres") {
            // TODO: 
            // const postgres_datastore = new ...

            // datastoreArn = postgres_datastore.tableArn; 
        };

        var SQSMessageProcessorFunction = props.lambda;

        if (props.lambda === undefined) {
            SQSMessageProcessorFunction = new lambda.Function(
                this, "SQSMessageProcessorFunction",
                {
                    runtime: lambda.Runtime.PYTHON_3_8,
                    code: lambda.Code.fromAsset("lambda"),
                    handler: "event_logger.handler",
                    environment: {
                        EVENT_LOGGING_LEVEL: props.eventLogginLevel,
                        DATASTORE_TYPE: props.datastore,
                        DATASTORE_ARN: datastoreArn
                    }
                }
            );
        };

        const sqsMessageProcessorTrigger = new lambda_event_sources.SqsEventSource(mainQueue);

        console.log({ props });
    }
}
