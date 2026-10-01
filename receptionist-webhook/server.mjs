// KCCC receptionist owner-approval bridge.
// Sarah (ElevenLabs) calls POST /tool/ask-owner when a caller wants to book.
// We text the owner, wait up to HOLD_SECONDS for his reply, then answer Sarah.
// If he replies late, we text the customer directly with the confirmed time.
//
// Env (set in Railway dashboard — never commit secrets):
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN  (paste in Railway yourself)
//   TWILIO_PHONE_NUMBER  (+17789496403 — the shop line)
//   OWNER_PHONE          (+12046988269 — Mehak's cell)
//   PUBLIC_URL           (https://<railway-domain>, for the SMS webhook)

import http from "node:http";

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER = "+17789496403",
  OWNER_PHONE = "+12046988269",
  PUBLIC_URL = "",
  PORT = "8080",
} = process.env;

const HOLD_SECONDS = 110; // ElevenLabs tool timeout is 120s; leave margin
const LATE_WINDOW_MS = 45 * 60 * 1000; // accept late replies for 45 min

// bookingId -> { resolve, customerPhone, vehicle, reason, name, createdAt, done }
const pending = new Map();

const twilioAuth =
  TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN
    ? "Basic " +
      Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64")
    : null;

function log(...a) {
  console.log(new Date().toISOString(), "[receptionist]", ...a);
}

async function twilioPost(path, params) {
  if (!twilioAuth) throw new Error("Twilio credentials not configured");
  const res = await fetch(`https://api.twilio.com${path}`, {
    method: "POST",
    headers: {
      Authorization: twilioAuth,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

async function sendSms(to, body) {
  const msg = await twilioPost(
    `/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    { From: TWILIO_PHONE_NUMBER, To: to, Body: body }
  );
  log("SMS sent", msg.sid, "to", to);
  return msg;
}

function makeId() {
  return "BK-" + Math.random().toString(36).slice(2, 6).toUpperCase();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function looksLikePhone(s) {
  return typeof s === "string" && s.replace(/\D/g, "").length >= 10;
}

// --- ElevenLabs tool: ask the owner for a time, holding the caller ---
async function handleAskOwner(req, res) {
  let payload = {};
  try {
    payload = JSON.parse(await readBody(req));
  } catch { /* ignore */ }
  // ElevenLabs may nest params under `parameters` or send them flat.
  const p = payload.parameters && typeof payload.parameters === "object"
    ? payload.parameters
    : payload;
  const name = (p.customer_name || p.name || "the caller").toString().slice(0, 60);
  const customerPhone = (p.customer_phone || p.phone || "").toString();
  const vehicle = (p.vehicle || "").toString().slice(0, 80);
  const reason = (p.reason || "appointment").toString().slice(0, 120);
  const preferred = (p.preferred_time || p.preferred || "").toString().slice(0, 80);
  const bookingId = makeId();

  log("ask-owner", bookingId, name, customerPhone, vehicle, "-", reason, "| prefers:", preferred || "anytime");

  let answered = false;
  const entry = { customerPhone, vehicle, reason, name, preferred, createdAt: Date.now(), done: false, resolve: null };
  pending.set(bookingId, entry);

  const ownerText =
    `KCCC booking [${bookingId}]: ${name} (${customerPhone}), ${vehicle} — ${reason}.` +
    (preferred ? ` Caller prefers: ${preferred}.` : ` No time preference given.`) +
    ` Reply with a proposed time (e.g. "Fri 10am"). Include the booking ID if juggling more than one.`;

  try {
    await sendSms(OWNER_PHONE, ownerText);
  } catch (e) {
    log("ERROR texting owner:", e.message);
    pending.delete(bookingId);
    return json(res, { confirmed_time: null, error: "could not reach owner" });
  }

  const confirmedTime = await new Promise((resolve) => {
    entry.resolve = (t) => { if (!answered) { answered = true; resolve(t); } };
    setTimeout(() => { if (!answered) { answered = true; resolve(null); } }, HOLD_SECONDS * 1000);
  });

  if (confirmedTime) {
    entry.done = true;
    pending.delete(bookingId);
    log("BOOKED", bookingId, "->", confirmedTime);
    return json(res, { confirmed_time: confirmedTime, booking_id: bookingId });
  }

  // Timeout: clear the live resolver so a late owner reply takes the
  // text-the-customer-directly path in handleSmsInbound instead of
  // hitting an already-settled resolver.
  entry.resolve = null;
  log("hold timed out", bookingId, "- waiting for late reply");
  setTimeout(() => pending.delete(bookingId), LATE_WINDOW_MS);
  return json(res, { confirmed_time: null, timed_out: true, booking_id: bookingId });
}

// --- Twilio inbound SMS (owner replies, or customer replies) ---
async function handleSmsInbound(req, res) {
  const raw = await readBody(req);
  const form = new URLSearchParams(raw);
  const from = (form.get("From") || "").replace(/\D/g, "");
  const body = (form.get("Body") || "").trim();
  const ownerDigits = OWNER_PHONE.replace(/\D/g, "");
  log("inbound SMS from", from, ":", body.slice(0, 80));

  res.writeHead(200, { "Content-Type": "text/xml" });
  res.end("<Response></Response>");

  if (!body) return;
  if (from !== ownerDigits) {
    log("ignoring SMS from non-owner");
    return;
  }
  // Owner reply -> match by booking ID if given ("BK-XXXX"), else the newest open request.
  const idMatch = body.toUpperCase().match(/BK-[A-Z0-9]{4}/);
  let open = null;
  if (idMatch && pending.has(idMatch[0]) && !pending.get(idMatch[0]).done) {
    open = [idMatch[0], pending.get(idMatch[0])];
  } else {
    open = [...pending.entries()]
      .filter(([, e]) => !e.done)
      .sort((a, b) => b[1].createdAt - a[1].createdAt)[0];
  }
  if (!open) {
    log("owner reply but no open booking request");
    return;
  }
  const [bookingId, entry] = open;
  if (entry.resolve) {
    log("owner confirmed", bookingId, "->", body.slice(0, 60));
    entry.resolve(body.slice(0, 160));
  } else {
    // Timed out already: text the customer directly.
    entry.done = true;
    pending.delete(bookingId);
    log("late owner confirmation", bookingId, "->", body.slice(0, 60));
    if (looksLikePhone(entry.customerPhone)) {
      try {
        await sendSms(
          entry.customerPhone,
          `Kelowna Car Care Centre: good news — the owner confirmed ${body.slice(0, 80)} for your visit (${entry.vehicle}). Reply here if that doesn't work.`
        );
      } catch (e) {
        log("ERROR texting customer:", e.message);
      }
    }
  }
}

function json(res, obj) {
  res.writeHead(200, { "Content-Type": "application/json" });
  // `result` wrapper matches ElevenLabs' documented tool-result convention;
  // top-level fields keep it readable too.
  res.end(JSON.stringify({ ...obj, result: obj }));
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") return json(res, { ok: true, v: 3 });
    if (req.method === "POST" && req.url === "/tool/ask-owner") return await handleAskOwner(req, res);
    if (req.method === "POST" && req.url === "/sms/inbound") return await handleSmsInbound(req, res);
    res.writeHead(404); res.end("not found");
  } catch (e) {
    log("ERROR", e.message);
    res.writeHead(500); res.end("error");
  }
});

// On boot, point the Twilio number's inbound SMS at this service.
async function selfConfigureSmsWebhook() {
  if (!twilioAuth || !PUBLIC_URL) {
    log("skipping SMS webhook self-config (missing creds or PUBLIC_URL)");
    return;
  }
  const smsUrl = PUBLIC_URL.replace(/\/$/, "") + "/sms/inbound";
  try {
    const listRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(TWILIO_PHONE_NUMBER)}`,
      { headers: { Authorization: twilioAuth } }
    );
    const list = await listRes.json();
    const pn = (list.incoming_phone_numbers || [])[0];
    if (!pn) { log("Twilio number not found in account"); return; }
    if (pn.sms_url === smsUrl) { log("SMS webhook already set"); return; }
    await twilioPost(
      `/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers/${pn.sid}.json`,
      { SmsUrl: smsUrl, SmsMethod: "POST" }
    );
    log("SMS webhook configured ->", smsUrl);
  } catch (e) {
    log("ERROR configuring SMS webhook:", e.message);
  }
}

server.listen(Number(PORT), "0.0.0.0", () => {
  log("listening on", PORT);
  selfConfigureSmsWebhook();
});
