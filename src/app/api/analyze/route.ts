import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { getGroqClient, VISION_MODEL, SUPPORTED_LANGUAGES, type LanguageCode } from "@/lib/groq";

export const runtime = "nodejs";

const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15MB

const JSON_SHAPE_INSTRUCTIONS = `Respond with ONLY a single JSON object (no markdown fences, no commentary) matching exactly this shape:
{
  "documentType": string,
  "summary": string,
  "medicines": [{ "name": string, "purpose": string, "dosageInstructions": string }],
  "labResults": [{ "test": string, "value": string, "referenceRange": string, "flag": "normal" | "low" | "high" | "critical" | "unknown", "plainMeaning": string }],
  "redFlags": [string]
}
Use empty arrays ([]) for sections that don't apply. Never omit a key.`;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const languageCode = String(formData.get("language") ?? "en") as LanguageCode;

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type || "unknown"}. Please upload a JPG, PNG, or WEBP photo.` },
        { status: 400 },
      );
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "File too large (max 15MB)." }, { status: 400 });
    }

    const language =
      SUPPORTED_LANGUAGES.find((l) => l.code === languageCode)?.label ?? "English";

    const bytes = Buffer.from(await file.arrayBuffer());
    const base64Data = bytes.toString("base64");
    const dataUri = `data:${file.type};base64,${base64Data}`;

    const client = getGroqClient();

    const prompt = `You are a health-literacy assistant. You are given a photo of a real medical document (prescription, lab report, or discharge summary).

Your job is ONLY to translate medical jargon into plain language that a layperson can understand — you are not diagnosing, and you must not invent information that is not in the document.

Respond entirely in this language: ${language}.

Rules:
- Extract every medicine, dosage, and lab result you can actually read in the image.
- For each lab result, mark it as normal/low/high/critical based on the reference range printed on the document itself (not general knowledge), and explain what that means in one plain sentence.
- List anything that looks urgent or abnormal in "redFlags" — but always phrase these as "worth asking your doctor about", never as a diagnosis.
- If the image is blurry, unreadable, or not a medical document, say so plainly in the summary and leave the other fields as empty arrays.
- Never fabricate a medicine, value, or result that is not visibly present in the document.

${JSON_SHAPE_INSTRUCTIONS}`;

    const completion = await client.chat.completions.create({
      model: VISION_MODEL,
      response_format: { type: "json_object" },
      // This model is a "thinking" model by default — its reasoning trace can burn
      // most of the free tier's tight per-minute token budget before it ever writes
      // the JSON answer, sometimes truncating it into invalid JSON. We don't use the
      // reasoning trace, so turn it off entirely.
      reasoning_effort: "none",
      max_completion_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: dataUri } },
          ],
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      throw new Error("Empty response from the model.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(
        "The model's response wasn't valid JSON. Please try again with a clearer photo.",
      );
    }

    return NextResponse.json({ result: parsed });
  } catch (err) {
    console.error("[/api/analyze] failed:", err);

    if (err instanceof Groq.RateLimitError) {
      return NextResponse.json(
        {
          error:
            "We've hit the free API rate limit (this app runs on a free tier). Please wait a minute and try again.",
        },
        { status: 429 },
      );
    }
    if (err instanceof Groq.AuthenticationError) {
      return NextResponse.json(
        { error: "The AI service isn't configured correctly (invalid API key)." },
        { status: 500 },
      );
    }
    if (err instanceof Groq.APIConnectionError || err instanceof Groq.InternalServerError) {
      return NextResponse.json(
        { error: "The AI service is temporarily unavailable. Please try again in a moment." },
        { status: 503 },
      );
    }

    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Analysis failed: ${message}` }, { status: 500 });
  }
}
