import assert from "node:assert/strict";
import { assessShipment, shipmentEventSchema } from "./shipment-service.ts";

const deliveredWithoutProof = shipmentEventSchema.parse({
  shipment_id: "SHP-1001", event: "delivered", occurred_at: "2026-10-28T08:00:00.000Z"
});
assert.deepEqual(assessShipment(deliveredWithoutProof), {
  shipment_id: "SHP-1001", state: "attention_required", needsAttention: true
});

const deliveredWithProof = shipmentEventSchema.parse({
  shipment_id: "SHP-1001", event: "delivered", occurred_at: "2026-10-28T08:00:00.000Z",
  proof_of_delivery: { name: "signature.png", content_type: "image/png", bytes: 2048 }
});
assert.equal(assessShipment(deliveredWithProof).state, "accepted");
console.log("shipment decision test passed");
