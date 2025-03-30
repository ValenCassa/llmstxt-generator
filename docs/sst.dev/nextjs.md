# Next.js on AWS with SST

Create and deploy a Next.js app to AWS with SST.

There are two ways to deploy a Next.js app to AWS with SST:

1. [Serverless with OpenNext](#serverless)
2. [Containers with Docker](#containers)

We’ll use both to build a couple of simple apps below.

---

## Examples

We also have a few other Next.js examples that you can refer to:
- [Adding basic auth to your Next.js app](https://docs/examples/#aws-nextjs-basic-auth)
- [Enabling streaming in your Next.js app](https://docs/examples/#aws-nextjs-streaming)
- [Add additional routes to the Next.js CDN](https://docs/examples/#aws-nextjs-add-behavior)
- [Hit counter with Redis and Next.js in a container](https://docs/examples/#aws-nextjs-container-with-redis)

---

## Serverless

We are going to create a Next.js app, add an S3 Bucket for file uploads, and deploy it using [OpenNext](https://opennext.js.org) and the `Nextjs` component.

> **Tip**: You can [view the source](https://github.com/sst/sst/tree/dev/examples/aws-nextjs) of this example in our repo.

Before you get started, make sure to [configure your AWS credentials](https://docs/iam-credentials#credentials).

### 1. Create a project

Let’s start by creating our app.

```bash
npx create-next-app@latest aws-nextjs
cd aws-nextjs
```

We are picking **TypeScript** and not selecting **ESLint**.

### Init SST

Now let’s initialize SST in our app.

```bash
npx sst@latest init
```

Select the defaults and pick **AWS**. This’ll create a `sst.config.ts` file in your project root.

### Start dev mode

Run the following to start dev mode. This’ll start SST and your Next.js app.

```bash
npx sst dev
```

Once complete, click on **MyWeb** in the sidebar and open your Next.js app in your browser.

### 2. Add an S3 Bucket

Let’s allow public access to our S3 Bucket for file uploads. Update your `sst.config.ts`.

```javascript
const bucket = new sst.aws.Bucket("MyBucket", {
  access: "public"
});
```

Add this above the `Nextjs` component.

#### Link the bucket

Now, link the bucket to our Next.js app.

```javascript
new sst.aws.Nextjs("MyWeb", {
  link: [bucket],
});
```

### 3. Create an upload form

Add a form client component in `components/form.tsx`.

```tsx
"use client";

import styles from "./form.module.css";

export default function Form({ url }: { url: string }) {
  return (
    <form
      className={styles.form}
      onSubmit={async (e) => {
        e.preventDefault();
        const file = (e.target as HTMLFormElement).file.files?.[0] ?? null;
        const image = await fetch(url, {
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
  );
}
```

Add some styles in `components/form.module.css`.

```css
.form {
  padding: 2rem;
  border-radius: 0.5rem;
  background-color: var(--gray-alpha-100);
}

.form input {
  margin-right: 1rem;
}

.form button {
  appearance: none;
  padding: 0.5rem 0.75rem;
  font-weight: 500;
  font-size: 0.875rem;
  border-radius: 0.375rem;
  background-color: transparent;
  font-family: var(--font-geist-sans);
  border: 1px solid var(--gray-alpha-200);
}

.form button:active:enabled {
  background-color: var(--gray-alpha-200);
}
```

### 4. Generate a pre-signed URL

When our app loads, we’ll generate a pre-signed URL for the file upload and render the form with it. Replace your `Home` component in `app/page.tsx`.

```ts
export const dynamic = "force-dynamic";

export default async function Home() {
  const command = new PutObjectCommand({
    Key: crypto.randomUUID(),
    Bucket: Resource.MyBucket.name,
  });
  const url = await getSignedUrl(new S3Client({}), command);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <Form url={url} />
      </main>
    </div>
  );
}
```

We need the `force-dynamic` because we don’t want Next.js to cache the pre-signed URL.

### 5. Deploy your app

Now let’s deploy your app to AWS.

```bash
npx sst deploy --stage production
```

You can use any stage name here but it’s good to create a new stage for production.

Congrats! Your app should now be live!

---

## Containers

We are going to create a Next.js app, add an S3 Bucket for file uploads, and deploy it in a container with the `Cluster` component.

> **Tip**: You can [view the source](https://github.com/sst/sst/tree/dev/examples/aws-nextjs-container) of this example in our repo.

Before you get started, make sure to [configure your AWS credentials](https://docs/iam-credentials#credentials).

### 1. Create a project

Let’s start by creating our app.

```bash
npx create-next-app@latest aws-nextjs-container
cd aws-nextjs-container
```

We are picking **TypeScript** and not selecting **ESLint**.

### Init SST

Now let’s initialize SST in our app.

```bash
npx sst@latest init
```

Select the defaults and pick **AWS**. This’ll create a `sst.config.ts` file in your project root.

### 2. Add a Service

To deploy our Next.js app in a container, we’ll use [AWS Fargate](https://aws.amazon.com/fargate/) with [Amazon ECS](https://aws.amazon.com/ecs/). Replace the `run` function in your `sst.config.ts`.

```javascript
async run() {
  const vpc = new sst.aws.Vpc("MyVpc");
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

This creates a VPC, and an ECS Cluster with a Fargate service in it.

> **Note**: By default, your service is not deployed when running in *dev*.

The `dev.command` tells SST to instead run our Next.js app locally in dev mode.

### Start dev mode

Run the following to start dev mode. This’ll start SST and your Next.js app.

```bash
npx sst dev
```

Once complete, click on **MyService** in the sidebar and open your Next.js app in your browser.

### 3. Add an S3 Bucket

Let’s allow public access to our S3 Bucket for file uploads. Update your `sst.config.ts`.

```typescript
const bucket = new sst.aws.Bucket("MyBucket", {
  access: "public"
});
```

Add this below the `Vpc` component.

#### Link the bucket

Now, link the bucket to the container.

```typescript
new sst.aws.Service("MyService", {
  // ...
  link: [bucket],
});
```

This will allow us to reference the bucket in our Next.js app.

### 4. Create an upload form

Add a form client component in `components/form.tsx`.

```tsx
"use client";

import styles from "./form.module.css";

export default function Form({ url }: { url: string }) {
  return (
    <form
      className={styles.form}
      onSubmit={async (e) => {
        e.preventDefault();
        const file = (e.target as HTMLFormElement).file.files?.[0] ?? null;
        const image = await fetch(url, {
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
  );
}
```

Add some styles in `components/form.module.css`.

```css
.form {
  padding: 2rem;
  border-radius: 0.5rem;
  background-color: var(--gray-alpha-100);
}

.form input {
  margin-right: 1rem;
}

.form button {
  appearance: none;
  padding: 0.5rem 0.75rem;
  font-weight: 500;
  font-size: 0.875rem;
  border-radius: 0.375rem;
  background-color: transparent;
  font-family: var(--font-geist-sans);
  border: 1px solid var(--gray-alpha-200);
}

.form button:active:enabled {
  background-color: var(--gray-alpha-200);
}
```

### 5. Generate a pre-signed URL

When our app loads, we’ll generate a pre-signed URL for the file upload and render the form with it. Replace your `Home` component in `app/page.tsx`.

```ts
export const dynamic = "force-dynamic";

export default async function Home() {
  const command = new PutObjectCommand({
    Key: crypto.randomUUID(),
    Bucket: Resource.MyBucket.name,
  });
  const url = await getSignedUrl(new S3Client({}), command);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <Form url={url} />
      </main>
    </div>
  );
}
```

We need the `force-dynamic` because we don’t want Next.js to cache the pre-signed URL.

---

## Test your app

Head over to the local Next.js app in your browser, `http://localhost:3000` and try **uploading an image**. You should see it upload and then download the image.

![SST Next.js app local](/_astro/start-nextjs-local.jNuBVnOP_1vxd79.webp)

---

## Conclusion

This documentation provides a comprehensive guide on how to create and deploy a Next.js application to AWS using SST, covering both serverless and containerized approaches.\n\n## Uploading Files with Next.js and AWS S3

### 5. Generate a pre-signed URL
When our app loads, we’ll generate a pre-signed URL for the file upload and render the form with it. Replace your `Home` component in `app/page.tsx`.

```typescript
export const dynamic = "force-dynamic";

export default async function Home() {
  const command = new PutObjectCommand({
    Key: crypto.randomUUID(),
    Bucket: Resource.MyBucket.name,
  });

  const url = await getSignedUrl(new S3Client({}), command);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <Form url={url} />
      </main>
    </div>
  );
}
```

We need the `force-dynamic` because we don’t want Next.js to cache the pre-signed URL.

> **Tip**: We are directly accessing our S3 bucket with `Resource.MyBucket.name`.

### Add the relevant imports
In `app/page.tsx`, add the following imports:

```typescript
import { Resource } from "sst";
import Form from "@/components/form";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
```

### Install the npm packages
Run the following command to install the necessary packages:

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

### Test your app
Head over to the local Next.js app in your browser, `http://localhost:3000` and try **uploading an image**. You should see it upload and then download the image.

### 6. Deploy your app
To build our app for production, we’ll enable Next.js’s [standalone output](https://nextjs.org/docs/pages/api-reference/next-config-js/output#automatically-copying-traced-files). Let’s update our `next.config.mjs`.

```javascript
const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone"
};
```

Now to deploy our app we’ll add a `Dockerfile`.

```dockerfile
FROM node:lts-alpine AS base

# Stage 1: Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY sst-env.d.ts* ./
RUN npm ci

# Stage 2: Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Production server
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
```

This builds our Next.js app in a Docker image.

> **Tip**: You need to be running [Docker Desktop](https://www.docker.com/products/docker-desktop/) to deploy your app.

If your Next.js app is building static pages that need linked resources, you can need to declare them in your `Dockerfile`. For example, if we need the linked `MyBucket` component from above.

```dockerfile
ARG SST_RESOURCE_MyBucket
```

You’ll need to do this for each linked resource.

Let’s also add a `.dockerignore` file in the root.

```.dockerignore
.git
.next
node_modules
```

Now to build our Docker image and deploy we run:

```bash
npx sst deploy --stage production
```

You can use any stage name here but it’s good to create a new stage for production.

Congrats! Your app should now be live!

### Connect the console
As a next step, you can setup the [SST Console](https://console.sst.dev) to **git push to deploy** your app and view logs from it.