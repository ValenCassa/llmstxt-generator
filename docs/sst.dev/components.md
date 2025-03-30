# Components

Components are the building blocks of your app.

Every SST app is made up of components. These are logical units that represent features in your app; like your frontends, APIs, databases, or queues.

There are two types of components in SST:

1. **Built-in components** — High level components built by the SST team
2. **Provider components** — Low level components from the providers

Let’s look at them below.

---

## Background

Most [providers](https://docs/providers/) like AWS are made up of low level resources. And it takes quite a number of these to put together something like a frontend or an API. For example, it takes around 70 low level AWS resources to create a Next.js app on AWS.

As a result, Infrastructure as Code has been traditionally only been used by DevOps or Platform engineers.

To fix this, SST has components that can help you with the most common features in your app.

---

## Built-in

The built-in components in SST, the ones you see in the sidebar, are designed to make it really easy to create the various parts of your app.

For example, you don’t need to know a lot of AWS details to deploy your Next.js frontend:

```typescript
new sst.aws.Nextjs("MyWeb");
```

And because this is all in code, it’s straightforward to configure this further.

```typescript
new sst.aws.Nextjs("MyWeb", {
  domain: "my-app.com",
  path: "packages/web",
  imageOptimization: {
    memory: "512 MB"
  },
  buildCommand: "npm run build"
});
```

You can even take this a step further and completely transform how the low level resources are created. We’ll look at this below.

---

## Constructor

To add a component to your app, you create an instance of it by passing in a couple of args. For example, here’s the signature of the [Function](https://docs/component/aws/function) component.

```typescript
new sst.aws.Function(name: string, args: FunctionArgs, opts?: pulumi.ComponentResourceOptions)
```

Each component takes the following:

- `name`: The name of the component. This needs to be unique across your entire app.
- `args`: An object of properties that allows you to configure the component.
- `opts?`: An optional object of properties that allows you to configure this component in Pulumi.

Here’s an example of creating a `Function` component:

```typescript
const function = new sst.aws.Function("MyFunction", {
  handler: "src/lambda.handler"
});
```

---

## Properties

An instance of a component exposes a set of properties. For example, the `Function` component exposes the following [properties](https://docs/component/aws/function#properties) — `arn`, `name`, `url`, and `nodes`.

```typescript
const functionArn = function.arn;
```

These can be used to output info about your app or can be used as args for other components. These are typically primitive types. However, they can also be a special version of a primitive type. It’ll look something like `Output<string>`. We’ll look at this in detail below.

---

## Outputs

The properties of a component are typically of a special type that looks something like, *`Output<primitive>`*.

These are values that are not available yet and will be resolved as the deploy progresses. However, these outputs can be used as args in other components.

This makes it so that parts of your app are not blocked and all your resources are deployed as concurrently as possible.

For example, let’s create a function with a url.

```typescript
const myFunction = new sst.aws.Function("MyFunction", {
  url: true,
  handler: "src/lambda.handler"
});
```

Here, `myFunction.url` is of type `Output<string>`. We want to use this function url as a route in our router.

```typescript
new sst.aws.Router("MyRouter", {
  routes: {
    "/api": myFunction.url
  }
});
```

The route arg takes `Input<string>`, which means it can take a string or an output. This creates a dependency internally. So the router will be deployed after the function has been. However, other components that are not dependent on this function can be deployed concurrently.

Read more about [Input and Output types on the Pulumi docs](https://www.pulumi.com/docs/concepts/inputs-outputs/).

---

## Versioning

SST components evolve over time, sometimes introducing breaking changes. To maintain backwards compatibility, we implement a component versioning scheme.

For example, we released a new version the [Vpc](https://docs/component/aws/vpc) that does not create a NAT Gateway by default. To roll this out the previous version of the `Vpc` component was renamed to [Vpc.v1](https://docs/component/aws/vpc-v1).

Now if you were using the original `Vpc` component, update SST, and deploy; you’ll get an error during the deploy saying that there’s a new version of this component.

This allows you to decide what you want to do with this component.\n\n## Versioning

SST components evolve over time, sometimes introducing breaking changes. To maintain backwards compatibility, we implement a component versioning scheme.

For example, we released a new version of the [`Vpc`](https://sst.dev/docs/component/aws/vpc) that does not create a NAT Gateway by default. To roll this out, the previous version of the `Vpc` component was renamed to [`Vpc.v1`](https://sst.dev/docs/component/aws/vpc-v1).

Now if you were using the original `Vpc` component, update SST, and deploy; you’ll get an error during the deploy saying that there’s a new version of this component. This allows you to decide what you want to do with this component.

---

### Continue with the old version

If you prefer to continue using the older version of a component, you can rename it.

```typescript
const vpc = new sst.aws.Vpc("MyVpc");
const vpc = new sst.aws.Vpc.v1("MyVpc");
```

Now if you deploy again, SST knows that you want to stick with the old version and it won’t error.

---

### Update to the latest version

Instead, if you wanted to update to the latest version, you’ll have to rename the component.

```typescript
const vpc = new sst.aws.Vpc("MyVpc");
const vpc = new sst.aws.Vpc("MyNewVpc");
```

Now if you redeploy, it’ll remove the previously created component and recreate it with the new name and the latest version. This is because from SST’s perspective it looks like the `MyVpc` component was removed and a new component called `MyNewVpc` was added.

> **Caution**  
> Removing and recreating components may cause temporary downtime in your app.

Since these are being recreated, you have to be aware that there might be a period of time when that resource is not around. This might cause some downtime, depending on the resource.