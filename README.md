# MedLingo 💊

**AI-powered health document translator — turn confusing prescriptions and lab reports into plain language, in your own language.**

Built for [Next Byte Hacks V3](https://next-byte-hacks-v3.devpost.com/).

## The problem

Prescriptions and lab reports are written for clinicians, not patients — dense medical jargon, abbreviated dosages, and reference ranges with no explanation. For elderly patients, people with low health literacy, or anyone outside their home country's language, this is a real barrier to understanding their own care.

## What it does

1. **Upload a photo** of a prescription, lab report, or discharge summary.
2. An AI vision model reads the document and extracts every medicine, dosage, and lab value it can actually see — no guessing, no fabrication.
3. Get a **plain-language summary** of what the document says.
4. Each **lab result** is flagged normal / low / high / critical (based on the reference range printed *on the document itself*) with a one-sentence plain explanation.
5. Anything abnormal is called out as a **red flag** — always phrased as "worth asking your doctor about," never as a diagnosis.
6. Choose your **language** — English, Bengali, Hindi, Spanish, French, Arabic, Urdu, or Swahili — the entire explanation is translated, not just the UI.
7. **Listen** to the summary read aloud via the browser's built-in text-to-speech, for low-literacy or visually impaired users.
8. A **local history** (stored only in your browser, never uploaded anywhere) lets you revisit past documents — useful for a caregiver tracking an elderly relative's records over time.

MedLingo is a literacy aid, not a diagnostic tool. It never keeps your photo — only the extracted, plain-language result is saved locally.

## Tech stack

- **Next.js 16** (App Router) + **TypeScript** + **Tailwind CSS**
- **Groq API** (`qwen/qwen3.6-27b`, a free-tier vision-language model) for OCR, plain-language explanation, and translation in a single call
- **Web Speech API** (browser-native) for text-to-speech — no extra service or cost
- **localStorage** for on-device history — no database, no backend, no user data leaves the browser except the document photo sent for analysis

Runs entirely on free tiers — no credit card required anywhere in the stack.

## Getting started

### Prerequisites

- Node.js 18+
- A free Groq API key — get one at [console.groq.com/keys](https://console.groq.com/keys) (no billing required)

### Setup

```bash
git clone <this-repo-url>
cd medlingo
npm install
cp .env.local.example .env.local
```

Edit `.env.local` and paste your key:

```
GROQ_API_KEY=your_free_groq_api_key_here
```

Then run the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and upload a photo of a prescription or lab report to try it.

### Build for production

```bash
npm run build
npm run start
```

## Project structure

```
src/
  app/
    page.tsx              # Main UI: upload, language select, results, history
    api/analyze/route.ts   # Server route — calls Groq's vision model
    icon.tsx               # Dynamically generated favicon
  lib/
    groq.ts                 # Groq client, supported languages, result types
    history.ts               # localStorage-backed history (CRUD)
```

## Known limitations

- Free-tier rate limits apply (Groq: ~30 requests/minute, 1,000/day) — under heavy demo traffic, requests may be briefly rate-limited; the app surfaces this as a friendly retry message rather than a crash.
- Accuracy depends on photo quality — blurry or poorly lit photos may return an incomplete read, which the app reports honestly rather than guessing.
- This is a health-literacy aid, not a medical device. It does not diagnose and should never replace advice from a doctor or pharmacist.

## What we learned / challenges

- Our original plan used Claude's vision API, but it's pay-per-token with no free tier. We evaluated Google Gemini next, but the free-tier quota on our test account was capped at zero (a known gotcha for Google Workspace–managed accounts). We landed on **Groq**, which offers genuinely free, no-billing vision-model access — a good reminder to verify "free tier" claims empirically before betting a hackathon build on them.
- The vision model we use returns a `<think>...</think>` reasoning trace in a separate `reasoning` field; structuring the request with `response_format: json_object` was essential to keep the actual result parseable.

## Future plans

- Family/caregiver accounts to share a patient's document history securely across devices (would need a real backend + auth).
- Drug interaction checks across a patient's saved medicine history.
- Camera capture directly in-browser (not just file upload) for a faster mobile flow.
- Offline-first support so low-connectivity users can still get explanations once cached.
