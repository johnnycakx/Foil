// Thin wrapper around Railway's public GraphQL endpoint, used by Claude Code
// goals to check deploy state WITHOUT going through the interactive-first
// `railway` CLI. See ADR-009 (Session 15 amendment) for the architectural
// rationale — short version: account-scoped CLI flows assume an attached TTY
// and a linked project directory, which doesn't fit the headless-goal model.
// The GraphQL endpoint takes a bearer token, has no link state, and gives
// us exactly what we need for status checks.
//
// Single import boundary: this is the ONLY module in the repo allowed to
// hit `backboard.railway.com`. If a goal needs a Railway field this wrapper
// doesn't expose yet, extend `railwayGraphql` and add a typed helper — keep
// the network surface concentrated here.

const RAILWAY_GRAPHQL_ENDPOINT = "https://backboard.railway.com/graphql/v2";

export type RailwayDeploymentStatus =
  | "BUILDING"
  | "DEPLOYING"
  | "SUCCESS"
  | "FAILED"
  | "CRASHED"
  | "REMOVED"
  | "SKIPPED"
  | "INITIALIZING"
  | "QUEUED"
  | "WAITING";

export type RailwayServiceStatus = {
  deploymentId: string;
  status: RailwayDeploymentStatus;
  /** ISO-8601 timestamp from Railway's API. Helpful for "is this the post-push deploy?" checks. */
  createdAt: string;
  /** Commit SHA the deployment is tied to, when available. */
  commitSha?: string | null;
};

export type RailwayGraphqlInput = {
  query: string;
  variables?: Record<string, unknown>;
  /** Bearer token. Defaults to `process.env.RAILWAY_API_TOKEN`. */
  token?: string;
  /** Override for tests — injects a custom fetch impl. */
  fetchImpl?: typeof fetch;
};

export type RailwayGraphqlResult<T> =
  | { ok: true; data: T }
  | { ok: false; status?: number; error: string };

/**
 * Raw GraphQL POST. Returns ok:false on missing token, network failure, or
 * a GraphQL `errors` payload. Soft-fail by design — callers handle the
 * negative case rather than wrapping in try/catch.
 */
export async function railwayGraphql<T = unknown>(
  input: RailwayGraphqlInput,
): Promise<RailwayGraphqlResult<T>> {
  const token = input.token ?? process.env.RAILWAY_API_TOKEN;
  if (!token) return { ok: false, error: "missing_railway_api_token" };
  const doFetch = input.fetchImpl ?? fetch;

  let res: Response;
  try {
    res = await doFetch(RAILWAY_GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query: input.query, variables: input.variables ?? {} }),
    });
  } catch (err) {
    return { ok: false, error: `fetch_failed: ${(err as Error).message}` };
  }

  if (!res.ok) {
    return { ok: false, status: res.status, error: `http_${res.status}` };
  }

  let body: { data?: T; errors?: Array<{ message: string }> };
  try {
    body = (await res.json()) as typeof body;
  } catch (err) {
    return { ok: false, status: res.status, error: `bad_json: ${(err as Error).message}` };
  }

  if (body.errors?.length) {
    return { ok: false, status: res.status, error: body.errors.map((e) => e.message).join("; ") };
  }
  if (!body.data) {
    return { ok: false, status: res.status, error: "no_data" };
  }
  return { ok: true, data: body.data };
}

const LATEST_DEPLOYMENT_QUERY = `
  query LatestDeployment($serviceId: String!) {
    deployments(
      first: 1
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
`.trim();

/**
 * Return the most-recent deployment for a Railway service. Returns ok:false
 * when the service has no deployments yet (e.g. brand-new service) — the
 * `error` field is `no_deployments` in that case so callers can distinguish.
 */
export async function getServiceStatus(
  serviceId: string,
  opts: { token?: string; fetchImpl?: typeof fetch } = {},
): Promise<RailwayGraphqlResult<RailwayServiceStatus>> {
  if (!serviceId) return { ok: false, error: "missing_service_id" };

  type DeploymentsResponse = {
    deployments: {
      edges: Array<{
        node: {
          id: string;
          status: RailwayDeploymentStatus;
          createdAt: string;
          meta?: { commitHash?: string } | null;
        };
      }>;
    };
  };

  const res = await railwayGraphql<DeploymentsResponse>({
    query: LATEST_DEPLOYMENT_QUERY,
    variables: { serviceId },
    token: opts.token,
    fetchImpl: opts.fetchImpl,
  });
  if (!res.ok) return res;

  const node = res.data.deployments.edges[0]?.node;
  if (!node) return { ok: false, error: "no_deployments" };

  return {
    ok: true,
    data: {
      deploymentId: node.id,
      status: node.status,
      createdAt: node.createdAt,
      commitSha: node.meta?.commitHash ?? null,
    },
  };
}

/** Convenience: true once the latest deployment is in a terminal good state. */
export function isDeploymentLive(status: RailwayDeploymentStatus): boolean {
  return status === "SUCCESS";
}

/** Convenience: terminal failure states — caller should stop polling on these. */
export function isDeploymentFailed(status: RailwayDeploymentStatus): boolean {
  return status === "FAILED" || status === "CRASHED" || status === "REMOVED";
}
