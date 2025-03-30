# Environment Variables

Manage the environment variables in your app.

You can manage the environment variables for all the components in your app, across all your stages, through the `sst.config.ts`.

> **Tip**: You don’t need to use `.env` files in SST.

While SST automatically loads your environment variables and `.env` files; we don’t recommend relying on them.

---

## Recommended

Typically, you’ll use environment variables or `.env` files to share things like database URLs, secrets, or other config.

To understand why we don’t recommend `.env` files, let’s look at each of these in detail.

### Links

A very common use case for `.env` is to share something like a database URL across your app.

Instead in SST, you can link the resources together.

```typescript
const rds = new sst.aws.Postgres("MyPostgres");

new sst.aws.Nextjs("MyWeb", {
  link: [rds],
});
```

You can then access the database in your Next.js app with the [JS SDK](https://docs.sst.dev/reference/sdk/).

```typescript
import { Resource } from "sst";

export const db = drizzle(client, {
  schema,
  database: Resource.MyPostgres.database,
  secretArn: Resource.MyPostgres.secretArn,
  resourceArn: Resource.MyPostgres.clusterArn,
});
```

This has a couple of key advantages:

1. You don’t have to deploy your database separately and then store the credentials in a `.env` file.
2. You don’t need to update this for every stage.
3. You don’t have to share these URLs with your teammates.

Anybody on your team can just run `sst deploy` on any stage and it’ll deploy the app and link the resources.

> **Tip**: Your team can just `git checkout` and `sst deploy`, without the need for a separate `.env` file.

You can learn more about [linking resources](https://docs.sst.dev/linking/).

### Secrets

Another common use case for `.env` is to manage secrets across your app.

SST has a built-in way to handle secrets.

```typescript
const secret = new sst.Secret("MySecret");

new sst.aws.Nextjs("MyWeb", {
  link: [secret],
});
```

You can set the secret using the `sst secret` CLI.

```bash
sst secret set MySecret my-secret-value
```

This is far more secure than storing it in a `.env` file and accidentally committing it to Git.

Learn more about [secrets](https://docs.sst.dev/component/secret).

### Other config

Finally, people use `.env` files for some general config. These are often different across stages and are not really sensitive. For example, you might have your `SENTRY_DSN` that’s different for dev and prod.

We recommend putting these directly in your `sst.config.ts` instead. And using the right one based on the stage.

```typescript
const SENTRY_DSN = $app.stage !== "prod"
  ? "https://foo@sentry.io/bar"
  : "https://baz@sentry.io/qux";
```

You can also conditionally set it based on if you are running `sst dev` or `sst deploy`.

```typescript
const SENTRY_DSN = $dev === true
  ? "https://foo@sentry.io/bar"
  : "https://baz@sentry.io/qux";
```

And you can pass this into your frontends and functions.

```typescript
new sst.aws.Nextjs("MyWeb", {
  environment: {
    SENTRY_DSN,
  },
});
```

Learn more about [global variables](https://docs.sst.dev/reference/global#app) and [dev](https://docs.sst.dev/reference/global#dev).

## Traditional

As mentioned above, SST also supports the traditional approach. If you run `sst dev` or `sst deploy` with an environment variable:

```bash
SOME_ENV_VAR=FOO sst deploy
```

You can access it using the `process.env` in your `sst.config.ts`.

```typescript
async run() {
  console.log(process.env.SOME_ENV_VAR); // FOO
}
```

However, this isn’t automatically added to your frontends or functions. You’ll need to add it manually.

```typescript
new sst.aws.Nextjs("MyWeb", {
  environment: {
    SOME_ENV_VAR: process.env.SOME_ENV_VAR ?? "fallback value",
  },
});
```

SST doesn’t do this automatically because you might have multiple frontends or functions and you might not want to load it for all of them.

> **Tip**: Environment variables are not automatically added to your frontend or functions.