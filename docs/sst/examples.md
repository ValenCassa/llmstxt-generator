# Examples

A collection of example SST apps. These are available in the [examples/](https://github.com/sst/sst/tree/dev/examples) directory of the repo.

> **Tip**  
> This doc is best viewed through the site search or through the *AI*.

The descriptions for these examples are generated using the comments in the `sst.config.ts` of the app.

## Contributing
To contribute an example or to edit one, submit a PR to the [repo](https://github.com/sst/sst). Make sure to document the `sst.config.ts` in your example.

---

## API Gateway auth
Enable IAM and JWT authorizers for API Gateway routes.

```typescript
const api = new sst.aws.ApiGatewayV2("MyApi", {
  domain: {
    name: "api.ion.sst.sh",
    path: "v1",
  },
});

api.route("GET /", {
  handler: "route.handler",
});

api.route("GET /foo", "route.handler", { auth: { iam: true } });

api.route("GET /bar", "route.handler", { auth: { jwt: {
    issuer: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_Rq4d8zILG",
    audiences: ["user@example.com"],
  },
}});

api.route("$default", "route.handler");

return {
  api: api.url,
};
```

View the [full example](https://github.com/sst/sst/tree/dev/examples/aws-apig-auth).

---

## AWS Astro container with Redis
Creates a hit counter app with Astro and Redis. This deploys Astro as a Fargate service to ECS and it’s linked to Redis.

```typescript
new sst.aws.Service("MyService", {
  cluster,
  link: [redis],
  loadBalancer: {
    ports: [{ listen: "80/http", forward: "3000/http" }],
  },
  dev: {
    command: "npm run dev",
  },
});
```

Since our Redis cluster is in a VPC, we’ll need a tunnel to connect to it from our local machine.

```bash
sudo npx sst tunnel install
```

This needs *sudo* to create a network interface on your machine. You’ll only need to do this once on your machine.

To start your app locally run:

```bash
npx sst dev
```

Now if you go to `http://localhost:4321` you’ll see a counter update as you refresh the page.

Finally, you can deploy it by adding the `Dockerfile` that’s included in this example and running `npx sst deploy --stage production`.

```typescript
const vpc = new sst.aws.Vpc("MyVpc", { bastion: true });
const redis = new sst.aws.Redis("MyRedis", { vpc });
const cluster = new sst.aws.Cluster("MyCluster", { vpc });

new sst.aws.Service("MyService", {
  cluster,
  link: [redis],
  loadBalancer: {
    ports: [{ listen: "80/http", forward: "4321/http" }],
  },
  dev: {
    command: "npm run dev",
  },
});
```

View the [full example](https://github.com/sst/sst/tree/dev/examples/aws-astro-redis).

---

## AWS Astro streaming
Follows the [Astro Streaming](https://docs.astro.build/en/recipes/streaming-improve-page-performance/) guide to create an app that streams HTML. The `responseMode` in the [astro-sst](https://www.npmjs.com/package/astro-sst) adapter is set to enable streaming.

```typescript
adapter: aws({
  responseMode: "stream"
})
```

Now any components that return promises will be streamed.

```astro
---
import type { Character } from "./character";

const friends: Character[] = await new Promise((resolve) => setTimeout(() => {
  setTimeout(() => {
    resolve([
      { name: "Patrick Star", image: "patrick.png" },
      { name: "Sandy Cheeks", image: "sandy.png" },
      { name: "Squidward Tentacles", image: "squidward.png" },
      { name: "Mr. Krabs", image: "mr-krabs.png" },
    ]);
  }, 3000);
});
---
<div class="grid">
  {friends.map((friend) => (
    <div class="card">
      <img class="img" src={friend.image} alt={friend.name} />
      <p>{friend.name}</p>
    </div>
  ))}
</div>
```

You should see the *friends* section load after a 3 second delay.

> **Note**  
> Safari handles streaming differently than other browsers. 
> 
> Safari uses a [different heuristic](https://bugs.webkit.org/show_bug.cgi?id=252413) to determine when to stream data. You need to render *enough* initial HTML to trigger streaming. This is typically only a problem for demo apps.

There’s nothing to configure for streaming in the `Astro` component.

```typescript
new sst.aws.Astro("MyWeb");
```

View the [full example](https://github.com/sst/sst/tree/dev/examples/aws-astro-stream).

---

## AWS Aurora local
In this example, we connect to a locally running Postgres instance for dev. While on deploy, we use RDS Aurora.

We use the [docker run](https://docs.docker.com/reference/cli/docker/container/run/) CLI to start a local container with Postgres. You don’t have to use Docker, you can use Postgres.app or any other way to run Postgres locally.

```bash
docker run \
  --rm \
  -p 5432:5432 \
  -v $(pwd)/.sst/storage/postgres:/var/lib/postgresql/data \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=local \
  postgres:16.4
```

The data is saved to the `.sst/storage` directory. So if you restart the dev server, the data will still be there.

We then configure the `dev` property of the `Aurora` component with the settings for the local Postgres instance.

```typescript
dev: {
  username: "postgres",
  password: "password",
  database: "local",
  port: 5432,
},
```

By providing the `dev` prop for Postgres, SST will use the local Postgres instance and not deploy a new RDS database when running `sst dev`.

It also allows us to access the database through a Resource `link` without having to conditionally check if we are running locally.

```typescript
const pool = new Pool({
  host: Resource.MyPostgres.host,
  port: Resource.MyPostgres.port,
  user: Resource.MyPostgres.username,
  password: Resource.MyPostgres.password,
  database: Resource.MyPostgres.database,
});
```

The above will work in both `sst dev` and `sst deploy`.\n\n## AWS Aurora Postgres
In this example, we deploy an Aurora Postgres database.

```typescript
const postgres = new sst.aws.Aurora("MyDatabase", {
  engine: "postgres",
  vpc,
});

new sst.aws.Function("MyApp", {
  handler: "index.handler",
  link: [postgres],
  url: true,
  vpc,
});
```

In the function, we use the [postgres](https://www.npmjs.com/package/postgres) package.

```typescript
import postgres from "postgres";
import { Resource } from "sst";

const sql = postgres({
  username: Resource.MyDatabase.username,
  password: Resource.MyDatabase.password,
  database: Resource.MyDatabase.database,
  host: Resource.MyDatabase.host,
  port: Resource.MyDatabase.port,
});
```

We also enable the `bastion` option for the VPC. This allows us to connect to the database from our local machine with the `sst tunnel` CLI.

```bash
sudo npx sst tunnel install
```

This needs *sudo* to create a network interface on your machine. You’ll only need to do this once on your machine.

Now you can run `npx sst dev` and you can connect to the database from your local machine.

```typescript
const vpc = new sst.aws.Vpc("MyVpc", { bastion: true });
const postgres = new sst.aws.Aurora("MyDatabase", { engine: "postgres", vpc });

new sst.aws.Function("MyApp", {
  handler: "index.handler",
  link: [postgres],
  url: true,
  vpc,
});
```

View the [full example](https://github.com/sst/sst/tree/dev/examples/aws-aurora-postgres).

---

## AWS Cluster private service
Adds a private load balancer to a service by setting the `loadBalancer.public` prop to `false`.

This allows you to create internal services that can only be accessed inside a VPC.

```typescript
const vpc = new sst.aws.Vpc("MyVpc", { bastion: true });
const cluster = new sst.aws.Cluster("MyCluster", { vpc });

new sst.aws.Service("MyService", {
  cluster,
  loadBalancer: { public: false },
  dev: { command: "bun dev" },
});
```

View the [full example](https://github.com/sst/sst/tree/dev/examples/aws-cluster-private-service).\n\n## AWS Cluster private service
Adds a private load balancer to a service by setting the `loadBalancer.public` prop to `false`.

This allows you to create internal services that can only be accessed inside a VPC.

```typescript
const vpc = new sst.aws.Vpc("MyVpc", { bastion: true });

const cluster = new sst.aws.Cluster("MyCluster", { vpc });

new sst.aws.Service("MyService", {
  cluster,
  loadBalancer: {
    public: false,
    ports: [{ listen: "80/http" }],
  },
});
```

View the [full example](https://github.com/sst/sst/tree/dev/examples/aws-cluster-internal).

---

## AWS Cluster Spot capacity
This example shows how to use the Fargate Spot capacity provider for your services.

We have it set to use only Fargate Spot instances for all non-production stages. Learn more about the `capacity` prop.

```typescript
const vpc = new sst.aws.Vpc("MyVpc");

const cluster = new sst.aws.Cluster("MyCluster", { vpc });

new sst.aws.Service("MyService", {
  cluster,
  loadBalancer: {
    ports: [{ listen: "80/http" }],
  },
  capacity: $app.stage === "production" ? undefined : "spot",
});
```

View the [full example](https://github.com/sst/sst/tree/dev/examples/aws-cluster-spot).

---

## AWS Cluster with API Gateway
Expose a service through API Gateway HTTP API using a VPC link.

This is an alternative to using a load balancer. Since API Gateway is pay per request, it works out a lot cheaper for services that don’t get a lot of traffic.

You need to specify which port in your service will be exposed through API Gateway.

```typescript
const service = new sst.aws.Service("MyService", {
  cluster,
  serviceRegistry: {
    port: 80,
  },
});

const api = new sst.aws.ApiGatewayV2("MyApi", { vpc });
api.routePrivate("$default", service.nodes.cloudmapService.arn);
```

A couple of things to note:
1. Your API Gateway HTTP API also needs to be in the **same VPC** as the service.
2. You also need to verify that your VPC’s [availability zones support VPC link](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-vpc-links.html#http-api-vpc-link-availability).
3. Run `aws ec2 describe-availability-zones` to get a list of AZs for your account.
4. Only list the AZ ID’s that support VPC link.

If the VPC picks an AZ automatically that doesn’t support VPC link, you’ll get the following error:

```
operation error ApiGatewayV2: BadRequestException: Subnet is in Availability Zone 'euw3-az2' where service is not available
```

View the [full example](https://github.com/sst/sst/tree/dev/examples/aws-cluster-vpclink).

---

## Subscribe to queues
Create an SQS queue, subscribe to it, and publish to it from a function.

```typescript
// create dead letter queue
const dlq = new sst.aws.Queue("DeadLetterQueue");
dlq.subscribe("subscriber.dlq");

// create main queue
const queue = new sst.aws.Queue("MyQueue", {
  dlq: dlq.arn,
});
queue.subscribe("subscriber.main");

const app = new sst.aws.Function("MyApp", {
  handler: "publisher.handler",
  link: [queue],
  url: true,
});

return {
  app: app.url,
  queue: queue.url,
  dlq: dlq.url,
};
```

View the [full example](https://github.com/sst/sst/tree/dev/examples/aws-dead-letter-queue).

---

## AWS Deno Redis
Creates a hit counter app with Deno and Redis.

This deploys Deno as a Fargate service to ECS and it’s linked to Redis.

```typescript
new sst.aws.Service("MyService", {
  cluster,
  link: [redis],
  loadBalancer: {
    ports: [{ listen: "80/http", forward: "8000/http" }],
  },
  dev: {
    command: "deno task dev",
  },
});
```

Since our Redis cluster is in a VPC, we’ll need a tunnel to connect to it from our local machine.

```bash
sudo sst tunnel install
```

This needs *sudo* to create a network interface on your machine. You’ll only need to do this once on your machine.

To start your app locally run.

```bash
sst dev
```

Now if you go to `http://localhost:8000` you’ll see a counter update as you refresh the page.

Finally, you can deploy it using `sst deploy --stage production` using a `Dockerfile` that’s included in the example.

View the [full example](https://github.com/sst/sst/tree/dev/examples/aws-deno-redis).

---

## DynamoDB streams
Create a DynamoDB table, enable streams, and subscribe to it with a function.

```typescript
const table = new sst.aws.Dynamo("MyTable", {
  fields: {
    id: "string",
  },
  primaryIndex: { hashKey: "id" },
  stream: "new-and-old-images",
});

table.subscribe("MySubscriber", "subscriber.handler", {
  filters: [
    {
      dynamodb: {
        NewImage: {
          message: {
            S: ["Hello"],
          },
        },
      },
    },
  ],
});

const app = new sst.aws.Function("MyApp", {
  handler: "publisher.handler",
  link: [table],
  url: true,
});

return {
  app: app.url,
  table: table.name,
};
```

View the [full example](https://github.com/sst/sst/tree/dev/examples/aws-dynamo).

---

## EC2 with Pulumi
Use raw Pulumi resources to create an EC2 instance.

```typescript
const securityGroup = new aws.ec2.SecurityGroup("web-secgrp", {
  ingress: [
    {
      protocol: "tcp",
      fromPort: 80,
      toPort: 80,
      cidrBlocks: ["0.0.0.0/0"],
    },
  ],
});

const ami = aws.ec2.getAmi({
  filters: [
    {
      name: "name",
      values: ["ubuntu/images/hvm-ssd/ubuntu-focal-20.04-amd64-server-*"],
    },
  ],
  mostRecent: true,
  owners: ["099720109477"], // Canonical
});

const userData = `#!/bin/bash
ho "Hello, World!" > index.html
hup python3 -m http.server 80 &`;

const server = new aws.ec2.Instance("web-server", {
  instanceType: "t2.micro",
  ami: ami.then((ami) => ami.id),
  userData: userData,
  vpcSecurityGroupIds: [securityGroup.id],
  associatePublicIpAddress: true,
});

return {
  app: server.publicIp,
};
```

View the [full example](https://github.com/sst/sst/tree/dev/examples/aws-ec2-pulumi).

---

## AWS EFS with SQLite
Mount an EFS file system to a function and write to a SQLite database.

```javascript
const db = sqlite3("/mnt/efs/mydb.sqlite");
```

The file system is mounted to `/mnt/efs` in the function.

```typescript
const vpc = new sst.aws.Vpc("MyVpc", { nat: "managed" });

const efs = new sst.aws.Efs("MyEfs", { vpc });

new sst.aws.Function("MyFunction", {
  vpc,
  url: true,
  volume: {
    efs,
    path: "/mnt/efs",
  },
  handler: "index.handler",
  nodejs: {
    install: ["better-sqlite3"],
  },
});
```

View the [full example](https://github.com/sst/sst/tree/dev/examples/aws-efs-sqlite).

---

## AWS EFS with SurrealDB
We use the SurrealDB docker image to run a server in a container and use EFS as the file system.

```typescript
const server = new sst.aws.Service("MyService", {
  cluster,
  architecture: "arm64",
  image: "surrealdb/surrealdb:v2.0.2",
  volumes: [{ efs, path: "/data" }],
});
```

We then connect to the server from a Lambda function.

```javascript
const endpoint = `http://${Resource.MyConfig.host}:${Resource.MyConfig.port}`;
const db = new Surreal();
await db.connect(endpoint);
```

This uses the SurrealDB client to connect to the server.

View the [full example](https://github.com/sst/sst/tree/dev/examples/aws-efs-surrealdb).

---

## AWS EFS
Mount an EFS file system to a function and a container.

This allows both your function and the container to access the same file system. Here they both update a counter that’s stored in the file system.

```javascript
await writeFile("/mnt/efs/counter", newValue.toString());
```

The file system is mounted to `/mnt/efs` in both the function and the container.

```typescript
const vpc = new sst.aws.Vpc("MyVpc", { nat: "managed" });
const efs = new sst.aws.Efs("MyEfs", { vpc });

new sst.aws.Function("MyFunction", {
  handler: "lambda.handler",
  url: true,
  vpc,
  volume: {
    efs,
    path: "/mnt/efs",
  },
});

new sst.aws.Service("MyService", {
  cluster,
  loadBalancer: {
    ports: [{ listen: "80/http" }],
  },
  volumes: [{ efs, path: "/mnt/efs" }],
});
```

View the [full example](https://github.com/sst/sst/tree/dev/examples/aws-efs).

---

## AWS Express Redis
Creates a hit counter app with Express and Redis.

This deploys Express as a Fargate service to ECS and it’s linked to Redis.

```typescript
new sst.aws.Service("MyService", {
  cluster,
  loadBalancer: {
    ports: [{ listen: "80/http" }],
  },
  dev: {
    command: "node --watch index.mjs",
  },
  link: [redis],
});
```

Since our Redis cluster is in a VPC, we’ll need a tunnel to connect to it from our local machine.

```bash
sudo npx sst tunnel install
```

This needs *sudo* to create a network interface on your machine. You’ll only need to do this once on your machine.

To start your app locally run.

```bash
npx sst dev
```

Now if you go to `http://localhost:80` you’ll see a counter update as you refresh the page.

Finally, you can deploy it using `npx sst deploy --stage production` using a `Dockerfile` that’s included in the example.

View the [full example](https://github.com/sst/sst/tree/dev/examples/aws-express-redis).\n\n## Deploying a Hit Counter App with Hono and Redis

This example demonstrates how to create a hit counter app using Hono and Redis, deploying it as a Fargate service to ECS.

### Configuration

```typescript
new sst.aws.Service("MyService", {
  cluster,
  link: [redis],
  loadBalancer: {
    ports: [{ listen: "80/http", forward: "3000/http" }],
  },
  dev: {
    command: "npm run dev",
  },
});
```

### Running the App Locally

To connect to the Redis cluster in a VPC, you need to create a tunnel:

```bash
sudo npx sst tunnel install
```

Then, start your app locally:

```bash
npx sst dev
```

Visit `http://localhost:3000` to see the counter update as you refresh the page.

### Deployment

You can deploy the app using the included `Dockerfile` and ensure your `tsconfig.json` is set up correctly:

```json
{
  "compilerOptions": {
    // ...
    "outDir": "./dist"
  },
  "exclude": ["node_modules"]
}
```

Install TypeScript:

```bash
npm install typescript --save-dev
```

Add a build script to your `package.json`:

```json
"scripts": {
  // ...
  "build": "tsc"
}
```

Finally, deploy with:

```bash
npx sst deploy --stage production
```

### Example Code

```typescript
const vpc = new sst.aws.Vpc("MyVpc", { bastion: true });
const redis = new sst.aws.Redis("MyRedis", { vpc });
const cluster = new sst.aws.Cluster("MyCluster", { vpc });

new sst.aws.Service("MyService", {
  cluster,
  link: [redis],
  loadBalancer: {
    ports: [{ listen: "80/http", forward: "3000/http" }],
  },
  dev: {
    command: "npm run dev",
  },
});
```

### Full Example

View the [full example](https://github.com/sst/sst/tree/dev/examples/aws-hono-redis).\n\n## AWS Lambda Retry with Queues

An example on how to retry Lambda invocations using SQS queues.

Create a SQS retry queue which will be set as the destination for the Lambda function.

```typescript
const retryQueue = new sst.aws.Queue("retryQueue");

const bus = new sst.aws.Bus("bus");

const busSubscriber = bus.subscribe("busSubscriber", {
  handler: "src/bus-subscriber.handler",
  environment: {
    RETRIES: "2", // set the number of retries
  },
  link: [busSubscriber.nodes.function, retryQueue, dlq], // so the function can send messages to the retry queue
});

new aws.lambda.FunctionEventInvokeConfig("eventConfig", {
  functionName: $resolve([busSubscriber.nodes.function.name]).apply(
    ([name]) => name,
  ),
  maximumRetryAttempts: 2, // default is 2, must be between 0 and 2
  destinationConfig: {
    onFailure: {
      destination: retryQueue.arn,
    },
  },
});
```

Create a bus subscriber which will publish messages to the bus. Include a DLQ for messages that continue to fail.

```typescript
const dlq = new sst.aws.Queue("dlq");

retryQueue.subscribe({
  handler: "src/retry.handler",
  link: [busSubscriber.nodes.function, retryQueue, dlq],
  timeout: "30 seconds",
  environment: {
    RETRIER_QUEUE_URL: retryQueue.url,
  },
  permissions: [
    {
      actions: ["lambda:GetFunction", "lambda:InvokeFunction"],
      resources: [
        $interpolate`arn:aws:lambda:${aws.getRegionOutput().name}:${aws.getCallerIdentityOutput().accountId}:function:*`,
      ],
    },
  ],
  transform: {
    function: {
      deadLetterConfig: {
        targetArn: dlq.arn,
      },
    },
  },
});
```

The Retry function will read messages and send back to the queue to be retried with a backoff.

```typescript
export const handler: SQSHandler = async (evt) => {
  for (const record of evt.Records) {
    const parsed = JSON.parse(record.body);
    console.log("body", parsed);
    const functionName = parsed.requestContext.functionArn
      .replace(":$LATEST", "")
      .split(":")
      .pop();

    if (parsed.responsePayload) {
      const attempt = (parsed.requestPayload.attempts || 0) + 1;
      const info = await lambda.send(
        new GetFunctionCommand({
          FunctionName: functionName,
        }),
      );
      const max =
        Number.parseInt(info.Configuration?.Environment?.Variables?.RETRIES || "") || 0;
      console.log("max retries", max);
      if (attempt > max) {
        console.log(`giving up after ${attempt} retries`);
        // send to dlq
        await sqs.send(
          new SendMessageCommand({
            QueueUrl: Resource.dlq.url,
            MessageBody: JSON.stringify({
              requestPayload: parsed.requestPayload,
              requestContext: parsed.requestContext,
              responsePayload: parsed.responsePayload,
            }),
          }),
        );
        return;
      }
      const seconds = Math.min(Math.pow(2, attempt), 900);
      console.log(
        "delaying retry by ",
        seconds,
        "seconds for attempt",
        attempt,
      );
      parsed.requestPayload.attempts = attempt;
      await sqs.send(
        new SendMessageCommand({
          QueueUrl: Resource.retryQueue.url,
          DelaySeconds: seconds,
          MessageBody: JSON.stringify({
            requestPayload: parsed.requestPayload,
            requestContext: parsed.requestContext,
          }),
        }),
      );
    }

    if (!parsed.responsePayload) {
      console.log("triggering function");
      try {
        await lambda.send(
          new InvokeCommand({
            InvocationType: "Event",
            Payload: Buffer.from(JSON.stringify(parsed.requestPayload)),
            FunctionName: functionName,
          }),
        );
      } catch (e) {
        if (e instanceof ResourceNotFoundException) {
          return;
        }
        throw e;
      }
    }
  }
};
```

View the [full example](https://github.com/sst/sst/tree/dev/examples/aws-lambda-retry-with-queues).\n\n## AWS Next.js Add Behavior

Here’s how to add additional routes or cache behaviors to the CDN of a Next.js app deployed with OpenNext to AWS.

Specify the path pattern that you want to forward to your new origin. For example, to forward all requests to the `/blog` path to a different origin.

```ts
pathPattern: "/blog/*"
```

And then specify the domain of the new origin.

```ts
domainName: "blog.example.com"
```

We use this to `transform` our site’s CDN and add the additional behaviors.

```ts
const blogOrigin = {
  // The domain of the new origin
  domainName: "blog.example.com",
  originId: "blogCustomOrigin",
  customOriginConfig: {
    httpPort: 80,
    httpsPort: 443,
    originSslProtocols: ["TLSv1.2"],
    // If HTTPS is supported
    originProtocolPolicy: "https-only",
  },
};

const cacheBehavior = {
  // The path to forward to the new origin
  pathPattern: "/blog/*",
  targetOriginId: blogOrigin.originId,
  viewerProtocolPolicy: "redirect-to-https",
  allowedMethods: ["GET", "HEAD", "OPTIONS"],
  cachedMethods: ["GET", "HEAD"],
  forwardedValues: {
    queryString: true,
    cookies: {
      forward: "all",
    },
  },
};

new sst.aws.Nextjs("MyWeb", {
  transform: {
    cdn: (options: sst.aws.CdnArgs) => {
      options.origins = $resolve(options.origins).apply(val => [...val, blogOrigin]);
      options.orderedCacheBehaviors = $resolve(
        options.orderedCacheBehaviors || []
      ).apply(val => [...val, cacheBehavior]);
    },
  },
});
```

View the [full example](https://github.com/sst/sst/tree/dev/examples/aws-nextjs-add-behavior).

---

## AWS Next.js Basic Auth

Deploys a simple Next.js app and adds basic auth to it. This is useful for dev environments where you want to share your app with your team but ensure that it’s not publicly accessible.

This works by injecting some code into a CloudFront function that checks the basic auth header and matches it against the `USERNAME` and `PASSWORD` secrets.

```ts
{
  injection: $interpolate`
    if (
        !event.request.headers.authorization
        || event.request.headers.authorization.value !== "Basic ${basicAuth}"
      ) {
      return {
        statusCode: 401,
        headers: {
          "www-authenticate": { value: "Basic" }
        }
      };
    }`,
}
```

To deploy this, you need to first set the `USERNAME` and `PASSWORD` secrets.

```bash
sst secret set USERNAME my-username
sst secret set PASSWORD my-password
```

If you are deploying this to preview environments, you might want to set the secrets using the `--fallback` flag.

```ts
const username = new sst.Secret("USERNAME");
const password = new sst.Secret("PASSWORD");
const basicAuth = $resolve([username.value, password.value]).apply(
  ([username, password]) =>
    Buffer.from(`${username}:${password}`).toString("base64")
);

new sst.aws.Nextjs("MyWeb", {
  server: {
    // Don't password protect prod
    edge: $app.stage !== "production"
      ? {
          viewerRequest: {
            injection: $interpolate`
              if (
                  !event.request.headers.authorization
                  || event.request.headers.authorization.value !== "Basic ${basicAuth}"
                ) {
                return {
                  statusCode: 401,
                  headers: {
                    "www-authenticate": { value: "Basic" }
                  }
                };
              }`,
          },
        }
      : undefined,
  },
});
```

View the [full example](https://github.com/sst/sst/tree/dev/examples/aws-nextjs-basic-auth).

---

## AWS Next.js Container with Redis

Creates a hit counter app with Next.js and Redis. This deploys Next.js as a Fargate service to ECS and it’s linked to Redis.

```ts
new sst.aws.Service("MyService", {
  cluster,
  link: [redis],
  loadBalancer: {
    ports: [{ listen: "80/http", forward: "3000/http" }],
  },
  dev: {
    command: "npm run dev",
  },
});
```

Since our Redis cluster is in a VPC, we’ll need a tunnel to connect to it from our local machine.

```bash
sudo npx sst tunnel install
```

This needs `sudo` to create a network interface on your machine. You’ll only need to do this once on your machine.

To start your app locally run:

```bash
npx sst dev
```

Now if you go to `http://localhost:3000` you’ll see a counter update as you refresh the page.

Finally, you can deploy it by:
1. Setting `output: "standalone"` in your `next.config.mjs` file.
2. Adding a `Dockerfile` that’s included in this example.
3. Running `npx sst deploy --stage production`.

```ts
const vpc = new sst.aws.Vpc("MyVpc", { bastion: true });
const redis = new sst.aws.Redis("MyRedis", { vpc });
const cluster = new sst.aws.Cluster("MyCluster", { vpc });

new sst.aws.Service("MyService", {
  cluster,
  link: [redis],
  loadBalancer: {
    ports: [{ listen: "80/http", forward: "3000/http" }],
  },
  dev: {
    command: "npm run dev",
  },
});
```

View the [full example](https://github.com/sst/sst/tree/dev/examples/aws-nextjs-redis).

---

## AWS Next.js Streaming

An example of how to use streaming Next.js RSC. Uses `Suspense` to stream an async component.

```tsx
<Suspense fallback={<div>Loading...</div>}>
  <Friends />
</Suspense>
```

For this demo we also need to make sure the route is not statically built.

```ts
export const dynamic = "force-dynamic";
```

This is deployed with OpenNext, which needs a config to enable streaming.

```ts
export default {
  default: {
    override: {
      wrapper: "aws-lambda-streaming"
    }
  }
};
```

You should see the *friends* section load after a 3 second delay.

> **Note**: Safari handles streaming differently than other browsers.

Safari uses a [different heuristic](https://bugs.webkit.org/show_bug.cgi?id=252413) to determine when to stream data. You need to render *enough* initial HTML to trigger streaming. This is typically only a problem for demo apps.

```ts
new sst.aws.Nextjs("MyWeb");
```

View the [full example](https://github.com/sst/sst/tree/dev/examples/aws-nextjs-stream).

---

## AWS Postgres Local

In this example, we connect to a locally running Postgres instance for dev. While on deploy, we use RDS.

We use the [docker run](https://docs.docker.com/reference/cli/docker/container/run/) CLI to start a local container with Postgres. You don’t have to use Docker, you can use Postgres.app or any other way to run Postgres locally.

```bash
docker run \
  --rm \
  -p 5432:5432 \
  -v $(pwd)/.sst/storage/postgres:/var/lib/postgresql/data \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=local \
  postgres:16.4
```

The data is saved to the `.sst/storage` directory. So if you restart the dev server, the data will still be there.

We then configure the `dev` property of the `Postgres` component with the settings for the local Postgres instance.

```ts
dev: {
  username: "postgres",
  password: "password",
  database: "local",
  port: 5432,
}
```

By providing the `dev` prop for Postgres, SST will use the local Postgres instance and not deploy a new RDS database when running `sst dev`.

It also allows us to access the database through a Resource `link` without having to conditionally check if we are running locally.

```ts
const pool = new Pool({
  host: Resource.MyPostgres.host,
  port: Resource.MyPostgres.port,
  user: Resource.MyPostgres.username,
  password: Resource.MyPostgres.password,
  database: Resource.MyPostgres.database,
});
```

The above will work in both `sst dev` and `sst deploy`.

```ts
const vpc = new sst.aws.Vpc("MyVpc", { nat: "ec2" });
const rds = new sst.aws.Postgres("MyPostgres", {
  dev: {
    username: "postgres",
    password: "password",
    database: "local",
    host: "localhost",
    port: 5432,
  },
  vpc,
});
```

View the [full example](https://github.com/sst/sst/tree/dev/examples/aws-postgres-local).

---

## Prisma in Lambda

To use Prisma in a Lambda function you need to:
1. Generate the Prisma Client with the right architecture.
2. Copy the generated client to the function.
3. Run the function inside a VPC.

You can set the architecture using the `binaryTargets` option in `prisma/schema.prisma`.

```prisma
// For x86
binaryTargets = ["native", "rhel-openssl-3.0.x"]

// For ARM
// binaryTargets = ["native", "linux-arm64-openssl-3.0.x"]
```

You can also switch to ARM, just make sure to also change the function architecture in your `sst.config.ts`.

```ts
{
  // For ARM
  architecture: "arm64",
}
```

To generate the client, you need to run `prisma generate` when you make changes to the schema.

Since this [needs to be done on every deploy](https://www.prisma.io/docs/orm/more/help-and-troubleshooting/help-articles/vercel-caching-issue#a-custom-postinstall-script), we add a `postinstall` script to the `package.json`.

```json
"scripts": {
  "postinstall": "prisma generate"
}
```

This runs the command on `npm install`.

We then need to copy the generated client to the function when we deploy.

```ts
{
  copyFiles: [{ from: "node_modules/.prisma/client/" }]
}
```

Our function also needs to run inside a VPC, since Prisma doesn’t support the Data API.

```ts
{
  vpc,
}
```

### Prisma in Serverless Environments

Prisma is [not great in serverless environments](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections#serverless-environments-faas). For a couple of reasons:
1. It doesn’t support Data API, so you need to manage the connection pool on your own.
2. Without the Data API, your functions need to run inside a VPC.
   - You cannot use `sst dev` without [connecting to the VPC](https://docs.sst.dev/live#using-a-vpc).
3. Due to the internal architecture of their client, it’s also has slower cold starts.

Instead we recommend using [Drizzle](https://orm.drizzle.team). This example is here for reference for people that are already using Prisma.

```ts
const vpc = new sst.aws.Vpc("MyVpc", { nat: "managed" });
const rds = new sst.aws.Postgres("MyPostgres", { vpc });
const api = new sst.aws.Function("MyApi", {
  vpc,
  url: true,
  link: [rds],
  // For ARM
  // architecture: "arm64",
  handler: "index.handler",
  copyFiles: [{ from: "node_modules/.prisma/client/" }],
});

return {
  api: api.url,
};
```

View the [full example](https://github.com/sst/sst/tree/dev/examples/aws-prisma-lambda).

---

## Puppeteer in Lambda

To use Puppeteer in a Lambda function you need:
1. [puppeteer-core](https://www.npmjs.com/package/puppeteer-core)
2. Chromium
   - In `sst dev`, we’ll use a locally installed Chromium version.
   - In `sst deploy`, we’ll use the [@sparticuz/chromium](https://github.com/sparticuz/chromium) package. It comes with a pre-built binary for Lambda.

### Chromium Version

Since Puppeteer has a preferred version of Chromium, we’ll need to check the version of Chrome that a given version of Puppeteer supports. Head over to the [Puppeteer’s Chromium Support page](https://pptr.dev/chromium-support) and check which versions work together.

For example, Puppeteer v23.1.1 supports Chrome for Testing 127.0.6533.119. So, we’ll use the v127 of `@sparticuz/chromium`.

```bash
npm install puppeteer-core@23.1.1 @sparticuz/chromium@127.0.0
```

### Install Chromium Locally

To use this locally, you’ll need to install Chromium.

```bash
npx @puppeteer/browsers install chromium@latest --path /tmp/localChromium
```

Once installed you’ll see the location of the Chromium binary, `/tmp/localChromium/chromium/mac_arm-1350406/chrome-mac/Chromium.app/Contents/MacOS/Chromium`.

Update this in your Lambda function.

```ts
// This is the path to the local Chromium binary
const YOUR_LOCAL_CHROMIUM_PATH = "/tmp/localChromium/chromium/mac_arm-1350406/chrome-mac/Chromium.app/Contents/MacOS/Chromium";
```

You’ll notice we are using the right binary with the `SST_DEV` environment variable.

```ts
const browser = await puppeteer.launch({
  args: chromium.args,
  defaultViewport: chromium.defaultViewport,
  executablePath: process.env.SST_DEV
    ? YOUR_LOCAL_CHROMIUM_PATH
    : await chromium.executablePath(),
  headless: chromium.headless,
});
```

### Deploy

We don’t need a layer to deploy this because `@sparticuz/chromium` comes with a pre-built binary for Lambda.

> **Note**: As of writing this, `arm64` is not supported by `@sparticuz/chromium`.

We just need to set it in the [nodejs.install](https://docs.sst.dev/component/aws/function#nodejs-install).

```ts
{
  nodejs: {
    install: ["@sparticuz/chromium"],
  },
}
```

And on deploy, SST will use the right binary.

> **Tip**: You don’t need to use a Lambda layer to use Puppeteer.

We are giving our function more memory and a longer timeout since running Puppeteer can take a while.

```ts
const api = new sst.aws.Function("MyFunction", {
  url: true,
  memory: "2 GB",
  timeout: "15 minutes",
  handler: "index.handler",
  nodejs: {
    install: ["@sparticuz/chromium"],
  },
});
```

View the [full example](https://github.com/sst/sst/tree/dev/examples/aws-puppeteer).

---

## Subscribe to Queues

Create an SQS queue, subscribe to it, and publish to it from a function.

```ts
const queue = new sst.aws.Queue("MyQueue");
queue.subscribe("subscriber.handler");

const app = new sst.aws.Function("MyApp", {
  handler: "publisher.handler",
  link: [queue],
  url: true,
});

return {
  app: app.url,
  queue: queue.url,
};
```

View the [full example](https://github.com/sst/sst/tree/dev/examples/aws-queue).

---

## AWS Redis Local

In this example, we connect to a local Docker Redis instance for dev. While on deploy, we use Redis ElastiCache.

We use the [docker run](https://docs.docker.com/reference/cli/docker/container/run/) CLI to start a local Redis server. You don’t have to use Docker, you can run it locally any way you want.

```bash
docker run \
  --rm \
  -p 6379:6379 \
  -v $(pwd)/.sst/storage/redis:/data \
  redis:latest
```

The data is persisted to the `.sst/storage` directory. So if you restart the dev server, the data will still be there.

We then configure the `dev` property of the `Redis` component with the settings for the local Redis server.

```ts
dev: {
  host: "localhost",
  port: 6379,
}
```

By providing the `dev` prop for Redis, SST will use the local Redis server and not deploy a new Redis ElastiCache cluster when running `sst dev`.

It also allows us to access Redis through a Resource `link`.\n\n## AWS Deployment Examples with SST

This documentation provides various examples of deploying applications using SST (Serverless Stack) on AWS, including configurations for Redis, Postgres, and static sites.

### Connecting to Redis in AWS

To connect to a Redis instance in AWS, you can use the following configuration:

```typescript
const client = Resource.MyRedis.host === "localhost"  
  ? new Redis({  
      host: Resource.MyRedis.host,  
      port: Resource.MyRedis.port,  
    })  
  : new Cluster(  
      [{  
        host: Resource.MyRedis.host,  
        port: Resource.MyRedis.port,  
      }],  
      {  
        redisOptions: {  
          tls: { checkServerIdentity: () => undefined },  
          username: Resource.MyRedis.username,  
          password: Resource.MyRedis.password,  
        },  
      },  
    );
```

### Configuring VPC and Redis

When deploying your application, you need to configure the VPC and Redis settings:

```typescript
const vpc = new sst.aws.Vpc("MyVpc", { nat: "managed" });

const redis = new sst.aws.Redis("MyRedis", {
  dev: {
    host: "localhost",
    port: 6379,
  },
  vpc,
});
```

### Deploying a Function

To deploy a function that connects to the Redis instance, you can use:

```typescript
new sst.aws.Function("MyApp", {
  vpc,
  url: true,
  link: [redis],
  handler: "index.handler",
});
```

### Running Locally

To run your application locally, you can use:

```bash
npx sst dev
```

### Deploying to Production

To deploy your application to production, ensure you have a Dockerfile and run:

```bash
npx sst deploy --stage production
```

### Full Example Links
- [AWS Redis Local Example](https://github.com/sst/sst/tree/dev/examples/aws-redis-local)
- [AWS Remix Container with Redis](https://github.com/sst/sst/tree/dev/examples/aws-remix-redis)
- [AWS Static Site Basic Auth](https://github.com/sst/sst/tree/dev/examples/aws-static-site-basic-auth)
- [AWS SvelteKit Container with Redis](https://github.com/sst/sst/tree/dev/examples/aws-svelte-redis)
- [AWS Swift in Lambda](https://github.com/sst/sst/tree/dev/examples/aws-swift)
- [T3 Stack in AWS](https://github.com/sst/sst/tree/dev/examples/aws-t3)

---

This documentation provides a comprehensive guide to deploying various applications on AWS using SST, ensuring you have the necessary configurations and examples to get started.\n\n## Database Configuration in SST

In our Next.js app, we can access our Postgres database because we [link them](https://example.com/docs/linking/) both. We don’t need to use our `.env` files.

### Example Configuration

```typescript
export default {
  schema: "./src/server/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    ssl: {
      rejectUnauthorized: false,
    },
    host: Resource.MyPostgres.host,
    port: Resource.MyPostgres.port,
    user: Resource.MyPostgres.username,
    password: Resource.MyPostgres.password,
    database: Resource.MyPostgres.database,
  },
  tablesFilter: ["aws-t3_*"],
} satisfies Config;
```

### Running in Development Mode
To run this in dev mode, execute:

```bash
npm install
npx sst dev
```

It’ll take a few minutes to deploy the database and the VPC. This also starts a tunnel to let your local machine connect to the RDS Postgres database. Make sure you have it installed; you only need to do this once for your local machine.

### Setting Up the Tunnel
In a new terminal, run:

```bash
sudo npx sst tunnel install
```

Now in a new terminal, you can run the database migrations:

```bash
npm run db:push
```

We also have the Drizzle Studio start automatically in dev mode under the **Studio** tab.

### Studio Configuration
```typescript
new sst.x.DevCommand("Studio", {
  link: [rds],
  dev: {
    command: "npx drizzle-kit studio",
  },
});
```

### Updating Credentials in package.json
To ensure our credentials are available, we update our `package.json` with the [sst shell](https://example.com/docs/reference/cli) CLI:

```json
"db:generate": "sst shell drizzle-kit generate",
"db:migrate": "sst shell drizzle-kit migrate",
"db:push": "sst shell drizzle-kit push",
"db:studio": "sst shell drizzle-kit studio",
```

So running `npm run db:push` will run Drizzle Kit with the right credentials.

### Deploying to Production
To deploy this to production, run:

```bash
npx sst deploy --stage production
```

Then run the migrations:

```bash
npx sst shell --stage production npx drizzle-kit push
```

If you are running this locally, you’ll need to have a tunnel running:

```bash
npx sst tunnel --stage production
```

If you are doing this in a CI/CD pipeline, you’d want your build containers to be in the same VPC.

### Example VPC and Database Configuration
```typescript
const vpc = new sst.aws.Vpc("MyVpc", { bastion: true, nat: "ec2" });
const rds = new sst.aws.Postgres("MyPostgres", { vpc, proxy: true });

new sst.aws.Nextjs("MyWeb", {
  vpc,
  link: [rds],
});

new sst.x.DevCommand("Studio", {
  link: [rds],
  dev: {
    command: "npx drizzle-kit studio",
  },
});
```

View the [full example](https://github.com/sst/sst/tree/dev/examples/aws-t3).