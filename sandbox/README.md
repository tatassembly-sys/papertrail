# Paper Trail sandbox

Isolated scenario suite. No MongoDB, no network, no deploy.

```
npm run test:sandbox
```

or:

```
node sandbox/run.mjs
```

`product.mjs` is an in-memory replica of the product rules in `lib/` (entitlements, cite, slugs, Stripe signatures, publish gates, quotas). `run.mjs` runs 500+ named scenarios against it.
