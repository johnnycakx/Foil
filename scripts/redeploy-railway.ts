// One-shot: trigger a Railway redeploy of foil-bot via the GraphQL mutation,
// since GitHub auto-deploy isn't firing for recent pushes (Sessions 15-18 sit
// on main but the running bot is still on Session 13's revision). Uses
// lib/railway-api.ts as the single import boundary per ADR-009.

import { railwayGraphql, getServiceStatus } from "../lib/railway-api.ts";

const SERVICE_ID = "2d0552e6-1999-4149-9f77-9973e46e2adc"; // foil-bot
const ENVIRONMENT_ID = "c1af4109-3b28-4af6-8e1e-e83d5d9a5121"; // production

const redeployMutation = `
  mutation Redeploy($serviceId: String!, $environmentId: String!) {
    serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId)
  }
`;

type RedeployResponse = { serviceInstanceRedeploy: boolean };

const res = await railwayGraphql<RedeployResponse>({
  query: redeployMutation,
  variables: { serviceId: SERVICE_ID, environmentId: ENVIRONMENT_ID },
});
console.log("redeploy mutation:", JSON.stringify(res, null, 2));

if (!res.ok) {
  console.error("Failed to trigger redeploy");
  process.exit(1);
}

console.log("\npolling for new deployment...");
const start = Date.now();
let last = "";
while (Date.now() - start < 180_000) {
  const s = await getServiceStatus(SERVICE_ID);
  if (s.ok) {
    const stamp = `${s.data.deploymentId} ${s.data.status} ${s.data.createdAt}`;
    if (stamp !== last) {
      console.log("  " + stamp);
      last = stamp;
    }
    if (s.data.status === "SUCCESS" && new Date(s.data.createdAt).getTime() > start - 60_000) {
      console.log("✓ new SUCCESS deployment");
      process.exit(0);
    }
    if (s.data.status === "FAILED" || s.data.status === "CRASHED") {
      console.error("✗ deployment failed:", s.data.deploymentId);
      process.exit(2);
    }
  }
  await new Promise((r) => setTimeout(r, 5000));
}
console.log("timed out after 3min — current state may still be BUILDING");
