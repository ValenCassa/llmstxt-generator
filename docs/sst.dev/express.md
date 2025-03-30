# Express on AWS with SST

Create and deploy an Express app to AWS with SST.

We are going to build an app with Express, add an S3 Bucket for file uploads, and deploy it to AWS in a container with SST.

Before you get started, make sure to [configure your AWS credentials](/docs/iam-credentials#credentials).

---

## Examples

We also have a few other Express examples that you can refer to:
- [Build a hit counter with Express and Redis](/docs/examples/#aws-express-redis)
- [Use service discovery to connect to your Express app](/docs/examples/#aws-cluster-service-discovery)

---

## 1. Create a project

Let’s start by creating our Express app.

```bash
mkdir aws-express && cd aws-express
npm init -y
npm install express
```

### Init Express

Create your app by adding an `index.mjs` to the root.

```javascript
import express from "express";

const PORT = 80;
const app = express();

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
```

### Init SST

Now let’s initialize SST in our app.

```bash
npx sst@latest init
npm install
```

This’ll create a `sst.config.ts` file in your project root.

---

## 2. Add a Service

To deploy our Express app, let’s add an [AWS Fargate](https://aws.amazon.com/fargate/) container with [Amazon ECS](https://aws.amazon.com/ecs/). Update your `sst.config.ts`.

```javascript
async run() {
  const vpc = new sst.aws.Vpc("MyVpc");
  const cluster = new sst.aws.Cluster("MyCluster", { vpc });

  new sst.aws.Service("MyService", {
    cluster,
    loadBalancer: {
      ports: [{ listen: "80/http" }],
    },
    dev: {
      command: "node --watch index.mjs",
    },
  });
}
```

This creates a VPC with an ECS Cluster, and adds a Fargate service to it.

> **Note**: By default, your service is not deployed when running in *dev*.

The `dev.command` tells SST to instead run our Express app locally in dev mode.

### Start dev mode

Run the following to start dev mode. This’ll start SST and your Express app.

```bash
npx sst dev
```

Once complete, click on **MyService** in the sidebar and open your Express app in your browser.

---

## 3. Add an S3 Bucket

Let’s add an S3 Bucket for file uploads. Add this to your `sst.config.ts` below the `Vpc` component.

```javascript
const bucket = new sst.aws.Bucket("MyBucket");
```

### Link the bucket

Now, link the bucket to the container.

```javascript
new sst.aws.Service("MyService", {
  // ...
  link: [bucket],
});
```

This will allow us to reference the bucket in our Express app.

---

## 4. Upload a file

We want a `POST` request made to the `/` route to upload a file to our S3 bucket. Let’s add this below our *Hello World* route in our `index.mjs`.

```javascript
app.post("/", upload.single("file"), async (req, res) => {
  const file = req.file;
  const params = {
    Bucket: Resource.MyBucket.name,
    ContentType: file.mimetype,
    Key: file.originalname,
    Body: file.buffer,
  };

  const upload = new Upload({
    params,
    client: s3,
  });

  await upload.done();
  res.status(200).send("File uploaded successfully.");
});
```

> **Tip**: We are directly accessing our S3 bucket with `Resource.MyBucket.name`.

### Test your app

To upload a file run the following from your project root.

```bash
curl -F file=@package.json http://localhost:80/
```

This should upload the `package.json`. Now head over to `http://localhost:80/latest` in your browser and it’ll show you what you just uploaded.

---

## 5. Deploy your app

To deploy our app we’ll first add a `Dockerfile`.

```dockerfile
FROM node:lts-alpine

WORKDIR /app/

COPY package.json /app
RUN npm install

COPY index.mjs /app

ENTRYPOINT ["node", "index.mjs"]
```

This just builds our Express app in a Docker image.

> **Tip**: You need to be running [Docker Desktop](https://www.docker.com/products/docker-desktop/) to deploy your app.

Let’s also add a `.dockerignore` file in the root.

```bash
node_modules
```

Now to build our Docker image and deploy we run:

```bash
npx sst deploy --stage production
```

You can use any stage name here but it’s good to create a new stage for production. This’ll give the URL of your Express app deployed as a Fargate service.

---

## Connect the console

As a next step, you can setup the [SST Console](/docs/console/) to **git push to deploy** your app and monitor it for any issues.

![SST Console Autodeploy](/_astro/sst-console-autodeploy.DTgdy-D4_Z1dQNdJ.webp)

You can [create a free account](https://console.sst.dev) and connect it to your AWS account.