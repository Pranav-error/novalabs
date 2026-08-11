"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import {
  Save,
  CheckCircle2,
  Plus,
  Trash2,
  Sparkles,
  Download,
  Printer,
  Loader2,
  Github,
  Linkedin,
  Mail,
  ExternalLink,
  Briefcase,
  GraduationCap,
  Zap,
  X,
} from "lucide-react";

interface ExperienceEntry {
  title: string;
  company: string;
  duration: string;
  description: string;
}

interface EducationEntry {
  degree: string;
  institution: string;
  year: string;
}

interface ResumeProject {
  day_number: number;
  description: string | null;
  github_url: string | null;
  live_url: string | null;
  stack_tags: string[];
  score: number | null;
}

interface AutoData {
  profile: {
    name: string;
    email: string;
    bio: string | null;
    github_url: string | null;
    linkedin_url: string | null;
  };
  stats: {
    total_xp: number;
    days_completed: number;
    avg_quiz_score: number;
  };
  projects: ResumeProject[];
  skills_learned: string[];
}

interface EditableData {
  headline: string;
  summary: string;
  experience: ExperienceEntry[];
  education: EducationEntry[];
  custom_skills: string[];
}

interface Analysis {
  score: number;
  suggestions: string[];
  strengths: string[];
}

const EMPTY_EDITABLE: EditableData = {
  headline: "",
  summary: "",
  experience: [],
  education: [],
  custom_skills: [],
};

export default function ResumePage() {
  const [loading, setLoading] = useState(true);
  const [auto, setAuto] = useState<AutoData | null>(null);
  const [editable, setEditable] = useState<EditableData>(EMPTY_EDITABLE);
  const [skillInput, setSkillInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    api
      .get("/resume")
      .then((res) => {
        setAuto(res.data.auto);
        setEditable({ ...EMPTY_EDITABLE, ...res.data.editable });
      })
      .catch(() => setError("Failed to load resume data."))
      .finally(() => setLoading(false));
  }, []);

  const update = (patch: Partial<EditableData>) => {
    setEditable((prev) => ({ ...prev, ...patch }));
    setSaved(false);
  };

  const updateExperience = (i: number, patch: Partial<ExperienceEntry>) => {
    update({
      experience: editable.experience.map((e, idx) =>
        idx === i ? { ...e, ...patch } : e
      ),
    });
  };

  const updateEducation = (i: number, patch: Partial<EducationEntry>) => {
    update({
      education: editable.education.map((e, idx) =>
        idx === i ? { ...e, ...patch } : e
      ),
    });
  };

  const addSkill = () => {
    const skills = skillInput
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && !editable.custom_skills.includes(s));
    if (skills.length > 0) {
      update({ custom_skills: [...editable.custom_skills, ...skills] });
    }
    setSkillInput("");
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await api.patch("/resume", editable);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Failed to save resume. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError("");
    try {
      // Save first so analysis reflects current edits
      await api.patch("/resume", editable);
      const res = await api.post("/resume/analyze");
      setAnalysis(res.data);
    } catch {
      setError("Failed to analyze resume. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDownloadJson = async () => {
    try {
      const res = await api.get("/resume/export/json");
      const blob = new Blob([JSON.stringify(res.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "resume.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to export resume JSON.");
    }
  };

  const scoreColor = (score: number) =>
    score >= 70
      ? "text-emerald-600"
      : score >= 40
        ? "text-amber-600"
        : "text-red-500";

  const allSkills = [
    ...(auto?.skills_learned ?? []),
    ...editable.custom_skills,
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-brand-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="py-4 sm:py-6 lg:py-8 space-y-5 sm:space-y-6 lg:space-y-8">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #resume-preview, #resume-preview * { visibility: visible; }
          #resume-preview { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none; border: none; }
        }
      `}</style>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="font-display text-xl sm:text-2xl font-bold text-brand-navy">Resume Builder</h1>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={handleDownloadJson} className="flex-1 sm:flex-none">
            <Download size={16} className="mr-1.5" />
            Download JSON
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()} className="flex-1 sm:flex-none">
            <Printer size={16} className="mr-1.5" />
            Print / Save as PDF
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-500 font-medium">{error}</p>
      )}

      <div className="grid lg:grid-cols-5 gap-5 sm:gap-6 lg:gap-8 items-start">
        {/* ---------- Editor column ---------- */}
        <div className="lg:col-span-2 space-y-5 sm:space-y-6">
          <Card className="p-5 sm:p-6 lg:p-7">
            <h3 className="font-display text-lg font-bold text-brand-navy mb-4">Basics</h3>
            <Input
              label="Headline"
              value={editable.headline}
              placeholder="Full-Stack Developer in the making"
              onChange={(e) => update({ headline: e.target.value })}
            />
            <div className="mt-4">
              <label className="block text-sm font-medium text-brand-navy mb-1.5">
                Summary
              </label>
              <textarea
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-brand-navy placeholder:text-gray-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary resize-none"
                rows={4}
                value={editable.summary}
                placeholder="Built and shipped projects during the NOVA LABS 30-Day Challenge..."
                onChange={(e) => update({ summary: e.target.value })}
              />
            </div>
          </Card>

          <Card className="p-5 sm:p-6 lg:p-7">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-bold text-brand-navy">Experience</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  update({
                    experience: [
                      ...editable.experience,
                      { title: "", company: "", duration: "", description: "" },
                    ],
                  })
                }
              >
                <Plus size={16} className="mr-1" />
                Add
              </Button>
            </div>
            {editable.experience.length === 0 && (
              <div className="py-6 text-center">
                <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <Briefcase size={18} className="text-gray-300" />
                </div>
                <p className="text-sm text-gray-400">No experience entries yet.</p>
              </div>
            )}
            <div className="space-y-4">
              {editable.experience.map((exp, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-gray-100 p-4 space-y-3"
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <Input
                        label="Title"
                        value={exp.title}
                        placeholder="Frontend Developer"
                        onChange={(e) =>
                          updateExperience(i, { title: e.target.value })
                        }
                      />
                    </div>
                    <button
                      className="mt-8 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                      onClick={() =>
                        update({
                          experience: editable.experience.filter(
                            (_, idx) => idx !== i
                          ),
                        })
                      }
                      aria-label="Remove experience"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="Company"
                      value={exp.company}
                      onChange={(e) =>
                        updateExperience(i, { company: e.target.value })
                      }
                    />
                    <Input
                      label="Duration"
                      value={exp.duration}
                      placeholder="2024 – Present"
                      onChange={(e) =>
                        updateExperience(i, { duration: e.target.value })
                      }
                    />
                  </div>
                  <textarea
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-brand-navy placeholder:text-gray-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary resize-none"
                    rows={2}
                    value={exp.description}
                    placeholder="What did you build or improve?"
                    onChange={(e) =>
                      updateExperience(i, { description: e.target.value })
                    }
                  />
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5 sm:p-6 lg:p-7">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-bold text-brand-navy">Education</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  update({
                    education: [
                      ...editable.education,
                      { degree: "", institution: "", year: "" },
                    ],
                  })
                }
              >
                <Plus size={16} className="mr-1" />
                Add
              </Button>
            </div>
            {editable.education.length === 0 && (
              <div className="py-6 text-center">
                <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <GraduationCap size={18} className="text-gray-300" />
                </div>
                <p className="text-sm text-gray-400">No education entries yet.</p>
              </div>
            )}
            <div className="space-y-4">
              {editable.education.map((edu, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-gray-100 p-4 space-y-3"
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <Input
                        label="Degree"
                        value={edu.degree}
                        placeholder="B.Tech Computer Science"
                        onChange={(e) =>
                          updateEducation(i, { degree: e.target.value })
                        }
                      />
                    </div>
                    <button
                      className="mt-8 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                      onClick={() =>
                        update({
                          education: editable.education.filter(
                            (_, idx) => idx !== i
                          ),
                        })
                      }
                      aria-label="Remove education"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="Institution"
                      value={edu.institution}
                      onChange={(e) =>
                        updateEducation(i, { institution: e.target.value })
                      }
                    />
                    <Input
                      label="Year"
                      value={edu.year}
                      placeholder="2025"
                      onChange={(e) =>
                        updateEducation(i, { year: e.target.value })
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5 sm:p-6 lg:p-7">
            <h3 className="font-display text-lg font-bold text-brand-navy mb-4">
              Custom Skills
            </h3>
            <div className="flex gap-2">
              <div className="flex-1 min-w-0">
                <Input
                  value={skillInput}
                  placeholder="TypeScript, Git, Figma"
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSkill();
                    }
                  }}
                />
              </div>
              <Button size="sm" variant="outline" onClick={addSkill} className="flex-shrink-0">
                <Plus size={16} />
              </Button>
            </div>
            {editable.custom_skills.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {editable.custom_skills.map((skill) => (
                  <Badge key={skill} variant="info">
                    {skill}
                    <button
                      className="ml-1.5 hover:text-red-500 transition-colors"
                      onClick={() =>
                        update({
                          custom_skills: editable.custom_skills.filter(
                            (s) => s !== skill
                          ),
                        })
                      }
                      aria-label={`Remove ${skill}`}
                    >
                      <X size={12} />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </Card>

          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
            <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
              {saving ? (
                "Saving..."
              ) : saved ? (
                <>
                  <CheckCircle2 size={16} className="mr-1.5" />
                  Saved
                </>
              ) : (
                <>
                  <Save size={16} className="mr-1.5" />
                  Save
                </>
              )}
            </Button>
            <Button
              variant="secondary"
              onClick={handleAnalyze}
              disabled={analyzing}
              className="w-full sm:w-auto"
            >
              {analyzing ? (
                <>
                  <Loader2 size={16} className="mr-1.5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles size={16} className="mr-1.5" />
                  Analyze Resume
                </>
              )}
            </Button>
            {saved && (
              <span className="text-sm text-emerald-600 font-medium">
                Saved ✓
              </span>
            )}
          </div>

          {analysis && (
            <Card className="p-5 sm:p-6 lg:p-7">
              <div className="flex items-center gap-4 mb-4">
                <p
                  className={`text-4xl sm:text-5xl font-bold flex-shrink-0 ${scoreColor(analysis.score)}`}
                >
                  {analysis.score}
                </p>
                <div>
                  <h3 className="font-display text-lg font-bold text-brand-navy">
                    Resume Score
                  </h3>
                  <p className="text-sm text-gray-500">out of 100</p>
                </div>
              </div>
              {analysis.strengths.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-brand-navy mb-2">
                    Strengths
                  </h4>
                  <ul className="space-y-1.5">
                    {analysis.strengths.map((s, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-gray-600"
                      >
                        <CheckCircle2
                          size={16}
                          className="text-emerald-500 mt-0.5 shrink-0"
                        />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {analysis.suggestions.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-brand-navy mb-2">
                    Suggestions
                  </h4>
                  <ul className="space-y-1.5">
                    {analysis.suggestions.map((s, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-gray-600"
                      >
                        <Sparkles
                          size={16}
                          className="text-amber-500 mt-0.5 shrink-0"
                        />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* ---------- Preview column ---------- */}
        <div className="lg:col-span-3">
          <Card id="resume-preview" className="p-5 sm:p-8 overflow-hidden">
            {/* Header */}
            <h2 className="text-2xl sm:text-3xl font-bold text-brand-navy break-words">
              {auto?.profile.name || "Your Name"}
            </h2>
            {editable.headline && (
              <p className="text-base sm:text-lg text-brand-primary font-medium mt-1">
                {editable.headline}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-gray-500">
              {auto?.profile.email && (
                <span className="inline-flex items-center gap-1 min-w-0">
                  <Mail size={14} className="flex-shrink-0" />
                  <span className="truncate">{auto.profile.email}</span>
                </span>
              )}
              {auto?.profile.github_url && (
                <span className="inline-flex items-center gap-1">
                  <Github size={14} />
                  {auto.profile.github_url.replace(/^https?:\/\//, "")}
                </span>
              )}
              {auto?.profile.linkedin_url && (
                <span className="inline-flex items-center gap-1">
                  <Linkedin size={14} />
                  {auto.profile.linkedin_url.replace(/^https?:\/\//, "")}
                </span>
              )}
            </div>

            {/* Summary */}
            {editable.summary && (
              <p className="mt-5 text-sm text-gray-700 leading-relaxed">
                {editable.summary}
              </p>
            )}

            {/* Skills */}
            {allSkills.length > 0 && (
              <section className="mt-6">
                <h3 className="text-sm font-bold text-brand-navy uppercase tracking-wide border-b border-gray-200 pb-1 mb-3">
                  Skills
                </h3>
                <div className="flex flex-wrap gap-2">
                  {allSkills.map((skill) => (
                    <Badge key={skill}>{skill}</Badge>
                  ))}
                </div>
              </section>
            )}

            {/* Challenge stats */}
            {auto && (
              <section className="mt-6">
                <h3 className="text-sm font-bold text-brand-navy uppercase tracking-wide border-b border-gray-200 pb-1 mb-3">
                  NOVA LABS 30-Day Challenge
                </h3>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-700">
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-500" />
                    {auto.stats.days_completed}/30 days completed
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Zap size={14} className="text-brand-primary" />
                    {auto.stats.total_xp} XP earned
                  </span>
                  {auto.stats.avg_quiz_score > 0 && (
                    <span className="inline-flex items-center gap-1.5">
                      <Sparkles size={14} className="text-amber-500" />
                      {auto.stats.avg_quiz_score}% avg quiz score
                    </span>
                  )}
                </div>
              </section>
            )}

            {/* Projects */}
            {auto && auto.projects.length > 0 && (
              <section className="mt-6">
                <h3 className="text-sm font-bold text-brand-navy uppercase tracking-wide border-b border-gray-200 pb-1 mb-3">
                  Projects
                </h3>
                <div className="space-y-4">
                  {auto.projects.map((project, i) => (
                    <div key={i}>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-brand-navy">
                          Day {project.day_number} Project
                        </p>
                        {project.score != null && (
                          <Badge variant="success">{project.score}/100</Badge>
                        )}
                        {project.stack_tags.map((tag) => (
                          <Badge key={tag} variant="info">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      {project.description && (
                        <p className="text-sm text-gray-600 mt-1">
                          {project.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-brand-primary">
                        {project.github_url && (
                          <a
                            href={project.github_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 hover:underline"
                          >
                            <Github size={12} />
                            {project.github_url.replace(/^https?:\/\//, "")}
                          </a>
                        )}
                        {project.live_url && (
                          <a
                            href={project.live_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 hover:underline"
                          >
                            <ExternalLink size={12} />
                            {project.live_url.replace(/^https?:\/\//, "")}
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Experience */}
            {editable.experience.length > 0 && (
              <section className="mt-6">
                <h3 className="text-sm font-bold text-brand-navy uppercase tracking-wide border-b border-gray-200 pb-1 mb-3">
                  Experience
                </h3>
                <div className="space-y-4">
                  {editable.experience.map((exp, i) => (
                    <div key={i}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold text-brand-navy inline-flex items-center gap-1.5">
                          <Briefcase size={14} className="text-gray-400" />
                          {exp.title || "Untitled role"}
                          {exp.company && (
                            <span className="font-normal text-gray-500">
                              · {exp.company}
                            </span>
                          )}
                        </p>
                        {exp.duration && (
                          <span className="text-xs text-gray-400">
                            {exp.duration}
                          </span>
                        )}
                      </div>
                      {exp.description && (
                        <p className="text-sm text-gray-600 mt-1">
                          {exp.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Education */}
            {editable.education.length > 0 && (
              <section className="mt-6">
                <h3 className="text-sm font-bold text-brand-navy uppercase tracking-wide border-b border-gray-200 pb-1 mb-3">
                  Education
                </h3>
                <div className="space-y-3">
                  {editable.education.map((edu, i) => (
                    <div
                      key={i}
                      className="flex flex-wrap items-baseline justify-between gap-2"
                    >
                      <p className="text-sm font-semibold text-brand-navy inline-flex items-center gap-1.5">
                        <GraduationCap size={14} className="text-gray-400" />
                        {edu.degree || "Degree"}
                        {edu.institution && (
                          <span className="font-normal text-gray-500">
                            · {edu.institution}
                          </span>
                        )}
                      </p>
                      {edu.year && (
                        <span className="text-xs text-gray-400">
                          {edu.year}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
