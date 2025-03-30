# Angular on AWS with SST

Create and deploy an Angular app to AWS with SST.

We are going to create an Angular 18 SPA, add an S3 Bucket for file uploads, and deploy it to AWS using SST.

Before you get started, make sure to [configure your AWS credentials](/docs/iam-credentials#credentials).

---

## 1. Create a project

Let’s start by creating our project.

```bash
npm install -g @angular/cli
ng new aws-angular
cd aws-angular
```

We are picking **CSS** for styles, and **not using SSR**.

### Init SST

Now let’s initialize SST in our app.

```bash
npx sst@latest init
```

This’ll create a `sst.config.ts` file in your project root.

## 2. Add an S3 Bucket

Let’s allow public `access` to our S3 Bucket for file uploads. Update your `sst.config.ts`.

```typescript
const bucket = new sst.aws.Bucket("MyBucket", {
  access: "public"
});
```

Add this above the `StaticSite` component.

We are going to upload a file to this bucket using a pre-signed URL. This’ll let us upload it directly to our bucket.

## 3. Add an API

Let’s create a simple API to generate that URL. Add this below the `Bucket` component.

```typescript
const pre = new sst.aws.Function("MyFunction", {
  url: true,
  link: [bucket],
  handler: "functions/presigned.handler",
});
```

We are linking our bucket to this function.

### Pass the API URL

Now, pass the API URL to our Angular app. Add this below the `build` prop in our `StaticSite` component.

```typescript
environment: {
  NG_APP_PRESIGNED_API: pre.url
},
```

To load this in our Angular app, we’ll use the [@ngx-env/builder](https://www.npmjs.com/package/@ngx-env/builder) package.

```bash
ng add @ngx-env/builder
```

### Start dev mode

Run the following to start dev mode. This’ll start SST and your Angular app.

```bash
npx sst dev
```

Once complete, click on **MyWeb** in the sidebar and go to your Angular app in your browser. Typically on `http://localhost:4200`.

## 4. Generate a pre-signed URL

Let’s implement the API that generates the pre-signed URL. Create a `functions/presigned.ts` file with the following.

```typescript
import { Resource } from "sst";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export async function handler() {
  const command = new PutObjectCommand({
    Key: crypto.randomUUID(),
    Bucket: Resource.MyBucket.name,
  });

  return {
    statusCode: 200,
    body: await getSignedUrl(new S3Client({}), command),
  };
}
```

We are directly accessing our S3 bucket with `Resource.MyBucket.name`.

And install the npm packages.

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

Head over to the local Angular app in your browser, `http://localhost:4200` and try **uploading an image**. You should see it upload and then download the image.

## 5. Deploy your app

Now let’s deploy your app to AWS.

```bash
npx sst deploy --stage production
```

You can use any stage name here but it’s good to create a new stage for production.

## Connect the console

As a next step, you can setup the [SST Console](/docs/console/) to **git push to deploy** your app and monitor it for any issues.

![SST Console Autodeploy](/_astro/sst-console-autodeploy.DTgdy-D4_Z1dQNdJ.webp)

You can [create a free account](https://console.sst.dev) and connect it to your AWS account.