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
export interface EventLoggerBaseProps {
    readonly stepfunctions: Array<StateMachine>
}
export interface EventLoggerCustomLambdaProps extends EventLoggerBaseProps {
    readonly lambda: lambda.Function
}
export interface EventLoggerStandardLambdaProps extends EventLoggerBaseProps {
    readonly eventLoggingLevel: EventLoggingLevel
    readonly datastore: Datastore
}
// export interface EventLoggerProps {
//     readonly stepfunctions: Array<StateMachine>
//     readonly lambda?: lambda.Function
//     readonly eventLoggingLevel?: EventLoggingLevel
//     readonly datastore?: Datastore
// }
//export type EventLoggerProps = EventLoggerStandardLambdaProps | EventLoggerCustomLambdaProps

export class StepFunctionEventLogger extends Construct {
    constructor(scope: Construct, id: string, props: EventLoggerStandardLambdaProps | EventLoggerCustomLambdaProps) {
        super(scope, id);

        function isCustomLambda(props: EventLoggerStandardLambdaProps | EventLoggerCustomLambdaProps): props is EventLoggerCustomLambdaProps {
            return (props as EventLoggerCustomLambdaProps).lambda !== undefined
        };

        if (!this.isPropsValid(props)) {
            throw new Error("Either (eventLoggingLevel AND datastore) OR lambda properties must be provided to the construtor")
        }

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
        const SQSMessageProcessorFunction = isCustomLambda(props) ? props.lambda : this.createMessageProcessorFunction(mainQueue, props.eventLoggingLevel, props.datastore)

        // grants message processor lambda permission to consume messages from SQS Queue
        mainQueue.grantConsumeMessages(SQSMessageProcessorFunction)

        // grants message processor lambda permsisions to read stepfunction execution history
        props.stepfunctions.forEach(sf => { sf.grantRead(SQSMessageProcessorFunction) });
    }

    isPropsValid(props: EventLoggerStandardLambdaProps | EventLoggerCustomLambdaProps) {
        // If a lambda is provided to the construct, it's the user's responsibility
        // to build a datastore and ensure the lambda is connected to it.
        return (("datastore" in props && "eventLoggingLevel" in props) || "lamdba" in props)
    }


    createMessageProcessorFunction(
        mainQueue: sqs.Queue,
        eventLoggingLevel: EventLoggingLevel,
        datastore: Datastore
    ) {
        const SQSMessageProcessorFunction = new lambda.Function(
            this, "SQSMessageProcessorFunction",
            {
                runtime: lambda.Runtime.PYTHON_3_8,
                code: lambda.Code.fromAsset("lambda"),
                handler: "event_logger.handler",
                timeout: Duration.minutes(1),
                events: [new lambda_event_sources.SqsEventSource(mainQueue)]
            }
        );



        SQSMessageProcessorFunction.addEnvironment(
            "EVENT_LOGGING_LEVEL", eventLoggingLevel
        )

        SQSMessageProcessorFunction.addEnvironment(
            "DATASTORE_TYPE", datastore
        )


        this.createDatastore(SQSMessageProcessorFunction, datastore);


        return SQSMessageProcessorFunction;
    }

    createDatastore(
        SQSMessageProcessorFunction: lambda.Function,
        datastore: Datastore
    ) {
        if (datastore === Datastore.DYNAMODB) {
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
        } else if (datastore === Datastore.POSTGRES) {
            // TODO:
            // const postgres_datastore = new ...

            // TODO: grant lambda access to postgres_datastore
            // datastoreArn = postgres_datastore.tableArn;
        };
    }
}
