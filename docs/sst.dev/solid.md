# SolidStart on AWS with SST

Create and deploy a SolidStart app to AWS with SST.

There are two ways to deploy SolidStart apps to AWS with SST:

1. [Serverless](#serverless)
2. [Containers](#containers)

We’ll use both to build a couple of simple apps below.

---

## Examples

We also have a few other SolidStart examples that you can refer to:
- [Adding a WebSocket endpoint to SolidStart](https://docs/examples/#aws-solidstart-websocket-endpoint)

---

## Serverless

We are going to create a SolidStart app, add an S3 Bucket for file uploads, and deploy it using the `SolidStart` component.

> **Tip**: You can [view the source](https://github.com/sst/sst/tree/dev/examples/aws-solid) of this example in our repo.

Before you get started, make sure to [configure your AWS credentials](https://docs/iam-credentials#credentials).

### 1. Create a project

Let’s start by creating our project.

```bash
npm init solid@latest aws-solid-start
cd aws-solid-start
```

We are picking the **SolidStart**, *basic*, and *TypeScript* options.

### Init SST

Now let’s initialize SST in our app.

```bash
npx sst@latest init
npm install
```

Select the defaults and pick **AWS**. This’ll create a `sst.config.ts` file in your project root.

It’ll also ask you to update your `app.config.ts` with something like this:

```ts
export default defineConfig({
  server: {
    preset: "aws-lambda",
    awsLambda: {
      streaming: true,
    },
  },
});
```

### Start dev mode

Run the following to start dev mode. This’ll start SST and your SolidStart app.

```bash
npx sst dev
```

Once complete, click on **MyWeb** in the sidebar and open your SolidStart app in your browser.

### 2. Add an S3 Bucket

Let’s allow public `access` to our S3 Bucket for file uploads. Update your `sst.config.ts`.

```js
const bucket = new sst.aws.Bucket("MyBucket", {
  access: "public",
});
```

Add this above the `SolidStart` component.

#### Link the bucket

Now, link the bucket to our SolidStart app.

```js
new sst.aws.SolidStart("MyWeb", {
  link: [bucket],
});
```

### 3. Generate a pre-signed URL

When our app loads, we’ll generate a pre-signed URL for the file upload and use it in our form. Add this below the imports in `src/routes/index.tsx`.

```ts
async function presignedUrl() {
  "use server";
  const command = new PutObjectCommand({
    Key: crypto.randomUUID(),
    Bucket: Resource.MyBucket.name,
  });
  return await getSignedUrl(new S3Client({}), command);
}

export const route = {
  load: () => presignedUrl(),
};
```

> **Tip**: We are directly accessing our S3 bucket with `Resource.MyBucket.name`.

### 4. Create an upload form

Add a form to upload files to the presigned URL. Replace the `Home` component in `src/routes/index.tsx` with:

```tsx
export default function Home() {
  const url = createAsync(() => presignedUrl());

  return (
    <main>
      <h1>Hello world!</h1>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const file = (e.target as HTMLFormElement).file.files?.[0]!;
          const image = await fetch(url() as string, {
            body: file,
            method: "PUT",
            headers: {
              "Content-Type": file.type,
              "Content-Disposition": `attachment; filename="${file.name}"`,
            },
          });
          window.location.href = image.url.split("?")[0];
        }}
      >
        <input name="file" type="file" accept="image/png, image/jpeg" />
        <button type="submit">Upload</button>
      </form>
    </main>
  );
}
```

Head over to the local app in your browser, `http://localhost:3000` and try **uploading an image**. You should see it upload and then download the image.

### 5. Deploy your app

Now let’s deploy your app to AWS.

```bash
npx sst deploy --stage production
```

You can use any stage name here but it’s good to create a new stage for production.

Congrats! Your site should now be live!

![SST SolidStart app](/_astro/start-solidstart.Dowkw9SM_1XvUu1.webp)

---

## Containers

We are going to build a hit counter SolidStart app with Redis. We’ll deploy it to AWS in a container using the `Cluster` component.

> **Tip**: You can [view the source](https://github.com/sst/sst/tree/dev/examples/aws-solid-container) of this example in our repo.

Before you get started, make sure to [configure your AWS credentials](https://docs/iam-credentials#credentials).

### 1. Create a project

Let’s start by creating our project.

```bash
npm init solid@latest aws-solid-container
cd aws-solid-container
```

We are picking the **SolidStart**, *basic*, and *TypeScript* options.

### Init SST

Now let’s initialize SST in our app.

```bash
npx sst@latest init
npm install
```

Select the defaults and pick **AWS**. This’ll create a `sst.config.ts` file in your project root.

It’ll also ask you to update your `app.config.ts`. Instead we’ll use the **default Node preset**.

```ts
import { defineConfig } from "@solidjs/start/config";

export default defineConfig({});
```

### 2. Add a Cluster

To deploy our SolidStart app in a container, we’ll use [AWS Fargate](https://aws.amazon.com/fargate/) with [Amazon ECS](https://aws.amazon.com/ecs/). Replace the `run` function in your `sst.config.ts`.

```js
async run() {
  const vpc = new sst.aws.Vpc("MyVpc", { bastion: true });
  const cluster = new sst.aws.Cluster("MyCluster", { vpc });

  new sst.aws.Service("MyService", {
    cluster,
    loadBalancer: {
      ports: [{ listen: "80/http", forward: "3000/http" }],
    },
    dev: {
      command: "npm run dev",
    },
  });
}
```

This creates a VPC with a bastion host, an ECS Cluster, and adds a Fargate service to it.

> **Note**: By default, your service is not deployed when running in *dev*.

The `dev.command` tells SST to instead run our SolidStart app locally in dev mode.

### 3. Add Redis

Let’s add an [Amazon ElastiCache](https://aws.amazon.com/elasticache/) Redis cluster. Add this below the `Vpc` component in your `sst.config.ts`.

```js
const redis = new sst.aws.Redis("MyRedis", { vpc });
```

This shares the same VPC as our ECS cluster.

#### Link Redis

Now, link the Redis cluster to the container.

```js
new sst.aws.Service("MyService", {
  // ...
  link: [redis],
});
```

This will allow us to reference the Redis cluster in our SolidStart app.

#### Install a tunnel

Since our Redis cluster is in a VPC, we’ll need a tunnel to connect to it from our local machine.

```bash
sudo npx sst tunnel install
```

This needs *sudo* to create a network interface on your machine. You’ll only need to do this once on your machine.

### 4. Connect to Redis

We want the `/` route to increment a counter in our Redis cluster. Let’s start by installing the packages we’ll use.

```bash
npm install ioredis @solidjs/router
```

We’ll increment the counter when the route loads. Replace your `src/routes/index.tsx` with:

```ts
import { Resource } from "sst";
import { Cluster } from "ioredis";
import { createAsync, cache } from "@solidjs/router";

const getCounter = cache(async () => {
  "use server";
  const redis = new Cluster([
    { host: Resource.MyRedis.host, port: Resource.MyRedis.port },
  ], {
    dnsLookup: (address, callback) => callback(null, address),
    redisOptions: {
      tls: {},
      username: Resource.MyRedis.username,
      password: Resource.MyRedis.password,
    },
  });

  return await redis.incr("counter");
}, "counter");

export const route = {
  load: () => getCounter(),
};
```

> **Tip**: We are directly accessing our Redis cluster with `Resource.MyRedis.*`.

Let’s update our component to show the counter. Add this to your `src/routes/index.tsx`.

```tsx
export default function Page() {
  const counter = createAsync(() => getCounter());

  return (
    <h1>Hit counter: {counter()}</h1>
  );
}
```

Now, when you visit the page, it should show the current hit counter from Redis.\n\n## Test your app

Let’s head over to `http://localhost:3000` in your browser and it’ll show the current hit counter.

You should see it increment every time you **refresh the page**.

---

## 5. Deploy your app

To deploy our app we’ll add a `Dockerfile`.

<details><summary>View Dockerfile</summary>

```dockerfile
FROM node:lts AS base

WORKDIR /src

# Build
FROM base as build

COPY --link package.json package-lock.json ./
RUN npm install
COPY --link . .
RUN npm run build

# Run
FROM base

ENV PORT=3000
ENV NODE_ENV=production
COPY --from=build /src/.output /src/.output
CMD [ "node", ".output/server/index.mjs" ]
```

</details>

<aside aria-label="Tip" class="starlight-aside starlight-aside--tip">
<p class="starlight-aside__title" aria-hidden="true">Tip</p>
<section class="starlight-aside__content">
<p>You need to be running <a href="https://www.docker.com/products/docker-desktop/">Docker Desktop</a> to deploy your app.</p>
</section>
</aside>

Let’s also add a `.dockerignore` file in the root.

```bash
node_modules
```

Now to build our Docker image and deploy we run:

```bash
npx sst deploy --stage production
```

You can use any stage name here but it’s good to create a new stage for production.

Congrats! Your app should now be live!

![SST SolidStart container app](/_astro/start-solidstart-container.CHZpvFiy_Z1OYUDk.webp)

---

## Connect the console

As a next step, you can setup the [SST Console](https://console.sst.dev) to **git push to deploy** your app and monitor it for any issues.

![SST Console Autodeploy](/_astro/sst-console-autodeploy.DTgdy-D4_Z1dQNdJ.webp)

You can [create a free account](https://console.sst.dev) and connect it to your AWS account.