"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import toast from "react-hot-toast";
import {
  Layers,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  GripVertical,
  Pencil,
  ArrowRight,
} from "lucide-react";
import { useReorder } from "@/hooks/useReorder";

interface Module {
  id: string;
  name: string;
  description: string | null;
  tagline: string | null;
  accent_color: string;
  skills_list: string[];
  display_order: number;
  is_published: boolean;
  day_count: number;
}

export default function AdminModulesPage() {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [skills, setSkills] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = await api.get("/admin/phases");
      setModules(res.data.phases);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const { list, handlers } = useReorder({
    items: modules,
    endpoint: "/admin/phases/reorder",
    onDone: load,
  });

  const create = async () => {
    if (!name.trim()) {
      toast.error("A module name is required");
      return;
    }
    setBusy(true);
    try {
      await api.post("/admin/phases", {
        name,
        tagline: tagline || null,
        skills_list: skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      toast.success("Module created — it stays hidden until you publish it");
      setAdding(false);
      setName("");
      setTagline("");
      setSkills("");
      load();
    } catch (err: any) {
      toast.error(getErrorMessage(err, "Could not create module"));
    } finally {
      setBusy(false);
    }
  };

  const rename = async (m: Module) => {
    const n = prompt("Module name:", m.name);
    if (n === null || !n.trim()) return;
    await api.patch(`/admin/phases/${m.id}`, { name: n });
    load();
  };

  const togglePublish = async (m: Module) => {
    const res = await api.patch(`/admin/phases/${m.id}/publish`);
    toast.success(res.data.is_published ? "Module published" : "Module hidden from learners");
    load();
  };

  const remove = async (m: Module) => {
    if (m.day_count > 0) {
      toast.error(`Move or delete its ${m.day_count} topic(s) first`);
      return;
    }
    if (!confirm(`Delete the module "${m.name}"?`)) return;
    try {
      await api.delete(`/admin/phases/${m.id}`);
      toast.success("Module deleted");
      load();
    } catch (err: any) {
      toast.error(getErrorMessage(err, "Could not delete module"));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-10 h-10 border-4 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6 lg:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
            <Layers size={16} className="text-brand-primary" />
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-brand-navy">Modules</h1>
        </div>
        <Button size="sm" onClick={() => setAdding((a) => !a)} className="w-full sm:w-auto">
          <Plus size={14} className="mr-1.5" /> New module
        </Button>
      </div>

      <div className="space-y-5 sm:space-y-6">
        {adding && (
          <Card className="border-brand-primary/30">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-primary mb-3">
              New module
            </h3>
            <div className="space-y-2.5">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Module name (e.g. React & Frontend)"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
              />
              <input
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Tagline (optional)"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
              />
              <input
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="Skills, comma separated — these show on learner résumés"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
              />
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <Button size="sm" onClick={create} disabled={busy} className="w-full sm:w-auto">
                  {busy ? "Creating…" : "Create module"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setAdding(false)}
                  disabled={busy}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        )}

        <div>
          <p className="text-xs text-gray-400 mb-3">
            Drag a module to change the order learners see. Topics live inside modules — open{" "}
            <Link href="/admin/days" className="text-brand-primary font-semibold">
              Topics
            </Link>{" "}
            to add lessons, videos, notes and quizzes.
          </p>

          <div className="space-y-2">
            {list.map((m) => (
              <Card key={m.id} className="!p-0 overflow-hidden">
                <div
                  {...handlers(m.id)}
                  className="flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-3 cursor-move"
                >
                  <GripVertical size={15} className="text-gray-300 shrink-0" />
                  <span
                    className="w-1.5 h-9 rounded-full shrink-0"
                    style={{ backgroundColor: m.accent_color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-brand-navy truncate">{m.name}</p>
                    <p className="text-[11px] text-gray-400 truncate">
                      {m.day_count} topic{m.day_count === 1 ? "" : "s"}
                      {m.tagline ? ` · ${m.tagline}` : ""}
                    </p>
                  </div>
                  <Badge variant={m.is_published ? "success" : "warning"}>
                    {m.is_published ? "Live" : "Hidden"}
                  </Badge>
                  <button
                    onClick={() => rename(m)}
                    className="text-gray-300 hover:text-brand-primary shrink-0"
                    title="Rename"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => togglePublish(m)}
                    className="text-gray-300 hover:text-brand-primary shrink-0"
                    title={m.is_published ? "Hide from learners" : "Publish"}
                  >
                    {m.is_published ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button
                    onClick={() => remove(m)}
                    className="text-gray-300 hover:text-red-500 shrink-0"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </Card>
            ))}

            {list.length === 0 && (
              <Card className="py-12 sm:py-16 px-5">
                <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <Layers size={24} className="text-gray-300" />
                </div>
                <p className="text-sm text-gray-400 text-center">
                  No modules yet. Create one to start building the curriculum.
                </p>
              </Card>
            )}
          </div>
        </div>

        <Link
          href="/admin/days"
          className="inline-flex items-center gap-1.5 text-sm text-brand-primary font-semibold"
        >
          Manage topics <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
