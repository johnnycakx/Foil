// One-shot verification script used by Session 18 to confirm the foil-bot
// redeploy went green. Not part of the autonomous pipeline; safe to remove
// after the goal completes (or keep as a debugging aide).

import { railwayGraphql, getServiceStatus, isDeploymentLive, isDeploymentFailed } from "../lib/railway-api.ts";

// Look up project by its known id (from SESSION-LOG Session 11/12).
const PROJECT_ID = "08088ed2-f78d-48de-9559-67a528d1c7cd"; // perceptive-communication
const projectQuery = `
  query Project($id: String!) {
    project(id: $id) {
      id
      name
      services {
        edges {
          node {
            id
            name
          }
        }
      }
    }
  }
`;

type ProjectResponse = {
  project: {
    id: string;
    name: string;
    services: { edges: Array<{ node: { id: string; name: string } }> };
  };
};

const projRes = await railwayGraphql<ProjectResponse>({
  query: projectQuery,
  variables: { id: PROJECT_ID },
});
if (!projRes.ok) {
  console.error("project query failed:", JSON.stringify(projRes, null, 2));
  process.exit(1);
}

let serviceId: string | null = null;
const projectName: string = projRes.data.project.name;
for (const svcEdge of projRes.data.project.services.edges) {
  if (svcEdge.node.name === "foil-bot") {
    serviceId = svcEdge.node.id;
  }
}

if (!serviceId) {
  console.error("Could not find foil-bot service");
  console.error(JSON.stringify(projRes.data, null, 2));
  process.exit(1);
}

console.log(`foil-bot service: ${serviceId} (project: ${projectName})`);

const status = await getServiceStatus(serviceId);
console.log(JSON.stringify(status, null, 2));

if (status.ok) {
  console.log(`status: ${status.data.status} live=${isDeploymentLive(status.data.status)} failed=${isDeploymentFailed(status.data.status)}`);
}

// Discover the production environment id for this project.
const envQuery = `
  query Envs($projectId: String!) {
    environments(projectId: $projectId) {
      edges {
        node {
          id
          name
        }
      }
    }
  }
`;
type EnvsResponse = { environments: { edges: Array<{ node: { id: string; name: string } }> } };
const envRes = await railwayGraphql<EnvsResponse>({ query: envQuery, variables: { projectId: PROJECT_ID } });
if (!envRes.ok) {
  console.error("envs query failed:", JSON.stringify(envRes, null, 2));
  process.exit(1);
}
const prodEnv = envRes.data.environments.edges.find((e) => e.node.name === "production")?.node
  ?? envRes.data.environments.edges[0]?.node;
if (!prodEnv) {
  console.error("no environments found");
  process.exit(1);
}
console.log(`environment: ${prodEnv.id} (${prodEnv.name})`);

// Pull the last 5 deployments with full meta so we can correlate to a SHA.
const recentDeploysQuery = `
  query RecentDeployments($serviceId: String!) {
    deployments(
      first: 5
      input: { serviceId: $serviceId }
    ) {
      edges {
        node {
          id
          status
          createdAt
          meta
        }
      }
    }
  }
`;

type DeploymentsResponse = {
  deployments: {
    edges: Array<{
      node: {
        id: string;
        status: string;
        createdAt: string;
        meta: Record<string, unknown> | null;
      };
    }>;
  };
};

const recentRes = await railwayGraphql<DeploymentsResponse>({
  query: recentDeploysQuery,
  variables: { serviceId },
});
if (recentRes.ok) {
  console.log("\nlast 5 deployments:");
  for (const e of recentRes.data.deployments.edges) {
    console.log(`  ${e.node.id} ${e.node.status} ${e.node.createdAt} meta=${JSON.stringify(e.node.meta)}`);
  }
}
