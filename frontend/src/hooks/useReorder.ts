"use client";

import { useState } from "react";
import api from "@/lib/api";
import toast from "react-hot-toast";

interface Options<T> {
  items: T[];
  /** Endpoint that accepts { items: [{ id, [field]: number }] }. */
  endpoint: string;
  /** Which column the server reorders on. Topics renumber `day_number`. */
  field?: "display_order" | "day_number";
  /** Refetch after a successful write. */
  onDone: () => void | Promise<void>;
}

/**
 * Drag-to-reorder for any admin list.
 *
 * Reassigns the positions the items already occupy rather than numbering from
 * zero — so reordering topics inside one module permutes only that module's
 * day numbers and never collides with another module's.
 *
 * The list is reordered optimistically and rolled back if the write fails.
 */
export function useReorder<T extends { id: string } & Record<string, any>>({
  items,
  endpoint,
  field = "display_order",
  onDone,
}: Options<T>) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [preview, setPreview] = useState<T[] | null>(null);
  const [saving, setSaving] = useState(false);

  const list = preview ?? items;

  const handlers = (id: string) => ({
    draggable: true,
    onDragStart: () => setDragId(id),
    onDragEnd: () => {
      setDragId(null);
      setPreview(null);
    },
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      if (!dragId || dragId === id) return;
      const next = [...list];
      const from = next.findIndex((i) => i.id === dragId);
      const to = next.findIndex((i) => i.id === id);
      if (from < 0 || to < 0) return;
      next.splice(to, 0, next.splice(from, 1)[0]);
      setPreview(next);
    },
    onDrop: async (e: React.DragEvent) => {
      e.preventDefault();
      setDragId(null);
      if (!preview) return;

      // The slots stay the same; only which item sits in each one changes.
      const slots = items.map((i) => i[field] as number).sort((a, b) => a - b);
      const payload = {
        items: preview.map((item, idx) => ({ id: item.id, [field]: slots[idx] })),
      };

      setSaving(true);
      try {
        await api.post(endpoint, payload);
        setPreview(null);
        await onDone();
      } catch (err: any) {
        setPreview(null); // roll back to server truth
        const detail = err?.response?.data?.detail;
        toast.error(typeof detail === "string" ? detail : "Could not save the new order");
      } finally {
        setSaving(false);
      }
    },
  });

  return { list, handlers, dragId, saving };
}
