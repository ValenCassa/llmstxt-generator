# Vpc

Reference doc for the `sst.aws.Vpc` component.

## Overview
The `Vpc` component lets you add a VPC to your app. It uses [Amazon VPC](https://docs.aws.amazon.com/vpc/). This is useful for services like RDS and Fargate that need to be hosted inside a VPC.

This creates a VPC with 2 Availability Zones by default. It also creates the following resources:

1. A default security group blocking all incoming internet traffic.
2. A public subnet in each AZ.
3. A private subnet in each AZ.
4. An Internet Gateway. All the traffic from the public subnets are routed through it.
5. If `nat` is enabled, a NAT Gateway or NAT instance in each AZ. All the traffic from the private subnets are routed to the NAT in the same AZ.

> **Note**: By default, this does not create NAT Gateways or NAT instances.

## Create a VPC
```typescript
new sst.aws.Vpc("MyVPC");
```

## Create it with 3 Availability Zones
```typescript
new sst.aws.Vpc("MyVPC", {
  az: 3
});
```

## Enable NAT
```typescript
new sst.aws.Vpc("MyVPC", {
  nat: "managed"
});
```

## Cost
By default, this component is **free**. Following is the cost to enable the `nat` or `bastion` options.

### Managed NAT
If you enable `nat` with the `managed` option, it uses a **NAT Gateway** per `az` at $0.045 per hour, and $0.045 per GB processed per month.

That works out to a minimum of $0.045 x 2 x 24 x 30 or **$65 per month**. Adjust this for the number of `az` and add $0.045 per GB processed per month.

The above are rough estimates for *us-east-1*, check out the [NAT Gateway pricing](https://aws.amazon.com/vpc/pricing/) for more details. Standard [data transfer charges](https://aws.amazon.com/ec2/pricing/on-demand/#Data_Transfer) apply.

### EC2 NAT
If you enable `nat` with the `ec2` option, it uses `t4g.nano` EC2 **On Demand** instances per `az` at $0.0042 per hour, and $0.09 per GB processed per month for the first 10TB.

That works out to a minimum of $0.0042 x 2 x 24 x 30 or **$6 per month**. Adjust this for the `nat.ec2.instance` you are using and add $0.09 per GB processed per month.

The above are rough estimates for *us-east-1*, check out the [EC2 On-Demand pricing](https://aws.amazon.com/vpc/pricing/) and the [EC2 Data Transfer pricing](https://aws.amazon.com/ec2/pricing/on-demand/#Data_Transfer) for more details.

### Bastion
If you enable `bastion`, it uses a single `t4g.nano` EC2 **On Demand** instance at $0.0042 per hour, and $0.09 per GB processed per month for the first 10TB.

That works out to $0.0042 x 24 x 30 or **$3 per month**. Add $0.09 per GB processed per month.

However if `nat: "ec2"` is enabled, one of the NAT EC2 instances will be reused; making this **free**.

The above are rough estimates for *us-east-1*, check out the [EC2 On-Demand pricing](https://aws.amazon.com/vpc/pricing/) and the [EC2 Data Transfer pricing](https://aws.amazon.com/ec2/pricing/on-demand/#Data_Transfer) for more details.

## Constructor
### Parameters
- `name` **string**
- `args?` [VpcArgs](#vpcargs)
- `opts?` [ComponentResourceOptions](https://www.pulumi.com/docs/concepts/options/)

## VpcArgs
### az?
- **Type**: `Input<number | Input<string>[]>`
- **Default**: `2`

Specify the Availability Zones or AZs for the VPC. You can specify a number of AZs or a list of AZs. If you specify a number, it will look up the availability zones in the region and automatically select that number of AZs. If you specify a list of AZs, it will use that list of AZs.

### bastion?
- **Type**: `Input<boolean>`
- **Default**: `false`

Configures a bastion host that can be used to connect to resources in the VPC. When enabled, an EC2 instance of type `t4g.nano` with the bastion AMI will be launched in a public subnet. The instance will have AWS SSM (AWS Session Manager) enabled for secure access without the need for SSH key.

### nat?
- **Type**: `Input<"ec2" | "managed" | Object>`
- **Default**: NAT is disabled

Configures NAT. Enabling NAT allows resources in private subnets to connect to the internet. There are two NAT options:
1. `"managed"` creates a [NAT Gateway](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html)
2. `"ec2"` creates an [EC2 instance](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html) with the [fck-nat](https://github.com/AndrewGuenther/fck-nat) AMI

### transform?
- **Type**: `Object`

Transform how this component creates its underlying resources.

## Properties
### bastion
- **Type**: `Output<string>`

The bastion instance ID.

### id
- **Type**: `Output<string>`

The VPC ID.

### nodes
- **Type**: `Object`

The underlying [resources](#nodes) this component creates.