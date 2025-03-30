# Console

Manage and monitor your apps with the SST Console.

The Console is a web-based dashboard to manage your SST apps — [**console.sst.dev**](https://console.sst.dev)

With it, you and your team can see all your apps, their **resources** and **updates**, **view logs**, **get alerts** on any issues, and **_git push to deploy_** them.

![SST Console](https://console.sst.dev)

> **Tip**  
> The Console is completely optional and comes with a free tier.

---

## Get started

Start by creating an account and connecting your AWS account.

> **Note**  
> Currently, the Console only supports apps **deployed to AWS**.

1. **Create an account with your email**  
   It’s better to use your work email so that you can invite your team to your workspace later — [**console.sst.dev**](https://console.sst.dev)

2. **Create a workspace**  
   You can add your apps and invite your team to a workspace. A workspace can be for a personal project or for your team at work. You can create as many workspaces as you want.

   > **Tip**  
   > Create a workspace for your organization. You can use it to invite your team and connect all your AWS accounts.

3. **Connect your AWS account**  
   This will ask you to create a CloudFormation stack in your AWS account. Make sure that this stack is being added to **us-east-1**. Scroll down and click **Create stack**.

   > **Caution**  
   > The CloudFormation stack needs to be created in **us-east-1**. If you create it in the wrong region by mistake, remove it and create it again.

   This stack will scan all the regions in your account for SST apps and subscribe to them. Once created, you’ll see all your apps, stages, and the functions in the apps.

   If you are connecting a newly created AWS account, you might run into the following error while creating the stack.

   > Resource handler returned message: “Specified ReservedConcurrentExecutions for function decreases account’s UnreservedConcurrentExecution below its minimum value”

   This happens because AWS has been limiting the concurrency of Lambda functions for new accounts. It’s a good idea to increase this limit before you go to production anyway. To do so, you can [request a quota increase](https://repost.aws/knowledge-center/lambda-concurrency-limit-increase) to the default value of 1000.

4. **Invite your team**  
   Use the email address of your teammates to invite them. They just need to login with the email you’ve used and they’ll be able to join your workspace.

---

## How it works

At a high level, here’s how the Console works.

- It’s hosted on our side
  - It stores some metadata about what resources you have deployed. We’ll have a version that can be self-hosted in the future.
- You can view all your apps and stages
  - Once you’ve connected your AWS accounts, it’ll deploy a separate CloudFormation stack and connect to any SST apps in it. And all your apps and stages will show up automatically.
- It’s open-source and built with SST
  - The Console is an SST app. You can view the [source on GitHub](https://github.com/sst/console). It’s also auto-deployed using itself.

---

## Security

The CloudFormation stack that the Console uses creates an IAM Role in your account to manage your resources. If this is a concern for your production environments, we have a couple of options.

By default, this role is granted `AdministratorAccess`, but you can customize it to restrict access. We’ll look at this below. Additionally, if you’d like us to sign a BAA, feel free to [contact us](mailto:hello@sst.dev).

There may be cases where you don’t want any data leaving your AWS account. For this, we’ll be supporting self-hosting the Console in the future.

### IAM permissions

Permissions for the Console fall into two categories: read and write:

#### Read Permissions
The Console needs specific permissions to display information about resources within your SST apps.

| Purpose                                   | AWS IAM Action                          |
|-------------------------------------------|----------------------------------------|
| Fetch stack outputs                        | `cloudformation:DescribeStacks`       |
| Retrieve function runtime and size        | `lambda:GetFunction`                   |
| Access stack metadata                     | `ec2:DescribeRegions`, `s3:GetObject`, `s3:ListBucket` |
| Display function logs                     | `logs:DescribeLogStreams`, `logs:FilterLogEvents`, `logs:GetLogEvents`, `logs:StartQuery` |
| Monitor invocation usage                  | `cloudwatch:GetMetricData`            |

Attach the `arn:aws:iam::aws:policy/ReadOnlyAccess` AWS managed policy to the IAM Role for comprehensive read access.

#### Write Permissions
The Console requires the following write permissions.

| Purpose                                   | AWS IAM Action                          |
|-------------------------------------------|----------------------------------------|
| Forward bootstrap bucket events to event bus | `s3:PutBucketNotification`            |
| Send events to Console                    | `events:PutRule`, `events:PutTargets` |
| Grant event bus access for Console        | `iam:CreateRole`, `iam:DeleteRole`, `iam:DeleteRolePolicy`, `iam:PassRole`, `iam:PutRolePolicy` |
| Enable Issues to subscribe logs           | `logs:CreateLogGroup`, `logs:PutSubscriptionFilter` |
| Invoke Lambda functions and replay invocations | `lambda:InvokeFunction`              |

It’s good practice to periodically review and update these policies.

---

### Customize policy
To customize IAM permissions for the CloudFormation stack:

1. On the CloudFormation create stack page, download the default `template.json`.
2. Edit the template file with necessary changes.
3. Upload your edited `template.json` file to an S3 bucket.
4. Return to the CloudFormation create stack page and replace the template URL in the page URL.\n\n## Configuring Auto-Deployment in SST

In the above example, we are using the `console.autodeploy.target` option to change the stage that’s tied to a git event. Only git pushes to the `main` branch will auto-deploy to the `production` stage.

This works because if `target` returns `undefined`, the deploy is skipped. If you provide your own `target` callback, it overrides the default behavior.

### Example Configuration
```typescript
export default $config({
  // Your app's config
  app(input) { },
  // Your app's resources
  async run() { },
  // Your app's Console config
  console: {
    autodeploy: {
      target(event) {
        if (event.type === "branch" && event.branch === "main" && event.action === "pushed") {
          return { stage: "production" };
        }
      }
    }
  }
});
```

### Configuring the Runner
Through the `console.autodeploy.runner` option, you can configure the runner that’s used. For example, if you wanted to increase the timeouts to 2 hours, you can.

#### Example Runner Configuration
```typescript
console: {
  autodeploy: {
    runner: { timeout: "2 hours" }
  }
}
```

This also takes the stage name, so you can set the runner config for a specific stage.

#### Example Stage-Specific Runner Configuration
```typescript
console: {
  autodeploy: {
    runner(stage) {
      if (stage === "production") return { timeout: "3 hours" };
    }
  }
}
```

You can also have your builds run inside your VPC.

#### Example VPC Configuration
```typescript
console: {
  autodeploy: {
    runner: {
      vpc: {
        id: "vpc-0be8fa4de860618bb",
        securityGroups: ["sg-0399348378a4c256c"],
        subnets: ["subnet-0b6a2b73896dc8c4", "subnet-021389ebee680c2f0"]
      }
    }
  }
}
```

Or specify files and directories to be cached.

#### Example Cache Configuration
```typescript
console: {
  autodeploy: {
    runner: {
      cache: {
        paths: ["node_modules", "/path/to/cache"]
      }
    }
  }
}
```

Read more about the [console.autodeploy](https://sst.dev/docs/reference/config/#console-autodeploy) config.

---

### Environments
The Console needs to know which account it needs to autodeploy into. You configure this under the **App’s Settings** > **Autodeploy**. Each environment takes:

1. **Stage**  
   The stage that is being deployed. By default, the stage name comes from the name of the branch. Branch names are sanitized to only letters/numbers and hyphens. So for example:
   - A push to a branch called `production` will deploy a stage called `production`.
   - A push to PR#12 will deploy to a stage called `pr-12`.

   As mentioned, above you can customize this through your `sst.config.ts`.

   > **Tip**: You can specify a pattern to match the stage name in your environments.

   If multiple stages share the same environment, you can use a glob pattern. For example, `pr-*` matches all stages that start with `pr-`.

2. **AWS Account**  
   The AWS account that you are deploying to.

3. **Environment Variables**  
   Any environment variables you need for the build process. These are made available under `process.env.*` in your `sst.config.ts`.

---

### How it Works
When you *git push* to a branch, pull request, or tag, the following happens:
1. The stage name is generated based on the `console.autodeploy.target` callback.
   - If there is no callback, the stage name is a sanitized version of the branch or tag.
   - If there is a callback but no stage is returned, the deploy is skipped.
2. The stage is matched against the environments in the Console to get the AWS account and any environment variables for the deploy.
3. The runner config is generated based on the `console.autodeploy.runner`. Or the defaults are used.
4. The deploy is run based on the above config.

This only applies to git events. If you trigger a deploy through the Console, you are asked to specify the stage you want to deploy to. So in this case, it skips step 1 from above and does not call `console.autodeploy.target`.

Both `target` and `runner` are optional and come with defaults, but they can be customized.

---

### Costs
AWS will bill you for the **CodeBuild build minutes** that are used to run your builds. [Learn more about CodeBuild pricing](https://aws.amazon.com/codebuild/pricing/).

---

### Local Logs
When the Console starts up, it checks if you are running `sst dev` locally. If so, then it’ll show you real-time logs from your local terminal. This works by connecting to a local server that’s run as a part of the SST CLI.

The local server only allows access from `localhost` and `console.sst.dev`.

The local logs work in all browsers and environments. But for certain browsers like Safari or Brave, and Gitpod, it needs some additional configuration.

---

### Safari & Brave
Certain browsers like Safari and Brave require the local connection between the browser and the `sst dev` CLI to be running on HTTPS.

SST can automatically generate a locally-trusted certificate using the `sst cert` command.

```bash
sst cert
```

You’ll only need to **run this once** on your machine.

---

### Gitpod
If you are using [Gitpod](https://www.gitpod.io/), you can use the Gitpod Local Companion app to connect to the `sst dev` process running inside your Gitpod workspace.

To get started:
1. [Install Gitpod Local Companion app](https://www.gitpod.io/blog/local-app#installation)
2. [Run the Companion app](https://www.gitpod.io/blog/local-app#running)
3. Navigate to Console in the browser

The companion app runs locally and creates a tunnelled connection to your Gitpod workspace.

---

### FAQ
Here are some frequently asked questions about the Console.
- **Do I need to use the Console to use SST?**  
  You **don’t need the Console** to use SST. It complements the CLI and has some features that help with managing your apps in production.
  That said, it is completely free to get started. You can create an account and invite your team, **without** having to add a **credit card**.

- **Is there a free tier?**  
  If your workspace has 350 active resources or fewer for the month, it’s considered to be in the free tier. This count also resets every month.

- **What happens if I go over the free tier?**  
  You won’t be able to access the *production* or deployed stages till you add your billing details in the workspace settings.
  Note that, you can continue to **access your personal stages**. Just make sure you have `sst dev` running locally. Otherwise the Console won’t be able to detect that it’s a personal stage.

- **What counts as a resource?**  
  Resources are what SST creates in your cloud provider. This includes the resources created by both SST’s built-in components, like `Function`, `Nextjs`, `Bucket`, and the ones created by any other Terraform/Pulumi provider.
  Some components, like `Nextjs` and `StaticSite`, create multiple resources. In general, the more complex the component, the more resources it’ll create.
  You can see a [full list of resources](#resources) if you go to an app in your Console and navigate to a stage in it.
  For some context, the Console is itself a pretty large [SST app](https://github.com/sst/console) and it has around 320 resources.

- **Do PR stages also count?**  
  A stage has to be around for at least 2 weeks before the resources in it are counted as active. So if a PR stage is created and removed within 2 weeks, they don’t count.
  However, if you remove a stage and create a new one with the same name, it does not reset the 2 week initial period.

If you have any further questions, feel free to [send us an email](mailto:hello@sst.dev).