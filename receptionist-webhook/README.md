# KCCC receptionist owner-approval bridge

Lets Sarah (ElevenLabs) put a booking caller on hold, text the owner for a
time, and confirm the booking live — or text the customer later if he
doesn't reply in time.

## How it works

1. `POST /tool/ask-owner` (ElevenLabs webhook tool, timeout 120s)
   → texts the owner: `KCCC booking [BK-XXXX]: name (phone), vehicle — reason. Reply with the time.`
   → waits up to 110s for the owner's SMS reply
   → returns `{ confirmed_time }` (or `{ confirmed_time: null, timed_out: true }`)
2. `POST /sms/inbound` (Twilio inbound SMS webhook)
   → owner's reply resolves the waiting call, or — if the hold already timed
     out — texts the customer directly with the confirmed time.

## Deploy (Railway)

1. New service in the kamino project from this repo, root directory
   `receptionist-webhook`.
2. Variables (paste yourself — never commit):
   - `TWILIO_ACCOUNT_SID` — from twilio.com/console
   - `TWILIO_AUTH_TOKEN` — from twilio.com/console
   - `TWILIO_PHONE_NUMBER` — `+17789496403`
   - `OWNER_PHONE` — `+12046988269`
   - `PUBLIC_URL` — `https://<this-service>.up.railway.app`
3. On boot the service points the Twilio number's inbound SMS at
   `PUBLIC_URL/sms/inbound` automatically.

## ElevenLabs

Create a webhook tool `ask_owner_for_time` → `POST {PUBLIC_URL}/tool/ask-owner`,
`response_timeout_secs: 120`, params: customer_name, customer_phone, vehicle,
reason. Attach to the KCCC Receptionist agent and add the booking flow to the
prompt (see memory 2026-09-30).
