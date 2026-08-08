# KMCP mobile

Two applications, one repository:

- **`apps/vendor`** — what a parking attendant uses at the kerb. Starts and ends
  parking sessions, photographs the plate, takes cash, and runs a shift.
- **`apps/citizen`** — the public app. Not built yet.

They share **`packages/api`**: the API client, the types the server actually
returns, and the offline queue. That package is the reason this is one
repository rather than two — the alternative is maintaining the same client
twice and letting the copies drift.

## The rule that shapes everything here

**Nothing on a device decides anything that matters.** Fares, geo-fences, tariff
selection, what a session costs and whether it may start at all are the server's
decisions. A handset reports what it observed — a typed plate, a photograph, a
GPS fix — and asks. That is what lets a tariff change take effect everywhere
without an app release, and what stops a modified build from parking for free.

## Working on it

```
npm install
npm run vendor      # Expo dev server for the attendant app
npm run typecheck
```

The apps read `EXPO_PUBLIC_API_URL`. Without it they run against nothing and say
so, rather than appearing to work.
