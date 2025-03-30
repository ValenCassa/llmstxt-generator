# Migrate From v2

Migrate your SST v2 apps to v3.

This guide will help you migrate your SST v2 apps to v3. We look at the major differences between v2 and v3 below. But to get a quick intro, we recommend reading the [What is SST](https://sst.dev/docs/) and [Workflow](https://sst.dev/docs/workflow/) docs.

> **Tip**  
> We recently [migrated our demo notes app](https://github.com/sst/demo-notes-app/pull/8/files) from v2 to v3. You can use these changes as a reference.

We’ll then go over a migration plan that you can use. The exact details of this will be different from team to team depending on the resources in it, and sensitivity of downtime.

---

## Getting help

SST v3 has been around for a few months with a pretty sizeable community on [Discord](https://sst.dev/discord). We’ve created a channel for folks looking to migrate.

Join `#migrate-from-v2` on [Discord](https://sst.dev/discord).

---

## Not supported

While the goal with v3 is to support most of what’s in v2, there are a few things that haven’t been supported yet. There are also a couple of them that are currently in beta and will be released in the near future.

| Construct | GitHub Issue |
|-----------|--------------|
| `Auth` | [In beta](https://github.com/sst/sst/issues/4893) |
| `Script` | [#811](https://github.com/sst/sst/issues/4323) |
| `Function` non-Node.js runtimes | [Python](https://github.com/sst/sst/issues/4669), [Container](https://github.com/sst/sst/issues/4462), [Custom](https://github.com/sst/sst/issues/4826) |

> **Note**  
> Currently, v3 only supports WSL. Windows support is on the roadmap — [#347](https://github.com/sst/sst/issues/4685)

Feel free to let us know via the linked GitHub issues if these are blockers for you. It’ll help us prioritize this list.

---

## Major changes

If you are coming from SST v2, it’s worth starting with the big differences between v2 and v3. It’ll help you understand the types of changes you’ll need to make as you migrate.

### No CloudFormation

Let’s start with the obvious. SST v3 moves away from CloudFormation and CDK, [we’ve written in detail about why we decided to do this](https://sst.dev/blog/moving-away-from-cdk.html).

No CloudFormation means a couple of things:

1. There are no stacks, all the resources are defined through the same function in the `sst.config.ts`.
2. The outputs of constructs or *components* are different. These used to be tokens that would get replaced on deploy. Now they are something called [*Outputs*](https://sst.dev/docs/components/#outputs).
3. The state of your app is stored locally and backed up to S3. Learn more about [State](https://sst.dev/docs/state/).

### No CDK

And moving away from CDK means:

1. You cannot fall back to CDK constructs if something isn’t supported by SST. Instead, there is the [AWS](https://www.pulumi.com/registry/packages/aws/) provider from Pulumi that’s built on Terraform. There are also 150+ other providers that allow you to build on any cloud. Check out the [Directory](https://sst.dev/docs/all-providers#directory).
2. If you are using a lot of higher-level CDK constructs in your v2 app, it’s going to be really hard to migrate to v3. The Pulumi/Terraform ecosystem is fairly complete but it’s mainly made up of low-level resources. You might not have ready replacements for your CDK constructs.
3. Since the constructs or *components* are no longer built on CDK; they don’t have a `cdk` prop. Instead, there’s a `transform` prop that lets you modify the props that a component sends to its underlying resources. Learn more about the [transform](https://sst.dev/docs/components/#transform) prop.

### sst.config.ts

The `sst.config.ts` is similar in v3 but there are some changes. Here’s a comparison of the general structure, we look at this in detail in a [section below](#sstconfigts-1).

```ts
export default $config({
  // Your app's config
  app(input) {
    return {
      name: "my-sst-app",
      home: "aws"
    };
  },
  // Your app's resources
  async run() { }
});
```

Learn more about the new [sst.config.ts](https://sst.dev/docs/reference/config/).

### sst dev

The `sst dev` CLI has been completely reworked. It now runs a *multiplexer* that deploys your app and runs your frontends together. So you don’t need to:

- Start your frontend separately
- Need to wrap your frontend `dev` script with `sst bind`

Learn more about [sst dev](https://sst.dev/docs/reference/cli/#dev).

### sst build

There is no `sst build` CLI. Instead, you can run `sst diff` to see what changes will be deployed, without doing an actual deploy.

Learn more about [sst diff](https://sst.dev/docs/reference/cli/#diff).

### Resource binding

Resource binding is now called resource linking, the `bind` prop is now renamed to `link`. The Node.js client or *JS SDK* has been reworked so that all linked resources are now available through the `Resource` object. We’ll look at this in [detail below](#clients).

The client handlers and hooks have not been supported yet.

Learn more about [Resource linking](https://sst.dev/docs/linking/).

### Secrets

Secrets are not stored in SSM. Instead, they are encrypted and stored in your state file. It’s encrypted using a passphrase that’s stored in SSM.

Loading secrets in your functions no longer needs a top-level await.

---

## Migration plan

Say you have a v2 app in a git repo that’s currently deployed to production. Here’s how we recommend carrying out the migration.

1. Use the steps below to migrate over your app to a non-prod stage. You don’t need to import any resources, just recreate them.
2. Test your non-prod version of your v3 app.
3. Then for your prod stage, follow the steps below and make the import, domain, and subscriber changes.
4. Once the prod version of your v3 app is running, clean up some of the v2 prod resources.

> **Caution**  
> These are recommendations and the specific details depend on the type of resources you have.

The general idea here is to have the v2 app hand over control of the underlying resources to the v3 version of the app.

---

### Setup

1. Start by setting the removal policy to `retain` in the v2 app for the production stages. This ensures resources don’t get accidentally removed.

   ```ts
   app.setDefaultRemovalPolicy("retain");
   ```

   > **Caution**  
   > You’ll want to deploy your app once after setting this.

2. Create a new branch in your repo for the upcoming changes.
3. For the prod version of the v3 app, pick a different stage name. Say your prod stage in v2 is called `production`. Maybe use `prod`, `main`, or `live` for your v3 app. Or vice versa. This isn’t strictly necessary, but we recommend doing this because you don’t want to change the wrong resources by mistake.

---

### Init v3

Now let’s set up our new v3 app in the root of your project.

1. Update SST to v3. Or set the version by hand in your `package.json`. Make sure to do this across all the packages in your repo.

   ```bash
   npm update sst
   ```

   Ensure v3 is installed.

   ```bash
   npx sst version
   ```

2. Backup the v2 config with.

   ```bash
   mv sst.config.ts sst.config.ts.bk
   ```

3. Init a v3 app.

   ```bash
   npx sst init
   ```

   > **Caution**  
   > Make sure to use the same app name.

4. Set the removal policy to `retain`. Similar to `setDefaultRemovalPolicy` in v2, you can configure the removal policy in `sst.config.ts` in v3.

   ```ts
   app(input) {
     return {
       name: "my-sst-app",
       removal: input?.stage === "production" ? "retain" : "remove"
     };
   }
   ```

   By default, v3 has removal policy set to `retain` for the `production` stage, and `remove` for other stages.

5. Deploy an empty app to ensure the app is configured correctly.

   ```bash
   npx sst deploy
   ```

6. Update the dev scripts for your frontend. Remove the `sst bind` from the `dev` script in your `package.json`. For example, for a Next.js app.

   ```json
   "dev": "next dev",
   ```

7. Remove any CDK related packages from your `package.json`.

---

### Migrate stacks

Now before we start making changes to our constructs, you might have some stacks code in your `sst.config.ts`.

Take a look at the [list below](#sstconfigts-1) and apply the changes that matter to you.

---

### Restructure

Since you don’t have to import the constructs and there are no stacks, you’ll need to change how your constructs are structured.

For example, in the [monorepo notes app](https://github.com/sst/demo-notes-app/pull/8) we made these changes.

```ts
export default $config({
  // ...
  async run() {
    await import("./infra/api");
    await import("./infra/storage");
    await import("./infra/frontend");
    const auth = await import("./infra/auth");

    return {
      UserPool: auth.userPool.id,
      Region: aws.getRegionOutput().name,
      IdentityPool: auth.identityPool.id,
      UserPoolClient: auth.userPoolClient.id,
    };
  }
});
```

We store our infrastructure files in the `infra/` directory in v3. You can refer to the [demo notes app](https://github.com/sst/demo-notes-app) to see how these are structured.

---

### Migrate runtime

For your runtime code, your functions and frontend; there are fairly minimal changes. The clients or the *JS SDK* have been reorganized.

You can make these changes now or as you are migrating each construct. [Check out](#clients) the steps below.

---

### Migrate constructs

Constructs in v2 have their equivalent *components* in v3. Constructs fall into roughly these 3 categories:

1. **Transient** — these don’t contain data, like `Function`, `Topic`, or `Queue`.
2. **Data** — these contain application data, like `RDS`, `Table`, or `Bucket`.
3. **Custom domains** — these have custom domains configured, like `Api`, `StaticSite`, or `NextjsSite`.
4. **Subscribers** — these are constructs that subscribe to other constructs, like the `Bucket`, `Queue`, or `Table` subscribers.

We’ll go over each of these types and copy our v2 constructs over as v3 components.

---

### Transient constructs

Constructs like `Function`, `Cron`, `Topic`, `Queue`, and `KinesisStream` do not contain data. They can be recreated in the v3 app.

Simply copy them over using the [reference below](#constructs).

---

### Data constructs

Constructs like `RDS`, `Table`, `Bucket`, and `Cognito` contain data. If you do not need to keep the data, you can recreate them like what you did above. This is often the case for non-production stages.

However, for production stages, you need to import the underlying AWS resource into the v3 app.

For example, here are the steps for importing an S3 bucket named `app-prod-MyBucket`.

1. **Import the resource**  
   Say the bucket is defined in SST v2, and the bucket name is `app-prod-MyBucket`.

   ```ts
   const bucket = new Bucket(stack, "MyBucket");
   ```

   You can use the `import` and `transform` props to import it.

   ```ts
   const bucket = new sst.aws.Bucket("MyBucket", {
     transform: {
       bucket: (args, opts) => {
         args.bucket = "app-prod-MyBucket";
         opts.import = "app-prod-MyBucket";
       },
       cors: (args, opts) => {
         opts.import = "app-prod-MyBucket";
       },
       policy: (args, opts) => {
         opts.import = "app-prod-MyBucket";
       },
       publicAccessBlock: (args, opts) => {
         opts.import = "app-prod-MyBucket";
       }
     }
   });
   ```

   Import is a process of bringing previously created resources into your SST app and allowing it to manage it moving forward. Learn more about [importing resources](https://sst.dev/docs/import-resources/).

2. **Deploy**  
   You’ll get an error if the resource configurations in your code do not match the exact configuration of the bucket in your AWS account.

   This is good because we don’t want to change our old resource.

3. **Update props**  
   In the error message, you’ll see the props you need to change. Add them to the corresponding `transform` block.

   And deploy again.

   > **Caution**  
   > Make sure the v2 app is set to `retain` to avoid accidentally removing imported resources.

   After the bucket has been imported, the v2 app can still make changes to the resource. If you try to remove the v2 app or remove the bucket from the v2 app, the S3 bucket will get removed. To prevent this, ensure that you had the removal policy in the v2 app set to `retain`.

---

### Constructs with custom domains

Constructs like the following have custom domains:

- Frontends like `StaticSite`, `NextjsSite`, `SvelteKitSite`, `RemixSite`, `AstroSite`, `SolidStartSite`
- APIs like `Api`, `ApiGatewayv1`, `AppSyncApi`, `WebSocketApi`
- `Service`

For non-prod stages you can just recreate them.

However, if they have a custom domain, you need to deploy them in steps to avoid any downtime.

1. First, create the resource in v3 without a custom domain. So for `Nextjs`, for example.

   ```ts
   new sst.aws.Nextjs("MySite");
   ```

2. Then, once that’s deployed, you can add the custom domain.\n\n## Constructs with Custom Domains
Constructs like the following have custom domains:

- Frontends like `StaticSite`, `NextjsSite`, `SvelteKitSite`, `RemixSite`, `AstroSite`, `SolidStartSite`
- APIs like `Api`, `ApiGatewayv1`, `AppSyncApi`, `WebSocketApi`
- `Service`

For non-prod stages, you can just recreate them. However, if they have a custom domain, you need to deploy them in steps to avoid any downtime.

### Deployment Steps
1. First, create the resource in v3 without a custom domain. For example, for `Nextjs`:
   ```typescript
   new sst.aws.Nextjs("MySite");
   ```
2. Deploy your v3 app.
3. When you are ready, flip the domain using the `override` prop:
   ```typescript
   new sst.aws.Nextjs("MySite", {
     domain: {
       name: "domain.com",
       dns: sst.aws.dns({ override: true })
     }
   });
   ```
   This updates the DNS record to point to your new Next.js app.

### Caution
Make sure the v2 app is set to `retain` to avoid accidentally removing imported resources. After the DNS record has been overridden, the v2 app can still make changes to it. If you try to remove the v2 app, the record will get removed. To prevent this, ensure that the removal policy in the v2 app is set to `retain`.

## Subscriber Constructs
Many constructs have subscribers that help with async processing. For example, the `Queue` has a consumer, `Bucket` has the notification, and `Table` constructs have streams. You can recreate the constructs in your v3 app.

However, recreating the subscribers for a production stage with an imported resource is not straightforward:
- Recreating the consumer for an imported Queue will fail because a `Queue` can only have 1 consumer.
- Recreating the consumer for an imported DynamoDB Table will result in double processing, as an event will be processed both in your v2 and v3 app.

### Recommended Approach
1. Deploy the v3 app without the subscribers. Either by commenting out the `.subscribe()` call or by returning early in the subscriber function.
2. When you are ready to flip, remove the subscribers in the v2 app and deploy.
3. Add the subscribers to the v3 app and deploy.

This ensures that the same subscriber is only attached once to a resource.

## Clean Up
Now that your v3 app is handling production traffic, you can optionally clean up a few things from the v2 app. The resources that were recreated in v3, the ones that were not imported, can now be removed. However, since we have the v2 app set to `retain`, this is going to be a manual process.

You can go to the CloudFormation console, look at the list of resources in your v2 app’s stacks, and remove them manually. Finally, when you run `sst remove` for your v2 app, it’ll remove the CloudFormation stacks as well.

## CI/CD
You probably have `git push to deploy` or CI/CD set up for your apps. If you are using GitHub Actions, there shouldn’t be much of a difference between v2 and v3.

If you are using [Seed](https://seed.run) to deploy your v2 app, then you’ll want to migrate to using [Autodeploy](https://console.sst.dev) on the SST Console. We are currently [not planning to support v3 on Seed](https://seed.run/blog/seed-and-sst-v3).

### Key Reasons to Autodeploy through the Console
- The builds are run in your AWS account.
- You can configure your workflow through your `sst.config.ts`.
- You can see which resources were updated as part of the deploy.

### Enabling Autodeploy on the Console
To enable Autodeploy on the Console, you’ll need to:
1. Create a new account on the Console — [console.sst.dev](https://console.sst.dev)
2. Link your AWS account
3. Connect your repo
4. Configure your environments
5. And `git push`

Learn more about [Console](https://console.sst.dev) and [Autodeploy](https://console.sst.dev).

## sst.config.ts
Listed below are some of the changes to your `sst.config.ts` in general.

### No Imports
All the constructs or components are available in the global context. So there’s no need to import anything. Your app’s `package.json` only needs the `sst` package. There are no extra CDK or infrastructure-related packages.

### Globals
There are a couple of global variables, `$app` and `$dev`, that replace the `app` argument that’s passed into the `stacks()` method of your `sst.config.ts`.
1. `$app.name` gives you the name of the app. Used to be `app.name`.
2. `$app.stage` gives you the name of the stage. Used to be `app.stage`.
3. `$dev === true` tells you if you are in dev mode. Used to be `app.mode === "dev"`.
4. `$dev === false` tells you if it’s being deployed. Used to be `app.mode === "deploy"`.
5. There is no `app.mode === remove` replacement since your components are not evaluated on `sst remove`.
6. There is no `app.region` since in v3 you can deploy resources to different regions or AWS profiles or providers. To get the default AWS provider, you can use `aws.getRegionOutput().name`.

### No Stacks
Also, since there are no stacks, you don’t have access to the `stack` argument inside your stack function and no `stack.addOutputs({})` method. You can still group your constructs or components in files. But to output something, you return in the `run` method of your config.

```typescript
async run() {
  const auth = await import("./infra/auth");
  return {
    UserPool: auth.userPool.id,
    IdentityPool: auth.identityPool.id,
    UserPoolClient: auth.userPoolClient.id
  };
}
```

### Defaults
The set of methods that applied defaults to all the functions in your app, like `addDefaultFunctionBinding`, `addDefaultFunctionEnv`, `addDefaultFunctionPermissions`, and `setDefaultFunctionProps`, can be replaced with the global `$transform`.

```typescript
$transform(sst.aws.Function, (args, opts) => {
  // Set the default if it's not set by the component
  if (args.runtime === undefined) {
    args.runtime = "nodejs18.x";
  }
});
```

Learn more about [$transform](https://docs.sst.dev/reference/global/#transform).

## Clients
The Node.js client, now called the [JS SDK](https://docs.sst.dev/reference/sdk/), has a couple of minor changes. Update `sst` to the latest version in your `package.json`. If you have a monorepo, make sure to update `sst` in all your packages.

### Bind
In SST v3, you access all bound or linked resources through the `Resource` module. Say you link a bucket to a function.

```typescript
const bucket = new sst.aws.Bucket("MyBucket");

new sst.aws.Function("MyFunction", {
  handler: "src/lambda.handler",
  link: [bucket]
});
```

In your function, you would access it like so:

```typescript
import { Resource } from "sst";

console.log(Resource.MyBucket.name);
```

### Config
The same applies to `Config` as well. Let’s look at a secret.

```typescript
const secret = new sst.Secret("MySecret");

new sst.aws.Function("MyFunction", {
  handler: "src/lambda.handler",
  link: [secret]
});
```

And in your function, you access it in the same way:

```typescript
import { Resource } from "sst";

console.log(Resource.MySecret.value);
```

### Handlers
In v2, some modules in the Node client had [handlers and hooks](https://v2.sst.dev/clients#handlers). These were experimental and are not currently supported in v3. To continue using them, you can import them by first adding it to your `package.json`.

```json
{
  "sstv2": "npm:sst@^2",
  "sst": "^3"
}
```

This means that you have both v2 and v3 installed in your project. Since they both have an `sst` binary, you want to make sure v3 takes precedence. So v3 should be listed **after** v2.

### Constructs
Below shows the v3 component version of a v2 construct.

#### Api
```typescript
const api = new sst.aws.ApiGatewayV2("MyApi", {
  domain: "api.example.com"
});

api.route("GET /", "src/get.handler");
api.route("POST /", "src/post.handler");
```

#### Job
The `Task` component that replaces `Job` is based on AWS Fargate. It runs a container task in the background.

```typescript
const cluster = new sst.aws.Cluster("MyCluster", { vpc });

new sst.aws.Task("MyTask", {
  cluster,
  image: {
    context: "./src",
    dockerfile: "Dockerfile"
  }
});
```

There are some key differences between `Job` and `Task`:
1. `Task` is based on AWS Fargate. `Job` used a combination of AWS CodeBuild and Lambda.
2. Since `Task` is natively based on Fargate, you can use the AWS SDK to interact with it, even in runtimes the SST SDK doesn’t support.
3. In dev mode, `Task` uses Fargate only, whereas `Job` used Lambda.
4. While CodeBuild is billed per minute, Fargate is a lot cheaper than CodeBuild. Roughly **$0.02 per hour** vs **$0.3 per hour** on X86 machines.

Learn more about [Task](https://docs.sst.dev/blog/tasks-in-v3).

#### RDS
The `Aurora` component uses [Amazon Aurora Serverless v2](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.html).

For migrations, we recommend using [Drizzle Kit](https://orm.drizzle.team/kit-docs/overview). Check out our [Drizzle example](https://docs.sst.dev/start/aws/drizzle/).

#### Cron
```typescript
new sst.aws.Cron("MyCronJob", {
  schedule: "rate(1 minute)",
  function: "src/cron.handler"
});
```

#### Table
```typescript
const table = new sst.aws.Dynamo("MyTable", {
  fields: {
    id: "string"
  },
  primaryIndex: { hashKey: "id" }
});

table.subscribe("MySubscriber", "src/subscriber.handler");
```

#### Topic
```typescript
const topic = new sst.aws.SnsTopic("MyTopic");

topic.subscribe("MySubscriber", "src/subscriber.handler");
```

#### Queue
```typescript
const queue = new sst.aws.Queue("MyQueue");

queue.subscribe("src/subscriber.handler");
```

### Config
The `Config` construct is now broken into a `Secret` component and v3 has a separate way to bind any value.

#### Secret
```typescript
const secret = new sst.Secret("MySecret");
```

#### Parameter
The `Linkable` component lets you bind or link any value.
```typescript
const secret = new sst.Linkable("MyParameter", {
  properties: { version: "1.2.0" }
});
```

In your function, you’d access this using:
```typescript
import { Resource } from "sst";

console.log(Resource.MyParameter.version);
```

### Bucket
```typescript
const bucket = new sst.aws.Bucket("MyBucket");

bucket.subscribe("src/subscriber.handler");
```

### Service
```typescript
const cluster = new sst.aws.Cluster("MyCluster", { vpc });

new sst.aws.Service("MyService", {
  cluster,
  loadBalancer: {
    domain: "my-app.com",
    ports: [{ listen: "80/http" }]
  }
});
```

### Cognito
```typescript
const userPool = new sst.aws.CognitoUserPool("MyUserPool");
const client = userPool.addClient("MyClient");

new sst.aws.CognitoIdentityPool("MyIdentityPool", {
  userPools: [{
    userPool: userPool.id,
    client: client.id
  }]
});
```\n\n## Cognito

### Configuration Example
```typescript
const userPool = new sst.aws.CognitoUserPool("MyUserPool");
const client = userPool.addClient("MyClient");

new sst.aws.CognitoIdentityPool("MyIdentityPool", {
  userPools: [{
    userPool: userPool.id,
    client: client.id
  }]
});
```

## Function

### Configuration Example
```typescript
new sst.aws.Function("MyFunction", {
  handler: "src/lambda.handler"
});
```

## AstroSite

### Configuration Example
```typescript
new sst.aws.Astro("MyWeb", {
  domain: "my-app.com"
});
```

## EventBus

### Configuration Example
```typescript
const bus = new sst.aws.EventBus("Bus");

bus.subscribe("MySubscriber1", "src/function1.handler", {
  pattern: {
    source: ["myevent"]
  }
});

bus.subscribe("MySubscriber2", "src/function2.handler", {
  pattern: {
    source: ["myevent"]
  }
});
```

## StaticSite

### Configuration Example
```typescript
new sst.aws.StaticSite("MyWeb", {
  domain: "my-app.com"
});
```

## AppSyncApi

### Configuration Example
```typescript
const api = new sst.aws.AppSync("MyApi", {
  schema: "schema.graphql",
  domain: "api.domain.com"
});

const lambdaDS = api.addDataSource({
  name: "lambdaDS",
  lambda: "src/lambda.handler"
});

api.addResolver("Query user", {
  dataSource: lambdaDS.name
});
```

## WebSocketApi

### Configuration Example
```typescript
const api = new sst.aws.ApiGatewayWebSocket("MyApi", {
  domain: "api.example.com"
});

api.route("$connect", "src/connect.handler");
api.route("$disconnect", "src/disconnect.handler");
```

## KinesisStream

### Configuration Example
```typescript
const stream = new sst.aws.KinesisStream("MyStream");

stream.subscribe("MySubscriber", "src/subscriber.handler");
```

## ApiGatewayV1Api

### Configuration Example
```typescript
const api = new sst.aws.ApiGatewayV1("MyApi", {
  domain: "api.example.com"
});

api.route("GET /", "src/get.handler");
api.route("POST /", "src/post.handler");
api.deploy();
```