# From Contact Lens to ServiceNow: the design

**Built, unit-tested and run on a real call (5 Nov 2026).** The first half (Contact Lens finds the signal and names it) is built and was run live in this lab. The second half (a Lambda that writes the ServiceNow record) is now code in the service desk lab (`amazon-connect-servicenow-service-desk`: the `handleLensRule` function, the EventBridge rule in Terraform behind `lens_route_enabled`, and 12 unit tests against a fake ServiceNow). The service desk lab (`amazon-connect-servicenow-service-desk`) already has a Lambda that writes ServiceNow incidents and requests during a call; this design reuses that idea after the call.

## The flow from my notes

```text
Customer calls
  -> Contact Lens listens (post-call analytics)
  -> Negative sentiment detected
  -> Category = Complaint
  -> Amazon EventBridge (event: a rule matched)
  -> Lambda
  -> Create ServiceNow incident
```

> In plain English: Connect writes down the call, labels it "Complaint", and shouts "a Complaint rule matched". EventBridge hears the shout and wakes a small program. The program opens a ticket in ServiceNow.

## The mapping: each Contact Lens signal to a ServiceNow outcome

|Contact Lens signal|ServiceNow outcome|How in Connect|Status|
|-|-|-|-|
|Negative sentiment|Create incident|Rule "Negative-Sentiment" + EventBridge action + Lambda|Run live 5 Nov 2026: opened an incident on a real angry call|
|Escalation request|Create case (CSM)|Rule "Escalation" + EventBridge + Lambda|Category built; Lambda opens an incident today (a CSM case is designed)|
|Compliance risk|Create task|Rule on words like "legal", "lawyer", "ombudsman" + task action|Designed (add the words to `rules/categories.json`)|
|AI summary|Fill the work notes|Lambda reads the summary from the analysis output and writes it to the ticket|Designed|
|Customer complaint|Route to the CSM team|Rule "Complaint" + Lambda sets the assignment group|Category built; routing designed|
|Call category|Drive assignment rules|Lambda copies the category into a ServiceNow field; ServiceNow assignment rules do the rest|Designed|

Two design points I found while checking AWS's documentation:

1. **The EventBridge event has no customer phone number.** It carries the rule name, action name, and the instance, contact, agent and queue ARNs. A Lambda must call `DescribeContact` (and Contact Lens data in S3) to get the caller number, the summary and the transcript. Do not promise "the ticket has the caller's details" unless that step is built.
2. **Amazon Connect has its own Cases and Tasks.** Rules can create a Connect case or task directly, with no ServiceNow. That is the simple option if ServiceNow is not needed. ServiceNow adds the enterprise route: assignment groups, SLAs, reporting.

## What is already built

* `rules/categories.json`: the words and the sentiment rule.
* `lens categories --eventbridge`: adds a "send an event" action to each rule.
* `examples/eventbridge-pattern.json`: the pattern an EventBridge rule uses to catch the events for Complaint, Escalation and Negative Sentiment. The detail-type is `conversational analytics Post Call Rules Matched`.

## What is built now (service desk lab)

1. An EventBridge rule on the default bus (off by default; `lens_route_enabled = true`). The pattern lists both event names AWS documents, because the two AWS pages disagree.
2. The same Lambda that serves the phone flow handles the event: it reads the contact id from `contactArn`, checks the rule name against an allow list, then notes the call's existing ticket or opens an incident (safe to repeat: the contact id is stored on the ticket).
3. It reuses the service desk lab's secret, retries, alarms and audit trail.
4. The ticket holds only the rule name, when it matched and the contact id: no transcript, no caller details.

## Still design only

* Calling `DescribeContact` to add the caller number, summary or transcript to the ticket (the event has none of them).
* Assignment groups, a CSM case for Escalation, and a dead-letter queue.
* Which event name Amazon Connect really sends. The first live run records it (`lens event received` in the audit trail).

## Interview version (30 seconds)

"Contact Lens turns a recorded call into a transcript, sentiment and categories. A rule marks a call as a complaint and emits an EventBridge event. A Lambda picks it up, asks Connect for the contact details and summary, and opens a ServiceNow incident assigned to the right team. I built the analytics side in a lab and designed the ticket side on top of my service desk lab."
