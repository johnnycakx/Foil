// One-shot: wire foil-bot's Railway service to the johnnycakx/Foil GitHub
// repo via serviceConnect + deploymentTriggerCreate. Runs the empty-commit
// verification after — confirms a github-triggered build fires.

import { railwayGraphql, getServiceSource } from "../lib/railway-api.ts";

const SERVICE_ID = "2d0552e6-1999-4149-9f77-9973e46e2adc"; // foil-bot
const PROJECT_ID = "08088ed2-f78d-48de-9559-67a528d1c7cd"; // perceptive-communication
const ENVIRONMENT_ID = "c1af4109-3b28-4af6-8e1e-e83d5d9a5121"; // production
const REPO = "johnnycakx/Foil";
const BRANCH = "main";

console.log("=== BEFORE ===");
console.log(JSON.stringify(await getServiceSource(SERVICE_ID), null, 2));

const connectMutation = `
  mutation ServiceConnect($id: String!, $input: ServiceConnectInput!) {
    serviceConnect(id: $id, input: $input) {
      id
      name
    }
  }
`;
const connectRes = await railwayGraphql({
  query: connectMutation,
  variables: {
    id: SERVICE_ID,
    input: { repo: REPO, branch: BRANCH },
  },
});
console.log("\n=== serviceConnect ===");
console.log(JSON.stringify(connectRes, null, 2));

const triggerMutation = `
  mutation TriggerCreate($input: DeploymentTriggerCreateInput!) {
    deploymentTriggerCreate(input: $input) {
      id
      branch
      provider
      repository
      serviceId
      environmentId
    }
  }
`;
const triggerRes = await railwayGraphql({
  query: triggerMutation,
  variables: {
    input: {
      projectId: PROJECT_ID,
      environmentId: ENVIRONMENT_ID,
      serviceId: SERVICE_ID,
      provider: "github",
      repository: REPO,
      branch: BRANCH,
    },
  },
});
console.log("\n=== deploymentTriggerCreate ===");
console.log(JSON.stringify(triggerRes, null, 2));

console.log("\n=== AFTER ===");
console.log(JSON.stringify(await getServiceSource(SERVICE_ID), null, 2));
