# Send emails in AWS with SST

Send emails from your API in AWS with SST.

We are going to build a simple SST app in AWS with a serverless API, and send emails from it.

Before you get started, make sure to [configure your AWS credentials](/docs/iam-credentials#credentials).

---

## 1. Create a project

Let’s start by creating our app.

```bash
mkdir my-email-app && cd my-email-app
npm init -y
```

### Init SST

Now let’s initialize SST in our app.

```bash
npx sst@latest init
npm install
```

Select the defaults and pick **AWS**. This’ll create a `sst.config.ts` file in your project root.

---

## 2. Add email

Let’s add Email to our app, it uses [Amazon SES](https://aws.amazon.com/ses/) behind the scenes. Update your `sst.config.ts`.

```javascript
async run() {
  const email = new sst.aws.Email("MyEmail", {
    sender: "email@example.com",
  });
}
```

SES can send emails from a verified email address or domain. To keep things simple we’ll be sending from an email. Make sure to use your email address here as we’ll be verifying it in the next step.

---

## 3. Add an API

Next let’s create a simple API that’ll send out an email when invoked. Add this to your `sst.config.ts`.

```javascript
const api = new sst.aws.Function("MyApi", {
  handler: "sender.handler",
  link: [email],
  url: true,
});

return {
  api: api.url,
};
```

We are linking our email component to our API.

### Start dev mode

Start your app in dev mode. This runs your functions [Live](/docs/live/).

```bash
npx sst dev
```

This will give you your API URL.

You should also get an email asking you to verify the sender email address.

![Verify your email with SST](/_astro/verify-your-email-with-sst.D4eClUNb_Z20GGsu.webp)

Click the link to verify your email address.

---

## 4. Send an email

We’ll use the SES client to send an email when the API is invoked. Create a new `sender.ts` file and add the following to it.

```typescript
export const handler = async () => {
  await client.send(
    new SendEmailCommand({
      FromEmailAddress: Resource.MyEmail.sender,
      Destination: {
        ToAddresses: [Resource.MyEmail.sender],
      },
      Content: {
        Simple: {
          Subject: {
            Data: "Hello World!",
          },
          Body: {
            Text: {
              Data: "Sent from my SST app.",
            },
          },
        },
      },
    })
  );

  return {
    statusCode: 200,
    body: "Sent!",
  };
};
```

We are sending an email to the same verified email that we are sending from because your SES account might be in *sandbox* mode and can only send to verified emails. We’ll look at how to go to production below.

> **Tip**: We are accessing our email service with `Resource.Email.sender`.

Add the imports.

```typescript
import { Resource } from "sst";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

const client = new SESv2Client();
```

And install the npm packages.

```bash
npm install @aws-sdk/client-sesv2
```

### Test your app

To test our app, hit the API.

```bash
curl https://wwwrwteda6kbpquppdz5i3lg4a0nvmbf.lambda-url.us-east-1.on.aws
```

This should print out `Sent!` and you should get an email. You might have to check your spam folder since the sender and receiver email address is the same in this case.

![Email sent from SST](/_astro/email-sent-from-sst.CHwVtr_T_1BJW3O.webp)

---

## 5. Deploy your app

Now let’s deploy your app.

```bash
npx sst deploy --stage production
```

You can use any stage name here but it’s good to create a new stage for production.

Next, for production you can:
1. [Request production access](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html) for SES
2. And [use your domain](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html) to send emails

This’ll let you send emails from your domain to any email address.

---

## Connect the console

As a next step, you can setup the [SST Console](/docs/console/) to **git push to deploy** your app and monitor it for any issues.

![SST Console Autodeploy](/_astro/sst-console-autodeploy.DTgdy-D4_Z1dQNdJ.webp)

You can [create a free account](https://console.sst.dev) and connect it to your AWS account.