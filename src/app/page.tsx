"use client";

import { useEffect, useRef, useState, type SVGProps } from "react";
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
  normal: "bg-success-bg text-success border-success-border",
  low: "bg-warning-bg text-warning border-warning-border",
  high: "bg-warning-bg text-warning border-warning-border",
  critical: "bg-critical-bg text-critical border-critical-border",
  unknown: "bg-cream-100 text-ink-muted border-border",
};

function formatTimestamp(ts: number) {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Icon({ children, ...props }: SVGProps<SVGSVGElement> & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

const IconUpload = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M12 15.5V6M12 6l-3.5 3.5M12 6l3.5 3.5" />
    <path d="M6 15.5v2A2.5 2.5 0 008.5 20h7a2.5 2.5 0 002.5-2.5v-2" />
  </Icon>
);

const IconSpeaker = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M4 9.5h3l4.5-4v13l-4.5-4H4v-5z" />
    <path d="M16.5 8.5a4.5 4.5 0 010 7M19 6a8 8 0 010 12" />
  </Icon>
);

const IconStop = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </Icon>
);

const IconClock = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 8v4.2l3 1.8" />
  </Icon>
);

const IconClose = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M6 6l12 12M6 18L18 6" />
  </Icon>
);

const IconAlert = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M12 9v4" />
    <path d="M10.4 4.1L2.9 17.3a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.6 4.1a1.6 1.6 0 00-2.8 0z" />
    <path d="M12 16.2h.01" />
  </Icon>
);

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
    <div className="min-h-screen bg-cream text-ink">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-2xl items-start justify-between gap-4 px-5 py-8 sm:px-6">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-cream">
                <svg viewBox="0 0 24 24" className="h-4.5 w-4.5">
                  <rect
                    x="3"
                    y="9.5"
                    width="18"
                    height="5"
                    rx="2.5"
                    transform="rotate(-45 12 12)"
                    fill="currentColor"
                  />
                  <path d="M9.5 9.5l5 5" stroke="var(--accent)" strokeWidth="1.4" />
                </svg>
              </span>
              <h1 className="font-serif text-2xl font-semibold tracking-tight">MedLingo</h1>
            </div>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">
              Upload a prescription or lab report photo — get a plain-language
              explanation in your language. Free, private, not a diagnosis.
            </p>
          </div>
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-xs font-medium text-ink-muted transition hover:border-accent hover:text-accent"
            aria-expanded={showHistory}
          >
            <IconClock className="h-3.5 w-3.5" />
            History{history.length > 0 ? ` (${history.length})` : ""}
          </button>
        </div>

        {showHistory && (
          <div className="border-t border-border bg-cream-100">
            <div className="mx-auto max-w-2xl px-5 py-4 sm:px-6">
              <div className="flex items-center justify-between">
                <p className="text-xs text-ink-muted">
                  Saved on this device only — never uploaded anywhere.
                </p>
                {history.length > 0 && (
                  <button
                    onClick={handleClearHistory}
                    className="text-xs font-medium text-ink-muted underline decoration-border underline-offset-2 hover:text-accent"
                  >
                    Clear all
                  </button>
                )}
              </div>
              {history.length === 0 ? (
                <p className="mt-3 text-sm text-ink-muted">
                  No documents explained yet on this device.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {history.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5"
                    >
                      <button
                        onClick={() => loadHistoryEntry(entry)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="truncate text-sm font-medium text-ink">
                          {entry.result.documentType || "Document"}
                        </p>
                        <p className="truncate text-xs text-ink-muted">
                          {formatTimestamp(entry.timestamp)}
                          {entry.result.redFlags.length > 0 &&
                            ` · ${entry.result.redFlags.length} flag${entry.result.redFlags.length > 1 ? "s" : ""}`}
                        </p>
                      </button>
                      <button
                        onClick={() => handleDeleteHistoryEntry(entry.id)}
                        aria-label="Delete this entry"
                        className="shrink-0 rounded-full p-1.5 text-ink-muted hover:bg-critical-bg hover:text-critical"
                      >
                        <IconClose className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-2xl px-5 py-8 sm:px-6">
        {/* Upload card */}
        <section className="rounded-3xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(38,34,32,0.04)] sm:p-7">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Explain in</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as LanguageCode)}
              className="w-full rounded-xl border border-border bg-cream px-3.5 py-2.5 text-sm text-ink focus:border-accent focus:outline-none sm:w-56"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          <div
            className="mt-5 flex min-h-[190px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-cream p-5 text-center transition hover:border-accent hover:bg-accent-soft/40 sm:p-6"
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
                className="max-h-56 rounded-xl object-contain shadow-sm"
              />
            ) : file ? (
              <p className="max-w-full truncate text-sm text-ink-muted">{file.name}</p>
            ) : (
              <>
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <IconUpload className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-medium text-ink">
                  Drop a photo here, or tap to choose a file
                </p>
                <p className="mt-1 text-xs text-ink-muted">
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

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={handleAnalyze}
              disabled={!file || status === "loading"}
              className="flex-1 rounded-full bg-accent px-5 py-3 text-sm font-medium text-cream shadow-sm transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
            >
              {status === "loading" ? "Analyzing…" : "Explain this document"}
            </button>
            {(file || result) && (
              <button
                onClick={reset}
                className="rounded-full border border-border px-5 py-3 text-sm font-medium text-ink-muted transition hover:border-accent hover:text-accent"
              >
                Clear
              </button>
            )}
          </div>

          {error && (
            <p className="mt-4 rounded-xl border border-critical-border bg-critical-bg px-3.5 py-2.5 text-sm text-critical">
              {error}
            </p>
          )}
        </section>

        {/* Loading skeleton */}
        {showResultLoading && (
          <section className="mt-6 animate-pulse space-y-4" aria-live="polite">
            <div className="h-28 rounded-3xl border border-border bg-card p-6 shadow-sm">
              <div className="h-3 w-24 rounded-full bg-cream-100" />
              <div className="mt-4 h-3 w-full rounded-full bg-cream-100" />
              <div className="mt-2 h-3 w-5/6 rounded-full bg-cream-100" />
            </div>
            <p className="text-center text-xs text-ink-muted">
              Reading the document and translating to plain language…
            </p>
          </section>
        )}

        {/* Results */}
        {result && !showResultLoading && (
          <section className="mt-6 space-y-5">
            {activeHistoryEntry && (
              <div className="rounded-xl bg-cream-100 px-3.5 py-2.5 text-xs text-ink-muted">
                Viewing a saved result from {formatTimestamp(activeHistoryEntry.timestamp)}
              </div>
            )}

            <div className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="inline-block rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
                    {result.documentType}
                  </span>
                  <h2 className="mt-3 font-serif text-xl font-semibold">
                    Plain-language summary
                  </h2>
                </div>
                <button
                  onClick={() =>
                    speaking ? stopSpeaking() : speak(result.summary, activeLanguage)
                  }
                  aria-label={speaking ? "Stop reading aloud" : "Read summary aloud"}
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-xs font-medium text-ink-muted transition hover:border-accent hover:text-accent"
                >
                  {speaking ? (
                    <IconStop className="h-3.5 w-3.5" />
                  ) : (
                    <IconSpeaker className="h-3.5 w-3.5" />
                  )}
                  {speaking ? "Stop" : "Listen"}
                </button>
              </div>
              <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-ink/90">
                {result.summary}
              </p>
            </div>

            {result.redFlags.length > 0 && (
              <div className="rounded-3xl border border-critical-border bg-critical-bg p-5 sm:p-7">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-critical">
                  <IconAlert className="h-4 w-4" />
                  Worth asking your doctor about
                </h2>
                <ul className="mt-3 space-y-2">
                  {result.redFlags.map((flag, i) => (
                    <li key={i} className="flex gap-2 text-sm leading-relaxed text-critical/90">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-critical" />
                      {flag}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.medicines.length > 0 && (
              <div className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7">
                <h2 className="font-serif text-lg font-semibold">Medicines</h2>
                <div className="mt-4 space-y-3">
                  {result.medicines.map((med, i) => (
                    <div key={i} className="rounded-2xl border border-border bg-cream p-4">
                      <p className="font-medium text-ink">{med.name}</p>
                      {med.purpose && (
                        <p className="mt-1 text-sm text-ink/80">{med.purpose}</p>
                      )}
                      <p className="mt-1.5 text-xs text-ink-muted">{med.dosageInstructions}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.labResults.length > 0 && (
              <div className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7">
                <h2 className="font-serif text-lg font-semibold">Lab results</h2>
                <div className="mt-4 space-y-3">
                  {result.labResults.map((lab, i) => (
                    <div
                      key={i}
                      className={`rounded-2xl border p-4 ${FLAG_STYLES[lab.flag] ?? FLAG_STYLES.unknown}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium">{lab.test}</p>
                        <span className="rounded-full bg-white/50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
                          {lab.flag}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm">
                        {lab.value}{" "}
                        <span className="opacity-70">(ref: {lab.referenceRange})</span>
                      </p>
                      <p className="mt-1.5 text-sm opacity-90">{lab.plainMeaning}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.medicines.length === 0 &&
              result.labResults.length === 0 &&
              result.redFlags.length === 0 && (
                <p className="rounded-3xl border border-border bg-card p-5 text-sm text-ink-muted sm:p-7">
                  We couldn&apos;t confidently read specific medicines or lab values from
                  this photo. Try a clearer, well-lit photo with the full document in
                  frame.
                </p>
              )}

            <p className="text-center text-xs leading-relaxed text-ink-muted">
              MedLingo explains documents in plain language — it does not diagnose or
              replace professional medical advice. Always confirm with a doctor or
              pharmacist.
            </p>
          </section>
        )}
      </main>

      <footer className="mx-auto max-w-2xl px-5 pb-10 text-center text-xs text-ink-muted/60 sm:px-6">
        Built for Next Byte Hacks V3 · Powered by Groq
      </footer>
    </div>
  );
}
