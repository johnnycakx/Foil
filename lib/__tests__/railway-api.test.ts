// Contract tests for the Railway GraphQL wrapper. Pins:
//   1. POST to https://backboard.railway.com/graphql/v2 with Bearer auth.
//   2. The LatestDeployment query carries the serviceId variable verbatim.
//   3. getServiceStatus returns the deployment id + status from the first
//      edge, surfaces commitHash from meta, and distinguishes "no deploys
//      yet" from other failures.
//   4. Missing token / network failure / non-2xx / GraphQL errors all
//      return ok:false without throwing — soft-fail like the Discord poster.

import test from "node:test";
import assert from "node:assert/strict";
import {
  getServiceSource,
  getServiceStatus,
  isDeploymentFailed,
  isDeploymentLive,
  railwayGraphql,
} from "../railway-api.ts";

type CapturedRequest = { url: string; init: RequestInit };

function fakeFetch(responses: Array<Response | (() => Response)>): {
  fetch: typeof fetch;
  calls: CapturedRequest[];
} {
  const calls: CapturedRequest[] = [];
  let i = 0;
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: typeof url === "string" ? url : url.toString(), init: init ?? {} });
    const r = responses[Math.min(i, responses.length - 1)];
    i++;
    return typeof r === "function" ? r() : r;
  }) as unknown as typeof fetch;
  return { fetch: fetchImpl, calls };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("railwayGraphql returns ok:false when no token is available", async () => {
  const prev = process.env.RAILWAY_API_TOKEN;
  delete process.env.RAILWAY_API_TOKEN;
  try {
    const out = await railwayGraphql({ query: "{ __typename }" });
    assert.equal(out.ok, false);
    if (!out.ok) assert.equal(out.error, "missing_railway_api_token");
  } finally {
    if (prev !== undefined) process.env.RAILWAY_API_TOKEN = prev;
  }
});

test("railwayGraphql POSTs to backboard with Bearer auth + JSON body", async () => {
  const { fetch, calls } = fakeFetch([jsonResponse({ data: { __typename: "Query" } })]);
  const out = await railwayGraphql({
    query: "query { __typename }",
    variables: { foo: "bar" },
    token: "tok_test",
    fetchImpl: fetch,
  });
  assert.equal(out.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://backboard.railway.com/graphql/v2");
  assert.equal(calls[0].init.method, "POST");
  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(headers["Authorization"], "Bearer tok_test");
  assert.equal(headers["Content-Type"], "application/json");
  const body = JSON.parse(calls[0].init.body as string);
  assert.equal(body.query, "query { __typename }");
  assert.deepEqual(body.variables, { foo: "bar" });
});

test("railwayGraphql surfaces GraphQL `errors` array as ok:false", async () => {
  const { fetch } = fakeFetch([
    jsonResponse({ errors: [{ message: "bad request" }, { message: "again" }] }),
  ]);
  const out = await railwayGraphql({
    query: "query {}",
    token: "tok",
    fetchImpl: fetch,
  });
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.error, "bad request; again");
});

test("railwayGraphql surfaces non-2xx HTTP status without throwing", async () => {
  const { fetch } = fakeFetch([new Response("nope", { status: 401 })]);
  const out = await railwayGraphql({
    query: "query {}",
    token: "tok",
    fetchImpl: fetch,
  });
  assert.equal(out.ok, false);
  if (!out.ok) {
    assert.equal(out.status, 401);
    assert.equal(out.error, "http_401");
  }
});

test("railwayGraphql soft-fails when fetch throws", async () => {
  const fetchImpl = (async () => {
    throw new Error("ECONNRESET");
  }) as unknown as typeof fetch;
  const out = await railwayGraphql({
    query: "query {}",
    token: "tok",
    fetchImpl,
  });
  assert.equal(out.ok, false);
  if (!out.ok) assert.match(out.error, /fetch_failed: ECONNRESET/);
});

test("getServiceStatus rejects an empty serviceId without hitting the network", async () => {
  let called = false;
  const fetchImpl = (async () => {
    called = true;
    return new Response("", { status: 200 });
  }) as unknown as typeof fetch;
  const out = await getServiceStatus("", { token: "tok", fetchImpl });
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.error, "missing_service_id");
  assert.equal(called, false);
});

test("getServiceStatus carries the serviceId variable and parses the latest deployment", async () => {
  const { fetch, calls } = fakeFetch([
    jsonResponse({
      data: {
        deployments: {
          edges: [
            {
              node: {
                id: "dep_xyz",
                status: "SUCCESS",
                createdAt: "2026-05-22T10:00:00Z",
                meta: { commitHash: "abc1234" },
              },
            },
          ],
        },
      },
    }),
  ]);
  const out = await getServiceStatus("svc_123", { token: "tok", fetchImpl: fetch });
  assert.equal(out.ok, true);
  if (out.ok) {
    assert.equal(out.data.deploymentId, "dep_xyz");
    assert.equal(out.data.status, "SUCCESS");
    assert.equal(out.data.createdAt, "2026-05-22T10:00:00Z");
    assert.equal(out.data.commitSha, "abc1234");
  }
  const body = JSON.parse(calls[0].init.body as string);
  assert.deepEqual(body.variables, { serviceId: "svc_123" });
  assert.match(body.query, /LatestDeployment/);
  assert.match(body.query, /deployments\(/);
});

test("getServiceStatus distinguishes 'no deployments yet' from other failures", async () => {
  const { fetch } = fakeFetch([
    jsonResponse({ data: { deployments: { edges: [] } } }),
  ]);
  const out = await getServiceStatus("svc_empty", { token: "tok", fetchImpl: fetch });
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.error, "no_deployments");
});

test("getServiceStatus handles meta=null gracefully (no commit info)", async () => {
  const { fetch } = fakeFetch([
    jsonResponse({
      data: {
        deployments: {
          edges: [
            {
              node: {
                id: "dep_no_commit",
                status: "BUILDING",
                createdAt: "2026-05-22T10:05:00Z",
                meta: null,
              },
            },
          ],
        },
      },
    }),
  ]);
  const out = await getServiceStatus("svc_123", { token: "tok", fetchImpl: fetch });
  assert.equal(out.ok, true);
  if (out.ok) {
    assert.equal(out.data.commitSha, null);
    assert.equal(out.data.status, "BUILDING");
  }
});

test("getServiceSource rejects an empty serviceId without hitting the network", async () => {
  let called = false;
  const fetchImpl = (async () => {
    called = true;
    return new Response("", { status: 200 });
  }) as unknown as typeof fetch;
  const out = await getServiceSource("", { token: "tok", fetchImpl });
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.error, "missing_service_id");
  assert.equal(called, false);
});

test("getServiceSource POSTs the ServiceSource query with serviceId + Bearer auth", async () => {
  const { fetch, calls } = fakeFetch([
    jsonResponse({
      data: {
        service: {
          id: "svc_abc",
          name: "foil-bot",
          repoTriggers: {
            edges: [
              {
                node: {
                  id: "trg_1",
                  branch: "main",
                  provider: "github",
                  repository: "johnnycakx/Foil",
                  environmentId: "env_1",
                  serviceId: "svc_abc",
                  checkSuites: false,
                },
              },
            ],
          },
        },
      },
    }),
  ]);
  const out = await getServiceSource("svc_abc", { token: "tok_test", fetchImpl: fetch });
  assert.equal(out.ok, true);
  if (out.ok) {
    assert.equal(out.data.serviceId, "svc_abc");
    assert.equal(out.data.serviceName, "foil-bot");
    assert.equal(out.data.connected, true);
    assert.equal(out.data.repoTriggers.length, 1);
    assert.equal(out.data.repoTriggers[0].repository, "johnnycakx/Foil");
    assert.equal(out.data.repoTriggers[0].branch, "main");
    assert.equal(out.data.repoTriggers[0].provider, "github");
  }
  assert.equal(calls[0].url, "https://backboard.railway.com/graphql/v2");
  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(headers["Authorization"], "Bearer tok_test");
  const body = JSON.parse(calls[0].init.body as string);
  assert.deepEqual(body.variables, { serviceId: "svc_abc" });
  assert.match(body.query, /ServiceSource/);
  assert.match(body.query, /repoTriggers/);
});

test("getServiceSource flags an unconnected service (empty repoTriggers) as connected:false", async () => {
  const { fetch } = fakeFetch([
    jsonResponse({
      data: {
        service: {
          id: "svc_naked",
          name: "foil-bot",
          repoTriggers: { edges: [] },
        },
      },
    }),
  ]);
  const out = await getServiceSource("svc_naked", { token: "tok", fetchImpl: fetch });
  assert.equal(out.ok, true);
  if (out.ok) {
    assert.equal(out.data.connected, false);
    assert.deepEqual(out.data.repoTriggers, []);
  }
});

test("getServiceSource returns service_not_found when the API returns null service", async () => {
  const { fetch } = fakeFetch([jsonResponse({ data: { service: null } })]);
  const out = await getServiceSource("svc_missing", { token: "tok", fetchImpl: fetch });
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.error, "service_not_found");
});

test("getServiceSource surfaces GraphQL errors as ok:false", async () => {
  const { fetch } = fakeFetch([
    jsonResponse({ errors: [{ message: "unauthorized" }] }),
  ]);
  const out = await getServiceSource("svc_abc", { token: "tok", fetchImpl: fetch });
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.error, "unauthorized");
});

test("getServiceSource soft-fails when fetch throws", async () => {
  const fetchImpl = (async () => {
    throw new Error("ENETDOWN");
  }) as unknown as typeof fetch;
  const out = await getServiceSource("svc_abc", { token: "tok", fetchImpl });
  assert.equal(out.ok, false);
  if (!out.ok) assert.match(out.error, /fetch_failed: ENETDOWN/);
});

test("isDeploymentLive / isDeploymentFailed match terminal states", () => {
  assert.equal(isDeploymentLive("SUCCESS"), true);
  assert.equal(isDeploymentLive("BUILDING"), false);
  assert.equal(isDeploymentLive("DEPLOYING"), false);
  assert.equal(isDeploymentFailed("FAILED"), true);
  assert.equal(isDeploymentFailed("CRASHED"), true);
  assert.equal(isDeploymentFailed("REMOVED"), true);
  assert.equal(isDeploymentFailed("SUCCESS"), false);
  assert.equal(isDeploymentFailed("BUILDING"), false);
});
