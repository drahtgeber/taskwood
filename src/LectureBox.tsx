import { useEffect, useState } from "react";
import { uid } from "./data";
import type { LectureNote } from "./data";
import { t } from "./i18n";

// "Heutige Vorlesung": pro Projekt und Tag Thema, bis zu welcher Folie, Notiz.
// Gespeichert wird erst mit "Speichern" (oder Enter); "von Folie" ergibt sich aus dem letzten Mal.

const pad = (n: number) => String(n).padStart(2, "0");
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const toSlide = (v: string) => {
  const n = parseInt(v.replace(/\D/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

type Draft = { topic: string; to: string; note: string };

// Zugeklappte Felder bleiben zu, solange die App läuft (auch beim Wechsel zwischen Fächern)
const closed = new Set<string>();

type Props = {
  projectId: string;
  notes: LectureNote[];
  onChange: (notes: LectureNote[]) => void;
  lectureToday: boolean; // laut Stundenplan heute Vorlesung in diesem Fach
};

export default function LectureBox({ projectId, notes, onChange, lectureToday }: Props) {
  const today = todayIso();
  const mine = notes.filter(n => n.projectId === projectId);
  const current = mine.find(n => n.date === today);
  const last = mine.filter(n => n.date < today && n.to !== undefined).sort((a, b) => (a.date < b.date ? 1 : -1))[0];

  const fromNote = (n?: LectureNote): Draft => ({ topic: n?.topic ?? "", to: n?.to !== undefined ? String(n.to) : "", note: n?.note ?? "" });
  const [draft, setDraft] = useState<Draft>(() => fromNote(current));
  const closeKey = `${projectId}|${today}`;
  const [open, setOpenState] = useState((lectureToday || !!current) && !closed.has(closeKey));
  const setOpen = (o: boolean) => {
    if (o) closed.delete(closeKey);
    else closed.add(closeKey);
    setOpenState(o);
  };
  const [saved, setSaved] = useState(false);

  // Gespeicherten Stand übernehmen, wenn er sich von außen ändert (z. B. Import)
  useEffect(() => setDraft(fromNote(current)), [current?.at]);

  const stored = fromNote(current);
  const dirty = draft.topic !== stored.topic || draft.to !== stored.to || draft.note !== stored.note;

  const save = () => {
    if (!dirty) return;
    const rest = notes.filter(n => n.id !== current?.id);
    const topic = draft.topic.trim();
    const note = draft.note.trim();
    const to = toSlide(draft.to);
    if (!topic && !note && to === undefined) {
      onChange(rest); // alles geleert: Eintrag entfernen
    } else {
      const from = current?.from ?? last?.to;
      onChange([...rest, { id: current?.id ?? uid(), projectId, date: today, topic: topic || undefined, from, to, note: note || undefined, at: Date.now() }]);
    }
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
    // Nach dem Speichern kurz die Bestätigung zeigen, dann zuklappen
    window.setTimeout(() => setOpen(false), 900);
  };

  useEffect(() => {
    if (!open) setDraft(fromNote(current));
  }, [open]);

  const set = (patch: Partial<Draft>) => {
    setDraft(d => ({ ...d, ...patch }));
    setSaved(false);
  };

  if (!open) {
    const summary = current ? [current.topic, current.to !== undefined ? t("bis Folie {n}", { n: current.to }) : ""].filter(Boolean).join(" · ") : "";
    return (
      <button className="lnote-open" onClick={() => setOpen(true)}>
        {current ? (
          <>
            <span className="lnote-done">✓ {t("Heutige Vorlesung")}</span>
            {summary && <span className="lnote-hint">{summary}</span>}
          </>
        ) : (
          <>
            + {t("Heutige Vorlesung eintragen")}
            {last && <span className="lnote-hint">{t("letztes Mal bis Folie {n}", { n: last.to! })}</span>}
          </>
        )}
      </button>
    );
  }

  return (
    <form
      className="lnote"
      onSubmit={e => {
        e.preventDefault();
        save();
      }}
    >
      <div className="lnote-head">
        <strong>{t("Heutige Vorlesung")}</strong>
        {last && <span className="lnote-hint">{t("letztes Mal bis Folie {n}", { n: last.to! })}</span>}
        <button
          type="button"
          className="lnote-close"
          onClick={() => setOpen(false)}
          title={t(dirty ? "Schließen (Änderungen verwerfen)" : "Schließen")}
          aria-label={t("Schließen")}
        >
          ×
        </button>
      </div>
      <div className="lnote-row">
        <input className="new" value={draft.topic} onChange={e => set({ topic: e.target.value })} placeholder={t("Thema")} />
        <label className="lnote-slide">
          {t("bis Folie")}
          <input className="new" inputMode="numeric" value={draft.to} onChange={e => set({ to: e.target.value.replace(/\D/g, "") })} placeholder="–" />
        </label>
      </div>
      <textarea
        className="new lnote-note"
        rows={2}
        value={draft.note}
        onChange={e => set({ note: e.target.value })}
        onKeyDown={e => {
          if (e.key === "Enter" && e.ctrlKey) {
            e.preventDefault();
            save();
          }
        }}
        placeholder={t("Notiz (optional)")}
      />
      <div className="lnote-actions">
        {saved && !dirty ? <span className="lnote-saved">✓ {t("Gespeichert")}</span> : dirty ? <span className="lnote-hint">{t("Nicht gespeichert")}</span> : null}
        <span className="spacer" />
        <button type="submit" className="btn primary" disabled={!dirty}>{t("Speichern")}</button>
      </div>
    </form>
  );
}
