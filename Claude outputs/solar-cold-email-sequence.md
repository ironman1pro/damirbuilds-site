# Solar Cold Email Sequence

Built to work with the landing page at `/solar-speed-to-lead.html` (link: `https://damirbuilds.com/solar-speed-to-lead`). Three short emails, all pointing to the same page and the same offer, a free 15-minute speed-to-lead audit call.

Kept deliberately short, same reasoning as the roofing sequence: solar business owners get a lot of cold email, the ones that get read look like a text from a person, not a mail-merged pitch. Every email here is under 90 words, one idea, one link, no filler.

**Variables use Smartlead's actual syntax** ([Smartlead Help Center](https://helpcenter.smartlead.ai/en/articles/159-what-are-variables-and-how-to-use-them-effectively-to-personalize-emails-on-smartlead)):
- `{{first_name}}` and `{{company_name}}` pull straight from your lead list columns. Case-sensitive in Smartlead, keep them lowercase with underscores exactly as written here.
- `%signature%` pulls whatever signature is configured on the sending mailbox, every email signs off with `%signature%` instead of a hardcoded name.

**Other format notes for Smartlead:**
- Plain text, no images, no HTML template.
- Smartlead's unsubscribe footer handles CAN-SPAM opt-out automatically, don't strip it.
- Each email has 2 subject lines to A/B test, don't send both to the same contact.
- Suggested spacing: day 1, day 4, day 8. Stop the sequence automatically for anyone who replies, books, or opts out.

Note the angle is different from the roofing sequence on purpose: roofing is a speed problem (first responder wins), solar is a follow-up problem (long consideration window, quotes go quiet). Don't reuse the roofing copy for solar leads, the pain point doesn't match and it'll read as generic.

---

## Email 1 — The pain (day 1)

**Subject A:** quick question about {{company_name}}'s quotes
**Subject B:** what happens after a solar quote goes quiet?

**Body:**

Hey {{first_name}},

Quick one: when a homeowner goes quiet after getting a quote, what's the follow-up look like right now?

Solar doesn't close on the first call, most homeowners take weeks, comparing financing, talking it over. The installers who stay in touch consistently win those deals. The ones who follow up once and move on lose them.

I build systems that follow up automatically for weeks, not just once.

Worth 15 minutes to see if it'd help {{company_name}}? No pitch: https://damirbuilds.com/solar-speed-to-lead

%signature%

---

## Email 2 — The proof (day 4)

**Subject A:** the follow-up gap
**Subject B:** why quiet leads aren't dead leads

**Body:**

{{first_name}}, one thing worth knowing.

A homeowner who stops replying after a quote usually isn't a lost sale, they're mid-decision. Financing, family, comparing installers. The deal usually goes to whoever's still in their inbox when they're ready, not whoever quoted first.

What I build responds instantly to new inquiries, then runs a structured follow-up sequence for weeks, automatically, so quotes don't just go cold from staff being busy.

How it works, and a spot to grab 15 minutes: https://damirbuilds.com/solar-speed-to-lead

%signature%

---

## Email 3 — The breakup (day 8)

**Subject A:** should I close this out?
**Subject B:** last one

**Body:**

{{first_name}}, I'll keep this short.

Reached out twice about automating follow-up on {{company_name}}'s open quotes. Haven't heard back, all good if it's not a priority right now.

If timing was just off, the offer's still open: https://damirbuilds.com/solar-speed-to-lead

If not, just say so and I'll stop here.

%signature%
