# What is SST

Build full-stack apps on your own infrastructure.

SST is a framework that makes it easy to build modern full-stack applications on your own infrastructure.

> **Note**: SST supports over 150 providers. Check out the [full list](https://sst.dev/docs/all-providers#directory).

What makes SST different is that your *entire* app is **defined in code** — in a single `sst.config.ts` file. This includes databases, buckets, queues, Stripe webhooks, or any one of **150+ providers**.

With SST, **everything is automated**.

---

## Components

You start by defining parts of your app, **in code**.

For example, you can add your frontend and set the domain you want to use.

### Example: Next.js
```typescript
new sst.aws.Nextjs("MyWeb", {
  domain: "my-app.com"
});
```

Just like the frontend, you can configure backend features *in code*.

Like your API deployed in a container. Or any Lambda functions, Postgres databases, S3 Buckets, or cron jobs.

### Example: Containers
```typescript
const cluster = new sst.aws.Cluster("MyCluster", { vpc });

new sst.aws.Service("MyService", {
  cluster,
  loadBalancer: {
    ports: [{ listen: "80/http" }]
  }
});
```

You can even set up your Stripe products in code.

### Example: Stripe Product
```typescript
new stripe.Product("MyStripeProduct", {
  name: "SST Paid Plan",
  description: "This is how SST makes money"
});
```

You can check out the full list of components in the sidebar.

---

## Infrastructure

The above are called **Components**. They are a way of defining the features of your application in code. You can define any feature of your application with them.

In the above examples, they create the necessary infrastructure in your AWS account. All without using the AWS Console.

Learn more about [Components](https://sst.dev/docs/components/).

---

## Configure

SST’s components come with sensible defaults designed to get you started. But they can also be configured completely.

### Example: Configuring a Function
```typescript
new sst.aws.Function("MyFunction", {
  handler: "src/lambda.handler",
  timeout: "3 minutes",
  memory: "1024 MB"
});
```

But with SST you can take it a step further and transform how the Function component creates its low level resources. For example, the Function component also creates an IAM Role. You can transform the IAM Role using the `transform` prop.

### Example: Transforming IAM Role
```typescript
new sst.aws.Function("MyFunction", {
  handler: "src/lambda.handler",
  transform: {
    role: (args) => ({
      name: `${args.name}-MyRole`
    })
  }
});
```

Learn more about [transforms](https://sst.dev/docs/components#transforms).

---

## Providers

SST has built-in components for AWS and Cloudflare that make these services easier to use.

> **Watch a video about providers in SST**: [Video Link](https://youtu.be/rlR2f5N9mW4)

However it also supports components from any one of the **150+ Pulumi/Terraform providers**. For example, you can use Vercel for your frontends.

### Example: Vercel Project
```typescript
new vercel.Project("MyFrontend", {
  name: "my-nextjs-app"
});
```

Learn more about [Providers](https://sst.dev/docs/providers) and check out the full list in the [Directory](https://sst.dev/docs/all-providers#directory).

---

## Link resources

Once you’ve added a couple of features, SST can help you link them together. This is great because you **won’t need to hardcode** anything in your app.

> **Watch a video on linking resources**: [Video Link](https://youtu.be/s8cWklU4Akw)

### Example: Linking a Bucket to a Service
```typescript
const bucket = new sst.aws.Bucket("MyBucket");
const cluster = new sst.aws.Cluster("MyCluster", { vpc });

new sst.aws.Service("MyService", {
  cluster,
  link: [bucket],
  loadBalancer: {
    ports: [{ listen: "80/http" }]
  }
});
```

You can then use SST’s [SDK](https://sst.dev/docs/reference/sdk/) to access the S3 bucket in your Express app.

### Example: Accessing the Bucket
```typescript
import { Resource } from "sst";

console.log(Resource.MyBucket.name);
```

Learn more about [resource linking](https://sst.dev/docs/linking/).

---

## Project structure

We’ve looked at a couple of different types of files. Let’s take a step back and see what an SST app looks like in practice.

> **Watch a video about SST's project structure**: [Video Link](https://youtu.be/mserRA-CWRw)

### Example: Drop-in Mode
```plaintext
my-nextjs-app
├─ next.config.js
├─ sst.config.ts
├─ package.json
├─ app
├─ lib
└─ public
```

View an [example Next.js](https://github.com/sst/sst/tree/dev/examples/aws-nextjs) app using SST in drop-in mode.

### Example: Monorepo
```plaintext
my-sst-app
├─ sst.config.ts
├─ package.json
├─ packages
│  ├─ functions
│  ├─ frontend
│  ├─ backend
│  └─ core
└─ infra
```

Learn more about our [monorepo setup](https://sst.dev/docs/set-up-a-monorepo/).

---

## CLI

To make this all work, SST comes with a [CLI](https://sst.dev/docs/reference/cli/). You can install it as a part of your Node project.

### Example: Install CLI
```bash
npm install sst
```

Or if you are not using Node, you can install it globally.

### Example: Global Install
```bash
curl -fsSL https://sst.dev/install | bash
```

> **Note**: SST currently supports **macOS, Linux, and WSL**. Support for Windows is on the roadmap.

The CLI currently supports macOS, Linux, and WSL. Learn more about the [CLI](https://sst.dev/docs/reference/cli/).

---

## Dev

The CLI includes a `dev` command that starts a local development environment.

### Example: Start Dev Environment
```bash
sst dev
```

This brings up a *multiplexer* that:
1. Starts a watcher that deploys any infrastructure changes.
2. Runs your functions *Live*, letting you make and test changes without having to redeploy them.
3. Creates a [tunnel](https://sst.dev/docs/reference/cli#tunnel) to connect your local machine to any resources in a VPC.
4. Starts your frontend and container services in dev mode and links it to your infrastructure.

> **Watch a video about dev mode**: [Video Link](https://youtu.be/mefLc137EB0)

The `sst dev` CLI makes it so that you won’t have to start your frontend or container applications separately. Learn more about [sst dev](https://sst.dev/docs/reference/cli/#dev).

---

## Deploy

When you’re ready to deploy your app, you can use the `deploy` command.

### Example: Deploy Command
```bash
sst deploy --stage production
```

### Stages
The stage name is used to namespace different environments of your app. So you can create one for dev.

### Example: Deploy to Dev Stage
```bash
sst deploy --stage dev
```

Or for a pull request.

### Example: Deploy to PR Stage
```bash
sst deploy --stage pr-123
```

Learn more about [stages](https://sst.dev/docs/reference/cli#stage).

---

## Console

Once you are ready to go to production, you can use the [SST Console](https://sst.dev/docs/console/) to **auto-deploy** your app, create **preview environments**, and **monitor** for any issues.

![SST Console](https://_astro/sst-console-home.-pMOaf_T_2f9BxE.webp)

Learn more about the [Console](https://sst.dev/docs/console/).

---

## FAQ

Here are some questions that we frequently get.

### Is SST open-source if it’s based on Pulumi and Terraform?
SST uses Pulumi behind the scenes for the providers and the deployment engine. And Terraform’s providers are *bridged* through Pulumi.

SST only relies on the open-source parts of Pulumi and Terraform. It does not require a Pulumi account and all the data about your app and its resources stay on your side.

### How does SST compare to CDK for Terraform or Pulumi?
Both CDKTF and Pulumi allow you to define your infrastructure using a programming language like TypeScript. SST is also built on top of Pulumi. So you might wonder how SST compares to them and why you would use SST instead of them.

In a nutshell, SST is for developers, while CDKTF and Pulumi are primarily for DevOps engineers. There are 3 big things SST does for developers:
1. **Higher-level components**: SST’s built-in components like [Nextjs](https://sst.dev/docs/component/aws/nextjs/) or [Email](https://sst.dev/docs/component/aws/email/) make it easy for developers to add features to their app. You can use these without having to figure out how to work with the underlying Terraform resources.
2. **Linking resources**: SST makes it easy to link your infrastructure to your application and access them at runtime in your code.
3. **Dev mode**: Finally, SST features a unified local developer environment that deploys your app through a watcher, runs your functions *Live*, creates a [tunnel](https://sst.dev/docs/reference/cli#tunnel) to your VPC, starts your frontend and backend, all together.

### How does SST make money?
While SST is open-source and free to use, we also have the [Console](https://sst.dev/docs/console/) that can auto-deploy your apps and monitor for any issues. It’s optional and includes a free tier but it’s a SaaS service. It’s used by a large number of teams in our community, including ours.

---

### Next steps
1. [Learn about the SST workflow](https://sst.dev/docs/workflow/)
2. Create your first SST app
   - [Build a Next.js app in AWS](https://sst.dev/docs/start/aws/nextjs/)
   - [Deploy Bun in a container to AWS](https://sst.dev/docs/start/aws/bun/)
   - [Build a Hono API with Cloudflare Workers](https://sst.dev/docs/start/cloudflare/hono/)