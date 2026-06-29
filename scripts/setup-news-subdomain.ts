// Sending-subdomain activation tool (ADR-082, Part B).
//
// Provisions the dedicated marketing sending subdomain (default
// `news.foiltcg.com`) in Resend and prints the EXACT DNS records to add at the
// registrar. Isolating marketing sends on their own subdomain protects the
// transactional reputation of the root `foiltcg.com` (which keeps sending the
// wishlist alerts from `alerts@`), and warming a fresh subdomain from zero is
// cleanest done now, before real volume.
//
// This is John's one hand-off (DNS). The script does NOT send any email; the
// only mutation is creating the domain, gated behind `--create`. Default (no
// flag) is read-only: it looks the domain up and prints its records + status.
//
// Verified against resend.com/docs/api-reference/domains/{create,get,list}.
// DKIM is SES Easy DKIM (3 CNAMEs → *.dkim.amazonses.com); SPF is an MX + TXT
// on the `send.<domain>` return-path subdomain; DMARC is NOT auto-provisioned
// by Resend, so we print a recommended record to add alongside.
//
// Usage:
//   node --experimental-strip-types --no-warnings scripts/setup-news-subdomain.ts            # read-only: look up + print
//   node --experimental-strip-types --no-warnings scripts/setup-news-subdomain.ts --create   # create the domain, then print
//   …optionally:  --domain news.foiltcg.com  --region us-east-1
//
// After the records verify in Resend, set NEWSLETTER_FROM="Foil <news@foiltcg.com>"
// on Vercel prod (the broadcast send already reads it — lib/notifications/resend.ts).

const API = "https://api.resend.com/domains";

type ResendDnsRecord = {
  record?: string; // SPF | DKIM | MX | Tracking
  name?: string; // relative to the domain (e.g. "send", "x._domainkey")
  type?: string; // MX | TXT | CNAME
  value?: string;
  ttl?: string;
  status?: string;
  priority?: number;
};

type ResendDomain = {
  id?: string;
  name?: string;
  status?: string;
  region?: string;
  records?: ResendDnsRecord[];
};

function arg(flag: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) return process.argv[i + 1];
  return fallback;
}

async function main(): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY is not set. Export it (it lives in .env.local + Vercel prod) and retry.");
    process.exit(1);
  }

  const domain = arg("--domain", "news.foiltcg.com")!;
  const region = arg("--region", "us-east-1")!;
  const doCreate = process.argv.includes("--create");
  const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };

  // Look for an existing domain by name first (idempotent — re-running is safe).
  const listRes = await fetch(API, { headers });
  if (!listRes.ok) {
    console.error(`GET /domains failed: HTTP ${listRes.status} — ${await listRes.text()}`);
    process.exit(1);
  }
  const list = (await listRes.json()) as { data?: ResendDomain[] };
  let found = (list.data ?? []).find((d) => d.name === domain);

  if (!found && doCreate) {
    // Lean config for deliverability: NO open/click tracking (avoids the extra
    // tracking CNAME + a tracking pixel; aligns with the ADR-079 text-forward,
    // land-in-Primary posture). Resend mints the SPF + 3 DKIM records.
    const createRes = await fetch(API, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: domain, region, open_tracking: false, click_tracking: false }),
    });
    if (!createRes.ok) {
      console.error(`POST /domains failed: HTTP ${createRes.status} — ${await createRes.text()}`);
      process.exit(1);
    }
    found = (await createRes.json()) as ResendDomain;
    console.log(`\n✅ Created Resend domain "${domain}" (id ${found.id}).`);
  } else if (!found) {
    console.log(`\nℹ️  Domain "${domain}" does not exist in this Resend account yet.`);
    console.log(`   Re-run with --create to provision it, then add the printed DNS records.\n`);
    process.exit(0);
  }

  // Pull the full record set (the list endpoint may not include records).
  if (found?.id) {
    const getRes = await fetch(`${API}/${found.id}`, { headers });
    if (getRes.ok) found = (await getRes.json()) as ResendDomain;
  }

  printRecords(domain, found!);
}

function printRecords(domain: string, d: ResendDomain): void {
  console.log(`\n=== DNS records for ${domain}  (status: ${d.status ?? "unknown"}, region: ${d.region ?? "?"}) ===`);
  console.log(`Add these at the registrar that hosts foiltcg.com DNS. Record "name" is shown`);
  console.log(`relative to the zone apex AND as a FQDN — use whichever your registrar expects.\n`);

  const records = d.records ?? [];
  if (records.length === 0) {
    console.log("(Resend returned no records — re-run after --create, or check the dashboard.)");
  }
  for (const r of records) {
    const rel = r.name ?? "";
    const fqdn = rel ? `${rel}.${domain}` : domain;
    console.log(`• [${r.record}] ${r.type}`);
    console.log(`    host (relative): ${rel || "@"}`);
    console.log(`    host (FQDN):     ${fqdn}`);
    if (r.priority !== undefined) console.log(`    priority:        ${r.priority}`);
    console.log(`    value:           ${r.value}`);
    console.log(`    ttl:             ${r.ttl ?? "Auto"}`);
    console.log("");
  }

  // DMARC is not auto-provisioned by Resend. Recommend a monitoring-mode record
  // scoped to the sending subdomain (mirrors the root's p=none from Task #18).
  console.log(`• [DMARC] TXT  (recommended — Resend does not mint this)`);
  console.log(`    host (relative): _dmarc`);
  console.log(`    host (FQDN):     _dmarc.${domain}`);
  console.log(`    value:           "v=DMARC1; p=none; rua=mailto:dmarc@foiltcg.com"`);
  console.log(`    ttl:             Auto\n`);

  console.log(`Next steps (the John-attended activation):`);
  console.log(`  1. Add every record above at the registrar.`);
  console.log(`  2. Verify the domain in Resend (dashboard → Domains, or POST /domains/${d.id}/verify).`);
  console.log(`  3. Set on Vercel prod:  NEWSLETTER_FROM="Foil <news@${domain.replace(/^news\./, "")}>"`);
  console.log(`     (the broadcast send already reads NEWSLETTER_FROM — no code change).`);
  console.log(`  4. Send a test broadcast; confirm it lands in Primary + DKIM/SPF/DMARC pass`);
  console.log(`     (Gmail → "Show original" → check the auth-results block).`);
  console.log(`  Rollback: unset NEWSLETTER_FROM → sends revert to the verified alerts@ sender.\n`);
}

main().catch((err) => {
  console.error("setup-news-subdomain failed:", err);
  process.exit(1);
});
