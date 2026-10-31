# Fake customer calls: seven role-play scripts

Use these in Part 6 of the guide. You are the customer on your mobile phone and the agent in the CCP (use a headset). Speak naturally and in whole sentences; read slowly. Each call is about one to two minutes. The words in **bold** are the ones the categories listen for.

Make **one call per category** so you can test the filters. Between scripts, close the contact in the CCP.

---

## Call 1. Complaint + negative sentiment

**Customer:** Hello. I want to make a **complaint**. I am **not happy** at all. This is **unacceptable**.
**Agent:** I am sorry to hear that. Can you tell me what happened?
**Customer:** I waited three weeks for my order and nobody told me anything. I am really **disappointed** and frustrated.
**Agent:** I understand, and I apologise. Let me find your order now.
**Customer:** Thank you. That would help. I just want it sorted.
**Agent:** I have found it, and I will make sure it ships today.
**Customer:** Okay. Thanks for your help.

*Expect:* Complaint. (Negative-Sentiment fires only when the customer's overall sentiment is negative: see Call 6.)

## Call 2. Escalation

**Customer:** Hi. I have called twice already and nothing has changed. I want to **speak to a manager**.
**Agent:** I can help. Can I ask what the problem is first?
**Customer:** No. I need a **supervisor**. I will **escalate** this if I have to.
**Agent:** Understood. I will note it and ask a supervisor to call you back today.
**Customer:** Fine. Please do that.

*Expect:* Escalation (Negative-Sentiment only if the call stays angry).

## Call 3. Billing issue

**Customer:** Hello. My **bill** this month looks wrong. I think I was **charged twice**.
**Agent:** Let me check your account. Which month is it?
**Customer:** This month. The **invoice** shows the same amount two times, so I was **overcharged**.
**Agent:** You are right. I can see two charges. I will reverse one.
**Customer:** Great, thank you very much.

*Expect:* Billing-Issue. Sentiment should end positive, which makes a good sentiment shift to search for.

## Call 4. Technical issue

**Customer:** Hi. My service is **not working**. I get an **error message** every time I try to **log in**. Actually I **cannot log in** at all.
**Agent:** I am sorry. Let me look. Have you tried resetting the password?
**Customer:** Yes. It **crashed** again after that. Our **internet is down** too, I think.
**Agent:** Thank you. I am raising a technical ticket now.
**Customer:** Thanks. Please be quick.

*Expect:* Technical-Issue.

## Call 5. Refund request

**Customer:** Hello. I would like a **refund** for my last order. It arrived broken.
**Agent:** I am sorry about that. I can arrange that.
**Customer:** I want my **money back**, please. I do not want a replacement.
**Agent:** No problem. I will process the refund today.
**Customer:** Thank you. That is all I needed.

*Expect:* Refund-Request.

---

## Tips

* Say the key words exactly as written. The rules match exact words in what the **customer** says, not the agent.
* A quiet line or mumbling hurts the transcript. Use a headset.
* Speak for at least a minute; very short calls may give thin results.
* Never say real personal details, card numbers or passwords on these calls.

---

## Call 6. Negative sentiment (angry from start to finish)

This one proves the Negative-Sentiment category. The customer stays angry the whole call, with no polite lines and no agent replies.

**Customer:** This is the worst service I have ever had. I am furious. Nobody has fixed anything and I am sick of it. This is absolutely terrible and I want this sorted now.

*Expect:* Complaint and Negative-Sentiment. (Result on 30 Oct 2026: both appeared.)

**Tip for speakers:** to get Agent and Customer labelled separately and a call summary, say the agent lines into the CCP's computer microphone (headset) and the customer lines into your phone, held to your ear, not on speaker. Never read the words "Agent" or "Customer" aloud. If one person says both into the phone, every line is labelled Customer and the summary says "not enough eligible conversation" (AWS needs at least one spoken line from each side).

---

## Call 7. Speaker labels and summary (about 2 minutes)

Say only the sentences, never the speaker names. Customer lines go into the phone, agent lines into the computer.

Customer: Hello, I am calling about my internet. It has not been working since yesterday morning.
Agent: I am sorry to hear that. Can I take your name and the address on the account?
Customer: Yes, it is Sam Taylor, and the address is 12 Example Street.
Agent: Thank you, Sam. I can see an outage in your area. Have you tried restarting the modem?
Customer: Yes, twice. The light stays red and I get an error message when I try to log in.
Agent: Understood. I will raise a fault for you now and book a technician for tomorrow morning.
Customer: Okay. I was also charged twice on my last bill. Can you look at that?
Agent: Yes, I can see the duplicate charge. I will arrange a refund for it today.
Customer: That is great, thank you. I am much happier now.
Agent: You are welcome, Sam. Is there anything else I can help with?
Customer: No, that is all. Thanks for your help.

*Expect:* lines labelled Agent and Customer, an AI-generated summary, and Technical-Issue, Billing-Issue and Refund-Request. (Result on 31 Oct 2026: all appeared.)
