# Amazon Connect Contact Lens and sentiment analysis lab

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
|`categories [--eventbridge]`|Create the six category rules|
|`rule-export --name N`|Show how AWS stored a rule|
|`results [--hours N]`|List recent analysed calls|

Safety: changes are a dry run until `--apply`; only the instance whose alias is `asvinluan-connect-lab` is used (override with `LENS_INSTANCE_ALIAS`); it refuses an instance that looks like the bank's; it never stores account or instance ids.

## Tested, and not tested

* Tested: the helper's logic against a pretend AWS (`node scripts/selftest.mjs`), script syntax, ShellCheck, a secret scan.
* **Not tested against real AWS:** the flow JSON, the rule JSON, category naming and the S3 path `results` reads. If AWS refuses one, use the by-hand steps.
* Not built: real-time analytics, the ServiceNow Lambda (design only).

## Cost

Conversational analytics for voice is billed per minute (about 0.015 USD in AWS's published first tier at the time of writing; check the pricing page). Telephony and S3 are extra. Set an AWS Budget alarm. Stop calling to stop the charge.

## Related labs

* `amazon-connect-servicenow-service-desk` : Connect + Lambda + ServiceNow incidents.
* `aws-enterprise-bank-servicenow-lab` : bank scenario with ServiceNow.
* `amazon-connect-lab`, `aws-enterprise-bank-lab` : the base labs.

## Rules for this repo

No account ids, instance ids, tokens or ServiceNow instance names. `scripts/check-offline.*` scans for them.

Licence: see `LICENSE`.
