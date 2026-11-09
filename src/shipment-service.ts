import { createServer } from "node:http";
import { z } from "zod";
import { infrai } from "./infrai.ts";

export const shipmentEventSchema = z.object({
  shipment_id: z.string().min(1),
  event: z.enum(["picked_up", "in_transit", "delivered", "exception"]),
  occurred_at: z.string().datetime(),
  proof_of_delivery: z.object({ name: z.string().min(1), content_type: z.string().min(1), bytes: z.number().int().positive() }).optional(),
  exception_reason: z.string().min(1).optional()
});
export type ShipmentEvent = z.infer<typeof shipmentEventSchema>;

export function assessShipment(event: ShipmentEvent) {
  const needsAttention = event.event === "exception" || (event.event === "delivered" && !event.proof_of_delivery);
  return { shipment_id: event.shipment_id, state: needsAttention ? "attention_required" : "accepted", needsAttention };
}

export async function recordShipment(event: ShipmentEvent) {
  const decision = assessShipment(event);
  if (decision.needsAttention) {
    await infrai.errors.capture({
      message: `Shipment ${event.shipment_id} needs attention`,
      exception: { shipment_id: event.shipment_id, event: event.event, exception_reason: event.exception_reason }
    });
  }
  return decision;
}

async function readBody(request: import("node:http").IncomingMessage): Promise<unknown> {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  return JSON.parse(raw);
}

export function startShipmentService(port = 3000) {
  const server = createServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== "/shipments/events") {
      response.writeHead(404).end();
      return;
    }
    try {
      const event = shipmentEventSchema.parse(await readBody(request));
      const result = await recordShipment(event);
      response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(result));
    } catch (error) {
      const message = error instanceof z.ZodError ? error.issues : "request could not be processed";
      response.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ error: message }));
    }
  });
  server.listen(port);
  return server;
}

if (process.argv[1]?.endsWith("shipment-service.ts")) {
  const cron = process.env.HEALTHCHECK_CRON ?? "*/5 * * * *";
  const healthUrl = process.env.HEALTHCHECK_URL ?? "http://localhost:3000/health";
  infrai.cron.create(cron, healthUrl).then(({ job_id }) => console.log(`health check scheduled: ${job_id}`));
  startShipmentService();
}
