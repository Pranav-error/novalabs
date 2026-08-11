"use client";

import { useState } from "react";
import api from "@/lib/api";
import Button from "@/components/ui/Button";
import toast from "react-hot-toast";
import { Upload, AlertTriangle } from "lucide-react";

interface Props {
  dayId: string;
  onChanged: () => void;
  onClose: () => void;
}

interface ParsedRow {
  question_text: string;
  options: string[];
  correct_option_index: number;
  explanation?: string | null;
}

const SAMPLE = `Paste JSON:
[{"question_text":"What does CSS stand for?",
  "options":["Cascading Style Sheets","Computer Style Sheets"],
  "correct_option_index":0,
  "explanation":"CSS = Cascading Style Sheets"}]

…or CSV, one question per line:
question, option1, option2, option3, option4, correct_index`;

/** CSV line -> row. Correct index is the last column, 0-based. */
function parseCsv(text: string): { rows: ParsedRow[]; errors: string[] } {
  const rows: ParsedRow[] = [];
  const errors: string[] = [];
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line, i) => {
      const cells = line.split(",").map((c) => c.trim());
      if (cells.length < 4) {
        errors.push(`Line ${i + 1}: needs a question, at least 2 options, and a correct index`);
        return;
      }
      const idx = parseInt(cells[cells.length - 1], 10);
      const options = cells.slice(1, -1);
      if (!Number.isFinite(idx) || idx < 0 || idx >= options.length) {
        errors.push(`Line ${i + 1}: correct index "${cells[cells.length - 1]}" is out of range`);
        return;
      }
      rows.push({ question_text: cells[0], options, correct_option_index: idx });
    });
  return { rows, errors };
}

export default function BulkMcqImport({ dayId, onChanged, onClose }: Props) {
  const [raw, setRaw] = useState("");
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [busy, setBusy] = useState(false);
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const parse = () => {
    const text = raw.trim();
    if (!text) {
      toast.error("Nothing to parse");
      return;
    }
    if (text.startsWith("[") || text.startsWith("{")) {
      try {
        const json = JSON.parse(text);
        const list: ParsedRow[] = Array.isArray(json) ? json : [json];
        const bad = list
          .map((r, i) =>
            !r.question_text || !Array.isArray(r.options) || r.options.length < 2
              ? `Row ${i + 1}: needs question_text and at least 2 options`
              : r.correct_option_index < 0 || r.correct_option_index >= r.options.length
              ? `Row ${i + 1}: correct_option_index out of range`
              : null
          )
          .filter(Boolean) as string[];
        setParsed(list);
        setErrors(bad);
      } catch (e: any) {
        setParsed(null);
        setErrors([`Invalid JSON: ${e.message}`]);
      }
    } else {
      const { rows, errors: errs } = parseCsv(text);
      setParsed(rows);
      setErrors(errs);
    }
  };

  const submit = async () => {
    if (!parsed?.length) return;
    setBusy(true);
    try {
      const res = await api.post(`/admin/days/${dayId}/mcqs/bulk`, { items: parsed, mode });
      toast.success(res.data.message);
      onChanged();
      onClose();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (detail?.errors) {
        setErrors(detail.errors.map((e: any) => `Row ${e.row + 1}: ${e.error}`));
        toast.error(detail.message);
      } else {
        toast.error(typeof detail === "string" ? detail : "Import failed");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 bg-white rounded-xl border border-brand-primary/20 p-3">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
          <Upload size={12} className="text-brand-primary" />
        </div>
        <span className="text-xs font-bold uppercase tracking-wider text-brand-primary">
          Bulk import MCQs
        </span>
      </div>
      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        rows={8}
        placeholder={SAMPLE}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs text-brand-navy font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
      />

      <div className="flex items-center gap-3 text-xs">
        <label className="flex items-center gap-1.5 text-gray-500">
          <input
            type="radio"
            checked={mode === "append"}
            onChange={() => setMode("append")}
          />
          Add to existing
        </label>
        <label className="flex items-center gap-1.5 text-gray-500">
          <input
            type="radio"
            checked={mode === "replace"}
            onChange={() => setMode("replace")}
          />
          Replace all
        </label>
      </div>

      {errors.length > 0 && (
        <div className="rounded-lg bg-red-50 border border-red-100 p-2.5 space-y-1">
          <p className="text-[11px] font-bold text-red-600 flex items-center gap-1">
            <AlertTriangle size={12} /> {errors.length} problem(s) — nothing will be imported
          </p>
          {errors.slice(0, 8).map((e, i) => (
            <p key={i} className="text-[10px] text-red-500">
              {e}
            </p>
          ))}
        </div>
      )}

      {parsed && errors.length === 0 && (
        <div className="rounded-lg bg-green-50 border border-green-100 p-2.5">
          <p className="text-[11px] font-bold text-green-700 mb-1">
            {parsed.length} question(s) ready
          </p>
          {parsed.slice(0, 3).map((r, i) => (
            <p key={i} className="text-[10px] text-green-600 truncate">
              {i + 1}. {r.question_text} → {r.options[r.correct_option_index]}
            </p>
          ))}
          {parsed.length > 3 && (
            <p className="text-[10px] text-green-600">…and {parsed.length - 3} more</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={parse} disabled={busy}>
          Check
        </Button>
        <Button
          size="sm"
          onClick={submit}
          disabled={busy || !parsed?.length || errors.length > 0}
        >
          <Upload size={13} className="mr-1" />
          {busy ? "Importing…" : `Import${parsed?.length ? ` ${parsed.length}` : ""}`}
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
