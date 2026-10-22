# Majlis — real-time AI sales coach (POC)

Private, real-time coaching for live sales calls, in the spirit of Amotions AI: practice with an AI buyer, get one "say this next" prompt during a real Google Meet call, and a scorecard afterwards. No bot joins the meeting. Nothing is stored server-side.

**Stack:** Next.js 15 · Deepgram Nova-3 streaming STT (two channels: your mic + the Meet tab) · Claude Haiku 5.5 (live coach, AI buyer) · Claude Sonnet 5.5 (scorecard, playbook import) · browser storage only. Runs on Vercel's free tier.

---

## 1. Run locally (5 minutes)

```bash
npm install
cp .env.example .env.local      # fill ANTHROPIC_API_KEY and DEEPGRAM_API_KEY
npm run dev                      # http://localhost:3000
```

Use **Google Chrome** on a laptop/desktop. Tab-audio capture and voice roleplay need Chrome.

## 2. Deploy to Vercel (free tier)

1. Push this repo to GitHub.
2. In Vercel: **Add New → Project → Import** the repo. Framework is auto-detected (Next.js). Leave build settings default.
3. **Environment Variables** (Production + Preview):
   - `ANTHROPIC_API_KEY` — from console.anthropic.com
   - `DEEPGRAM_API_KEY` — from console.deepgram.com ($200 free credit on signup)
   - `DEEPGRAM_PROJECT_ID` — optional; Deepgram console → Projects → Project ID. When set, the server mints short-lived keys for the browser instead of ever sending the main key.
   - `LIVE_SESSION_CAP_MINUTES` — optional, default `15`
4. Deploy. The green dot in the top-right of the app ("AI services ready") confirms both keys are visible to the server.

Never commit `.env.local`. The keys are only read on the server (API routes).

## 3. What's in the box

| Page | What it does |
| --- | --- |
| `/` | Landing + stats from this device |
| `/live` | 3-step setup (mic → share Meet tab with audio → start), then the coaching overlay: emotion read, next best action with approved wording, playbook stage tracker, live transcript, prompt history, level meters, 15-minute countdown with auto-stop. Compact overlay toggle for placing beside Meet. |
| `/roleplay` | Pick a buyer persona (easy → brutal), optional scenario, talk to the AI buyer (it speaks aloud via the browser), same coach watches, "reveal buyer's mind" toggle, type-to-talk fallback. |
| `/report/[id]` | Scorecard: deal health gauge, summary, talk ratio, sentiment arc, rubric bars, missed moments with the exact line to say instead, what worked, risks, stage completion, CRM-ready notes (copy), next drill → one-click roleplay of that moment, transcript with the prompts shown in the moment. |
| `/playbook` | Structured editor (stages, objections, talk tracks, rubric, notes) with validation, plus **Import with AI**: paste or upload a .txt/.md and Claude structures it. Two sample playbooks ship: Dubai off-plan real estate and UAE SME ERP. |
| `/calls` | History on this device. |

### API routes (server-side, keys never reach the browser)

- `POST /api/coach` — Haiku 5.5, tool-forced JSON: emotion (20-label taxonomy), next action, optional verbatim playbook line, flag, stage checklist update.
- `POST /api/buyer` — Haiku 5.5 persona reply + hidden "internal" thought.
- `POST /api/score` — Sonnet 5.5 full scorecard (60 s max).
- `POST /api/playbook-parse` — Sonnet 5.5 raw text → structured playbook.
- `POST /api/deepgram-token` — short-lived Deepgram credential (auth/grant → temp project key → raw key fallback).
- `GET /api/health` — which keys are configured.

### Credit protection

- Hard stop per live session (`LIVE_SESSION_CAP_MINUTES`, default 15) with a visible countdown; red at 80%.
- Streaming only runs between **Start coaching** and **End call**; the WebSocket is closed on end, on tab-share stop, and on page unload.
- Roleplay uses the browser's free speech recognition and speech synthesis, not Deepgram.
- Coaching requests fire on buyer turn end / buyer question / 25 s of rep monologue, not on every transcript fragment. Roughly 60–120 Haiku calls per hour of call ≈ a few cents.
- $200 Deepgram credit ≈ 200+ hours of dual-channel streaming at list price; a 15-minute demo call costs about $0.25.

---

## 4. Demo runbook (read the night before)

**Kit:** demo laptop with Chrome, headphones (important: stops your mic hearing the buyer twice), a second laptop or phone for the "buyer", a Google Meet link, the Vercel URL open in a separate Chrome **window** (not tab) next to Meet.

**Rehearse once** with the roleplay mode so you know the rhythm: the prompt updates about two seconds after the buyer finishes a sentence.

**Flow (10 minutes):**

1. **Playbook (1 min).** Open `/playbook`. Show the two sample playbooks; if you have the client's material, paste it into *Import with AI* live. Point out approved objection responses — "the coach will quote these verbatim".
2. **Live call (5 min).** Open `/live`. Step 1 allow mic, Step 2 share the Meet tab (Chrome Tab → Meet → tick *Share tab audio*), Step 3 start. The buyer (your colleague, or the client's own salesperson) raises two or three objections from the playbook: "it's more than I expected", "I need to think about it", "is my money safe?". Watch the emotion badge and the *Say this next* card. Toggle compact overlay to show how it sits beside the call. End the call before the countdown.
3. **Scorecard (2 min).** It opens automatically. Walk the gauge, the missed moment with *Say instead*, copy the CRM notes, then click **Practice this moment**.
4. **Roleplay (2 min).** It opens pre-loaded with that scenario and a persona. Say one or two lines; the AI buyer answers aloud; the coach prompts. Click the eye icon to reveal what the buyer is "thinking".

**If something goes wrong:**

- Red dot top-right → an env var is missing on Vercel. Fix in Vercel → Settings → Environment Variables → redeploy.
- Tab share shows "no audio" → the Chrome dialog must be on the **Chrome Tab** pane and *Share tab audio* ticked; Window/Screen sharing does not carry audio on Mac.
- Buyer channel level meter stays flat → the Meet tab's audio is muted in Chrome, or the wrong tab was shared. End and restart the session.
- Deepgram "connection failed" → key wrong or credit exhausted; check console.deepgram.com. Roleplay still works without Deepgram.
- Speech recognition in roleplay fails → type your lines in the box; everything else is unchanged.
- Meet with no second participant: the roleplay mode is the full-loop fallback; it needs only the Anthropic key.

**What to say when asked "is this real?"** Yes: real dual-channel audio from the Meet tab and the mic, real streaming transcription, real Claude calls grounded in the playbook, and real scoring. What it is *not* yet: a signed desktop app that captures the Zoom/Teams desktop clients (Phase 0 of the architecture doc), multi-user accounts, billing, CRM writeback, and persistent storage (everything lives in this browser).

---

## 5. Known limits of the POC

- Chrome only. Tab audio capture is a Chrome feature; voice roleplay uses Chrome's speech engine.
- Call must run in a browser tab (Google Meet, or Zoom/Teams web). Desktop clients need the Electron capture spike.
- English transcription (`language=en`); Deepgram Nova-3 supports multilingual if needed.
- Data is in `localStorage`; clearing site data clears history.
- Prompt caching only kicks in above the model's minimum cacheable size; larger playbooks get cheaper per call, not more expensive.
