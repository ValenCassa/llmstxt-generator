# Bus

Reference doc for the `sst.aws.Bus` component.

## Overview
The `Bus` component lets you add an [Amazon EventBridge Event Bus](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-event-bus.html) to your app.

## Create a bus
```typescript
const bus = new sst.aws.Bus("MyBus");
```

## Add a subscriber
```typescript
bus.subscribe("MySubscriber", "src/subscriber.handler");
```

## Customize the subscriber
```typescript
bus.subscribe("MySubscriber", {
  handler: "src/subscriber.handler",
  timeout: "60 seconds"
});
```

## Link the bus to a resource
You can link the bus to other resources, like a function or your Next.js app.
```typescript
new sst.aws.Nextjs("MyWeb", {
  link: [bus]
});
```

Once linked, you can publish messages to the bus from your app.

### Example of publishing messages
```typescript
import { Resource } from "sst";
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";

const eb = new EventBridgeClient({});
await eb.send(new PutEventsCommand({
  Entries: [
    {
      EventBusName: Resource.MyBus.name,
      Source: "my.source",
      Detail: JSON.stringify({ foo: "bar" })
    }
  ]
}));
```

## Constructor
### Signature
```typescript
new Bus(name, args?, opts?)
```

### Parameters
- `name` (string): The name of the bus.
- `args?` ([BusArgs](#busargs)): Optional arguments for the bus.
- `opts?` ([ComponentResourceOptions](https://www.pulumi.com/docs/concepts/options/)): Optional resource options.

## BusArgs
### transform?
#### Type
Object

### Properties
- `bus?`: Transform how this component creates its underlying resources.

## Properties
### arn
#### Type
Output<string>
The ARN of the EventBus.

### name
#### Type
Output<string>
The name of the EventBus.

### nodes
#### Type
Object
The underlying resources this component creates.

## SDK
Use the [SDK](https://docs/reference/sdk/) in your runtime to interact with your infrastructure.

### Links
This is accessible through the `Resource` object in the [SDK](https://docs/reference/sdk/#links).
- `arn`: The ARN of the EventBus.
- `name`: The name of the EventBus.

## Methods
### subscribe
#### Signature
```typescript
subscribe(name, subscriber, args?)
```
#### Parameters
- `name` (string): The name of the subscription.
- `subscriber` (Input<string> | FunctionArgs | “arn:aws:lambda:${string}”): The function that’ll be notified.
- `args?` (BusSubscriberArgs): Configure the subscription.

#### Returns
Output<BusLambdaSubscriber>

### subscribeQueue
#### Signature
```typescript
subscribeQueue(name, queue, args?)
```
#### Parameters
- `name` (string): The name of the subscription.
- `queue` (Input<string> | Queue): The queue that’ll be notified.
- `args?` (BusSubscriberArgs): Configure the subscription.

#### Returns
Output<BusQueueSubscriber>

## BusSubscriberArgs
### pattern?
#### Type
Input<Object>
Filter the messages that’ll be processed by the subscriber.

### pattern.detail?
#### Type
Record<string, any>
An object of detail values to match against.

### pattern.detailType?
#### Type
any[]
A list of detail-type values to match against.

### pattern.source?
#### Type
any[]
A list of source values to match against.

### transform?
#### Type
Object
Transform how this subscription creates its underlying resources.\n\n## Event Subscription Documentation

### Source

- **Type**: `any[]`

A list of `source` values to match against. The `source` indicates where the event originated.

```javascript
{
  pattern: {
    source: ["my.source", "my.source2"]
  }
}
```

### Transform

Transform how this subscription creates its underlying resources.

- **Type**: `Object`

#### Transform Rule

- **Type**: [EventRuleArgs](https://www.pulumi.com/registry/packages/aws/api-docs/cloudwatch/eventrule/#inputs) | (args: EventRuleArgs, opts: ComponentResourceOptions, name: string) => void

Transform the EventBus rule resource.

#### Transform Target

- **Type**: [EventTargetArgs](https://www.pulumi.com/registry/packages/aws/api-docs/cloudwatch/eventtarget/#inputs) | (args: EventTargetArgs, opts: ComponentResourceOptions, name: string) => void

Transform the EventBus target resource.