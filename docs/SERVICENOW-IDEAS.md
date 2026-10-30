# From Contact Lens to ServiceNow: the design

**Design only.** The first half (Contact Lens finds the signal and names it) is built in this lab. The second half (a Lambda that writes the ServiceNow record) is a design. The service desk lab (`amazon-connect-servicenow-service-desk`) already has a Lambda that writes ServiceNow incidents and requests during a call; this design reuses that idea after the call.

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
|Negative sentiment|Create incident|Rule "Negative Sentiment" + EventBridge action + Lambda|Category built; Lambda designed|
|Escalation request|Create case (CSM)|Rule "Escalation" + EventBridge + Lambda|Category built; Lambda designed|
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

## What a build would add (not done)

1. An EventBridge rule on the default bus with the pattern file.
2. A target Lambda: take `contactArn`, call `DescribeContact`, read the summary, call the ServiceNow Table API as the service desk lab does (OAuth secret in Secrets Manager, never in code).
3. A dead-letter queue and an alarm, as in the service desk lab.
4. Keep tickets free of sensitive speech: turn on redaction, and write only what the ticket needs.

## Interview version (30 seconds)

"Contact Lens turns a recorded call into a transcript, sentiment and categories. A rule marks a call as a complaint and emits an EventBridge event. A Lambda picks it up, asks Connect for the contact details and summary, and opens a ServiceNow incident assigned to the right team. I built the analytics side in a lab and designed the ticket side on top of my service desk lab."
