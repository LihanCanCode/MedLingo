import Groq from "groq-sdk";

export const VISION_MODEL = "qwen/qwen3.6-27b";

export function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not set. Add it to .env.local");
  }
  return new Groq({ apiKey });
}

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "bn", label: "বাংলা (Bengali)" },
  { code: "hi", label: "हिन्दी (Hindi)" },
  { code: "es", label: "Español (Spanish)" },
  { code: "fr", label: "Français (French)" },
  { code: "ar", label: "العربية (Arabic)" },
  { code: "ur", label: "اردو (Urdu)" },
  { code: "sw", label: "Kiswahili (Swahili)" },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

export type AnalysisResult = {
  documentType: string;
  summary: string;
  medicines: {
    name: string;
    purpose: string;
    dosageInstructions: string;
  }[];
  labResults: {
    test: string;
    value: string;
    referenceRange: string;
    flag: "normal" | "low" | "high" | "critical" | "unknown";
    plainMeaning: string;
  }[];
  redFlags: string[];
};
