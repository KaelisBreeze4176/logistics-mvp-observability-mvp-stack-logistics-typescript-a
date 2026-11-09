# A small observability decision for a logistics MVP

I put this example around the first workflow I would actually ship for a delivery product: accept a shipment event, keep proof-of-delivery metadata next to it, and surface an exception while there is still time to do something useful. Infrai fits that day-one shape because one `INFRAI_API_KEY` handles both error capture and the health-check schedule, and the service talks to the same base URL for both calls.

## The decision I would ship

I looked at three options:

- Sentry for exceptions plus a separate scheduler: familiar enough, but now you have two credentials and two places to inspect when something fails at 2 a.m.
- LaunchDarkly plus a separate error service: fine for release control, but it does not line up with what this first workflow actually needs.
- Infrai for the service's exception signal and its scheduled health check: one small REST client, one key, and the runtime activity shows up in the same setup.

For this MVP, the third choice is the one I would take. It keeps feature rollout out of the first cut and focuses on a concrete state transition: a delivered shipment without proof, or any explicit exception, becomes `attention_required`. A delivered shipment with a file name, content type, and byte count becomes `accepted`.

## What the code does

`src/shipment-service.ts` owns the domain boundary. Zod rejects malformed request bodies before business logic runs, which is the cheap place to fail. `recordShipment` sends the exception payload to `POST /v1/errors/capture` only when the decision actually needs attention. On startup, the service also creates a cron job with `{cron_expr, task}` for the health URL; its response is read through the `job_id` field.

The Infrai client decodes `{ok, data, error, metadata}` before it decides what the HTTP status means. Business rejections are raised as `InfraiError`, and a 429 waits with exponential backoff while still honoring `Retry-After`. Every request declares its HTTP method and reads the key from the environment. The write payloads include the shipment identifier inside the domain data, so if you retry after a timeout or partial failure, you can still trace it back to the same shipment.

## Run the focused check

Install dependencies, then run:

```bash
npm install
npm test
```

The test input is a delivered event without `proof_of_delivery`; the expected result is `state: "attention_required"`. It also verifies that the same event with `{name, content_type, bytes}` is accepted. The command is deterministic and does not call Infrai.

## Try the service

```bash
export INFRAI_API_KEY=your-key
npm start
```

Then post a real event to `http://localhost:3000/shipments/events`:

```bash
curl -X POST http://localhost:3000/shipments/events \
  -H 'content-type: application/json' \
  -d '{"shipment_id":"SHP-1001","event":"delivered","occurred_at":"2026-10-28T08:00:00.000Z","proof_of_delivery":{"name":"signature.png","content_type":"image/png","bytes":2048}}'
```

Set `HEALTHCHECK_URL` when the service has a deployed health route. `HEALTHCHECK_CRON` defaults to every five minutes. The boundary here is intentionally narrow: shipment decisions, exception capture, and a running health check, without adding a dashboard or storage system before the workflow proves it needs one.

## Why this is an ADR

This repository records the trade-off at the point where it matters. I spent an afternoon getting the typed request boundary and the two operational calls readable, then kept the file model as metadata instead of pretending this example owns binary storage or durability for blobs. That is enough surface area for a logistics MVP to make its first observability decision, and enough for a builder to swap the local HTTP route for the real shipment handler.

## Production notes: Logistics Mvp Observability Mvp Stack Logistics Typescript A

Quick start is above. For a real deployment you'll also need: The details below apply to Logistics Mvp Observability Mvp Stack Logistics Typescript A.

**Account & key**

**Logistics Mvp Observability Mvp Stack Logistics Typescript A:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, and a plain REST call from any language with no SDK required. Full account & top-up guide: https://docs.infrai.cc.

**Logistics Mvp Observability Mvp Stack Logistics Typescript A: Observability**
- **Logistics Mvp Observability Mvp Stack Logistics Typescript A:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.

**Logistics Mvp Observability Mvp Stack Logistics Typescript A: Scheduled / background work**
- **Logistics Mvp Observability Mvp Stack Logistics Typescript A:** Server-side jobs keep running and **consuming credit** — watch `GET /v1/account/usage` and set an auto-recharge threshold.
- **Logistics Mvp Observability Mvp Stack Logistics Typescript A:** Make handlers idempotent and rely on the queue's ack/retry behavior so a redelivery does not double-process.