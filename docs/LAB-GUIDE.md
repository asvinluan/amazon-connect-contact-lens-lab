# Contact Lens and sentiment analysis lab: guide

**Lab work.** Built in my own AWS account, on my own lab Amazon Connect instance. The Meridian Bank instance is not touched: AWS allows only two instances and the bank one stays as it is. Calls and customers are made up.

**Goal.** Be able to say, truthfully and with proof, "I turned on conversational analytics in Amazon Connect, took a call, and found its transcript, sentiment, summary and categories." This closes the Contact Lens gap for an Amazon Connect lead role.

> **Plain-English box.** Lines that start with "In plain English" are the easy version.

---

## Why a new lab and not an update

I looked at the options and chose a **new, small lab** (`amazon-connect-contact-lens-lab`).

* It needs no Lambda, no ServiceNow and no Terraform. The older labs do. Mixing them would make a 10-minute exercise into an hour.
* It uses a different instance from the bank lab, so it must not live inside the bank lab's Terraform.
* It is easy to repeat: queue, flow, call, look.

The ServiceNow ideas from my notes are kept, as a **design** (`SERVICENOW-IDEAS.md`) that builds on this lab and on the service desk lab.

## Part 0. Words you need

|Word|Plain English|
|-|-|
|Contact Lens|Amazon Connect's feature that listens to a recorded call afterwards and writes down what happened. AWS now also calls it "conversational analytics".|
|Transcript|The call as text, with who said what and when.|
|Speaker separation|Agent and customer are labelled separately in the transcript.|
|Sentiment|Positive, neutral or negative, scored for each speaker. The scale is -5 (most negative) to +5 (most positive).|
|Category|A label put on a call when it matches a rule, for example "Refund Request" when the customer says "refund".|
|Post-call analytics|The analysis is done after the call ends and the agent finishes after-call work. This lab uses it. It is the cheaper mode.|
|Real-time analytics|The analysis runs during the call, so a supervisor could watch. It costs more. Optional.|
|Contact search|The page where you find a past call: Analytics and optimization > Contact search.|

## Part 1. What you will build

```text
Your mobile phone -> claimed Connect number -> lens-lab-flow
   1 greeting (says the call is recorded)
   2 Set recording and analytics behavior  (record both sides, analytics on,
                                            sentiment on, English Australia)
   3 send to the queue  lens-lab-queue
   -> you answer in the CCP in your browser (you are the agent)
   -> hang up, close the contact
   -> Analytics and optimization > Contact search > the call
        transcript, sentiment, recording, summary, categories
```

> In plain English: you phone your own call centre, answer yourself, have a pretend argument, and then read what Connect wrote down about it.

## Part 2. Before you start

Tick these off. The next part checks most of them for you.

* A lab Connect instance (your own) with **a claimed phone number** (Channels > Phone numbers). Without a number you cannot phone in.
* **Call recordings stored in S3** (Data storage > Call recordings). It is on by default for a new instance.
* **Conversational analytics enabled** on the instance. AWS says it is on by default for new instances. If it is off: Analytics tools > Enable conversational analytics > Save.
* You are a user with the **Admin** security profile (it already has Contact search and the analytics permissions).
* A headset. Without one, your laptop speaker and microphone will feed back into the phone call.
* The tools from the runbook (Node and the AWS CLI), only if you use the helper scripts.

**Region and language.** AWS lists English (Australia) as supported for post-call analytics, real-time analytics, sentiment, redaction and summaries, and lists Asia Pacific (Sydney) as having post-call analytics, real-time analytics, generative AI summaries and categorisation. This lab uses `en-AU` in Sydney.

**Cost.** Recording the call and recording both sides has no extra charge. Conversational analytics for voice is billed per minute: AWS's pricing page lists 0.015 USD per minute in the first tier, and says post-contact summaries are included in that price. Telephony (the phone call itself) and S3 storage are extra, and AWS says a free trial exists for first-time conversational analytics customers. Check the pricing page for today's numbers, and set an AWS Budget alarm first. A 5-minute test call should cost cents.

## Part 3. Check your instance (read-only)

Run the helper. It only reads.

PowerShell: `.\scripts\lens.ps1 check --user YOUR_LOGIN`
Git Bash: `./scripts/lens.sh check --user YOUR_LOGIN`

`YOUR_LOGIN` is the name you sign in to Connect with. You should see lines starting `OK` or `ACTION`. Fix every `ACTION` line before going on. If AWS blocks the helper, do the same checks by hand in the console using the list in Part 2.

## Part 4. Queue and agent

**By hand (console).**

1. Routing > Queues > Add new queue. Name `lens-lab-queue`. Hours of operation: Basic Hours. Save.
2. Users > Routing profiles. Open the profile your own agent user has. Add the queue `lens-lab-queue` with channel **Voice**. Save.
3. Users > User management. Open your own user and confirm it has that routing profile and the Admin security profile.

**Or with the helper.** It adds the queue to your *existing* routing profile and leaves the other queues alone. It is a dry run until you add `--apply`.

PowerShell: `.\scripts\lens.ps1 queue --user YOUR_LOGIN` then the same with `--apply`
Git Bash: `./scripts/lens.sh queue --user YOUR_LOGIN` then the same with `--apply`

> In plain English: make a waiting room for the calls, and let yourself be the person who answers them.

## Part 5. The simple flow (six blocks)

**By hand (this is the safe way, about five minutes).**

1. Routing > Flows > Create flow. Name it `lens-lab-flow`.
2. Add **Play prompt** (or Message participant): "Welcome to the practice line. This call is recorded and analysed for training and quality." The recording notice is not optional: tell callers.
3. Add **Set recording and analytics behavior** (newer consoles may call it **Set recording, analytics and processing behavior**).
   * Voice: call recording **On**, **Agent and Customer**. Both sides are required for analytics.
   * Analytics: **Enable conversational analytics** and **Enable speech analytics**. Choose **Post-call analytics**.
   * Language: **English (Australia)**.
   * Sentiment: **on**. Generative AI summary: **on** if the box is there.
   * Redaction: off for this lab (nothing real is said).
4. Add **Set working queue**: choose `lens-lab-queue`.
5. Add **Transfer to queue**. Connect the error branches to a **Play prompt** ("Sorry, we cannot connect you") then **Disconnect**.
6. Connect the blocks in this order: Welcome > Set recording and analytics > Set working queue > Transfer to queue. Save, then **Publish**.

Keep the analytics block **before** the call reaches the queue. A later block of the same kind overwrites an earlier one.

**Or with the helper (untested against real AWS).** It builds the same flow and asks AWS to create it. If AWS rejects it, the helper says so and you use the hand steps above. `flow --print` writes the JSON so you could use the flow designer's Import instead.

PowerShell: `.\scripts\lens.ps1 flow` then the same with `--apply`
Git Bash: `./scripts/lens.sh flow` then the same with `--apply`

**Attach the number.** Channels > Phone numbers > your number > Contact flow: `lens-lab-flow` > Save. (Careful: this replaces whatever that number does now. Use a number you do not need for another lab, or change it back afterwards.)

## Part 6. Make the call

1. Open the CCP (the phone icon at the top right of the Connect admin website, or `https://YOUR-ALIAS.my.connect.aws/ccp-v2/`). Allow the browser to use your microphone. Put on the headset.
2. Set your status to **Available**.
3. From your mobile, phone the claimed number. You should hear the welcome message, then the CCP rings.
4. **Accept** the call in the CCP.
5. Have the fake conversation. `FAKE-CALLS.md` has five short scripts. Say the key words clearly, in whole sentences. Speak for at least a minute so there is something to analyse.
6. Hang up from the mobile.
7. In the CCP the call goes into after-call work. Click **Close contact** (or Clear). **Analysis starts only after you close the contact.**

## Part 7. Look at the results (this is where the magic happens)

Wait about five to ten minutes, then:

1. Analytics and optimization > **Contact search**.
2. Set the date range to today and the channel to Voice. Search.
3. Click the **Contact ID** of your call.

You should see, on the contact details page:

|You should see|Where|
|-|-|
|Call recording (a player)|Recording section|
|Transcript|Transcript section, with timestamps; click one to jump in the recording|
|Speaker separation|Each line labelled Agent or Customer|
|Sentiment|A face or colour beside each turn, plus an overall score for each speaker|
|Conversation summary|A generated summary of the call, if summaries are on|
|Categories|Labels such as Complaint, once Part 8 is done and the call is made *after* the rules exist|

If nothing appears after fifteen minutes, run `lens results` (read-only). It lists recent calls and whether an analysis file has been written, then see the troubleshooting table.

## Part 8. Categories

Categories apply to **new calls only**. Create them first, then make the test calls.

|Category|Matches when the customer says (any of)|
|-|-|
|Complaint|complaint, complain, not happy, unacceptable, disappointed, terrible|
|Escalation|speak to a manager, supervisor, escalate, your manager, someone senior|
|Billing Issue|bill, invoice, charged twice, overcharged, wrong amount|
|Technical Issue|not working, error message, cannot log in, crashed, outage, internet is down|
|Refund Request|refund, money back, reimburse, reimbursement|
|Negative Sentiment|the customer's overall sentiment is negative|

**By hand (console).** Analytics and optimization > Rules > Create rule. Choose the conversational analytics, **post-call** trigger. Add a condition on **words or phrases** spoken by the **customer** (or, for the last one, **sentiment: negative** for the customer). Action: **Assign contact category**, with the category name from the table. Save and publish. Repeat for each. (AWS renames menus now and then; look for the words rule, post-call and category.)

**Or with the helper (untested against real AWS).** Dry run first, then `--apply`. Add `--eventbridge` if you want each category to also send an event, for the ServiceNow route in `SERVICENOW-IDEAS.md`.

PowerShell: `.\scripts\lens.ps1 categories` then the same with `--apply`
Git Bash: `./scripts/lens.sh categories` then the same with `--apply`

If AWS refuses the rule format, create one rule by hand and run `lens rule-export --name "Complaint"`. It prints exactly how AWS stored it, and the format in `scripts/lens.mjs` can be fixed from that.

Honest note: in the AWS API a category takes its name from the **rule name**. I could not confirm this against a live account. After creating them, open Contact search > Add filter > Contact category and check the names show up.

## Part 9. Your five questions, answered

**How do I find a transcript?** Analytics and optimization > Contact search > open the contact ID > Transcript section. You need the Contact search and conversational analytics permissions, and the contact must have been analysed (call ended, contact closed).

**How do I identify negative calls?** In Contact search add a **sentiment** filter: pick Customer, type of analysis "Sentiment score", and "less than or equal to" -1. Or filter by the **Negative Sentiment** category from Part 8. The overall score is -5 to +5.

**How do I create categories?** Part 8: a rule with a post-call trigger, a condition on words or sentiment, and the action Assign contact category.

**How do I search for conversations by category?** Contact search > Add filter > **Contact category** > choose one or more > Match any, Match all or Match none.

**How do I view sentiment trends during a call?** Two meanings.
* *Inside one finished call:* the transcript shows sentiment turn by turn, and the sentiment **shift** filter finds calls where the customer started negative and ended positive (or the reverse).
* *Live, while the call is happening:* needs **real-time analytics** switched on in the flow block (Part 5 uses post-call to keep cost down) and a supervisor watching. Try it later by choosing real-time in the block.
* *Over time, across many calls:* the analytics dashboards (Sydney lists them as available).

## Part 10. From insight to action (ServiceNow)

Categories become useful when they do something: a complaint opens a ticket, an escalation alerts someone. `SERVICENOW-IDEAS.md` maps each Contact Lens signal to a ServiceNow action and says which parts are built (the categories and the event) and which are only designed (the Lambda that writes the ticket).

## Part 11. What to say, and what not to say

Only after you have seen the transcript, sentiment and a category on **your own** call, you can truthfully say: "Configured Amazon Connect conversational analytics in a lab instance: call recording, post-call transcripts, sentiment, summaries and rule-based categories, and searched calls by category and sentiment." Keep it labelled "lab". Do not put it under an employer's job entry, and do not claim an AWS certification you do not hold. Before the live proof, say "built and tested offline, not yet run live".

## Part 12. Cost and cleanup

* Stop making test calls and the analytics charge stops. Recordings and analysis files stay in S3 and cost cents; delete old ones if you wish (in the console, S3, under the instance's bucket).
* To stop analysing, edit `lens-lab-flow` and turn analytics off, or unpublish the categories (Rules).
* Release the phone number if you do not need it (it is billed monthly). Or point it back at its old flow.
* The queue stays; it costs nothing.

## Part 13. Limits and what is NOT proven

* **Not run live.** Everything in the helper script was tested against a pretend AWS (it proves the logic, not that AWS accepts the JSON). The flow JSON and the category rule JSON in particular have not been sent to real AWS. The by-hand steps are the dependable path.
* The console menu names come from AWS's documentation and may be renamed.
* Real-time analytics is not set up.
* Sentiment trends across many calls need dashboards or data work that this lab does not do.
* The ServiceNow part is a design, not code.

## Part 14. Troubleshooting

|Symptom|Likely cause|Fix|
|-|-|-|
|No transcript or sentiment after 15 minutes|The agent did not close the contact|Close the contact in the CCP, wait, check again|
|Same|Analytics block missing, after the queue, or turned off by a later block|Part 5: the block must come before the queue; no later block that turns it off|
|Same|Only one side recorded|Recording must be **Agent and Customer**|
|Same|Contact Lens off on the instance|Analytics tools > Enable conversational analytics|
|Contact search shows nothing|Wrong date, channel or permission|Date today, channel Voice; you need Contact search permission|
|Categories empty|Rules created after the call|Rules apply to new calls only; call again|
|Category not matching|Customer said different words|Edit the words; say the key word clearly|
|Calls do not reach the CCP|Status not Available, or queue not in your routing profile|Set Available; Part 4|
|`lens` says no AWS login|CLI not signed in|`aws configure` or `aws sso login`|
|`lens` says found 0 instances|Alias or region differs|Set `LENS_INSTANCE_ALIAS` or `AWS_REGION`|
|`lens` refuses to change an instance|Its alias looks like the bank's|By design. Use the lab instance|

## Part 15. Files

|Path|What it is|
|-|-|
|`docs/LAB-GUIDE.md`|This guide|
|`docs/FAKE-CALLS.md`|Five role-play scripts|
|`docs/SERVICENOW-IDEAS.md`|The ServiceNow design|
|`docs/RUNBOOK-POWERSHELL.md`, `docs/RUNBOOK-BASH.md`|Helper commands, one for each shell|
|`scripts/lens.mjs`, `lens.ps1`, `lens.sh`|The helper: check, queue, flow, categories, rule-export, results|
|`scripts/selftest.mjs`, `check-offline.*`|Offline tests with a pretend AWS|
|`rules/categories.json`|The category words, editable|
|`examples/eventbridge-pattern.json`|The EventBridge pattern for the ServiceNow route|
