# Solar Cold Email Sequence

Built to work with the landing page at `/solar-speed-to-lead.html` (link: `https://damirbuilds.com/solar-speed-to-lead`). Three short emails, all pointing to the same page and the same offer, a free 15-minute speed-to-lead audit call.

**Revised for higher conversions** (v2): subject lines are now question/curiosity-driven instead of descriptive, the email 1 opener leads with a direct question instead of "Quick one," and a light P.S. was added to email 1 to nudge replies (even a "not now" is a reply, and replies keep deliverability healthy). Bodies stay under ~90 words, same reasoning as before: solar owners get a lot of cold email, the ones that get read look like a text from a person, not a mail-merged pitch.

**Variables use Smartlead's actual syntax** ([Smartlead Help Center](https://helpcenter.smartlead.ai/en/articles/159-what-are-variables-and-how-to-use-them-effectively-to-personalize-emails-on-smartlead)):
- `{{first_name}}` and `{{company_name}}` pull straight from your lead list columns. Case-sensitive in Smartlead, keep them lowercase with underscores exactly as written here.
- `%signature%` pulls whatever signature is configured on the sending mailbox, every email signs off with `%signature%` instead of a hardcoded name.

**Other format notes for Smartlead:**
- Plain text, no images, no HTML template.
- Smartlead's unsubscribe footer handles CAN-SPAM opt-out automatically, don't strip it.
- Each email has 2 subject lines to A/B test, don't send both to the same contact.
- Suggested spacing: day 1, day 4, day 8. Stop the sequence automatically for anyone who replies, books, or opts out.

Angle stays deliberately different from the roofing sequence: roofing is a speed problem (first responder wins), solar is a follow-up problem (long consideration window, quotes go quiet). Don't reuse the roofing copy for solar leads, the pain point doesn't match and it'll read as generic.

---

## Email 1 — The pain (day 1)

**Subject A:** the quotes {{company_name}} already paid for
**Subject B:** what's your average solar sales cycle?

**Body:**

Hey {{first_name}},

Genuine question: out of the quotes {{company_name}} sends out, how many go quiet before the homeowner signs?

Solar's a slow decision, financing, family, comparing bids. Most installers follow up once or twice, then move on. The ones who stay in the inbox for weeks are the ones who win the deal later, when the homeowner's finally ready.

I build the system that does that follow-up automatically.

Worth 15 minutes to see if it'd help {{company_name}}? https://damirbuilds.com/solar-speed-to-lead

%signature%

P.S. Even a quick "not right now" is useful, tells me whether to check back later or leave you alone.

---

## Email 2 — The proof (day 4)

**Subject A:** quiet doesn't mean dead
**Subject B:** why the second follow-up isn't enough

**Body:**

{{first_name}}, one thing worth knowing.

A homeowner who stops replying after a quote is usually still deciding, not gone. The deal typically goes to whoever's still showing up in their inbox when they're finally ready, not whoever quoted first.

What I build follows up automatically for weeks after every quote, so nothing slips through because staff got busy or moved on to the next lead.

How it works, and a spot to grab 15 minutes: https://damirbuilds.com/solar-speed-to-lead

%signature%

---

## Email 3 — The breakup (day 8)

**Subject A:** should I close this out?
**Subject B:** last one, promise

**Body:**

{{first_name}}, keeping this short.

Reached out twice about automating follow-up on {{company_name}}'s open quotes. No worries if it's not a priority right now.

If timing was just off, the offer's still open: https://damirbuilds.com/solar-speed-to-lead

If not, just say the word and I'll stop here.

%signature%
