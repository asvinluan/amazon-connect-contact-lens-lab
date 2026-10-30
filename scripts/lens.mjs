// Contact Lens lab helper. One file, six small jobs, no npm packages.
//
//   node scripts/lens.mjs check                      read-only: is everything ready?
//   node scripts/lens.mjs queue --user LOGIN [--apply]   create the lab queue, add it to your routing profile
//   node scripts/lens.mjs flow [--apply | --print]       create the simple lab flow (or print its JSON)
//   node scripts/lens.mjs categories [--apply] [--eventbridge]   create the Contact Lens categories
//   node scripts/lens.mjs rule-export [--name NAME]      show the rules already in your instance
//   node scripts/lens.mjs results [--hours N]            read-only: recent calls and their analysis files
//
// Run it through lens.ps1 (PowerShell) or lens.sh (bash). They only check that
// node and the AWS CLI exist, then call this file.
//
// Safety:
//   * Everything that CHANGES something is a dry run unless you add --apply.
//   * It works on ONE instance, chosen by alias (default asvinluan-connect-lab).
//     It refuses to change an instance whose alias looks like the bank one.
//   * Nothing is written to disk. No instance id or account id is stored anywhere.
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const region = process.env.AWS_REGION || "ap-southeast-2";
const wantedAlias = (process.env.LENS_INSTANCE_ALIAS || "asvinluan-connect-lab").trim();
const QUEUE_NAME = process.env.LENS_QUEUE_NAME || "lens-lab-queue";
const FLOW_NAME = process.env.LENS_FLOW_NAME || "lens-lab-flow";
const BANK_LOOKS_LIKE = /meridian|^mb[-_]/i;

const [command = "help", ...rest] = process.argv.slice(2);
const flag = (name) => rest.includes(`--${name}`);
const option = (name, fallback = "") => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 && rest[i + 1] && !rest[i + 1].startsWith("--") ? rest[i + 1] : fallback;
};
const apply = flag("apply");

// ---------------------------------------------------------------------------
// Talking to the AWS CLI (always with an argument list, so no shell mangles JSON)
// ---------------------------------------------------------------------------
function runAws(args) {
  const bin = process.env.AWS_BIN || "aws";
  const full = [...args, "--region", region, "--output", "json"];
  const [file, argv] = bin.startsWith("node:") ? [process.execPath, [bin.slice(5), ...full]] : [bin, full];
  const out = execFileSync(file, argv, {
    encoding: "utf8",
    env: { ...process.env, AWS_PAGER: "" },
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
  return out.trim() ? JSON.parse(out) : {};
}

function aws(args) {
  try {
    return runAws(args);
  } catch (err) {
    const text = String(err.stderr || err.message || err);
    const e = new Error(text.split("\n").filter(Boolean).slice(-1)[0] || "AWS CLI failed");
    e.code = /AccessDenied|not authorized/i.test(text)
      ? "denied"
      : /ResourceNotFound|NoSuchEntity|NotFound/i.test(text)
        ? "missing"
        : /Unable to locate credentials|ExpiredToken|InvalidClientTokenId|SSO/i.test(text)
          ? "login"
          : "other";
    throw e;
  }
}

/** Run a read, but turn a failure into a short note instead of a crash. */
function tryAws(args, what) {
  try {
    return aws(args);
  } catch (err) {
    if (err.code === "login") stop("no working AWS login. Run: aws configure   (or: aws sso login)   and try again.");
    console.log(`  (could not read ${what}: ${err.code === "denied" ? "your AWS login is not allowed to" : err.message})`);
    return null;
  }
}

/** A change. Dry run by default: it prints what it would do and returns null. */
function change(label, args) {
  const shown = `aws ${args.slice(0, 2).join(" ")}`;
  if (!apply) {
    console.log(`  [dry run] would ${label}   (${shown})`);
    return null;
  }
  console.log(`  ${label} ...`);
  return aws(args);
}

/** Asks Connect WHY it refused a flow (the plain error hides the list of problems). Prints no keys. */
function explainRejection(instanceId, content) {
  const bin = process.env.AWS_BIN || "aws";
  const dir = mkdtempSync(join(tmpdir(), "lens-"));
  const file = join(dir, "flow.json");
  writeFileSync(file, content);
  const name = `lens-probe-${Date.now()}`;
  const full = ["connect", "create-contact-flow", "--instance-id", instanceId, "--name", name, "--type", "CONTACT_FLOW",
    "--content", `file://${file}`, "--region", region, "--debug"];
  const [cmd, argv] = bin.startsWith("node:") ? [process.execPath, [bin.slice(5), ...full]] : [bin, full];
  const r = spawnSync(cmd, argv, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, env: { ...process.env, AWS_PAGER: "" } });
  rmSync(dir, { recursive: true, force: true });
  const text = `${r.stderr || ""}${r.stdout || ""}`;
  const redact = (t) => t.replace(/AKIA[0-9A-Z]{12,}|ASIA[0-9A-Z]{12,}|Credential=\S+|Signature=\S+|X-Amz-\S+/g, "[removed]");
  if (r.status === 0) {
    const m = text.match(/"ContactFlowId"\s*:\s*"([^"]+)"/);
    if (m) spawnSync(cmd, bin.startsWith("node:") ? [bin.slice(5), "connect", "delete-contact-flow", "--instance-id", instanceId, "--contact-flow-id", m[1], "--region", region] : ["connect", "delete-contact-flow", "--instance-id", instanceId, "--contact-flow-id", m[1], "--region", region], { encoding: "utf8" });
    return "Connect accepted the flow this time. Run the same command again.";
  }
  const i = text.search(/"problems"/i);
  if (i < 0) return "Connect gave no list of problems.";
  const after = text.slice(i, i + 20000);
  const msgs = [...new Set([...after.matchAll(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/gi)].map((x) => x[1]))];
  return msgs.length ? msgs.map((m, n) => `${n + 1}. ${redact(m)}`).join("\n         ") : redact(after.slice(0, 1500));
}

function stop(message, code = 1) {
  console.error(`\nSTOPPED: ${message}`);
  process.exit(code);
}

const say = (s = "") => console.log(s);
const ok = (s) => say(`  OK       ${s}`);
const todo = (s) => say(`  ACTION   ${s}`);
const note = (s) => say(`  note     ${s}`);

// ---------------------------------------------------------------------------
// Which instance?
// ---------------------------------------------------------------------------
function findInstance({ forChange }) {
  let list;
  try {
    list = aws(["connect", "list-instances"]).InstanceSummaryList ?? [];
  } catch (err) {
    stop(err.code === "login" ? "no working AWS login. Run: aws configure   (or: aws sso login)   and try again." : `could not list Connect instances: ${err.message}`);
  }
  const byId = (process.env.CONNECT_INSTANCE_ID || "").trim();
  const hit = byId
    ? list.filter((i) => i.Id === byId)
    : list.filter((i) => (i.InstanceAlias || "").toLowerCase() === wantedAlias.toLowerCase());
  if (hit.length !== 1) {
    const names = list.map((i) => i.InstanceAlias || "(no alias)").join(", ") || "none";
    stop(
      `expected exactly one instance with alias "${wantedAlias}" in ${region}, found ${hit.length}. ` +
        `Instances here: ${names}. Set LENS_INSTANCE_ALIAS to the right alias, or check AWS_REGION.`,
    );
  }
  const inst = hit[0];
  if (forChange && BANK_LOOKS_LIKE.test(inst.InstanceAlias || "")) {
    stop(`"${inst.InstanceAlias}" looks like the bank instance. This lab never changes it. Use the lab instance.`);
  }
  return inst;
}

// ---------------------------------------------------------------------------
// check
// ---------------------------------------------------------------------------
function cmdCheck() {
  say(`Region ${region}. Looking for the instance with alias "${wantedAlias}" (read-only).\n`);
  const inst = findInstance({ forChange: false });
  const id = inst.Id;
  say(`Instance: ${inst.InstanceAlias}   status: ${inst.InstanceStatus}`);
  say(`Inbound calls: ${inst.InboundCallsEnabled}   Outbound calls: ${inst.OutboundCallsEnabled}\n`);

  const lens = tryAws(["connect", "describe-instance-attribute", "--instance-id", id, "--attribute-type", "CONTACT_LENS"], "the Contact Lens setting");
  if (lens) (lens.Attribute?.Value === "true" ? ok : todo)(
    lens.Attribute?.Value === "true"
      ? "Contact Lens (conversational analytics) is on for this instance"
      : "Contact Lens is OFF. In the console: Analytics tools > Enable conversational analytics > Save",
  );

  const rec = tryAws(["connect", "list-instance-storage-configs", "--instance-id", id, "--resource-type", "CALL_RECORDINGS"], "call recording storage");
  const s3 = rec?.StorageConfigs?.[0]?.S3Config;
  if (s3) ok(`Call recordings are stored in S3 (bucket ${s3.BucketName})`);
  else if (rec) todo("No call recording storage. Data storage > Call recordings must point at an S3 bucket");

  const numbers = tryAws(["connect", "list-phone-numbers-v2", "--target-arn", inst.Arn], "phone numbers");
  const nums = numbers?.ListPhoneNumbersSummaryList ?? [];
  if (nums.length) ok(`Phone number(s) claimed: ${nums.map((n) => n.PhoneNumber).join(", ")}`);
  else if (numbers) todo("No phone number. Channels > Phone numbers > Claim a number (needed to phone in)");

  const queues = tryAws(["connect", "list-queues", "--instance-id", id, "--queue-types", "STANDARD"], "queues");
  if (queues) {
    const q = (queues.QueueSummaryList ?? []).find((x) => x.Name === QUEUE_NAME);
    (q ? ok : todo)(q ? `Queue "${QUEUE_NAME}" exists` : `Queue "${QUEUE_NAME}" not created yet: run  lens queue --user YOUR_LOGIN --apply`);
  }

  const flows = tryAws(["connect", "list-contact-flows", "--instance-id", id, "--contact-flow-types", "CONTACT_FLOW"], "flows");
  if (flows) {
    const f = (flows.ContactFlowSummaryList ?? []).find((x) => x.Name === FLOW_NAME);
    (f ? ok : todo)(f ? `Flow "${FLOW_NAME}" exists` : `Flow "${FLOW_NAME}" not created yet: build it by hand (guide, Part 5) or run  lens flow --apply`);
  }

  const rules = tryAws(["connect", "list-rules", "--instance-id", id, "--event-source-name", "OnPostCallAnalysisAvailable"], "rules");
  if (rules) {
    const have = new Set((rules.RuleSummaryList ?? []).map((r) => r.Name));
    const wanted = loadCategories().map((c) => c.name);
    const missing = wanted.filter((n) => !have.has(n));
    (missing.length ? todo : ok)(
      missing.length
        ? `Categories missing: ${missing.join(", ")}. Create by hand (guide, Part 8) or run  lens categories --apply`
        : `All ${wanted.length} categories exist`,
    );
  }

  const user = option("user");
  if (user) checkUser(id, user);
  else note("Add  --user YOUR_LOGIN  to check your agent's routing profile and permissions.");
  say("\nThis only read things. Nothing was changed.");
}

function findUser(id, login) {
  const users = aws(["connect", "list-users", "--instance-id", id]).UserSummaryList ?? [];
  return users.find((u) => (u.Username || "").toLowerCase() === login.toLowerCase());
}

function checkUser(id, login) {
  say(`\nAgent "${login}":`);
  let u;
  try {
    u = findUser(id, login);
  } catch (err) {
    return note(`could not list users: ${err.message}`);
  }
  if (!u) return todo(`No user named "${login}". Users > User management > Add new users`);
  const d = tryAws(["connect", "describe-user", "--instance-id", id, "--user-id", u.Id], "the user");
  if (!d) return;
  ok("user exists");
  const profiles = d.User?.SecurityProfileIds ?? [];
  const names = new Set();
  for (const spId of profiles) {
    const perms = tryAws(["connect", "list-security-profile-permissions", "--instance-id", id, "--security-profile-id", spId], "security profile permissions");
    for (const p of perms?.Permissions ?? []) names.add(p);
  }
  const interesting = [...names].filter((p) => /search|record|transcript|analytic|lens|contact/i.test(p)).sort();
  note(`security profile permissions that look relevant: ${interesting.length ? interesting.join(", ") : "none found"}`);
  note("Needed: Contact search, conversational analytics (view), call recordings and transcripts. The Admin profile has them.");
  const rp = d.User?.RoutingProfileId;
  if (rp) {
    const q = tryAws(["connect", "list-routing-profile-queues", "--instance-id", id, "--routing-profile-id", rp], "routing profile queues");
    const has = (q?.RoutingProfileQueueConfigSummaryList ?? []).some((x) => x.QueueName === QUEUE_NAME);
    (has ? ok : todo)(has ? `routing profile includes "${QUEUE_NAME}"` : `routing profile does not include "${QUEUE_NAME}" yet`);
  }
}

// ---------------------------------------------------------------------------
// queue
// ---------------------------------------------------------------------------
function cmdQueue() {
  const login = option("user");
  if (!login) stop("add  --user YOUR_AGENT_LOGIN  (the name you sign in to Connect with).");
  const inst = findInstance({ forChange: true });
  const id = inst.Id;
  say(`Instance "${inst.InstanceAlias}". ${apply ? "Applying." : "Dry run: nothing will change. Add --apply to do it."}\n`);

  const user = findUser(id, login);
  if (!user) stop(`no user named "${login}" in this instance.`);
  const detail = aws(["connect", "describe-user", "--instance-id", id, "--user-id", user.Id]);
  const rpId = detail.User?.RoutingProfileId;
  if (!rpId) stop("that user has no routing profile.");

  let queues = aws(["connect", "list-queues", "--instance-id", id, "--queue-types", "STANDARD"]).QueueSummaryList ?? [];
  let queue = queues.find((q) => q.Name === QUEUE_NAME);
  if (queue) {
    ok(`queue "${QUEUE_NAME}" already exists`);
  } else {
    const hours = aws(["connect", "list-hours-of-operations", "--instance-id", id]).HoursOfOperationSummaryList ?? [];
    const h = hours.find((x) => /basic hours/i.test(x.Name)) ?? hours[0];
    if (!h) stop("no hours of operation found. Create one (Routing > Hours of operation) and try again.");
    const made = change(`create queue "${QUEUE_NAME}" (hours: ${h.Name})`, [
      "connect", "create-queue", "--instance-id", id, "--name", QUEUE_NAME,
      "--description", "Contact Lens practice queue", "--hours-of-operation-id", h.Id,
    ]);
    if (made) queue = { Id: made.QueueId, Name: QUEUE_NAME };
  }

  const inProfile = aws(["connect", "list-routing-profile-queues", "--instance-id", id, "--routing-profile-id", rpId]).RoutingProfileQueueConfigSummaryList ?? [];
  if (inProfile.some((q) => q.QueueName === QUEUE_NAME)) {
    ok(`"${login}"'s routing profile already includes "${QUEUE_NAME}"`);
  } else if (queue) {
    change(`add "${QUEUE_NAME}" to the routing profile of "${login}" (voice, priority 1; other queues untouched)`, [
      "connect", "associate-routing-profile-queues", "--instance-id", id, "--routing-profile-id", rpId,
      "--queue-configs", JSON.stringify([{ QueueReference: { QueueId: queue.Id, Channel: "VOICE" }, Priority: 1, Delay: 0 }]),
    ]);
  } else {
    note(`(dry run) after the queue exists, it would be added to the routing profile of "${login}".`);
  }
  say(apply ? "\nDone. Next: build the flow (guide, Part 5), or run  lens flow --apply" : "\nNothing was changed.");
}

// ---------------------------------------------------------------------------
// flow
// ---------------------------------------------------------------------------
export function buildFlow(queueArn) {
  const blocks = [];
  const add = (id, type, parameters, transitions) => blocks.push({ Identifier: id, Type: type, Parameters: parameters, Transitions: transitions });
  const err = (target, types = ["NoMatchingError"]) => types.map((t) => ({ NextAction: target, ErrorType: t }));
  const say1 = (id, text, next) => add(id, "MessageParticipant", { Text: text }, { NextAction: next, Errors: err(next), Conditions: [] });

  add("L01-Logging", "UpdateFlowLoggingBehavior", { FlowLoggingBehavior: "Enabled" }, { NextAction: "L02-Voice", Errors: [], Conditions: [] });
  add("L02-Voice", "UpdateContactTextToSpeechVoice", { TextToSpeechEngine: "Neural", TextToSpeechStyle: "None", TextToSpeechVoice: "Olivia" }, { NextAction: "L03-Welcome", Errors: [], Conditions: [] });
  say1("L03-Welcome", "Welcome to the practice line. This call is recorded and analysed for training and quality.", "L04-Analytics");
  // The one block this lab is about. Both sides must be recorded for analytics.
  add(
    "L04-Analytics",
    "UpdateContactRecordingBehavior",
    {
      RecordingBehavior: { RecordedParticipants: ["Agent", "Customer"], IVRRecordingBehavior: "Disabled" },
      AnalyticsBehavior: {
        Enabled: "True",
        AnalyticsLanguage: "en-AU",
        AnalyticsRedactionBehavior: "Disabled",
        ChannelConfiguration: { Voice: { AnalyticsModes: ["PostContact"] } },
        SentimentConfiguration: { Enabled: "True" },
        SummaryConfiguration: { SummaryModes: ["PostContact"] },
      },
    },
    { NextAction: "L05-Hold", Errors: err("L05-Hold"), Conditions: [] },
  );
  say1("L05-Hold", "Please hold while I connect you to an agent.", "L06-Queue");
  add("L06-Queue", "UpdateContactTargetQueue", { QueueId: queueArn }, { NextAction: "L07-Transfer", Errors: err("L09-Sorry"), Conditions: [] });
  add("L07-Transfer", "TransferContactToQueue", {}, {
    NextAction: "L08-End",
    Errors: [
      { NextAction: "L09-Sorry", ErrorType: "QueueAtCapacity" },
      { NextAction: "L09-Sorry", ErrorType: "NoMatchingError" },
    ],
    Conditions: [],
  });
  add("L08-End", "EndFlowExecution", {}, {});
  say1("L09-Sorry", "Sorry, we cannot connect your call right now. Please try again later.", "L10-Disconnect");
  add("L10-Disconnect", "DisconnectParticipant", {}, {});

  const metadata = {};
  blocks.forEach((b, i) => (metadata[b.Identifier] = { position: { x: 160 + (i % 5) * 280, y: 20 + Math.floor(i / 5) * 170 } }));
  return {
    Version: "2019-10-30",
    StartAction: blocks[0].Identifier,
    Metadata: { entryPointPosition: { x: 20, y: 20 }, ActionMetadata: metadata },
    Actions: blocks.map((b) => ({ ...b, Transitions: b.Transitions.NextAction === undefined && !("Errors" in b.Transitions) ? {} : b.Transitions })),
  };
}

function cmdFlow() {
  if (flag("print")) {
    // No AWS needed: this is the JSON you could paste into the flow designer's Import.
    const flow = buildFlow("REPLACE-WITH-YOUR-QUEUE-ARN");
    console.log(JSON.stringify(flow, null, 2));
    return;
  }
  const inst = findInstance({ forChange: true });
  const id = inst.Id;
  say(`Instance "${inst.InstanceAlias}". ${apply ? "Applying." : "Dry run: nothing will change. Add --apply to do it."}\n`);
  const queue = (aws(["connect", "list-queues", "--instance-id", id, "--queue-types", "STANDARD"]).QueueSummaryList ?? []).find((q) => q.Name === QUEUE_NAME);
  if (!queue) stop(`queue "${QUEUE_NAME}" does not exist yet. Run  lens queue --user YOUR_LOGIN --apply  first.`);
  const flows = aws(["connect", "list-contact-flows", "--instance-id", id, "--contact-flow-types", "CONTACT_FLOW"]).ContactFlowSummaryList ?? [];
  if (flows.some((f) => f.Name === FLOW_NAME)) {
    ok(`flow "${FLOW_NAME}" already exists. Not changed.`);
    return;
  }
  const content = JSON.stringify(buildFlow(queue.Arn));
  try {
    change(`create flow "${FLOW_NAME}" (greeting, recording + Contact Lens, queue)`, [
      "connect", "create-contact-flow", "--instance-id", id, "--name", FLOW_NAME, "--type", "CONTACT_FLOW",
      "--description", "Contact Lens practice flow", "--content", content,
    ]);
  } catch (err) {
    const why = apply ? explainRejection(id, content) : "";
    stop(
      `AWS rejected the flow (${err.message}).\n` +
        (why ? `         Connect's list of problems:\n         ${why}\n         Please send me that list.\n` : "") +
        "         That is the part of this lab that could not be tested here. Build the flow by hand instead:\n" +
        "         guide, Part 5. It is six blocks and takes about five minutes.",
    );
  }
  if (apply) say("\nDone. Open it in the console (Routing > Flows), check it, then Publish and attach your phone number to it.");
}

// ---------------------------------------------------------------------------
// categories
// ---------------------------------------------------------------------------
function loadCategories() {
  const file = new URL("../rules/categories.json", import.meta.url);
  const data = JSON.parse(readFileSync(file, "utf8"));
  return data.categories;
}

const customerOnly = { LogicOperator: "AND", Filters: [{ Type: "ParticipantRole", Data: "CUSTOMER" }] };

export function ruleFunction(category) {
  const condition = category.sentiment
    ? {
        Operator: "EQUALS",
        Operands: [category.sentiment],
        ComparisonValue: "$.ContactLens.PostCall.Sentiment.State",
        FilterClause: customerOnly,
        Negate: false,
      }
    : {
        Operator: "CONTAINS_ANY",
        Operands: category.words,
        ComparisonValue: "$.ContactLens.PostCall.ExactMatch.Transcript",
        FilterClause: customerOnly,
        Negate: false,
      };
  return { Version: "2022-11-25", RuleFunction: { Operator: "OR", Operands: [condition] } };
}

// Connect only allows letters, digits, dot, underscore and hyphen in a rule name (no spaces).
// Found on the first live run: "Billing Issue" was refused, "Complaint" was accepted.
export const ruleName = (n) => n.replace(/[^0-9a-zA-Z._-]+/g, "-").replace(/^-+|-+$/g, "");

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function cmdCategories() {
  const inst = findInstance({ forChange: true });
  const id = inst.Id;
  const withEvent = flag("eventbridge");
  say(`Instance "${inst.InstanceAlias}". ${apply ? "Applying." : "Dry run: nothing will change. Add --apply to do it."}`);
  say(`Each category also sends an EventBridge event: ${withEvent ? "yes" : "no (add --eventbridge to turn on the ServiceNow route)"}\n`);
  const existing = new Set((aws(["connect", "list-rules", "--instance-id", id, "--event-source-name", "OnPostCallAnalysisAvailable"]).RuleSummaryList ?? []).map((r) => r.Name));
  let failed = 0;
  for (const c of loadCategories()) {
    const rn = ruleName(c.name);
    if (existing.has(rn)) {
      ok(`"${rn}" already exists. Not changed.`);
      continue;
    }
    const actions = [{ ActionType: "ASSIGN_CONTACT_CATEGORY", AssignContactCategoryAction: {} }];
    if (withEvent) actions.push({ ActionType: "GENERATE_EVENTBRIDGE_EVENT", EventBridgeAction: { Name: `lens-lab-${slug(c.name)}` } });
    try {
      change(`create category "${rn}"`, [
        "connect", "create-rule", "--instance-id", id, "--name", rn,
        "--trigger-event-source", "EventSourceName=OnPostCallAnalysisAvailable",
        "--function", JSON.stringify(ruleFunction(c)),
        "--actions", JSON.stringify(actions),
        "--publish-status", "PUBLISHED",
      ]);
    } catch (err) {
      failed += 1;
      say(`  FAILED   "${rn}": ${err.message}`);
    }
  }
  if (failed) {
    say("\nAWS did not accept the rule format. That part could not be tested here.");
    say("Create the categories by hand (guide, Part 8), then run  lens rule-export  to see exactly how AWS stores one.");
    process.exit(1);
  }
  say(apply ? "\nDone. Categories apply to NEW calls only. Make a test call, then look in Contact search." : "\nNothing was changed.");
}

// ---------------------------------------------------------------------------
// rule-export
// ---------------------------------------------------------------------------
function cmdRuleExport() {
  const inst = findInstance({ forChange: false });
  const id = inst.Id;
  const list = aws(["connect", "list-rules", "--instance-id", id, "--event-source-name", "OnPostCallAnalysisAvailable"]).RuleSummaryList ?? [];
  const name = option("name");
  if (!name) {
    say(`Post-call rules in "${inst.InstanceAlias}" (${list.length}):`);
    for (const r of list) say(`  ${r.Name}   [${r.PublishStatus}]`);
    say("\nTo see one in full:  lens rule-export --name \"Complaint\"");
    return;
  }
  const r = list.find((x) => x.Name === name);
  if (!r) stop(`no post-call rule named "${name}".`);
  const d = aws(["connect", "describe-rule", "--instance-id", id, "--rule-id", r.RuleId]).Rule;
  say(JSON.stringify({ Name: d.Name, Function: d.Function, Actions: d.Actions, PublishStatus: d.PublishStatus }, null, 2));
}

// ---------------------------------------------------------------------------
// results
// ---------------------------------------------------------------------------
function cmdResults() {
  const hours = Number(option("hours", "6")) || 6;
  const inst = findInstance({ forChange: false });
  const id = inst.Id;
  const end = new Date();
  const start = new Date(end.getTime() - hours * 3600_000);
  say(`Voice calls in "${inst.InstanceAlias}" over the last ${hours} hour(s) (read-only):\n`);
  const found = tryAws([
    "connect", "search-contacts", "--instance-id", id,
    "--time-range", `Type=INITIATION_TIMESTAMP,StartTime=${start.toISOString()},EndTime=${end.toISOString()}`,
    "--search-criteria", "Channels=VOICE", "--max-results", "10",
  ], "recent contacts");
  const contacts = found?.Contacts ?? [];
  if (!contacts.length) {
    say("  No voice calls found. Make a test call (guide, Part 6), then run this again.");
    return;
  }
  const rec = tryAws(["connect", "list-instance-storage-configs", "--instance-id", id, "--resource-type", "CALL_RECORDINGS"], "call recording storage");
  const s3 = rec?.StorageConfigs?.[0]?.S3Config;
  let keys = [];
  if (s3) {
    const base = (s3.BucketPrefix || "").replace(/\/?CallRecordings\/?$/, "");
    const prefix = `${base ? `${base}/` : ""}Analysis/Voice/`;
    const listed = tryAws(["s3api", "list-objects-v2", "--bucket", s3.BucketName, "--prefix", prefix, "--max-items", "1000"], "analysis files in S3");
    keys = (listed?.Contents ?? []).map((o) => o.Key);
  }
  for (const c of contacts) {
    const hit = keys.find((k) => k.includes(c.Id));
    say(`  ${c.InitiationTimestamp}   ${c.InitiationMethod ?? ""}   contact ${c.Id}`);
    say(`      analysis file: ${hit ? "FOUND" : "not there yet"}`);
  }
  say("\nAnalysis appears only after the call ends AND the agent clicks Close contact (finishes after-call work).");
  say("Allow a few minutes. Then: Analytics and optimization > Contact search > open the contact id above.");
  note("The S3 folder name is an assumption from AWS's usual layout. If it says 'not there yet' for a long time, check Contact search anyway.");
}

// ---------------------------------------------------------------------------
const commands = { check: cmdCheck, queue: cmdQueue, flow: cmdFlow, categories: cmdCategories, "rule-export": cmdRuleExport, results: cmdResults };

if (process.argv[1] && /lens\.mjs$/.test(process.argv[1])) {
  const run = commands[command];
  if (!run) {
    console.log("Commands: check | queue --user LOGIN | flow | categories | rule-export | results");
    console.log("Changes need --apply. Without it you only see what would happen.");
    process.exit(command === "help" ? 0 : 1);
  }
  run();
}
