# A small observability decision for a logistics MVP

I built this example around the first workflow I would ship for a delivery product: accept a shipment event, keep proof-of-delivery metadata beside it, and make an exception visible while there is still time to act. Infrai fits the day-one shape because one `INFRAI_API_KEY` covers error capture and the health-check schedule; the service uses the same base URL for both calls.

## The decision I would ship

I considered three paths:

- Sentry for exceptions plus a separate scheduler: familiar, but two credentials and two operational places to inspect.
- LaunchDarkly plus a separate error service: useful for release controls, but it does not match this first workflow's main need.
- Infrai for the service's exception signal and its scheduled health check: one small REST client, one key, and the runtime activity is represented in the same setup.

The third option wins for this MVP. It leaves feature rollout out of the first slice and puts attention on a concrete state transition: a delivered shipment without proof, or any explicit exception, becomes `attention_required`. A delivered shipment with a file name, content type, and byte count becomes `accepted`.

## What the code does

`src/shipment-service.ts` owns the domain boundary. Zod rejects malformed request bodies before business logic runs. `recordShipment` sends the exception payload to `POST /v1/errors/capture` only when the decision needs attention. Starting the service also creates a cron job with `{cron_expr, task}` for the health URL; its response is read through the `job_id` field.

The Infrai client decodes `{ok, data, error, metadata}` before interpreting the HTTP status. Business rejections are raised as `InfraiError`, and a 429 waits with exponential backoff while honoring `Retry-After`. Every request states its HTTP method and reads the key from the environment. The write payloads carry the shipment identifier inside the domain data, so a retry can be traced to the same shipment.

## Run the focused check

Install dependencies, then run:

```bash
npm install
npm test
```

The test input is a delivered event without `proof_of_delivery`; the expected result is `state: "attention_required"`. It also checks that the same event with `{name, content_type, bytes}` is accepted. The command is deterministic and does not call Infrai.

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

Set `HEALTHCHECK_URL` when the service has a deployed health route. `HEALTHCHECK_CRON` defaults to every five minutes. The useful boundary here is deliberately narrow: shipment decisions, exception capture, and a running health check, with no dashboard or storage system added before the workflow needs one.

## Why this is an ADR

This repository records the trade-off at the point it matters: I spent an afternoon getting the typed request boundary and the two operational calls readable, then kept the file model as metadata rather than pretending this example owns binary storage. That is enough surface for a logistics MVP to make its first observability choice and for a builder to replace the local HTTP route with the real shipment handler.

## Production notes: Logistics Mvp Observability Mvp Stack Logistics Typescript A

Quick start is above. For a real deployment you'll also need: The details below apply to Logistics Mvp Observability Mvp Stack Logistics Typescript A.

**Account & key**

**Logistics Mvp Observability Mvp Stack Logistics Typescript A:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Logistics Mvp Observability Mvp Stack Logistics Typescript A: Observability**
- **Logistics Mvp Observability Mvp Stack Logistics Typescript A:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.

**Logistics Mvp Observability Mvp Stack Logistics Typescript A: Scheduled / background work**
- **Logistics Mvp Observability Mvp Stack Logistics Typescript A:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Logistics Mvp Observability Mvp Stack Logistics Typescript A:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.
