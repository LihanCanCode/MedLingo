import type { AnalysisResult, LanguageCode } from "@/lib/groq";

const STORAGE_KEY = "medlingo:history";
const MAX_ENTRIES = 20;

export type HistoryEntry = {
  id: string;
  timestamp: number;
  language: LanguageCode;
  result: AnalysisResult;
};

function isBrowser() {
  return typeof window !== "undefined";
}

export function getHistory(): HistoryEntry[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveToHistory(language: LanguageCode, result: AnalysisResult): HistoryEntry[] {
  if (!isBrowser()) return [];
  const entry: HistoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    language,
    result,
  };
  const next = [entry, ...getHistory()].slice(0, MAX_ENTRIES);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or unavailable — history is a nice-to-have, fail silently.
  }
  return next;
}

export function deleteFromHistory(id: string): HistoryEntry[] {
  if (!isBrowser()) return [];
  const next = getHistory().filter((e) => e.id !== id);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export function clearHistory(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
