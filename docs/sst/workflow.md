# Workflow

The basic workflow of building apps with SST.

The main difference between working on SST versus any other framework is that everything related to your app is all **defined in code**.

1. SST **automatically manages** the resources in AWS (or any provider) defined in your app.
2. You don’t need to **make any manual changes** to them in your cloud provider’s console.

This idea of *automating everything* can feel unfamiliar at first. So let’s go through the workflow and look at some basic concepts.

---

## Setup

Before you start working on your app, there are a couple of things we recommend setting up.

Starting with your code editor.

### Editor

SST apps are configured through a file called `sst.config.ts`. It’s a TypeScript file and it can work with your editor to type check and autocomplete your code. It can also show you inline help.

Most modern editors; VS Code and Neovim included, should do the above automatically. But you should start by making sure that your editor has been set up.

### Credentials

SST apps are deployed to your infrastructure. So whether you are deploying to AWS, or Cloudflare, or any other cloud provider, make sure you have their credentials configured locally.

Learn more about how to [configure your AWS credentials](/docs/iam-credentials/).

### Console

SST also comes with a [Console](/docs/console/). It shows you all your apps, the resources in them, lets you configure *git push to deploy*, and also send you alerts for when there are any issues.

While it is optional, we recommend creating a free account and linking it to your AWS account. Learn more about the [SST Console](/docs/console/).

---

## sst.config.ts

Now that you are ready to work on your app and your `sst.config.ts`, let’s take a look at what it means to *configure everything in code*.

### IaC

Infrastructure as Code or *IaC* is a process of automating the management of infrastructure through code. Rather than doing it manually through a console or user interface.

Say your app has a Function and an S3 bucket, you would define that in your `sst.config.ts`.

```typescript
const bucket = new sst.aws.Bucket("MyBucket");

new sst.aws.Function("MyFunction", {
  handler: "index.handler",
});
```

You won’t need to go to the Lambda and S3 parts of the AWS Console. SST will do the work for you.

In the above snippets, `sst.aws.Function` and `sst.aws.Bucket` are called Components. Learn more about [Components](/docs/components/).

### Resources

The reason this works is because when SST deploys the above app, it’ll convert it into a set of commands. These then call AWS with your credentials to create the underlying resources. So the above components get transformed into a list of low level resources in AWS.

If you log in to your AWS Console you can see what gets created internally. While these might look a little intimidating, they are all managed by SST and you are not directly responsible for them.

SST will create, track, and remove all the low level resources defined in your app.

### Exceptions

There are some exceptions to this. You might have resources that are not defined in your SST config. These could include the following resources:

1. **Previously created**: You might’ve previously created some resources by hand that you would like to use in your new SST app. You can import these resources into your app. Moving forward, SST will manage them for you. Learn more about [importing resources](/docs/import-resources/).
2. **Externally managed**: You might have resources that are managed by a different team. In this case, you don’t want SST to manage them. You simply want to reference them in your app. Learn more about [referencing resources](/docs/reference-resources/).
3. **Shared across stages**: If you are creating preview environments, you might not want to make copies of certain resources, like your database. You might want to share these across stages. Learn more about [sharing across stages](/docs/share-across-stages/).

### Linking

Let’s say you wanted your function from the above example to upload a file to the S3 bucket, you’d need to hardcode the name of the bucket in your API.

SST avoids this by allowing you to **link resources** together.

```typescript
new sst.aws.Function("MyFunction", {
  handler: "index.handler",
  link: [bucket],
});
```

Now in your function you can access the bucket using SST’s [SDK](/docs/reference/sdk/).

```typescript
import { Resource } from "sst";

console.log(Resource.MyBucket.name);
```

There’s a difference between the two snippets above. One is your **infrastructure code** and the other is your **runtime code**. One is run while creating your app, while the other runs when your users use your app.

### State

When you make a change to your `sst.config.ts`, like we did above. SST only deploys the changes.

It does this by maintaining a *state* of your app. The state is a tree of all the resources in your app and all their properties.

The state is stored in a file locally and backed up to a bucket in your AWS (or Cloudflare) account.

A word of caution, if for some reason you delete your state locally and in your provider, SST won’t be able to manage the resources anymore. To SST this app won’t exist anymore.

To fix this, you’ll have to manually re-import all those resources back into your app. Learn more about [how state works](/docs/state/).

### Out of sync

We mentioned above that you are not responsible for the low level resources that SST creates. But this isn’t just a point of convenience; it’s something you should not do.

The reason for this is that, SST only applies the diffs when your `sst.config.ts` changes. So if you manually change the resources, it’ll be out of sync with your state.

You can fix some of this by running `sst refresh` but in general you should avoid doing this.

---

## App

So now that we know how IaC works, a lot of the workflow and concepts will begin to make sense. Starting with the key parts of an app.

### Name

Every app has a name. The name is used as a namespace. It allows SST to deploy multiple apps to the same cloud provider account, while isolating the resources in an app.

If you change the name of your app in your `sst.config.ts`, SST will create a completely new set of resources for it. It **does not** rename the resources.

### Stage

An app can have multiple stages. A stage is like an *environment*, it’s a separate version of your app. For example, you might have a dev stage, a production stage, or a personal stage.

You create a new stage by deploying to it with the `--stage <name>` CLI option. The stage name is used as a namespace to create a new version of your app. It’s similar to how the app name is used as a namespace.

### Region

Most resources that are created in AWS (and many other providers) belong to a specific region. So when you deploy your app, it’s deployed to a specific region.

For AWS, the region comes from your AWS credentials but it can be specified in the `sst.config.ts`.

---

## Commands

Now with the above background let’s look at the workflow of building an SST app.

Let’s say you’ve created an app by running:

```bash
sst init
```

### Dev

To start with, you’ll run your app in dev.

```bash
sst dev
```

This deploys your app to your *personal* stage in *dev mode*. It brings up a multiplexer that deploys your app, runs your functions, creates a tunnel, and starts your frontend and container services.

### Deploy

Once you are ready to go to production you can run:

```bash
sst deploy --stage production
```

You can use any stage name for production here.

### Remove

If you want to remove your app and all the resources in it, you can run:

```bash
sst remove --stage <name>
```

You want to be careful while running this command because it permanently removes all the resources from your AWS (or cloud provider) account.

---

## With a team

This workflow really shines when working with a team. Let’s look at what it looks like with a basic git workflow.

1. Every developer on the team uses `sst dev` to work in their own isolated personal stage.
2. You commit your changes to a branch called `dev`.
3. Any changes to the `dev` branch are auto-deployed using `sst deploy --stage dev`.
4. Your team tests changes made to the `dev` stage of your app.
5. If they look good, `dev` is merged into a branch called `production`.
6. And any changes to the `production` branch are auto-deployed to the `production` stage with `sst deploy --stage production`.

In this setup, you have a separate stage per developer, a *dev* stage for testing, and a *production* stage.