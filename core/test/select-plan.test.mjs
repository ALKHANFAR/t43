import test from "node:test";
import assert from "node:assert/strict";
import { selectPlan } from "../src/select-plan.mjs";

const capabilities = [
  { id: "shopify.abandoned", piece: "shopify", requires: [], produces: ["checkout_id", "phone"] },
  { id: "kapso.send", piece: "kapso", requires: ["phone"], produces: ["message_id"] },
  { id: "shopify.paid", piece: "shopify", requires: ["checkout_id"], produces: ["paid_order_id"] }
];
const recipe = { id: "recover_checkout", outcome: "recover_revenue",
  proofEvent: "paid_order_id", steps: capabilities.map(c => c.id) };
const goal = { outcome: "recover_revenue", proofEvent: "paid_order_id" };
const tenant = { id: "tenant-a", allowedActions: recipe.steps,
  connectedPieces: ["shopify", "kapso"] };

test("chooses a complete connected path with an outcome proof", () => {
  const result = selectPlan({ goal, tenant, capabilities, recipes: [recipe] });
  assert.equal(result.status, "eligible_plan");
  assert.deepEqual(result.choices[0].steps, recipe.steps);
});

test("rejects an action outside tenant permissions even when connected", () => {
  const result = selectPlan({ goal, tenant: { ...tenant, allowedActions: ["shopify.abandoned", "shopify.paid"] },
    capabilities, recipes: [recipe] });
  assert.equal(result.status, "no_eligible_plan");
  assert.ok(result.rejected[0].reasons.includes("not_authorized:kapso.send"));
});

test("rejects execution when source fields cannot support an action", () => {
  const changed = capabilities.map(c => c.id === "shopify.abandoned" ? { ...c, produces: ["checkout_id"] } : c);
  const result = selectPlan({ goal, tenant, capabilities: changed, recipes: [recipe] });
  assert.ok(result.rejected[0].reasons.includes("missing_field:phone:kapso.send"));
});

test("an activity receipt does not prove the commercial outcome", () => {
  const result = selectPlan({ goal, tenant, capabilities, recipes: [
    { ...recipe, proofEvent: "message_id", steps: recipe.steps.slice(0, 2) }
  ] });
  assert.equal(result.status, "no_eligible_plan");
  assert.ok(result.rejected[0].reasons.includes("missing_outcome_proof"));
});
