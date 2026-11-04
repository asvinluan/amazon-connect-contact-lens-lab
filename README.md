# Amazon Connect Contact Lens and sentiment analysis lab

[![ci](https://github.com/asvinluan/amazon-connect-contact-lens-lab/actions/workflows/ci.yml/badge.svg)](https://github.com/asvinluan/amazon-connect-contact-lens-lab/actions/workflows/ci.yml)

**Lab work.** A small, console-first lab in my own AWS account, on my own lab Amazon Connect instance. Not employer work. Calls and customers are made up.

**What it teaches:** turn on conversational analytics (Contact Lens), take a test call, then find the transcript, sentiment timeline, speaker separation, recording, summary and categories in Contact search. Then see how those signals could open ServiceNow tickets.

```text
mobile phone -> Connect number -> lens-lab-flow (record + analytics on)
   -> lens-lab-queue -> agent answers in the CCP -> hang up, close contact
   -> Analytics and optimization > Contact search
      transcript | sentiment | speakers | recording | summary | categories
```

## Start here

1. `docs/LAB-GUIDE.md` : the plain-English guide (by-hand console steps).
2. `docs/FAKE-CALLS.md` : five role-play scripts, one per category.
3. `docs/SERVICENOW-IDEAS.md` : Contact Lens signal to ServiceNow action (design).
4. `docs/RUNBOOK-POWERSHELL.md` or `docs/RUNBOOK-BASH.md` : the optional helper commands.

## The helper (optional)

`scripts/lens.ps1` (PowerShell) or `scripts/lens.sh` (Git Bash). Needs Node 22+ and the AWS CLI.

|Command|What it does|
|-|-|
|`check [--user LOGIN]`|Read-only checks of the instance|
|`queue --user LOGIN`|Create `lens-lab-queue`, add it to your routing profile|
|`flow`|Create `lens-lab-flow` (or `--print` the JSON)|
|`categories [--eventbridge] [--realtime]`|Create the six category rules (`--realtime`: the three `Live-` rules that match during a call)|
|`rule-export [--realtime] --name N`|Show how AWS stored a rule|
|`results [--hours N]`|List recent analysed calls|

Safety: changes are a dry run until `--apply`; only the instance whose alias you set in `LENS_INSTANCE_ALIAS` is used; it refuses an instance that looks like the bank's; it never stores account or instance ids.

## Tested, and not tested

* Tested offline: the helper's logic against a pretend AWS (`node scripts/selftest.mjs`), script syntax, ShellCheck, a secret scan. CI runs these on every push.
* **Proven live (30 Oct 2026, own lab Amazon Connect instance, own mobile as the caller):** the generated flow was accepted by Amazon Connect; calls were recorded and transcribed with per-line sentiment; all six category rules were created through the helper and all six matched on test calls (Complaint, Escalation, Billing-Issue, Technical-Issue, Refund-Request, and Negative-Sentiment on a deliberately angry one-sided call); on a second run with a separate agent microphone (31 Oct 2026) the transcript labelled Agent and Customer separately and Contact Lens produced an AI-generated call summary that matched the call.
* **What the live run taught (all fixed in the helper):** the instance had no call recording storage, so the first five calls were not recorded (the helper now stops and says so); Connect rule names cannot contain spaces, so categories are `Billing-Issue` not `Billing Issue`; the agent user needs the queue in its routing profile; and Agent/Customer labels and summaries need the agent's voice to arrive through the CCP microphone (a summary needs at least one spoken line from each side), not read into the customer's phone.
* **Real-time analytics (31 Oct 2026):** switched on by hand in the flow block (Real-time and post-contact analytics). A second Connect user watching the live call in Monitoring mode (Connect does not let you monitor your own call) saw a live transcript with Agent and Customer lines. The generated flow in this repo is still post-call only.
* **Observed, as seen:** redaction was on in the hand-built flow; post-call transcripts showed `[PII]` and the live view showed a name unmasked.
* **Built, not yet run live:** live (real-time) category rules (`lens categories --realtime`), and the Contact Lens to ServiceNow route, whose Lambda lives in `amazon-connect-servicenow-service-desk` (unit-tested against a fake ServiceNow).
* **Not proven:** that live categories match during a call, and the route on a real call. Speech recognition made errors on a few words, so transcripts are good enough for categories and sentiment, not word-perfect.

## Cost

Conversational analytics for voice is billed per minute (about 0.015 USD in AWS's published first tier at the time of writing; check the pricing page). Telephony and S3 are extra. Set an AWS Budget alarm. Stop calling to stop the charge.

## Related labs

* `amazon-connect-servicenow-service-desk` : Connect + Lambda + ServiceNow incidents. It also holds the Lambda that turns a matched Contact Lens rule into a ServiceNow note or incident (build in that repo, `docs/SESSION-*.md` for the live run).
* `aws-enterprise-bank-servicenow-lab` : bank scenario with ServiceNow.
* `amazon-connect-lab`, `aws-enterprise-bank-lab` : the base labs.

## Rules for this repo

No account ids, instance ids, tokens or ServiceNow instance names. `scripts/check-offline.*` scans for them.

Licence: see `LICENSE`.
