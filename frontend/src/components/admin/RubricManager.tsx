"use client";

import { useState } from "react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import Button from "@/components/ui/Button";
import toast from "react-hot-toast";
import { ClipboardCheck, ChevronDown, Plus, Trash2, GripVertical } from "lucide-react";
import { useReorder } from "@/hooks/useReorder";

export interface AdminRubricItem {
  id: string;
  name: string;
  description: string | null;
  max_points: number;
  pass_fail_criteria: string | null;
  display_order: number;
}

interface Props {
  dayId: string;
  items: AdminRubricItem[];
  onChanged: () => void;
}

export default function RubricManager({ dayId, items, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [points, setPoints] = useState("10");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const sorted = items.slice().sort((a, b) => a.display_order - b.display_order);
  const { list, handlers } = useReorder({
    items: sorted,
    endpoint: `/admin/days/${dayId}/rubric-items/reorder`,
    onDone: onChanged,
  });

  const total = items.reduce((sum, i) => sum + i.max_points, 0);

  const reset = () => {
    setAdding(false);
    setName("");
    setPoints("10");
    setDescription("");
  };

  const add = async () => {
    const max = parseInt(points, 10);
    if (!name.trim() || !Number.isFinite(max) || max <= 0) {
      toast.error("A name and a positive point value are required");
      return;
    }
    setBusy(true);
    try {
      await api.post(`/admin/days/${dayId}/rubric-items`, {
        name,
        description: description || null,
        max_points: max,
        display_order: items.length,
      });
      toast.success("Criterion added");
      reset();
      onChanged();
    } catch (err: any) {
      toast.error(getErrorMessage(err, "Could not add criterion"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this rubric criterion?")) return;
    await api.delete(`/admin/rubric-items/${id}`);
    toast.success("Criterion deleted");
    onChanged();
  };

  const edit = async (item: AdminRubricItem) => {
    const n = prompt("Criterion name:", item.name);
    if (n === null || !n.trim()) return;
    const p = prompt("Max points:", String(item.max_points));
    if (p === null) return;
    const max = parseInt(p, 10);
    if (!Number.isFinite(max) || max <= 0) {
      toast.error("Max points must be a positive number");
      return;
    }
    await api.patch(`/admin/rubric-items/${item.id}`, { name: n, max_points: max });
    onChanged();
  };

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center gap-2.5 px-4 py-3 bg-white text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="w-7 h-7 rounded-lg bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
          <ClipboardCheck size={14} className="text-brand-primary" />
        </div>
        <span className="text-sm font-semibold text-brand-navy flex-1">
          Grading rubric ({items.length}
          {total > 0 && ` · ${total} pts`})
        </span>
        <ChevronDown
          size={14}
          className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="p-3 bg-gray-50 space-y-2">
          {list.length === 0 && !adding && (
            <p className="text-xs text-gray-400 px-1 py-2">
              No rubric yet. Add criteria and assignments for this topic can be scored
              against them instead of one overall number.
            </p>
          )}

          {list.map((item, i) => (
            <div
              key={item.id}
              {...handlers(item.id)}
              className="flex items-center gap-2.5 bg-white rounded-lg border border-gray-100 px-3 py-2 cursor-move"
            >
              <GripVertical size={13} className="text-gray-300 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-brand-navy truncate">
                  {i + 1}. {item.name}
                </p>
                {item.description && (
                  <p className="text-[10px] text-gray-400 truncate">{item.description}</p>
                )}
              </div>
              <span className="text-[10px] font-bold text-brand-primary shrink-0">
                {item.max_points} pts
              </span>
              <button
                onClick={() => edit(item)}
                className="text-xs text-brand-primary font-semibold shrink-0"
              >
                Edit
              </button>
              <button
                onClick={() => remove(item.id)}
                className="text-gray-300 hover:text-red-500 shrink-0"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}

          {!adding ? (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)} className="w-full sm:w-auto">
              <Plus size={13} className="mr-1" /> Add criterion
            </Button>
          ) : (
            <div className="space-y-2 bg-white rounded-xl border border-brand-primary/20 p-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Criterion (e.g. Correctness)"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
              />
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What earns full marks (optional)"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
              />
              <input
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                type="number"
                min={1}
                placeholder="Max points"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
              />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={add} disabled={busy}>
                  {busy ? "Adding…" : "Add"}
                </Button>
                <Button size="sm" variant="ghost" onClick={reset} disabled={busy}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
