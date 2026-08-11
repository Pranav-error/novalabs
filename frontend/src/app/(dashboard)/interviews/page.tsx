"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ProgressBar from "@/components/ui/ProgressBar";
import {
  Mic,
  Code2,
  Atom,
  Server,
  Database,
  Network,
  Users,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle2,
  XCircle,
  Trophy,
  RotateCcw,
  History,
  Sparkles,
} from "lucide-react";

interface Topic {
  id: string;
  name: string;
  question_count: number;
}

interface Question {
  id: string;
  question: string;
}

interface SessionData {
  session_id: string;
  topic: string;
  topic_name: string;
  questions: Question[];
}

interface ResultItem {
  question_id: string;
  question: string;
  your_answer: string;
  score: number;
  feedback: string;
  keywords_hit: string[];
  keywords_missed: string[];
  model_answer: string;
}

interface ResultsData {
  session_id: string;
  topic_name: string;
  total_score: number;
  results: ResultItem[];
}

interface HistoryItem {
  session_id: string;
  topic_name: string;
  status: string;
  total_score: number | null;
  started_at: string;
}

const TOPIC_ICONS: Record<string, React.ElementType> = {
  html_css: Code2,
  react: Atom,
  python_fastapi: Server,
  mongodb: Database,
  system_design: Network,
  hr_behavioural: Users,
};

export default function InterviewsPage() {
  const [stage, setStage] = useState<"topics" | "session" | "results">("topics");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [session, setSession] = useState<SessionData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentQ, setCurrentQ] = useState(0);
  const [results, setResults] = useState<ResultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadTopicsAndHistory = async () => {
    try {
      const [t, h] = await Promise.all([
        api.get("/interviews/topics"),
        api.get("/interviews/history"),
      ]);
      setTopics(t.data.topics);
      setHistory(h.data.sessions);
    } catch {
      setError("Failed to load interview topics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTopicsAndHistory();
  }, []);

  const startInterview = async (topicId: string) => {
    setStarting(topicId);
    setError("");
    try {
      const res = await api.post("/interviews/start", { topic: topicId });
      setSession(res.data);
      setAnswers({});
      setCurrentQ(0);
      setStage("session");
    } catch {
      setError("Failed to start interview. Please try again.");
    } finally {
      setStarting(null);
    }
  };

  const submitInterview = async () => {
    if (!session) return;
    setSubmitting(true);
    setError("");
    try {
      await api.post(`/interviews/${session.session_id}/submit`, { answers });
      const res = await api.get(`/interviews/${session.session_id}/results`);
      setResults(res.data);
      setStage("results");
      loadTopicsAndHistory();
    } catch {
      setError("Failed to submit answers. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const backToTopics = () => {
    setStage("topics");
    setSession(null);
    setResults(null);
    setAnswers({});
    setCurrentQ(0);
  };

  const viewPastResults = async (sessionId: string) => {
    try {
      const res = await api.get(`/interviews/${sessionId}/results`);
      setResults(res.data);
      setStage("results");
    } catch {
      setError("Failed to load results");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  /* ---------- Stage: Results ---------- */
  if (stage === "results" && results) {
    const scoreColor =
      results.total_score >= 70
        ? "text-emerald-600"
        : results.total_score >= 40
        ? "text-amber-600"
        : "text-red-500";

    return (
      <div className="py-4 sm:py-6 lg:py-8 space-y-5 sm:space-y-6 lg:space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-xl sm:text-2xl font-bold text-brand-navy">Interview Results</h1>
            <p className="text-gray-500 text-sm mt-1 truncate">{results.topic_name}</p>
          </div>
          <Button variant="outline" size="sm" onClick={backToTopics} className="w-full sm:w-auto flex-shrink-0">
            <RotateCcw className="w-4 h-4 mr-2" /> New Interview
          </Button>
        </div>

        <Card className="text-center py-8 sm:py-10 px-5">
          <div className="w-16 h-16 rounded-full bg-brand-primary/10 flex items-center justify-center mx-auto mb-3">
            <Trophy className="w-8 h-8 text-brand-primary" />
          </div>
          <div className={`text-4xl sm:text-5xl font-bold ${scoreColor}`}>{results.total_score}</div>
          <p className="text-gray-500 mt-1">out of 100</p>
          <div className="max-w-xs mx-auto mt-4">
            <ProgressBar value={results.total_score} max={100} />
          </div>
          <Badge variant="info" className="mt-4">
            <Sparkles className="w-3 h-3 mr-1" /> +20 XP earned
          </Badge>
        </Card>

        <div className="space-y-4">
          {results.results.map((r, i) => (
            <Card key={r.question_id} className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <h3 className="font-semibold text-brand-navy min-w-0 flex-1">
                  Q{i + 1}. {r.question}
                </h3>
                <Badge
                  variant={r.score >= 8 ? "success" : r.score >= 5 ? "info" : "warning"}
                  className="shrink-0"
                >
                  {r.score}/10
                </Badge>
              </div>

              <div className="mt-3 text-sm">
                <p className="text-gray-400 font-medium mb-1">Your answer</p>
                <p className="text-gray-700 whitespace-pre-wrap break-words">
                  {r.your_answer || <span className="italic text-gray-400">No answer given</span>}
                </p>
              </div>

              <p className="mt-3 text-sm text-brand-deep-blue font-medium">{r.feedback}</p>

              {(r.keywords_hit.length > 0 || r.keywords_missed.length > 0) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.keywords_hit.map((kw) => (
                    <span
                      key={kw}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700"
                    >
                      <CheckCircle2 className="w-3 h-3" /> {kw}
                    </span>
                  ))}
                  {r.keywords_missed.map((kw) => (
                    <span
                      key={kw}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-red-50 text-red-500"
                    >
                      <XCircle className="w-3 h-3" /> {kw}
                    </span>
                  ))}
                </div>
              )}

              <details className="mt-4 group">
                <summary className="cursor-pointer text-sm font-semibold text-brand-primary hover:underline select-none">
                  Show model answer
                </summary>
                <p className="mt-2 text-sm text-gray-700 bg-gray-50 rounded-xl p-4 whitespace-pre-wrap break-words">
                  {r.model_answer}
                </p>
              </details>
            </Card>
          ))}
        </div>

        <div className="flex justify-center pb-4 sm:pb-8">
          <Button onClick={backToTopics} className="w-full sm:w-auto">
            <RotateCcw className="w-4 h-4 mr-2" /> Practice Another Topic
          </Button>
        </div>
      </div>
    );
  }

  /* ---------- Stage: Session ---------- */
  if (stage === "session" && session) {
    const q = session.questions[currentQ];
    const answered = session.questions.filter((qq) => (answers[qq.id] || "").trim()).length;
    const isLast = currentQ === session.questions.length - 1;

    return (
      <div className="py-4 sm:py-6 lg:py-8 space-y-5 sm:space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-xl sm:text-2xl font-bold text-brand-navy truncate">{session.topic_name}</h1>
            <p className="text-gray-500 text-xs sm:text-sm mt-1">
              Question {currentQ + 1} of {session.questions.length} &middot; {answered} answered
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={backToTopics} className="flex-shrink-0">
            Quit
          </Button>
        </div>

        <ProgressBar value={currentQ + 1} max={session.questions.length} />

        <Card className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center shrink-0">
              <Mic className="w-5 h-5 text-brand-primary" />
            </div>
            <h2 className="text-base sm:text-lg font-semibold text-brand-navy pt-1.5 min-w-0">{q.question}</h2>
          </div>

          <textarea
            value={answers[q.id] || ""}
            onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
            placeholder="Type your answer here... Explain as if you're speaking to an interviewer. Aim for 3-5 sentences covering the key concepts."
            rows={8}
            className="mt-5 w-full rounded-xl border border-gray-200 p-4 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary resize-y"
          />
          <p className="text-xs text-gray-400 mt-2">
            {(answers[q.id] || "").length} characters — detailed answers score higher
          </p>
        </Card>

        {error && <p className="text-sm text-red-500 text-center">{error}</p>}

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={currentQ === 0}
            onClick={() => setCurrentQ((c) => c - 1)}
            className="w-full sm:w-auto"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Previous
          </Button>

          {isLast ? (
            <Button onClick={submitInterview} disabled={submitting} className="w-full sm:w-auto">
              {submitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Submit Interview
            </Button>
          ) : (
            <Button size="sm" onClick={() => setCurrentQ((c) => c + 1)} className="w-full sm:w-auto">
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-2 pb-4 sm:pb-8">
          {session.questions.map((qq, i) => (
            <button
              key={qq.id}
              onClick={() => setCurrentQ(i)}
              className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                i === currentQ
                  ? "bg-brand-primary text-white"
                  : (answers[qq.id] || "").trim()
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* ---------- Stage: Topics ---------- */
  return (
    <div className="py-4 sm:py-6 lg:py-8 space-y-5 sm:space-y-6 lg:space-y-8">
      <div>
        <h1 className="font-display text-xl sm:text-2xl font-bold text-brand-navy">Mock Interviews</h1>
        <p className="text-gray-500 text-sm sm:text-base mt-1">
          Practice interview questions, get instant feedback, and earn +20 XP per session.
        </p>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {topics.map((t) => {
          const Icon = TOPIC_ICONS[t.id] || Mic;
          return (
            <Card key={t.id} className="flex flex-col p-5 sm:p-6">
              <div className="w-12 h-12 rounded-xl bg-brand-primary/10 flex items-center justify-center mb-4">
                <Icon className="w-6 h-6 text-brand-primary" />
              </div>
              <h3 className="font-semibold text-brand-navy">{t.name}</h3>
              <p className="text-sm text-gray-400 mt-1 mb-4">
                5 questions per session &middot; {t.question_count} in bank
              </p>
              <Button
                size="sm"
                className="mt-auto w-full"
                onClick={() => startInterview(t.id)}
                disabled={starting !== null}
              >
                {starting === t.id ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Mic className="w-4 h-4 mr-2" />
                )}
                Start Interview
              </Button>
            </Card>
          );
        })}
      </div>

      {history.length > 0 && (
        <Card className="p-5 sm:p-6 lg:p-7">
          <h2 className="font-display text-lg font-bold text-brand-navy mb-4 sm:mb-5 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
              <History size={14} className="text-brand-primary" />
            </div>
            Past Sessions
          </h2>
          <div className="space-y-2">
            {history.slice(0, 10).map((h) => (
              <div
                key={h.session_id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100/70 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-medium text-brand-navy text-sm truncate">{h.topic_name}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(h.started_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {h.status === "completed" ? (
                    <>
                      <Badge variant={h.total_score !== null && h.total_score >= 70 ? "success" : "info"}>
                        {h.total_score}/100
                      </Badge>
                      <Button variant="ghost" size="sm" onClick={() => viewPastResults(h.session_id)}>
                        View
                      </Button>
                    </>
                  ) : (
                    <Badge variant="warning">In progress</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
