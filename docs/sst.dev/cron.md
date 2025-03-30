# Cron

Reference doc for the `sst.aws.Cron` component.

## Overview
The `Cron` component lets you add cron jobs to your app using [Amazon Event Bus](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-event-bus.html). The cron job can invoke a `Function` or a container `Task`.

### Cron job function
Pass in a `schedule` and a `function` that’ll be executed.

```typescript
new sst.aws.Cron("MyCronJob", {
  function: "src/cron.handler",
  schedule: "rate(1 minute)"
});
```

### Cron job container task
Create a container task and pass in a `schedule` and a `task` that’ll be executed.

```typescript
const myCluster = new sst.aws.Cluster("MyCluster");
const myTask = new sst.aws.Task("MyTask", { cluster: myCluster });

new sst.aws.Cron("MyCronJob", {
  task: myTask,
  schedule: "rate(1 day)"
});
```

### Customize the function
You can customize the function by passing additional properties.

```javascript
new sst.aws.Cron("MyCronJob", {
  schedule: "rate(1 minute)",
  function: {
    handler: "src/cron.handler",
    timeout: "60 seconds"
  }
});
```

## Constructor
### Signature
```typescript
new Cron(name, args, opts?)
```

### Parameters
- `name`: `string`
- `args`: [CronArgs](#cronargs)
- `opts?`: [ComponentResourceOptions](https://www.pulumi.com/docs/concepts/options/)

## CronArgs
### enabled?
- **Type**: `Input<boolean>`  
- **Default**: `true`  
Configures whether the cron job is enabled. When disabled, the cron job won’t run.

```typescript
{
  enabled: false
}
```

### event?
- **Type**: `Input<Record<string, Input<string>>>`  
The event that’ll be passed to the function or task.

```typescript
{
  event: {
    foo: "bar",
  }
}
```

### function?
- **Type**: `Input<string | FunctionArgs | “arn:aws:lambda:${string}”>`  
The function that’ll be executed when the cron job runs.

```typescript
{
  function: "src/cron.handler"
}
```

### schedule
- **Type**: `Input<“rate(${string})” | “cron(${string})”>`  
The schedule for the cron job.

```typescript
{
  schedule: "rate(5 minutes)"
}
```

### task?
- **Type**: [Task](https://docs/component/aws/task/)  
The task that’ll be executed when the cron job runs.

## Properties
### nodes
- **Type**: `Object`

#### nodes.rule
- **Type**: [EventRule](https://www.pulumi.com/registry/packages/aws/api-docs/cloudwatch/eventrule/)
The EventBridge Rule resource.

#### nodes.target
- **Type**: [EventTarget](https://www.pulumi.com/registry/packages/aws/api-docs/cloudwatch/eventtarget/)
The EventBridge Target resource.

#### nodes.function
- **Type**: `Output<Function>`
The AWS Lambda Function that’ll be invoked when the cron job runs.

#### nodes.job
- **Type**: `Output<Function>`
The AWS Lambda Function that’ll be invoked when the cron job runs.