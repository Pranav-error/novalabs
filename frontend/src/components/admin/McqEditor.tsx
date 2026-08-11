"use client";

import { useState } from "react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import Button from "@/components/ui/Button";
import toast from "react-hot-toast";
import { Plus, Trash2, Save, ChevronDown, HelpCircle } from "lucide-react";

export interface AdminMcq {
  id: string;
  question_text: string;
  options: string[];
  correct_option_index: number;
  explanation: string | null;
  display_order: number;
}

interface Props {
  dayId: string;
  mcqs: AdminMcq[];
  onChanged: () => void;
}

const EMPTY = {
  question_text: "",
  options: ["", "", "", ""],
  correct_option_index: 0,
  explanation: "",
};

export default function McqEditor({ dayId, mcqs, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const startEdit = (m: AdminMcq) => {
    setAdding(false);
    setEditing(m.id);
    setForm({
      question_text: m.question_text,
      options: [...m.options],
      correct_option_index: m.correct_option_index,
      explanation: m.explanation || "",
    });
  };

  const startAdd = () => {
    setEditing(null);
    setAdding(true);
    setForm({ ...EMPTY, options: ["", "", "", ""] });
  };

  const save = async () => {
    if (!form.question_text.trim() || form.options.some((o) => !o.trim())) {
      toast.error("Question and all options are required");
      return;
    }
    setSaving(true);
    try {
      if (adding) {
        await api.post(`/admin/days/${dayId}/mcqs`, {
          ...form,
          display_order: mcqs.length,
        });
        toast.success("Question added");
      } else if (editing) {
        await api.patch(`/admin/mcqs/${editing}`, form);
        toast.success("Question updated");
      }
      setEditing(null);
      setAdding(false);
      onChanged();
    } catch (err: any) {
      toast.error(getErrorMessage(err, "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this question?")) return;
    await api.delete(`/admin/mcqs/${id}`);
    toast.success("Question deleted");
    onChanged();
  };

  const editorForm = (
    <div className="space-y-3 bg-white rounded-xl border border-brand-primary/20 p-4">
      <textarea
        value={form.question_text}
        onChange={(e) => setForm((f) => ({ ...f, question_text: e.target.value }))}
        placeholder="Question text"
        rows={2}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
      />
      {form.options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="radio"
            name="correct"
            checked={form.correct_option_index === i}
            onChange={() => setForm((f) => ({ ...f, correct_option_index: i }))}
            title="Mark as correct answer"
          />
          <input
            value={opt}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                options: f.options.map((o, j) => (j === i ? e.target.value : o)),
              }))
            }
            placeholder={`Option ${String.fromCharCode(65 + i)}`}
            className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-primary/50"
          />
        </div>
      ))}
      <textarea
        value={form.explanation}
        onChange={(e) => setForm((f) => ({ ...f, explanation: e.target.value }))}
        placeholder="Explanation shown after submit (optional)"
        rows={2}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={save} disabled={saving}>
          <Save size={13} className="mr-1" /> {saving ? "Saving…" : "Save question"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setEditing(null); setAdding(false); }}>
          Cancel
        </Button>
      </div>
    </div>
  );

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center gap-2.5 px-4 py-3 bg-white text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="w-7 h-7 rounded-lg bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
          <HelpCircle size={14} className="text-brand-primary" />
        </div>
        <span className="text-sm font-semibold text-brand-navy flex-1">
          Quiz questions ({mcqs.length})
        </span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="p-3 bg-gray-50 space-y-2">
          {mcqs.length === 0 && !adding && (
            <p className="text-xs text-gray-400 px-1 py-1">
              No questions yet — add one below or use bulk import.
            </p>
          )}
          {mcqs
            .slice()
            .sort((a, b) => a.display_order - b.display_order)
            .map((m, i) =>
              editing === m.id ? (
                <div key={m.id}>{editorForm}</div>
              ) : (
                <div key={m.id} className="flex items-start gap-2 bg-white rounded-lg border border-gray-100 px-3 py-2">
                  <span className="text-xs font-bold text-gray-300 mt-0.5 shrink-0">Q{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-brand-navy">{m.question_text}</p>
                    <p className="text-[11px] text-green-600 mt-0.5">
                      ✓ {m.options[m.correct_option_index]}
                    </p>
                  </div>
                  <button onClick={() => startEdit(m)} className="text-xs text-brand-primary font-semibold shrink-0">
                    Edit
                  </button>
                  <button onClick={() => remove(m.id)} className="text-gray-300 hover:text-red-500 shrink-0">
                    <Trash2 size={13} />
                  </button>
                </div>
              )
            )}

          {adding ? (
            editorForm
          ) : (
            <Button size="sm" variant="outline" onClick={startAdd} className="w-full sm:w-auto">
              <Plus size={13} className="mr-1" /> Add question
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
