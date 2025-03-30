# Linking

Link resources together and access them in a typesafe and secure way.

## Resource Linking

Resource Linking allows you to access your **infrastructure** in your **runtime code** in a typesafe and secure way.

<aside aria-label="Watch a video on linking resources" class="starlight-aside starlight-aside--tip custom-aside-video">
<p class="starlight-aside__title" aria-hidden="true"> <svg aria-hidden="true" class="starlight-aside__icon astro-uhqvxnpk" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="--sl-icon-size: 1em;"><path d="M23.5 6.2A3 3 0 0 0 21.4 4c-1.9-.5-9.4-.5-9.4-.5s-7.5 0-9.4.5A3 3 0 0 0 .5 6.3C0 8 0 12 0 12s0 4 .5 5.8A3 3 0 0 0 2.6 20c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2c.5-2 .5-5.9.5-5.9s0-4-.5-5.8zm-14 9.4V8.4l6.3 3.6-6.3 3.6z"></path></svg>  <a target="_blank" rel="noopener noreferrer" href="https://youtu.be/s8cWklU4Akw"> Watch a video on linking resources <svg aria-hidden="true" class=" astro-uhqvxnpk" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="--sl-icon-size: 1rem;"><path d="m14.83 11.29-4.24-4.24a1 1 0 1 0-1.42 1.41L12.71 12l-3.54 3.54a1 1 0 0 0 0 1.41 1 1 0 0 0 .71.29 1 1 0 0 0 .71-.29l4.24-4.24a1.002 1.002 0 0 0 0-1.42Z"></path></svg>  </a> </p>
</aside>

1. Create a resource that you want to link to. For example, a bucket.
   
   ```typescript
   const bucket = new sst.aws.Bucket("MyBucket");
   ```

2. Link it to your function or frontend, using the `link` prop.
   
   <starlight-tabs class="astro-g7wulw6w">
   <div class="tablist-wrapper not-content astro-g7wulw6w">
   <ul role="tablist" class="astro-g7wulw6w">
   <li role="presentation" class="tab astro-g7wulw6w"> <a role="tab" href="#tab-panel-34" id="tab-34" aria-selected="true" tabindex="0" class="astro-g7wulw6w">  Next.js </a> </li>
   <li role="presentation" class="tab astro-g7wulw6w"> <a role="tab" href="#tab-panel-35" id="tab-35" aria-selected="false" tabindex="-1" class="astro-g7wulw6w">  Remix </a> </li>
   <li role="presentation" class="tab astro-g7wulw6w"> <a role="tab" href="#tab-panel-36" id="tab-36" aria-selected="false" tabindex="-1" class="astro-g7wulw6w">  Astro </a> </li>
   <li role="presentation" class="tab astro-g7wulw6w"> <a role="tab" href="#tab-panel-37" id="tab-37" aria-selected="false" tabindex="-1" class="astro-g7wulw6w">  Function </a> </li>
   </ul>
   </div>
   <section id="tab-panel-34" aria-labelledby="tab-34" role="tabpanel">
   ```typescript
   new sst.aws.Nextjs("MyWeb", {
     link: [bucket]
   });
   ```
   </section>
   <section id="tab-panel-35" aria-labelledby="tab-35" role="tabpanel" hidden="">
   ```typescript
   new sst.aws.Remix("MyWeb", {
     link: [bucket]
   });
   ```
   </section>
   <section id="tab-panel-36" aria-labelledby="tab-36" role="tabpanel" hidden="">
   ```typescript
   new sst.aws.Astro("MyWeb", {
     link: [bucket]
   });
   ```
   </section>
   <section id="tab-panel-37" aria-labelledby="tab-37" role="tabpanel" hidden="">
   ```typescript
   new sst.aws.Function("MyFunction", {
     handler: "src/lambda.handler",
     link: [bucket]
   });
   ```
   </section>
   </starlight-tabs>

3. Use the [SDK](https://docs/reference/sdk/) to access the linked resource in your runtime in a typesafe way.
   
   <starlight-tabs class="astro-g7wulw6w">
   <div class="tablist-wrapper not-content astro-g7wulw6w">
   <ul role="tablist" class="astro-g7wulw6w">
   <li role="presentation" class="tab astro-g7wulw6w"> <a role="tab" href="#tab-panel-38" id="tab-38" aria-selected="true" tabindex="0" class="astro-g7wulw6w">  Next.js </a> </li>
   <li role="presentation" class="tab astro-g7wulw6w"> <a role="tab" href="#tab-panel-39" id="tab-39" aria-selected="false" tabindex="-1" class="astro-g7wulw6w">  Remix </a> </li>
   <li role="presentation" class="tab astro-g7wulw6w"> <a role="tab" href="#tab-panel-40" id="tab-40" aria-selected="false" tabindex="-1" class="astro-g7wulw6w">  Astro </a> </li>
   <li role="presentation" class="tab astro-g7wulw6w"> <a role="tab" href="#tab-panel-41" id="tab-41" aria-selected="false" tabindex="-1" class="astro-g7wulw6w">  Function </a> </li>
   </ul>
   </div>
   <section id="tab-panel-38" aria-labelledby="tab-38" role="tabpanel">
   ```javascript
   import { Resource } from "sst";
   console.log(Resource.MyBucket.name);
   ```
   </section>
   <section id="tab-panel-39" aria-labelledby="tab-39" role="tabpanel" hidden="">
   ```javascript
   import { Resource } from "sst";
   console.log(Resource.MyBucket.name);
   ```
   </section>
   <section id="tab-panel-40" aria-labelledby="tab-40" role="tabpanel" hidden="">
   ```astro
   ---
   import { Resource } from "sst";
   console.log(Resource.MyBucket.name);
   ---
   ```
   </section>
   <section id="tab-panel-41" aria-labelledby="tab-41" role="tabpanel" hidden="">
   ```javascript
   import { Resource } from "sst";
   console.log(Resource.MyBucket.name);
   ```
   </section>
   </starlight-tabs>

## Working locally

The above applies to your app deployed through `sst deploy`.

To access linked resources locally you’ll need to be running `sst dev`. By default, the `sst dev` CLI runs a multiplexer that also starts your frontend for you. This loads all your linked resources in the environment. Read more about [sst dev](https://docs/reference/cli/#dev).

However if you are not using the multiplexer.

```bash
sst dev --mode=basic
```

You’ll need to wrap your frontend’s dev command with the `sst dev` command.

<starlight-tabs class="astro-g7wulw6w">
<div class="tablist-wrapper not-content astro-g7wulw6w">
<ul role="tablist" class="astro-g7wulw6w">
<li role="presentation" class="tab astro-g7wulw6w"> <a role="tab" href="#tab-panel-42" id="tab-42" aria-selected="true" tabindex="0" class="astro-g7wulw6w">  Next.js </a> </li>
<li role="presentation" class="tab astro-g7wulw6w"> <a role="tab" href="#tab-panel-43" id="tab-43" aria-selected="false" tabindex="-1" class="astro-g7wulw6w">  Remix </a> </li>
<li role="presentation" class="tab astro-g7wulw6w"> <a role="tab" href="#tab-panel-44" id="tab-44" aria-selected="false" tabindex="-1" class="astro-g7wulw6w">  Astro </a> </li>
<li role="presentation" class="tab astro-g7wulw6w"> <a role="tab" href="#tab-panel-45" id="tab-45" aria-selected="false" tabindex="-1" class="astro-g7wulw6w">  Function </a> </li>
</ul>
</div>
<section id="tab-panel-42" aria-labelledby="tab-42" role="tabpanel">
```bash
sst dev next dev
```
</section>
<section id="tab-panel-43" aria-labelledby="tab-43" role="tabpanel" hidden="">
```bash
sst dev remix dev
```
</section>
<section id="tab-panel-44" aria-labelledby="tab-44" role="tabpanel" hidden="">
```bash
sst dev astro dev
```
</section>
<section id="tab-panel-45" aria-labelledby="tab-45" role="tabpanel" hidden="">
```bash
sst dev
```
</section>
</starlight-tabs>

## How it works

At high level when you link a resource to a function or frontend, the following happens:

1. The *links* that the resource exposes are injected into the function package.

   <aside aria-label="Tip" class="starlight-aside starlight-aside--tip"><p class="starlight-aside__title" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="starlight-aside__icon"><path fill-rule="evenodd" clip-rule="evenodd" d="M1.43909 8.85483L1.44039 8.85354L4.96668 5.33815C5.30653 4.99386 5.7685 4.79662 6.2524 4.78972L6.26553 4.78963L12.9014 4.78962L13.8479 3.84308C16.9187 0.772319 20.0546 0.770617 21.4678 0.975145C21.8617 1.02914 22.2271 1.21053 22.5083 1.4917C22.7894 1.77284 22.9708 2.13821 23.0248 2.53199C23.2294 3.94517 23.2278 7.08119 20.1569 10.1521L19.2107 11.0983V17.7338L19.2106 17.7469C19.2037 18.2308 19.0067 18.6933 18.6624 19.0331L15.1456 22.5608C14.9095 22.7966 14.6137 22.964 14.29 23.0449C13.9663 23.1259 13.6267 23.1174 13.3074 23.0204C12.9881 22.9235 12.7011 22.7417 12.4771 22.4944C12.2533 22.2473 12.1006 21.9441 12.0355 21.6171L11.1783 17.3417L6.65869 12.822L4.34847 12.3589L2.38351 11.965C2.05664 11.8998 1.75272 11.747 1.50564 11.5232C1.25835 11.2992 1.07653 11.0122 0.979561 10.6929C0.882595 10.3736 0.874125 10.034 0.955057 9.7103C1.03599 9.38659 1.20328 9.09092 1.43909 8.85483ZM6.8186 10.8724L2.94619 10.096L6.32006 6.73268H10.9583L6.8186 10.8724ZM15.2219 5.21703C17.681 2.75787 20.0783 2.75376 21.1124 2.8876C21.2462 3.92172 21.2421 6.31895 18.783 8.77812L12.0728 15.4883L8.51172 11.9272L15.2219 5.21703ZM13.9042 21.0538L13.1279 17.1811L17.2676 13.0414V17.68L13.9042 21.0538Z"></path></svg>Note</p><section class="starlight-aside__content"><p>The links a component exposes are listed in its API reference. For example, you can <a href="/docs/component/aws/bucket/#links">view a Bucket’s links here</a>.</p></section></aside>

2. The types to access these links are generated.

3. The function is given permission to access the linked resource.

## Injecting links

Resource links are injected into your function or frontend package when you run `sst dev` or `sst deploy`. But this is done in a slightly different way for both these cases.

### Functions

The functions in SST are tree shaken and bundled using [esbuild](https://esbuild.github.io/). While bundling, SST injects the resource links into the [`globalThis`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/globalThis). These are encrypted and added to the function bundle. And they are synchronously decrypted on load by the SST SDK.

### Frontends

The frontends are not bundled by SST. Instead, when they are built, SST injects the resource links into the `process.env` object using the prefix `SST_RESOURCE_`.

This is why when you are running your frontend locally, it needs to be wrapped in the `sst dev` command.

Resource links are only available on the server-side of your frontend. If you want to access them in your client components, you’ll need to pass them in explicitly.

## Generating types

When you run `sst dev` or `sst deploy`, it generates the types to access the linked resources. These are generated as:

1. A `sst-env.d.ts` file in the project root with types for **all** the linked resources in the app.
2. A `sst-env.d.ts` file in the same directory of the nearest `package.json` of the function or frontend that’s *receiving* the links. This references the root `sst-env.d.ts` file.

You can check the generated `sst-env.d.ts` types into source control. This will let your teammates see the types without having to run `sst dev` when they pull your changes.

## Extending linking

The examples above are built into SST’s components. You might want to modify the permissions that are granted as a part of these links.

Or, you might want to link other resources from the Pulumi/Terraform ecosystem. Or want to link a different set of outputs than what SST exposes.

You can do this using the [`sst.Linkable`](https://docs/component/linkable/) component.

### Link any value

The `Linkable` component takes a list of properties that you want to link. These can be outputs from other resources or constants.

```typescript
const myLinkable = new sst.Linkable("MyLinkable", {
  properties: { foo: "bar" }
});
```

You can optionally include permissions or bindings for the linked resource.

Now you can now link this resource to your frontend or a function.

```typescript
new sst.aws.Function("MyApi", {
  handler: "src/lambda.handler",
  link: [myLinkable]
});
```

Then use the [SDK](https://docs/reference/sdk/) to access that at runtime.

```javascript
import { Resource } from "sst";
console.log(Resource.MyLinkable.foo);
```

Read more about [`sst.Linkable`](https://docs/component/linkable/).

### Link any resource

You can also wrap any resource class to make it linkable with the `Linkable.wrap` static method.

```typescript
Linkable.wrap(aws.dynamodb.Table, (table) => ({
  properties: { tableName: table.name }
}));
```

Now you create an instance of `aws.dynamodb.Table` and link it in your app like any other SST component.

```typescript
const table = new aws.dynamodb.Table("MyTable", {
  attributes: [{ name: "id", type: "S" }],
  hashKey: "id"
});

new sst.aws.Nextjs("MyWeb", {
  link: [table]
});
```

And use the [SDK](https://docs/reference/sdk/) to access it at runtime.

```javascript
import { Resource } from "sst";
console.log(Resource.MyTable.tableName);
```

### Modify built-in links

You can also modify the links SST creates. For example, you might want to change the permissions of a linkable resource.

```typescript
sst.Linkable.wrap(sst.aws.Bucket, (bucket) => ({
  properties: { name: bucket.name },
  include: [
    sst.aws.permission({
      actions: ["s3:GetObject"],
      resources: [bucket.arn]
    })
  ]
}));
```

This overrides the existing link and lets you create your own.

Read more about [`sst.Linkable.wrap`](https://docs/component/linkable/#static-wrap).