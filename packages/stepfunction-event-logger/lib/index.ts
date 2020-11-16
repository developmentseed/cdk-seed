import { Construct, Duration } from "@aws-cdk/core";
import * as sqs from "@aws-cdk/aws-sqs";
import * as events from "@aws-cdk/aws-events";
import * as events_targets from "@aws-cdk/aws-events-targets";
import * as lambda from "@aws-cdk/aws-lambda";
import * as lambda_event_sources from "@aws-cdk/aws-lambda-event-sources";
import * as dynamodb from "@aws-cdk/aws-dynamodb";
import { StateMachine } from "@aws-cdk/aws-stepfunctions";

export enum EventLoggingLevel {
    FULL = "FULL",
    SUMMARY = "SUMMARY"
}
export enum Datastore {
    DYNAMODB = "Dynamodb",
    POSTGRES = "Postgres"
}
export interface EventLoggerProps {
    readonly stepfunctions: Array<StateMachine>
    readonly lambda?: lambda.Function
    readonly eventLoggingLevel?: EventLoggingLevel
    readonly datastore?: Datastore
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

        var stepfunctionArns = Array<string>();
        props.stepfunctions.forEach(sf => {
            stepfunctionArns.push(sf.stateMachineArn)
        });

        new events.Rule(
            this, "EventNotificationToSQSRule",
            {
                ruleName: "SendNewStepFunctionEventToQueue",
                description: "Captures status changed events from StepFunction and creates a message in SQS",
                eventPattern: {
                    detail: {
                        status: ["SUCCEEDED", "FAILED", "ABORTED", "TIMED_OUT"],
                        stateMachineArn: stepfunctionArns
                    },
                    detailType: ["Step Functions Execution Status Change"],
                    source: ["aws.states"],
                },
                targets: [new events_targets.SqsQueue(mainQueue)]
            }
        )

        // If a lambda is provided to the construct, it's the user's responsibility
        // to build a datastore and ensure the lambda is connected to it.
        const SQSMessageProcessorFunction = props.lambda || this.createMessageProcessorFunction(mainQueue);

        // grants message processor lambda permission to consume messages from SQS Queue
        mainQueue.grantConsumeMessages(SQSMessageProcessorFunction)

        // grants message processor lambda permsisions to read stepfunction execution history
        props.stepfunctions.forEach(sf => { sf.grantRead(SQSMessageProcessorFunction) });

        if (props.datastore === "Dynamodb") {
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

            // grants message processor lambda permission to write to DynamoDB
            dynamodb_datastore.grantWriteData(SQSMessageProcessorFunction)

            SQSMessageProcessorFunction.addEnvironment(
                "DATASTORE_ARN", dynamodb_datastore.tableArn
            )
        } else if (props.datastore === "Postgres") {
            // TODO:
            // const postgres_datastore = new ...

            // TODO: grant lambda access to postgres_datastore
            // datastoreArn = postgres_datastore.tableArn;
        };

        // TODO: is this prop really optional?
        if (props.eventLoggingLevel) {
            SQSMessageProcessorFunction.addEnvironment(
                "EVENT_LOGGING_LEVEL", props.eventLoggingLevel
            )
        }

        // TODO: is this prop really optional?
        if (props.datastore) {
            SQSMessageProcessorFunction.addEnvironment(
                "DATASTORE_TYPE", props.datastore
            )
        }
    }

    createMessageProcessorFunction (mainQueue: sqs.Queue) {
        return new lambda.Function(
            this, "SQSMessageProcessorFunction",
            {
                runtime: lambda.Runtime.PYTHON_3_8,
                code: lambda.Code.fromAsset("lambda"),
                handler: "event_logger.handler",
                timeout: Duration.minutes(1),
                events: [new lambda_event_sources.SqsEventSource(mainQueue)]
            }
        );
    }
}
