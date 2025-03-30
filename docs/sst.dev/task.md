# Task

Reference doc for the `sst.aws.Task` component.

## Overview
The `Task` component lets you create containers that are used for long running asynchronous work, like data processing. It uses [Amazon ECS](https://aws.amazon.com/ecs/) on [AWS Fargate](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate.html).

### Create a Task
Tasks are run inside an ECS Cluster. If you haven’t already, create one.

```typescript
const vpc = new sst.aws.Vpc("MyVpc");
const cluster = new sst.aws.Cluster("MyCluster", { vpc });
```

Add the task to it.

```typescript
const task = new sst.aws.Task("MyTask", { cluster });
```

### Configure the container image
By default, the task will look for a Dockerfile in the root directory. Optionally, configure the image context and dockerfile.

```typescript
new sst.aws.Task("MyTask", {
  cluster,
  image: {
    context: "./app",
    dockerfile: "Dockerfile"
  }
});
```

To add multiple containers in the task, pass in an array of containers args.

```typescript
new sst.aws.Task("MyTask", {
  cluster,
  containers: [
    {
      name: "app",
      image: "nginxdemos/hello:plain-text"
    },
    {
      name: "admin",
      image: {
        context: "./admin",
        dockerfile: "Dockerfile"
      }
    }
  ]
});
```

This is useful for running sidecar containers.

### Link resources
[Link resources](https://docs/linking/) to your task. This will grant permissions to the resources and allow you to access it in your app.

```typescript
const bucket = new sst.aws.Bucket("MyBucket");

new sst.aws.Task("MyTask", {
  cluster,
  link: [bucket]
});
```

You can use the [SDK](https://docs/reference/sdk/) to access the linked resources in your task.

```typescript
import { Resource } from "sst";

console.log(Resource.MyBucket.name);
```

### Task SDK
With the [Task JS SDK](https://docs/component/aws/task#sdk), you can run your tasks, stop your tasks, and get the status of your tasks.

For example, you can link the task to a function in your app.

```typescript
new sst.aws.Function("MyFunction", {
  handler: "src/lambda.handler",
  link: [task]
});
```

Then from your function run the task.

```typescript
import { Resource } from "sst";
import { task } from "sst/aws/task";

const runRet = await task.run(Resource.MyTask);
const taskArn = runRet.arn;
```

If you are not using Node.js, you can use the AWS SDK instead. Here’s [how to run a task](https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_RunTask.html).

## Cost
By default, this uses a *Linux/X86* *Fargate* container with 0.25 vCPUs at $0.04048 per vCPU per hour and 0.5 GB of memory at $0.004445 per GB per hour. It includes 20GB of *Ephemeral Storage* for free with additional storage at $0.000111 per GB per hour. Each container also gets a public IPv4 address at $0.005 per hour.

It works out to $0.04048 x 0.25 + $0.004445 x 0.5 + $0.005. Or **$0.02 per hour** your task runs for.

Adjust this for the `cpu`, `memory` and `storage` you are using. And check the prices for *Linux/ARM* if you are using `arm64` as your `architecture`.

The above are rough estimates for *us-east-1*, check out the [Fargate pricing](https://aws.amazon.com/fargate/pricing/) and the [Public IPv4 Address pricing](https://aws.amazon.com/vpc/pricing/) for more details.

## Constructor

### Signature
```typescript
new Task(name, args, opts?)
```

### Parameters
- `name` **string**
- `args` [TaskArgs](#taskargs)
- `opts?` [ComponentResourceOptions](https://www.pulumi.com/docs/concepts/options/)

## TaskArgs
### architecture?
**Type**: `Input<“x86_64” | “arm64”>`  
**Default**: `“x86_64”`  
The CPU architecture of the container.

### cluster
**Type**: [Cluster](https://docs/component/aws/cluster/)  
The ECS Cluster to use. Create a new `Cluster` in your app, if you haven’t already.

### command?
**Type**: `Input<string[]>`  
The command to override the default command in the container.

### containers?
**Type**: `Input<Object>[]`  
The containers to run in the task.

### cpu?
**Type**: `“0.25 vCPU” | “0.5 vCPU” | “1 vCPU” | “2 vCPU” | “4 vCPU” | “8 vCPU” | “16 vCPU”`  
**Default**: `“0.25 vCPU”`  
The amount of CPU allocated to the container.

### memory?
**Type**: `“${number} GB”`  
The amount of memory allocated to the container.

### name
**Type**: `Input<string>`  
The name of the container.

### ssm?
**Type**: `Input<Record<string, Input<string>>>`  
Key-value pairs of AWS Systems Manager Parameter Store parameter ARNs or AWS Secrets Manager secret ARNs. The values will be loaded into the container as environment variables.

### volumes?
**Type**: `Input<Object>[]`  
Mount Amazon EFS file systems into the container.

### Example
```typescript
new sst.aws.Task("MyTask", {
  cluster,
  containers: [
    {
      name: "app",
      image: "nginxdemos/hello:plain-text"
    },
    {
      name: "admin",
      image: {
        context: "./admin",
        dockerfile: "Dockerfile"
      }
    }
  ]
});
```\n\n## Running Tasks in SST Dev

When you run `sst dev`, a stub version of your task is deployed. This is a minimal image that starts up faster.

### Steps When Running `sst dev`
1. A stub version of your task is deployed.
2. When your task is started through the SDK, the stub version is provisioned. This can take roughly **10 - 20 seconds**.
3. The stub version proxies the payload to your local machine using the same events system used by [Live](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-tasks-services.html#fargate-tasks-size).
4. The `dev.command` is called to run your task locally. Once complete, the stub version of your task is stopped as well.

### Advantages of Using Stub Versions
The advantage of this approach is that you can test your task locally even if it’s invoked remotely, or through a cron job.

### Cost Consideration
You are charged for the time it takes to run the stub version of your task, which is roughly **$0.02 per hour**.

To disable this and deploy your task in `sst dev`, pass in `false`. Read more about [Live](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-tasks-services.html#fargate-tasks-size) and [`sst dev`](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-tasks-services.html#fargate-tasks-size).

## Configuration Parameters
### `dev.command?`
- **Type**: `Input<string>`  
The command that `sst dev` runs in dev mode.

### `dev.directory?`
- **Type**: `Input<string>`  
**Default**: Uses the `image.dockerfile` path.  
Change the directory from where the `command` is run.

### `entrypoint?`
- **Type**: `Input<string[]>`  
The entrypoint that overrides the default entrypoint in the container.

### `environment?`
- **Type**: `Input<Record<string, Input<string>>>`  
Key-value pairs of values that are set as [container environment variables](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/taskdef-envfiles.html).

### `executionRole?`
- **Type**: `Input<string>`  
**Default**: Creates a new role.  
Assigns the given IAM role name to AWS ECS to launch and manage the containers.

### `image?`
- **Type**: `Input<string | Object>`  
Configure the Docker build command for building the image or specify a pre-built image.

### `volumes?`
- **Type**: `Input<Object>[]`  
Mount Amazon EFS file systems into the container.

### Example Configuration
```javascript
{
  dev: {
    command: "npm run start",
    directory: "./src"
  },
  entrypoint: ["/usr/bin/my-entrypoint"],
  environment: {
    DEBUG: "true"
  },
  executionRole: "my-execution-role",
  image: {
    context: "./app",
    dockerfile: "Dockerfile"
  },
  volumes: [
    {
      efs: {
        fileSystem: "fs-12345678",
        accessPoint: "fsap-12345678"
      },
      path: "/mnt/efs"
    }
  ]
}
```

### Links
- [AWS ECS Task Definition](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/what-is-ecs.html)
- [AWS SDK for JavaScript](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/welcome.html)\n\n## Default
**Default** `"fargate"`

Configure the capacity provider; regular Fargate or Fargate Spot, for this task.

## RunResponse
### Type
**Type** `Object`

### Properties
- [**arn**](#runresponse-arn): The ARN of the task.
- [**response**](#runresponse-response): The raw response from the AWS ECS RunTask API.
- [**status**](#runresponse-status): The status of the task.

### arn
#### Type
**Type** `string`

The ARN of the task.

### response
#### Type
**Type** [@aws-sdk/client-ecs.RunTaskResponse](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-client-ecs/Interface/RunTaskResponse/)

The raw response from the AWS ECS RunTask API.

### status
#### Type
**Type** `string`

The status of the task.

## StopResponse
### Type
**Type** `Object`

### Properties
- [**arn**](#stopresponse-arn): The ARN of the task.
- [**response**](#stopresponse-response): The raw response from the AWS ECS StopTask API.
- [**status**](#stopresponse-status): The status of the task.

### arn
#### Type
**Type** `string`

The ARN of the task.

### response
#### Type
**Type** [@aws-sdk/client-ecs.StopTaskResponse](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-client-ecs/Interface/StopTaskResponse/)

The raw response from the AWS ECS StopTask API.

### status
#### Type
**Type** `string`

The status of the task.