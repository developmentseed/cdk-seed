import { Construct, Duration } from "@aws-cdk/core";
import * as sqs from "@aws-cdk/aws-sqs";
import * as events from "@aws-cdk/aws-events";
import * as events_targets from "@aws-cdk/aws-events-targets";
import * as lambda from "@aws-cdk/aws-lambda";
import * as lambda_event_sources from "@aws-cdk/aws-lambda-event-sources";
import { StateMachine } from "@aws-cdk/aws-stepfunctions";

enum EventLoggingLevel {
    Full,
    Summary
}
enum Datastore {
    Dynamodb,
    Postregs
}
export interface EventLoggerProps {
    eventLogginLevel: EventLoggingLevel
    datastore: Datastore
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
                        status: ["SUCCEEDED", "FAILED"],
                        stateMachineArn: props.stepfunctionArns
                    },
                    detailType: ["Step Functions Execution Status Change"],
                    source: ["aws.states"],
                },
                targets: [new events_targets.SqsQueue(mainQueue)]
            }
        )

        const SQSMessageProcessorFunction = new lambda.Function(
            this, "SQSMessageProcessorFunction",
            {
                runtime: lambda.Runtime.PYTHON_3_8,
                code: lambda.Code.fromAsset("lambda"), // TODO: make a `lambda` folder with the code
                handler: "event_logger.handler",
                environment: {
                    EVENT_LOGGING_LEVEL: props.eventLogginLevel.toString(), // TODO: is this the correct way to get a string value from an Enum? 
                    DATASTORE: props.datastore.toString()
                }

            })
        const sqsMessageProcessorTrigger = new lambda_event_sources.SqsEventSource(mainQueue);

        console.log({ props });
    }
}
