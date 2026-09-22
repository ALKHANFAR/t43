/**
 * First vertical slice of Siyadah's decision layer. No network access and no AP writes.
 * Inputs are discovered action-level capabilities, not marketing names or model guesses.
 * A plan is eligible only when every action is authorized, connected, and data-compatible.
 */
export function selectPlan({ goal, tenant, capabilities, recipes }) {
  if (!goal || typeof goal !== "object" || !goal.outcome || !goal.proofEvent) {
    throw new TypeError("Goal needs an outcome and a proofEvent");
  }
  if (!tenant || !tenant.id || !Array.isArray(tenant.allowedActions) ||
      !Array.isArray(tenant.connectedPieces)) {
    throw new TypeError("Tenant context is incomplete");
  }
  if (!Array.isArray(capabilities) || !Array.isArray(recipes)) {
    throw new TypeError("Capabilities and recipes must be arrays");
  }

  const byId = new Map(capabilities.map(c => [c.id, c]));
  const choices = [];
  const rejected = [];
  for (const recipe of recipes) {
    const reasons = [];
    if (!recipe || !Array.isArray(recipe.steps) || recipe.steps.length === 0) {
      rejected.push({ recipeId: recipe?.id ?? null, reasons: ["empty_recipe"] });
      continue;
    }
    if (recipe.outcome !== goal.outcome) reasons.push("wrong_outcome");
    if (recipe.proofEvent !== goal.proofEvent) reasons.push("missing_outcome_proof");
    const available = new Set(goal.availableFields ?? []);
    for (const id of recipe.steps) {
      const action = byId.get(id);
      if (!action) { reasons.push("unknown_action:" + id); continue; }
      if (!tenant.allowedActions.includes(id)) reasons.push("not_authorized:" + id);
      if (!tenant.connectedPieces.includes(action.piece)) reasons.push("not_connected:" + action.piece);
      for (const field of action.requires ?? []) {
        if (!available.has(field)) reasons.push("missing_field:" + field + ":" + id);
      }
      for (const field of action.produces ?? []) available.add(field);
    }
    if (!available.has(goal.proofEvent)) reasons.push("unobservable_outcome");
    if (reasons.length) rejected.push({ recipeId: recipe.id, reasons: [...new Set(reasons)] });
    else choices.push({ recipeId: recipe.id, steps: recipe.steps, proofEvent: recipe.proofEvent });
  }
  // No fictional scores. With several valid plans, ask for a measurable constraint.
  const status = choices.length === 0 ? "no_eligible_plan" :
    choices.length === 1 ? "eligible_plan" : "needs_comparison";
  return { status, choices, rejected };
}
