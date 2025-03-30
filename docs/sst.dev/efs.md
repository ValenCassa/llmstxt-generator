# Efs

Reference doc for the `sst.aws.Efs` component.

## Overview
The `Efs` component lets you add [Amazon Elastic File System (EFS)](https://docs.aws.amazon.com/efs/latest/ug/whatisefs.html) to your app.

### Create the file system
This needs a VPC.

```typescript
const vpc = new sst.aws.Vpc("MyVpc");
const efs = new sst.aws.Efs("MyEfs", { vpc });
```

### Attach it to a Lambda function
This is now mounted at `/mnt/efs` in the Lambda function.

```typescript
new sst.aws.Function("MyFunction", {
  vpc,
  handler: "lambda.handler",
  volume: { efs, path: "/mnt/efs" }
});
```

### Attach it to a container
Mounted at `/mnt/efs` in the container.

```typescript
const cluster = new sst.aws.Cluster("MyCluster", { vpc });
new sst.aws.Service("MyService", {
  cluster,
  public: {
    ports: [{ listen: "80/http" }],
  },
  volumes: [
    { efs, path: "/mnt/efs" }
  ]
});
```

## Cost
By default this component uses *Regional (Multi-AZ) with Elastic Throughput*. The pricing is pay-per-use.
- For storage: $0.30 per GB per month
- For reads: $0.03 per GB per month
- For writes: $0.06 per GB per month

The above are rough estimates for *us-east-1*, check out the [EFS pricing](https://aws.amazon.com/efs/pricing/) for more details.

## Constructor
```typescript
new Efs(name, args, opts?)
```
### Parameters
- `name` **string**
- `args` [EfsArgs](#efsargs)
- `opts?` [ComponentResourceOptions](https://www.pulumi.com/docs/concepts/options/)

## EfsArgs
### performance?
- **Type**: `Input<"general-purpose" | "max-io">`
- **Default**: `"general-purpose"`

The performance mode for the EFS file system. The `max-io` mode can support higher throughput, but with slightly higher latency. It’s recommended for larger workloads like data analysis or media processing.

### throughput?
- **Type**: `Input<"provisioned" | "bursting" | "elastic">`
- **Default**: `"elastic"`

The throughput mode for the EFS file system. The default `elastic` mode scales up or down based on the workload.

### transform?
- **Type**: `Object`

Transform how this component creates its underlying resources.

### vpc
- **Type**: [Vpc](https://docs/component/aws/vpc/) | `Input<Object>`

The VPC to use for the EFS file system.

## Properties
### accessPoint
- **Type**: `Output<string>`

The ID of the EFS access point.

### id
- **Type**: `Output<string>`

The ID of the EFS file system.

### nodes
- **Type**: `Object`

The underlying resources this component creates.

### Methods
#### static get
```typescript
Efs.get(name, fileSystemID, opts?)
```

##### Parameters
- `name` **string**
- `fileSystemID` **Input<string>**
- `opts?` [ComponentResourceOptions](https://www.pulumi.com/docs/concepts/options/)

##### Returns
[**Efs**](.)

Reference an existing EFS file system with the given file system ID. This is useful when you create a EFS file system in one stage and want to share it in another.