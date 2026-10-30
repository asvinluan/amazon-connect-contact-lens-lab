// Offline self-test for lens.mjs. It runs the real script against a pretend AWS
// CLI (a stub) and checks what the script asked AWS to do. No AWS, no network.
//
// What this proves: the dry run changes nothing, --apply makes the expected calls
// once, a second run does nothing, the bank instance is refused, the flow and rule
// JSON are well formed. What it does NOT prove: that real AWS accepts them.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const lens = join(here, "lens.mjs");
const work = mkdtempSync(join(tmpdir(), "lens-selftest-"));
const stubPath = join(work, "stub-aws.mjs");
const statePath = join(work, "state.json");

writeFileSync(stubPath, `
import { readFileSync, writeFileSync } from "node:fs";
const S = process.env.STUB_STATE;
const st = JSON.parse(readFileSync(S, "utf8"));
const a = process.argv.slice(2);
const [svc, op] = a;
const f = {};
for (let i = 2; i < a.length; i++) if (a[i].startsWith("--")) f[a[i].slice(2)] = a[i + 1];
st.log.push({ svc, op, f });
const out = (o) => { writeFileSync(S, JSON.stringify(st)); console.log(JSON.stringify(o)); process.exit(0); };
const fail = (m) => { writeFileSync(S, JSON.stringify(st)); console.error(m); process.exit(255); };
const inst = { Id: "inst-1", Arn: "arn:aws:connect:ap-southeast-2:ACCOUNT:instance/inst-1", InstanceAlias: st.alias, InstanceStatus: "ACTIVE", InboundCallsEnabled: true, OutboundCallsEnabled: true };
if (svc === "connect") {
  switch (op) {
    case "list-instances": out({ InstanceSummaryList: [inst] });
    case "describe-instance-attribute": out({ Attribute: { AttributeType: f["attribute-type"], Value: st.lens } });
    case "list-instance-storage-configs": out(st.noStorage ? { StorageConfigs: [] } : { StorageConfigs: [{ S3Config: { BucketName: "lab-bucket", BucketPrefix: "connect/" + st.alias + "/CallRecordings" } }] });
    case "list-phone-numbers-v2": out({ ListPhoneNumbersSummaryList: [{ PhoneNumber: "+61000000000" }] });
    case "list-queues": out({ QueueSummaryList: st.queues });
    case "list-hours-of-operations": out({ HoursOfOperationSummaryList: [{ Id: "hrs-1", Name: "Basic Hours" }] });
    case "create-queue": { const q = { Id: "q-" + (st.queues.length + 1), Arn: "arn:aws:connect:ap-southeast-2:ACCOUNT:instance/inst-1/queue/q-" + (st.queues.length + 1), Name: f["name"], QueueType: "STANDARD" }; st.queues.push(q); out({ QueueId: q.Id, QueueArn: q.Arn }); }
    case "list-users": out({ UserSummaryList: [{ Id: "u-1", Username: "agent1" }] });
    case "describe-user": out({ User: { Id: "u-1", RoutingProfileId: "rp-1", SecurityProfileIds: ["sp-1"] } });
    case "list-security-profile-permissions": out({ Permissions: ["ContactSearch", "OutboundCallAccess"] });
    case "list-routing-profile-queues": out({ RoutingProfileQueueConfigSummaryList: st.rpQueues.map((n) => ({ QueueName: n })) });
    case "associate-routing-profile-queues": { const cfg = JSON.parse(f["queue-configs"]); const q = st.queues.find((x) => x.Id === cfg[0].QueueReference.QueueId); st.rpQueues.push(q.Name); out({}); }
    case "list-contact-flows": out({ ContactFlowSummaryList: st.flows.map((n) => ({ Name: n })) });
    case "create-contact-flow": { JSON.parse(f["content"]); st.flows.push(f["name"]); st.flowContent = f["content"]; out({ ContactFlowId: "f-1" }); }
    case "list-rules": out({ RuleSummaryList: st.rules.map((r, i) => ({ Name: r.Name, RuleId: "r-" + i, PublishStatus: "PUBLISHED" })) });
    case "create-rule": { if (!/^[0-9a-zA-Z._-]*$/.test(f["name"])) fail("An error occurred (InvalidRequestException) when calling the CreateRule operation: Name fails to match the required pattern"); st.rules.push({ Name: f["name"], Function: f["function"], Actions: f["actions"], Trigger: f["trigger-event-source"], Status: f["publish-status"] }); out({ RuleId: "r-new" }); }
    case "describe-rule": { const r = st.rules[Number(f["rule-id"].slice(2))]; out({ Rule: { Name: r.Name, Function: r.Function, Actions: JSON.parse(r.Actions), PublishStatus: "PUBLISHED" } }); }
    case "search-contacts": out({ Contacts: st.contacts });
  }
}
if (svc === "s3api" && op === "list-objects-v2") out({ Contents: st.keys.map((k) => ({ Key: k })) });
fail("stub: unhandled " + a.join(" "));
`);

const fresh = (over = {}) => {
  const st = { alias: "demo-connect-lab", lens: "true", queues: [], flows: [], rules: [], rpQueues: ["existing-queue"], contacts: [], keys: [], log: [], ...over };
  writeFileSync(statePath, JSON.stringify(st));
};
const state = () => JSON.parse(readFileSync(statePath, "utf8"));
const run = (args, env = {}) => {
  try {
    const out = execFileSync(process.execPath, [lens, ...args], {
      encoding: "utf8",
      env: { ...process.env, AWS_BIN: `node:${stubPath}`, STUB_STATE: statePath, LENS_INSTANCE_ALIAS: "demo-connect-lab", ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
};
const calls = (op) => state().log.filter((l) => l.op === op).length;

let failures = 0;
const check = (name, cond, detail = "") => {
  if (!cond) failures += 1;
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${!cond && detail ? `\n          ${detail.slice(0, 300)}` : ""}`);
};

fresh();
let r0 = run(["check", "--user", "agent1"], { LENS_INSTANCE_ALIAS: "" });
console.log(`  ${/set your instance alias first/.test(r0.out) && r0.code !== 0 ? "PASS" : "FAIL"}  no alias set: stops and tells you how to set it`);
if (!(/set your instance alias first/.test(r0.out) && r0.code !== 0)) process.exitCode = 1;
console.log("== check (read-only)");
fresh({ lens: "false" });
let r = run(["check", "--user", "agent1"]);
check("check runs and warns that Contact Lens is off", r.code === 0 && /Contact Lens is OFF/.test(r.out), r.out);
check("check reports the missing queue, flow and categories", /not created yet/.test(r.out) && /Categories missing/.test(r.out), r.out);
check("check changed nothing", ["create-queue", "create-contact-flow", "create-rule", "associate-routing-profile-queues"].every((o) => calls(o) === 0));

console.log("== queue");
fresh();
r = run(["queue", "--user", "agent1"]);
check("dry run says 'dry run' and changes nothing", /dry run/.test(r.out) && calls("create-queue") === 0 && calls("associate-routing-profile-queues") === 0, r.out);
r = run(["queue", "--user", "agent1", "--apply"]);
check("apply creates the queue once and adds it to the routing profile once", r.code === 0 && calls("create-queue") === 1 && calls("associate-routing-profile-queues") === 1, r.out);
check("the other queue in the routing profile is kept", state().rpQueues.includes("existing-queue") && state().rpQueues.includes("lens-lab-queue"));
r = run(["queue", "--user", "agent1", "--apply"]);
check("second apply does nothing (safe to repeat)", r.code === 0 && calls("create-queue") === 1 && calls("associate-routing-profile-queues") === 1, r.out);
r = run(["queue", "--apply"]);
check("queue without --user stops", r.code !== 0 && /--user/.test(r.out));
r = run(["queue", "--user", "nobody", "--apply"]);
check("unknown user stops", r.code !== 0 && /no user named/.test(r.out));

console.log("== the bank instance is protected");
fresh({ alias: "meridian-bank-connect" });
r = run(["queue", "--user", "agent1", "--apply"], { LENS_INSTANCE_ALIAS: "meridian-bank-connect" });
check("queue refuses the bank instance", r.code !== 0 && /bank instance/.test(r.out) && calls("create-queue") === 0, r.out);
r = run(["categories", "--apply"], { LENS_INSTANCE_ALIAS: "meridian-bank-connect" });
check("categories refuses the bank instance", r.code !== 0 && calls("create-rule") === 0, r.out);
r = run(["check"], { LENS_INSTANCE_ALIAS: "meridian-bank-connect" });
check("read-only check is still allowed there", r.code === 0, r.out);
fresh();
r = run(["check"], { LENS_INSTANCE_ALIAS: "some-other-alias" });
check("an alias that does not match stops with a clear message", r.code !== 0 && /found 0/.test(r.out), r.out);

console.log("== flow");
fresh();
r = run(["flow", "--apply"]);
check("flow without the queue stops and says why", r.code !== 0 && /queue "lens-lab-queue" does not exist/.test(r.out), r.out);
run(["queue", "--user", "agent1", "--apply"]);
const saved = state();
writeFileSync(statePath, JSON.stringify({ ...saved, noStorage: true }));
r = run(["flow", "--apply"]);
check("flow refuses when call recording storage is missing", r.code !== 0 && /no call recording storage/.test(r.out) && calls("create-contact-flow") === 0, r.out);
r = run(["check", "--user", "agent1"]);
check("check says STOP when storage is missing", /STOP, FIX THIS FIRST/.test(r.out), r.out);
writeFileSync(statePath, JSON.stringify({ ...state(), noStorage: false }));
r = run(["flow"]);
check("flow dry run changes nothing", /dry run/.test(r.out) && calls("create-contact-flow") === 0, r.out);
r = run(["flow", "--apply"]);
check("flow apply creates one flow", r.code === 0 && calls("create-contact-flow") === 1, r.out);
const flow = JSON.parse(state().flowContent);
const ids = new Set(flow.Actions.map((a) => a.Identifier));
const targets = flow.Actions.flatMap((a) => [a.Transitions?.NextAction, ...(a.Transitions?.Errors ?? []).map((e) => e.NextAction)].filter(Boolean));
check("every block points at a block that exists", targets.every((t) => ids.has(t)) && ids.has(flow.StartAction));
const rb = flow.Actions.find((a) => a.Type === "UpdateContactRecordingBehavior");
check("the flow records agent AND customer (needed for analytics)", JSON.stringify(rb?.Parameters.RecordingBehavior.RecordedParticipants) === '["Agent","Customer"]');
check("analytics, sentiment and en-AU are switched on", rb?.Parameters.AnalyticsBehavior.Enabled === "True" && rb.Parameters.AnalyticsBehavior.SentimentConfiguration.Enabled === "True" && rb.Parameters.AnalyticsBehavior.AnalyticsLanguage === "en-AU");
const order = flow.Actions.map((a) => a.Type);
check("analytics is set BEFORE the call goes to the queue", order.indexOf("UpdateContactRecordingBehavior") < order.indexOf("TransferContactToQueue"));
check("the greeting tells the caller the call is recorded", /recorded/i.test(flow.Actions.find((a) => a.Identifier === "L03-Welcome").Parameters.Text));
const q1 = state().queues[0];
check("the flow sends calls to the lab queue", flow.Actions.find((a) => a.Type === "UpdateContactTargetQueue").Parameters.QueueId === q1.Arn);
r = run(["flow", "--apply"]);
check("second apply does nothing", r.code === 0 && calls("create-contact-flow") === 1);
r = run(["flow", "--print"]);
check("flow --print needs no AWS", r.code === 0 && JSON.parse(r.out).Version === "2019-10-30");

console.log("== categories");
fresh();
r = run(["categories"]);
check("dry run changes nothing", /dry run/.test(r.out) && calls("create-rule") === 0, r.out);
r = run(["categories", "--apply"]);
check("apply creates 6 categories", r.code === 0 && calls("create-rule") === 6, r.out);
const rules = state().rules;
check("rule names match the categories", ["Complaint", "Escalation", "Billing-Issue", "Technical-Issue", "Refund-Request", "Negative-Sentiment"].every((n) => rules.some((x) => x.Name === n)));
const fn = JSON.parse(rules.find((x) => x.Name === "Refund-Request").Function);
check("word rule: exact-match transcript, customer only, version 2022-11-25",
  fn.Version === "2022-11-25" && fn.RuleFunction.Operator === "OR" && fn.RuleFunction.Operands[0].ComparisonValue === "$.ContactLens.PostCall.ExactMatch.Transcript" && fn.RuleFunction.Operands[0].FilterClause.Filters[0].Data === "CUSTOMER" && fn.RuleFunction.Operands[0].Operands.includes("refund"));
const sn = JSON.parse(rules.find((x) => x.Name === "Negative-Sentiment").Function);
check("sentiment rule: customer sentiment state EQUALS NEGATIVE", sn.RuleFunction.Operands[0].ComparisonValue === "$.ContactLens.PostCall.Sentiment.State" && sn.RuleFunction.Operands[0].Operands[0] === "NEGATIVE");
check("rules trigger on post-call analysis and assign a category", rules.every((x) => x.Trigger === "EventSourceName=OnPostCallAnalysisAvailable" && JSON.parse(x.Actions)[0].ActionType === "ASSIGN_CONTACT_CATEGORY"));
check("without --eventbridge there is no EventBridge action", rules.every((x) => JSON.parse(x.Actions).length === 1));
r = run(["categories", "--apply"]);
check("second apply does nothing", r.code === 0 && calls("create-rule") === 6);
fresh();
run(["categories", "--apply", "--eventbridge"]);
check("--eventbridge adds the EventBridge action", state().rules.every((x) => JSON.parse(x.Actions).some((a) => a.ActionType === "GENERATE_EVENTBRIDGE_EVENT")));
r = run(["rule-export"]);
check("rule-export lists the rules", r.code === 0 && /Complaint/.test(r.out), r.out);
r = run(["rule-export", "--name", "Complaint"]);
check("rule-export shows one rule in full", r.code === 0 && /RuleFunction/.test(r.out), r.out);

console.log("== results");
fresh();
r = run(["results"]);
check("no calls: tells you to make a test call", r.code === 0 && /No voice calls found/.test(r.out), r.out);
fresh({ contacts: [{ Id: "abc-123", InitiationMethod: "INBOUND", InitiationTimestamp: "2026-10-29T01:00:00Z" }], keys: ["connect/demo-connect-lab/Analysis/Voice/2026/10/29/abc-123_analysis.json"] });
r = run(["results"]);
check("finds the analysis file for a call", r.code === 0 && /abc-123/.test(r.out) && /FOUND/.test(r.out), r.out);
fresh({ contacts: [{ Id: "zzz-999", InitiationMethod: "INBOUND", InitiationTimestamp: "2026-10-29T01:00:00Z" }] });
r = run(["results"]);
check("says 'not there yet' when there is no analysis file", /not there yet/.test(r.out), r.out);

rmSync(work, { recursive: true, force: true });
console.log(failures === 0 ? "\nAll self-tests passed. (This used a pretend AWS, so it proves the logic, not that AWS accepts the JSON.)" : `\n${failures} self-test(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
