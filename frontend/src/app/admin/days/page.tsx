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
  BookOpen,
  ChevronDown,
  Save,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Trash2,
  GripVertical,
  ExternalLink,
  Layers,
  AlertTriangle,
} from "lucide-react";
import McqEditor, { AdminMcq } from "@/components/admin/McqEditor";
import VideoManager, { AdminVideo } from "@/components/admin/VideoManager";
import MaterialsManager, { AdminMaterial } from "@/components/admin/MaterialsManager";
import RubricManager, { AdminRubricItem } from "@/components/admin/RubricManager";
import BulkMcqImport from "@/components/admin/BulkMcqImport";
import { useReorder } from "@/hooks/useReorder";

interface TopicRow {
  id: string;
  phase_id: string;
  day_number: number;
  title: string;
  is_published: boolean;
  language: string;
}

interface ModuleGroup {
  id: string;
  name: string;
  display_order: number;
  is_published: boolean;
  accent_color: string;
  days: TopicRow[];
}

interface TopicDetail {
  id: string;
  phase_id: string;
  day_number: number;
  title: string;
  estimated_time: string | null;
  lesson_content: string | null;
  assignment_prompt: string | null;
  starter_code: string | null;
  reference_solution: string | null;
  language: string;
  version: number;
  is_published: boolean;
  mcqs: AdminMcq[];
  videos: AdminVideo[];
  materials: AdminMaterial[];
  rubric_items: AdminRubricItem[];
}

export default function AdminTopicsPage() {
  const [modules, setModules] = useState<ModuleGroup[]>([]);
  const [orphans, setOrphans] = useState<TopicRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openTopic, setOpenTopic] = useState<string | null>(null);
  const [detail, setDetail] = useState<TopicDetail | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [bulkFor, setBulkFor] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await api.get("/admin/days");
      setModules(res.data.modules ?? []);
      setOrphans(res.data.orphan_days ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const refreshDetail = async (id: string) => {
    const res = await api.get(`/admin/days/${id}`);
    setDetail(res.data);
  };

  const openEditor = async (topicId: string) => {
    if (openTopic === topicId) {
      setOpenTopic(null);
      return;
    }
    setOpenTopic(topicId);
    setDetail(null);
    setBulkFor(null);
    const res = await api.get(`/admin/days/${topicId}`);
    setDetail(res.data);
    setForm({
      title: res.data.title || "",
      estimated_time: res.data.estimated_time || "",
      lesson_content: res.data.lesson_content || "",
      assignment_prompt: res.data.assignment_prompt || "",
      starter_code: res.data.starter_code || "",
      reference_solution: res.data.reference_solution || "",
      language: res.data.language || "html",
      phase_id: res.data.phase_id || "",
    });
  };

  const save = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      const res = await api.put(`/admin/days/${detail.id}`, form);
      toast.success(`Saved (v${res.data.version})`);
      load();
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (topicId: string) => {
    const res = await api.patch(`/admin/days/${topicId}/publish`);
    toast.success(res.data.is_published ? "Published" : "Unpublished (hidden from learners)");
    load();
  };

  const createTopic = async (moduleId: string) => {
    if (!newTitle.trim()) {
      toast.error("A topic title is required");
      return;
    }
    try {
      const res = await api.post("/admin/days", { phase_id: moduleId, title: newTitle });
      toast.success(`Topic created as Day ${res.data.day_number}`);
      setAddingTo(null);
      setNewTitle("");
      load();
    } catch (err: any) {
      toast.error(getErrorMessage(err, "Could not create topic"));
    }
  };

  const deleteTopic = async (t: TopicRow) => {
    const go = async (force: boolean) => {
      const url = `/admin/days/${t.id}${force ? "?force=true" : ""}`;
      return api.delete(url);
    };
    if (!confirm(`Delete "${t.title}" (Day ${t.day_number}) and all its content?`)) return;
    try {
      await go(false);
      toast.success("Topic deleted");
      load();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (detail?.counts) {
        const lines = Object.entries(detail.counts)
          .filter(([, n]) => (n as number) > 0)
          .map(([k, n]) => `${n} ${k.replace(/_/g, " ")}`)
          .join(", ");
        if (
          confirm(
            `${detail.message}\n\n${lines}\n\nThat learner data will be orphaned. Delete anyway?`
          )
        ) {
          await go(true);
          toast.success("Topic deleted");
          load();
        }
      } else {
        toast.error(typeof detail === "string" ? detail : "Could not delete topic");
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-10 h-10 border-4 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
      </div>
    );
  }

  const renderTopic = (t: TopicRow, dragHandlers: any) => (
    <Card key={t.id} className="!p-0 overflow-hidden">
      <div className="flex items-center gap-2 sm:gap-2.5 px-3 py-3 sm:px-4" {...dragHandlers}>
        <GripVertical size={14} className="text-gray-300 shrink-0 cursor-move" />
        <button
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
          onClick={() => openEditor(t.id)}
        >
          <span className="w-8 h-8 rounded-lg bg-brand-primary/10 text-brand-primary text-xs font-bold flex items-center justify-center shrink-0">
            {t.day_number}
          </span>
          <span className="flex-1 text-sm font-semibold text-brand-navy truncate">
            {t.title}
          </span>
        </button>
        <Badge variant={t.is_published ? "success" : "warning"}>
          {t.is_published ? "Published" : "Draft"}
        </Badge>
        <a
          href={`/days/${t.day_number}?preview=1`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-300 hover:text-brand-primary shrink-0"
          title="Preview as a learner"
        >
          <ExternalLink size={14} />
        </a>
        <button
          onClick={() => deleteTopic(t)}
          className="text-gray-300 hover:text-red-500 shrink-0"
          title="Delete topic"
        >
          <Trash2 size={14} />
        </button>
        <button onClick={() => openEditor(t.id)} className="shrink-0">
          <ChevronDown
            size={16}
            className={`text-gray-400 transition-transform ${
              openTopic === t.id ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>

      {openTopic === t.id && (
        <div className="border-t border-gray-100 p-3 sm:p-4 lg:p-5 bg-gray-50/50">
          {!detail ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
              <Loader2 size={14} className="animate-spin" /> Loading content…
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {/* Basic info */}
              <div className="rounded-xl border border-gray-100 bg-white p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-brand-primary mb-3">
                  Basic info
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                      Module
                    </label>
                    <select
                      value={form.phase_id ?? detail.phase_id ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, phase_id: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                    >
                      {modules.map((mod) => (
                        <option key={mod.id} value={mod.id}>
                          {mod.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Moving a topic only regroups it — the day number and all learner
                      progress stay exactly as they are.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                      Title
                    </label>
                    <input
                      value={form.title}
                      onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                        Estimated time (e.g. 2 hrs)
                      </label>
                      <input
                        value={form.estimated_time}
                        onChange={(e) => setForm((s) => ({ ...s, estimated_time: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                        Language (html / javascript / python)
                      </label>
                      <input
                        value={form.language}
                        onChange={(e) => setForm((s) => ({ ...s, language: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Lesson content */}
              <div className="rounded-xl border border-gray-100 bg-white p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-brand-primary mb-3">
                  Lesson content
                </h3>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                  Markdown
                </label>
                <textarea
                  value={form.lesson_content}
                  onChange={(e) => setForm((s) => ({ ...s, lesson_content: e.target.value }))}
                  rows={12}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-brand-navy font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                />
              </div>

              {/* Assignment & code */}
              <div className="rounded-xl border border-gray-100 bg-white p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-brand-primary mb-3">
                  Assignment &amp; code
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                      Assignment prompt (markdown)
                    </label>
                    <textarea
                      value={form.assignment_prompt}
                      onChange={(e) => setForm((s) => ({ ...s, assignment_prompt: e.target.value }))}
                      rows={5}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-brand-navy font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                    />
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                        Starter code
                      </label>
                      <textarea
                        value={form.starter_code}
                        onChange={(e) => setForm((s) => ({ ...s, starter_code: e.target.value }))}
                        rows={6}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-brand-navy font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                        Reference solution
                      </label>
                      <textarea
                        value={form.reference_solution}
                        onChange={(e) => setForm((s) => ({ ...s, reference_solution: e.target.value }))}
                        rows={6}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-brand-navy font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <VideoManager
                dayId={detail.id}
                videos={detail.videos ?? []}
                onChanged={() => refreshDetail(detail.id)}
              />
              <MaterialsManager
                dayId={detail.id}
                materials={detail.materials ?? []}
                onChanged={() => refreshDetail(detail.id)}
              />
              <McqEditor
                dayId={detail.id}
                mcqs={detail.mcqs}
                onChanged={() => refreshDetail(detail.id)}
              />

              {bulkFor === detail.id ? (
                <BulkMcqImport
                  dayId={detail.id}
                  onChanged={() => refreshDetail(detail.id)}
                  onClose={() => setBulkFor(null)}
                />
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setBulkFor(detail.id)}
                  className="w-full sm:w-auto"
                >
                  <Plus size={13} className="mr-1" /> Bulk import MCQs
                </Button>
              )}

              <RubricManager
                dayId={detail.id}
                items={detail.rubric_items ?? []}
                onChanged={() => refreshDetail(detail.id)}
              />

              <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1 border-t border-gray-100">
                <div className="flex flex-col sm:flex-row flex-wrap gap-2 flex-1">
                  <Button size="sm" onClick={save} disabled={saving} className="w-full sm:w-auto">
                    <Save size={14} className="mr-1.5" />
                    {saving ? "Saving…" : "Save changes"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => togglePublish(t.id)}
                    className="w-full sm:w-auto"
                  >
                    {t.is_published ? (
                      <>
                        <EyeOff size={14} className="mr-1.5" /> Unpublish
                      </>
                    ) : (
                      <>
                        <Eye size={14} className="mr-1.5" /> Publish
                      </>
                    )}
                  </Button>
                  <a
                    href={`/days/${t.day_number}?preview=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto"
                  >
                    <Button size="sm" variant="ghost" className="w-full sm:w-auto">
                      <ExternalLink size={14} className="mr-1.5" /> Preview as learner
                    </Button>
                  </a>
                </div>
                <span className="text-[11px] text-gray-400 sm:flex-shrink-0">
                  version {detail.version}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );

  return (
    <div className="space-y-5 sm:space-y-6 lg:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
            <BookOpen size={16} className="text-brand-primary" />
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-brand-navy">Topics</h1>
        </div>
        <Link href="/admin/modules" className="w-full sm:w-auto">
          <Button size="sm" variant="outline" className="w-full sm:w-auto">
            <Layers size={14} className="mr-1.5" /> Manage modules
          </Button>
        </Link>
      </div>

      <div className="space-y-6 sm:space-y-8">
        {modules.map((m) => (
          <ModuleSection
            key={m.id}
            module={m}
            renderTopic={renderTopic}
            onReordered={load}
            addingTo={addingTo}
            setAddingTo={setAddingTo}
            newTitle={newTitle}
            setNewTitle={setNewTitle}
            createTopic={createTopic}
          />
        ))}

        {orphans.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-6 h-6 rounded-md bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={12} className="text-red-500" />
              </div>
              <h2 className="text-sm font-bold text-red-500">
                Topics with no module ({orphans.length})
              </h2>
            </div>
            <div className="space-y-2">{orphans.map((t) => renderTopic(t, {}))}</div>
          </div>
        )}

        {modules.length === 0 && (
          <Card className="py-12 sm:py-16 px-5">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Layers size={24} className="text-gray-300" />
            </div>
            <p className="text-sm text-gray-400 text-center">
              No modules yet.{" "}
              <Link href="/admin/modules" className="text-brand-primary font-semibold">
                Create a module
              </Link>{" "}
              before adding topics.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

/** One module heading plus its drag-reorderable topics. */
function ModuleSection({
  module: m,
  renderTopic,
  onReordered,
  addingTo,
  setAddingTo,
  newTitle,
  setNewTitle,
  createTopic,
}: {
  module: ModuleGroup;
  renderTopic: (t: TopicRow, handlers: any) => React.ReactNode;
  onReordered: () => void;
  addingTo: string | null;
  setAddingTo: (id: string | null) => void;
  newTitle: string;
  setNewTitle: (t: string) => void;
  createTopic: (moduleId: string) => void;
}) {
  // Reordering permutes only this module's day numbers.
  const { list, handlers } = useReorder({
    items: m.days,
    endpoint: "/admin/days/reorder",
    field: "day_number",
    onDone: onReordered,
  });

  return (
    <div>
      <div className="flex items-center flex-wrap gap-x-2 gap-y-1.5 mb-2.5">
        <span
          className="w-1.5 h-5 rounded-full flex-shrink-0"
          style={{ backgroundColor: m.accent_color }}
        />
        <h2 className="text-sm font-bold text-brand-navy">{m.name}</h2>
        {!m.is_published && <Badge variant="warning">Module hidden</Badge>}
        <span className="text-[11px] text-gray-400">
          {m.days.length} topic{m.days.length === 1 ? "" : "s"}
        </span>
        <button
          onClick={() => setAddingTo(addingTo === m.id ? null : m.id)}
          className="ml-auto text-xs text-brand-primary font-semibold flex items-center gap-1"
        >
          <Plus size={13} /> Add topic
        </button>
      </div>

      {addingTo === m.id && (
        <Card className="mb-2.5 border-brand-primary/30">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createTopic(m.id)}
              placeholder="Topic title"
              autoFocus
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => createTopic(m.id)} className="flex-1 sm:flex-none">
                Create
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setAddingTo(null)}
                className="flex-1 sm:flex-none"
              >
                Cancel
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5">
            Added at the end of the curriculum as a draft. Drag to reposition.
          </p>
        </Card>
      )}

      <div className="space-y-2">
        {list.map((t) => renderTopic(t, handlers(t.id)))}
        {list.length === 0 && (
          <p className="text-xs text-gray-400 px-1 py-2">No topics in this module yet.</p>
        )}
      </div>
    </div>
  );
}
