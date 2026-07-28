"use client";

import { useEffect, useRef, useState } from "react";
import { SUPPORTED_LANGUAGES, type AnalysisResult, type LanguageCode } from "@/lib/groq";
import {
  clearHistory,
  deleteFromHistory,
  getHistory,
  saveToHistory,
  type HistoryEntry,
} from "@/lib/history";

type Status = "idle" | "loading" | "error" | "done";

const FLAG_STYLES: Record<string, string> = {
  normal: "bg-emerald-50 text-emerald-700 border-emerald-200",
  low: "bg-amber-50 text-amber-700 border-amber-200",
  high: "bg-amber-50 text-amber-700 border-amber-200",
  critical: "bg-red-50 text-red-700 border-red-200",
  unknown: "bg-slate-50 text-slate-600 border-slate-200",
};

function formatTimestamp(ts: number) {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [activeHistoryEntry, setActiveHistoryEntry] = useState<HistoryEntry | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // localStorage is only available client-side; reading it here (rather than as a
    // useState initializer) avoids a server/client hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistory(getHistory());
  }, []);

  function handleFileChosen(chosen: File | undefined | null) {
    if (!chosen) return;
    setFile(chosen);
    setResult(null);
    setError(null);
    setActiveHistoryEntry(null);
    if (chosen.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(chosen));
    } else {
      setPreviewUrl(null);
    }
  }

  async function handleAnalyze() {
    if (!file) return;
    setStatus("loading");
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("language", language);

      const res = await fetch("/api/analyze", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Something went wrong.");
      }
      const analysis = data.result as AnalysisResult;
      setResult(analysis);
      setStatus("done");
      setActiveHistoryEntry(null);
      setHistory(saveToHistory(language, analysis));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }

  function speak(text: string, lang: LanguageCode) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }

  function reset() {
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    setStatus("idle");
    setActiveHistoryEntry(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function loadHistoryEntry(entry: HistoryEntry) {
    stopSpeaking();
    setFile(null);
    setPreviewUrl(null);
    setError(null);
    setStatus("done");
    setLanguage(entry.language);
    setResult(entry.result);
    setActiveHistoryEntry(entry);
    setShowHistory(false);
  }

  function handleDeleteHistoryEntry(id: string) {
    setHistory(deleteFromHistory(id));
    if (activeHistoryEntry?.id === id) {
      reset();
    }
  }

  function handleClearHistory() {
    clearHistory();
    setHistory([]);
  }

  const activeLanguage = activeHistoryEntry?.language ?? language;
  const showResultLoading = status === "loading";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-start justify-between gap-4 px-4 py-6 sm:px-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">MedLingo</h1>
            <p className="mt-1 text-sm text-slate-500">
              Upload a prescription or lab report photo — get a plain-language explanation
              in your language. Free, private, not a diagnosis.
            </p>
          </div>
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
            aria-expanded={showHistory}
          >
            🕘 History{history.length > 0 ? ` (${history.length})` : ""}
          </button>
        </div>

        {showHistory && (
          <div className="border-t border-slate-200 bg-slate-50">
            <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-500">
                  Saved on this device only — never uploaded anywhere.
                </p>
                {history.length > 0 && (
                  <button
                    onClick={handleClearHistory}
                    className="text-xs font-medium text-slate-400 underline hover:text-slate-600"
                  >
                    Clear all
                  </button>
                )}
              </div>
              {history.length === 0 ? (
                <p className="mt-3 text-sm text-slate-400">
                  No documents explained yet on this device.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {history.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                    >
                      <button
                        onClick={() => loadHistoryEntry(entry)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="truncate text-sm font-medium text-slate-800">
                          {entry.result.documentType || "Document"}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {formatTimestamp(entry.timestamp)}
                          {entry.result.redFlags.length > 0 &&
                            ` · ${entry.result.redFlags.length} flag${entry.result.redFlags.length > 1 ? "s" : ""}`}
                        </p>
                      </button>
                      <button
                        onClick={() => handleDeleteHistoryEntry(entry.id)}
                        aria-label="Delete this entry"
                        className="shrink-0 rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {/* Upload card */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Explain in
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as LanguageCode)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none sm:w-52"
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
            className="mt-4 flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center transition hover:border-slate-400 sm:p-6"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFileChosen(e.dataTransfer.files?.[0]);
            }}
          >
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Uploaded document preview"
                className="max-h-56 rounded-lg object-contain"
              />
            ) : file ? (
              <p className="max-w-full truncate text-sm text-slate-600">📄 {file.name}</p>
            ) : (
              <>
                <p className="text-sm font-medium text-slate-600">
                  Drop a photo here, or tap to choose a file
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  JPG, PNG, or WEBP — up to 15MB
                </p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => handleFileChosen(e.target.files?.[0])}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={handleAnalyze}
              disabled={!file || status === "loading"}
              className="flex-1 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
            >
              {status === "loading" ? "Analyzing…" : "Explain this document"}
            </button>
            {(file || result) && (
              <button
                onClick={reset}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
              >
                Clear
              </button>
            )}
          </div>

          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </section>

        {/* Loading skeleton */}
        {showResultLoading && (
          <section className="mt-6 animate-pulse space-y-4" aria-live="polite">
            <div className="h-28 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="h-3 w-24 rounded bg-slate-200" />
              <div className="mt-4 h-3 w-full rounded bg-slate-100" />
              <div className="mt-2 h-3 w-5/6 rounded bg-slate-100" />
            </div>
            <p className="text-center text-xs text-slate-400">
              Reading the document and translating to plain language…
            </p>
          </section>
        )}

        {/* Results */}
        {result && !showResultLoading && (
          <section className="mt-6 space-y-5">
            {activeHistoryEntry && (
              <div className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-500">
                Viewing a saved result from {formatTimestamp(activeHistoryEntry.timestamp)}
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    {result.documentType}
                  </span>
                  <h2 className="mt-3 text-lg font-semibold">Plain-language summary</h2>
                </div>
                <button
                  onClick={() =>
                    speaking ? stopSpeaking() : speak(result.summary, activeLanguage)
                  }
                  aria-label={speaking ? "Stop reading aloud" : "Read summary aloud"}
                  className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  {speaking ? "⏹ Stop" : "🔊 Listen"}
                </button>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                {result.summary}
              </p>
            </div>

            {result.redFlags.length > 0 && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 sm:p-6">
                <h2 className="text-sm font-semibold text-red-800">
                  ⚠ Worth asking your doctor about
                </h2>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-700">
                  {result.redFlags.map((flag, i) => (
                    <li key={i}>{flag}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.medicines.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                <h2 className="text-lg font-semibold">Medicines</h2>
                <div className="mt-3 space-y-3">
                  {result.medicines.map((med, i) => (
                    <div key={i} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <p className="font-medium text-slate-800">{med.name}</p>
                      {med.purpose && (
                        <p className="mt-1 text-sm text-slate-600">{med.purpose}</p>
                      )}
                      <p className="mt-1 text-xs text-slate-500">{med.dosageInstructions}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.labResults.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                <h2 className="text-lg font-semibold">Lab results</h2>
                <div className="mt-3 space-y-3">
                  {result.labResults.map((lab, i) => (
                    <div
                      key={i}
                      className={`rounded-xl border p-3 ${FLAG_STYLES[lab.flag] ?? FLAG_STYLES.unknown}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium">{lab.test}</p>
                        <span className="text-xs font-semibold uppercase tracking-wide">
                          {lab.flag}
                        </span>
                      </div>
                      <p className="mt-1 text-sm">
                        {lab.value}{" "}
                        <span className="opacity-70">(ref: {lab.referenceRange})</span>
                      </p>
                      <p className="mt-1 text-sm opacity-90">{lab.plainMeaning}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.medicines.length === 0 &&
              result.labResults.length === 0 &&
              result.redFlags.length === 0 && (
                <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500 sm:p-6">
                  We couldn&apos;t confidently read specific medicines or lab values from
                  this photo. Try a clearer, well-lit photo with the full document in
                  frame.
                </p>
              )}

            <p className="text-center text-xs text-slate-400">
              MedLingo explains documents in plain language — it does not diagnose or
              replace professional medical advice. Always confirm with a doctor or
              pharmacist.
            </p>
          </section>
        )}
      </main>

      <footer className="mx-auto max-w-3xl px-4 pb-8 text-center text-xs text-slate-300 sm:px-6">
        Built for Next Byte Hacks V3 · Powered by Groq
      </footer>
    </div>
  );
}
