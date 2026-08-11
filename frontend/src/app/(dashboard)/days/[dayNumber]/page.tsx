"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import {
  ChevronLeft,
  ChevronRight,
  Lock,
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  Send,
  BookOpen,
  Code2,
  HelpCircle,
  FileText,
  Circle,
  MessageCircle,
  StickyNote,
  PlayCircle,
  Clock,
} from "lucide-react";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });
const NotesPanel = dynamic(() => import("@/components/days/NotesPanel"), { ssr: false });
const NotesEditor = dynamic(
  () => import("@/components/days/NotesPanel").then((m) => ({ default: m.NotesEditor })),
  { ssr: false }
);
const DoubtsThread = dynamic(() => import("@/components/days/DoubtsThread"), { ssr: false });
const CodeRunner = dynamic(() => import("@/components/days/CodeRunner"), { ssr: false });
import VideoLessons, { DayVideo } from "@/components/days/VideoLessons";
import DayMaterials, { DayMaterial } from "@/components/days/DayMaterials";
import Confetti from "@/components/ui/Confetti";
import DayGridLayout, { type DayWidget } from "@/components/days/DayGridLayout";
import CaptureGuard from "@/components/days/CaptureGuard";

interface MCQ {
  id: string;
  question_text: string;
  options: string[];
  display_order: number;
}

interface QuizResult {
  question_id: string;
  selected: number;
  correct: number;
  is_correct: boolean;
  explanation: string | null;
}

interface DayData {
  day_number: number;
  title: string;
  estimated_time: string | null;
  is_locked: boolean;
  lesson_content: string | null;
  assignment_prompt: string | null;
  // Absent from the locked-day payload, so these are optional on purpose.
  assignment_type?: string | null;
  starter_code?: string | null;
  language?: string | null;
  videos?: DayVideo[];
  materials?: DayMaterial[];
  /** Learner's email, stamped over the video player. */
  watermark?: string;
  /** True once the learner has paid — notes become downloadable. */
  can_download_materials?: boolean;
  mcqs?: MCQ[];
  progress: {
    status: string;
    best_quiz_score: number;
    quiz_attempts: number;
    scroll_completed?: boolean;
  } | null;
}

type Tab = "lesson" | "quiz" | "assignment";
/** Tabs inside the single "Workspace" widget on desktop. */
type WorkTab = "progress" | "quiz" | "assignment" | "doubts" | "notes";

/** True once mounted on a viewport wide enough for the draggable grid layout.
 *  Starts false so server and first client render agree. */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return isDesktop;
}

/** Prev/next day links. Module-level so the locked view can use it before the
 *  component has built the rest of its content. */
function footerNavFor(dayNumber: number) {
  return (
    <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-100">
      {dayNumber > 1 ? (
        <Link href={`/days/${dayNumber - 1}`}>
          <Button variant="outline" size="sm">
            <ChevronLeft size={16} className="mr-1" />
            Day {dayNumber - 1}
          </Button>
        </Link>
      ) : (
        <div />
      )}
      {dayNumber < 30 ? (
        <Link href={`/days/${dayNumber + 1}`}>
          <Button size="sm">
            Day {dayNumber + 1}
            <ChevronRight size={16} className="ml-1" />
          </Button>
        </Link>
      ) : (
        <Badge variant="success">Final Day!</Badge>
      )}
    </div>
  );
}

export default function DayPage() {
  const params = useParams();
  const dayNumber = parseInt(params.dayNumber as string);
  const { user } = useAuth();

  const [day, setDay] = useState<DayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("lesson");
  const [workTab, setWorkTab] = useState<WorkTab>("progress");
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const isDesktop = useIsDesktop();
  const [markingRead, setMarkingRead] = useState(false);
  const lessonEndRef = useRef<HTMLDivElement>(null);

  // Quiz state
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [quizResults, setQuizResults] = useState<Record<string, QuizResult>>({});
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  // Code editor state
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const fetchDay = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get(`/days/${dayNumber}`);
      setDay(res.data);
      setCode(res.data.starter_code || "");
      setSelectedAnswers({});
      setQuizSubmitted(false);
      setQuizScore(null);
      setQuizResults({});
      setSubmitted(false);
      setActiveVideoIndex(0);
    } catch (err: any) {
      setError(getErrorMessage(err, "Failed to load day content"));
    } finally {
      setLoading(false);
    }
  }, [dayNumber]);

  useEffect(() => {
    fetchDay();
  }, [fetchDay]);

  /** Records that the lesson has been read.
   *
   *  A day only completes when scroll_completed AND quiz_attempts >= 1, and
   *  nothing in either client ever called this endpoint — so no learner could
   *  complete a day, and progress sat at 0/30 forever.
   */
  const markLessonRead = async () => {
    if (markingRead || day?.progress?.scroll_completed) return;
    setMarkingRead(true);
    try {
      await api.post(`/days/${dayNumber}/mark-viewed`);
      await refreshProgress();
    } catch {
      // non-fatal: the learner can still take the quiz
    } finally {
      setMarkingRead(false);
    }
  };

  /** Mark the lesson read once its end scrolls into view.
   *
   *  A single observer covers both layouts: with `root: null` the browser
   *  accounts for clipping ancestors, so this fires whether the lesson scrolls
   *  inside its pane (desktop) or with the page (narrow screens). If the lesson
   *  is short enough not to scroll, the sentinel is on screen immediately and
   *  it marks straight away — which is correct, there is nothing left to read.
   */
  useEffect(() => {
    const sentinel = lessonEndRef.current;
    if (!sentinel || !day || day.progress?.scroll_completed) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) markLessonRead();
      },
      { threshold: 0.5 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayNumber, day?.lesson_content, day?.progress?.scroll_completed, isDesktop, activeTab]);

  /** Re-read just the progress block. A full fetchDay would reset the quiz UI
   *  and wipe the results the learner is still looking at. */
  const refreshProgress = async () => {
    try {
      const res = await api.get(`/days/${dayNumber}`);
      setDay((prev) => (prev ? { ...prev, progress: res.data.progress } : prev));
    } catch {
      // leave the last known progress in place
    }
  };

  const handleQuizSubmit = async () => {
    if (!day) return;
    setQuizSubmitting(true);
    try {
      const res = await api.post(`/days/${dayNumber}/quiz`, { answers: selectedAnswers });
      setQuizScore(res.data.score);
      const resultMap: Record<string, QuizResult> = {};
      for (const r of res.data.results || []) resultMap[r.question_id] = r;
      setQuizResults(resultMap);
      setQuizSubmitted(true);
      if (res.data.score === 100) {
        setCelebrate(true);
        setTimeout(() => setCelebrate(false), 3200);
      }
      // The attempt may have just completed the day — reflect it immediately.
      await refreshProgress();
    } catch (err: any) {
      setError(getErrorMessage(err, "Failed to submit quiz"));
    } finally {
      setQuizSubmitting(false);
    }
  };

  const handleAssignmentSubmit = async () => {
    if (!day) return;
    setSubmitting(true);
    try {
      await api.post(`/days/${dayNumber}/assignment`, {
        submission_type: day.assignment_type,
        content: code,
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(getErrorMessage(err, "Failed to submit assignment"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-4 sm:py-6 flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !day) {
    return (
      <div className="max-w-4xl mx-auto py-4 sm:py-6">
        <Card className="text-center py-12 sm:py-16 px-5">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Lock size={26} className="text-gray-300" />
          </div>
          <h2 className="font-display text-xl font-bold text-brand-navy mb-2">
            {error === "Payment required" ? "This day requires a paid plan" : error || "Day not found"}
          </h2>
          <p className="text-gray-500 mb-6">
            {error === "Payment required"
              ? "Unlock all 30 days to access this content."
              : "This content is not available yet."}
          </p>
          {error === "Payment required" && (
            <Link href="/checkout">
              <Button className="w-full sm:w-auto">Unlock All 30 Days</Button>
            </Link>
          )}
        </Card>
      </div>
    );
  }

  // A locked day returns only {day_number, title, is_locked, lesson_content} —
  // no language, no mcqs — so the full view cannot be rendered from it.
  if (day.is_locked) {
    return (
      <div className="max-w-4xl mx-auto py-4 sm:py-6">
        <Card className="text-center py-12 sm:py-16 px-5">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Lock size={26} className="text-gray-300" />
          </div>
          <Badge variant="premium">Day {dayNumber}</Badge>
          <h2 className="font-display text-xl font-bold text-brand-navy mt-3 mb-2">{day.title}</h2>
          <p className="text-gray-500 mb-6">
            Unlock all 30 days to open this lesson, its quiz and the assignment.
          </p>
          {/* /checkout, not the landing page's #pricing: everything under
              (dashboard) is already signed in, and the landing CTA sends people
              to /signup — which bounced logged-in learners to a signup form. */}
          <Link href="/checkout">
            <Button className="w-full sm:w-auto">Unlock All 30 Days</Button>
          </Link>
        </Card>
        {footerNavFor(dayNumber)}
      </div>
    );
  }

  const mcqs = day.mcqs ?? [];
  const allAnswered = mcqs.length > 0 && Object.keys(selectedAnswers).length === mcqs.length;
  const language = day.language || "javascript";
  const monacoLanguage = language === "html" ? "html" : language === "python" ? "python" : "javascript";

  const quizLabelSuffix = day.progress?.best_quiz_score ? ` (${day.progress.best_quiz_score}/10)` : "";

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "lesson", label: "Lesson", icon: <BookOpen size={16} /> },
    { id: "quiz", label: `Quiz${quizLabelSuffix}`, icon: <HelpCircle size={16} /> },
    { id: "assignment", label: "Assignment", icon: <Code2 size={16} /> },
  ];


  // ── Content blocks, shared by the stacked (narrow) and split (desktop) layouts ──

  const videoBlock = (
    <VideoLessons
      videos={day.videos ?? []}
      watermark={day.watermark}
      activeIndex={activeVideoIndex}
      onActiveIndexChange={setActiveVideoIndex}
    />
  );
  const videoPaneBlock = (
    <VideoLessons
      videos={day.videos ?? []}
      watermark={day.watermark}
      activeIndex={activeVideoIndex}
      onActiveIndexChange={setActiveVideoIndex}
      bare
    />
  );

  const lessonProse = (
    <div className="prose prose-brand max-w-none prose-headings:text-brand-navy prose-code:text-brand-primary prose-code:bg-brand-primary/5 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-900 prose-pre:text-gray-100">
      {day.lesson_content ? (
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{day.lesson_content}</ReactMarkdown>
      ) : (
        <p className="text-gray-400 text-center py-12">No lesson content yet.</p>
      )}
    </div>
  );

  /** Sentinel marking the end of the lesson; reaching it counts as read. */
  const lessonEnd = <div ref={lessonEndRef} className="h-px" aria-hidden />;

  const lessonBlock = (
    <>
      <DayMaterials materials={day.materials ?? []} canDownload={day.can_download_materials ?? false} />
      <Card className="mb-6">
        {lessonProse}
        {lessonEnd}
      </Card>
    </>
  );

  const hasVideo = (day.videos ?? []).length > 0;

  const lessonRead = !!day.progress?.scroll_completed;
  const quizDone = (day.progress?.quiz_attempts ?? 0) >= 1;
  const dayComplete = day.progress?.status === "completed";

  /** The two things a day needs, stated plainly. Learners were finishing the
   *  lesson and seeing nothing move, with no indication of what was missing. */
  const completionChecklist = (
    <Card className={`mb-5 sm:mb-6 ${dayComplete ? "border-green-200 bg-green-50/60" : ""}`}>
      {dayComplete ? (
        <div className="flex items-center gap-3 text-green-700">
          <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 size={18} />
          </div>
          <span className="font-semibold">Day {dayNumber} complete — nice work!</span>
        </div>
      ) : (
        <>
          <p className="font-semibold text-brand-navy mb-3">Finish Day {dayNumber}</p>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className={`flex items-center gap-2 text-sm ${lessonRead ? "text-green-700" : "text-gray-600"}`}>
                {lessonRead ? <CheckCircle2 size={16} className="flex-shrink-0" /> : <Circle size={16} className="text-gray-300 flex-shrink-0" />}
                Read the lesson
              </span>
              {!lessonRead && (
                <Button size="sm" variant="outline" onClick={markLessonRead} disabled={markingRead}>
                  {markingRead ? "Saving..." : "Mark as read"}
                </Button>
              )}
            </div>
            <div className={`flex items-center gap-2 text-sm ${quizDone ? "text-green-700" : "text-gray-600"}`}>
              {quizDone ? <CheckCircle2 size={16} className="flex-shrink-0" /> : <Circle size={16} className="text-gray-300 flex-shrink-0" />}
              Attempt the quiz
              {quizDone && day.progress?.best_quiz_score
                ? ` — best ${day.progress.best_quiz_score}/${mcqs.length || 10}`
                : ""}
            </div>
          </div>
        </>
      )}
    </Card>
  );

  const sortedVideos = [...(day.videos ?? [])].sort((a, b) => a.display_order - b.display_order);

  /** The course-video playlist, Udemy-style — lives in the Progress tab (not
   *  under the player itself), so switching parts and checking progress
   *  happen in the same place. Selecting an item here drives the same
   *  activeVideoIndex the video widget/block reads, so both stay in sync. */
  const videoPlaylistBlock = hasVideo && (
    <Card className="mb-5 sm:mb-6 !p-0 overflow-hidden">
      <p className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
        Course content — {sortedVideos.length} parts
      </p>
      <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
        {sortedVideos.map((v, i) => (
          <button
            key={v.id}
            onClick={() => setActiveVideoIndex(i)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
              i === activeVideoIndex ? "bg-brand-primary/5" : "hover:bg-gray-50"
            }`}
          >
            <div
              className={`w-14 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                i === activeVideoIndex ? "bg-brand-primary" : "bg-gray-900"
              }`}
            >
              <PlayCircle size={16} className="text-white/80" />
            </div>
            <span
              className={`flex-1 min-w-0 text-xs truncate ${
                i === activeVideoIndex ? "font-semibold text-brand-primary" : "font-medium text-gray-700"
              }`}
            >
              {i + 1}. {v.title}
            </span>
            {i === activeVideoIndex ? (
              <span className="text-[10px] font-semibold text-brand-primary shrink-0">Now playing</span>
            ) : (
              v.duration_minutes != null && (
                <span className="text-[10px] text-gray-300 inline-flex items-center gap-1 shrink-0">
                  <Clock size={10} /> {v.duration_minutes}m
                </span>
              )
            )}
          </button>
        ))}
      </div>
    </Card>
  );

  /** Lesson pane contents on desktop — no Card, the Pane is already the container. */
  const lessonPaneBody = (
    <>
      <DayMaterials materials={day.materials ?? []} canDownload={day.can_download_materials ?? false} />
      {lessonProse}
      {lessonEnd}
    </>
  );

  const quizBlock = (
    <div className="space-y-4 mb-6">
      {mcqs.length === 0 ? (
        <Card className="text-center py-12">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <HelpCircle size={24} className="text-gray-300" />
          </div>
          <p className="text-gray-400">No quiz questions for this day yet.</p>
        </Card>
      ) : (
        <>
          {mcqs
            .slice()
            .sort((a, b) => a.display_order - b.display_order)
            .map((mcq, qIndex) => {
              const selected = selectedAnswers[mcq.id];
              const result = quizResults[mcq.id];
              const isCorrect = result?.is_correct ?? false;

              return (
                <Card
                  key={mcq.id}
                  className={
                    quizSubmitted
                      ? isCorrect
                        ? "border-green-200 bg-green-50/50"
                        : "border-red-200 bg-red-50/50"
                      : ""
                  }
                >
                  <p className="font-semibold text-brand-navy mb-3">
                    <span className="text-brand-primary mr-2">Q{qIndex + 1}.</span>
                    {mcq.question_text}
                  </p>
                  <div className="space-y-2">
                    {mcq.options.map((option, oIndex) => {
                      const isSelected = selected === oIndex;
                      const isCorrectOption = result != null && oIndex === result.correct;
                      let optionClass = "border-gray-200 hover:border-brand-primary/50";

                      if (quizSubmitted) {
                        if (isCorrectOption) optionClass = "border-green-400 bg-green-50";
                        else if (isSelected && !isCorrectOption) optionClass = "border-red-400 bg-red-50";
                      } else if (isSelected) {
                        optionClass = "border-brand-primary bg-brand-primary/5";
                      }

                      return (
                        <button
                          key={oIndex}
                          onClick={() =>
                            !quizSubmitted && setSelectedAnswers((prev) => ({ ...prev, [mcq.id]: oIndex }))
                          }
                          disabled={quizSubmitted}
                          className={`w-full text-left p-3 rounded-lg border-2 text-sm transition-all flex items-center gap-3 ${optionClass}`}
                        >
                          <span
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                              isSelected ? "border-brand-primary bg-brand-primary text-white" : "border-gray-300"
                            }`}
                          >
                            {String.fromCharCode(65 + oIndex)}
                          </span>
                          {option}
                          {quizSubmitted && isCorrectOption && (
                            <CheckCircle2 size={16} className="ml-auto text-green-500 flex-shrink-0" />
                          )}
                          {quizSubmitted && isSelected && !isCorrectOption && (
                            <XCircle size={16} className="ml-auto text-red-500 flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {quizSubmitted && result?.explanation && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
                      <strong>Explanation:</strong> {result.explanation}
                    </div>
                  )}
                </Card>
              );
            })}

          {!quizSubmitted ? (
            <Button onClick={handleQuizSubmit} disabled={!allAnswered || quizSubmitting} className="w-full">
              {quizSubmitting
                ? "Submitting..."
                : `Submit Quiz (${Object.keys(selectedAnswers).length}/${mcqs.length} answered)`}
            </Button>
          ) : (
            <Card className="text-center">
              <div
                className={`text-4xl font-bold mb-2 ${
                  (quizScore || 0) >= 8 ? "text-green-600" : (quizScore || 0) >= 5 ? "text-amber-600" : "text-red-600"
                }`}
              >
                {quizScore}/{mcqs.length}
              </div>
              <p className="text-gray-500 text-sm mb-4">
                {(quizScore || 0) >= 8
                  ? "Excellent! Great understanding of the material."
                  : (quizScore || 0) >= 5
                  ? "Good — review the explanations above."
                  : "Review the material and retry."}
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedAnswers({});
                  setQuizSubmitted(false);
                  setQuizScore(null);
                  setQuizResults({});
                }}
              >
                <RotateCcw size={14} className="mr-2" />
                Retry Quiz
              </Button>
            </Card>
          )}
        </>
      )}
    </div>
  );

  const assignmentBlock = (
    <div className="space-y-4 mb-6">
      {day.assignment_prompt && (
        <Card>
          <h3 className="font-bold text-brand-navy mb-2 flex items-center gap-2">
            <FileText size={18} />
            Assignment
          </h3>
          <div className="prose prose-sm max-w-none text-gray-600">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{day.assignment_prompt}</ReactMarkdown>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-900 text-gray-300 text-sm">
          <span className="font-mono">{language.toUpperCase()} Editor</span>
          <div className="flex gap-2">
            <button
              onClick={() => setCode(day.starter_code || "")}
              className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 transition-colors"
            >
              <RotateCcw size={12} className="inline mr-1" />
              Reset
            </button>
          </div>
        </div>
        <MonacoEditor
          height="400px"
          language={monacoLanguage}
          value={code}
          onChange={(value) => setCode(value || "")}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            wordWrap: "on",
            tabSize: 2,
            padding: { top: 12 },
          }}
        />
      </Card>

      <CodeRunner language={monacoLanguage} code={code} />

      {submitted ? (
        <Card className="text-center bg-green-50 border-green-200">
          <CheckCircle2 size={32} className="mx-auto mb-2 text-green-600" />
          <p className="font-bold text-green-800">Assignment Submitted!</p>
          <p className="text-sm text-green-600">Your submission is being reviewed.</p>
        </Card>
      ) : (
        <Button onClick={handleAssignmentSubmit} disabled={submitting || !code.trim()} className="w-full">
          <Send size={16} className="mr-2" />
          {submitting ? "Submitting..." : "Submit Assignment"}
        </Button>
      )}
    </div>
  );

  const dayHeader = (
    <div className="flex items-center justify-between mb-4 sm:mb-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1.5">
          <Badge variant="info">Day {dayNumber}</Badge>
          {dayNumber === 1 ? <Badge variant="success">FREE</Badge> : <Badge variant="premium">PAID</Badge>}
          {day.estimated_time && <span className="text-xs text-gray-400">~{day.estimated_time}</span>}
          {day.progress?.status === "completed" && (
            <Badge variant="success">
              <CheckCircle2 size={12} className="mr-1" /> Completed
            </Badge>
          )}
        </div>
        <h1 className="font-display text-xl sm:text-2xl font-bold text-brand-navy break-words">{day.title}</h1>
        {isDesktop && (
          <p className="text-xs text-gray-400 mt-1">
            Drag a panel by its header to move it, or its corner to resize — your layout is remembered.
          </p>
        )}
      </div>
    </div>
  );

  const footerNav = footerNavFor(dayNumber);

  // ── Desktop: a fully rearrangeable grid — Video, Lesson, and one tabbed
  // "Workspace" panel (Progress/Quiz/Assignment/Doubts/Notes), each its own
  // draggable, resizable widget, remembered per-browser across every day. ──
  if (isDesktop) {
    const widgets: DayWidget[] = [];

    if (hasVideo) {
      widgets.push({
        id: "video",
        title: "Video",
        icon: <Play size={13} className="text-brand-primary shrink-0" />,
        content: videoPaneBlock,
        defaultLayout: { x: 0, y: 0, w: 8, h: 16 },
        minW: 4,
        minH: 8,
      });
    }
    widgets.push({
      id: "lesson",
      title: "Lesson",
      icon: <BookOpen size={13} className="text-brand-primary shrink-0" />,
      content: lessonPaneBody,
      defaultLayout: hasVideo ? { x: 0, y: 16, w: 8, h: 20 } : { x: 0, y: 0, w: 8, h: 36 },
      minW: 4,
      minH: 8,
    });

    const workspaceTabs: { id: WorkTab; label: string; icon: React.ReactNode }[] = [
      { id: "progress", label: "Progress", icon: <CheckCircle2 size={14} /> },
      { id: "quiz", label: `Quiz${quizLabelSuffix}`, icon: <HelpCircle size={14} /> },
      { id: "assignment", label: "Assignment", icon: <Code2 size={14} /> },
      { id: "doubts", label: "Doubts", icon: <MessageCircle size={14} /> },
      { id: "notes", label: "Notes", icon: <StickyNote size={14} /> },
    ];
    const workspaceContent: Record<WorkTab, React.ReactNode> = {
      progress: (
        <>
          {completionChecklist}
          {videoPlaylistBlock}
        </>
      ),
      quiz: quizBlock,
      assignment: assignmentBlock,
      doubts: <DoubtsThread dayNumber={dayNumber} />,
      notes: <NotesEditor dayNumber={dayNumber} />,
    };

    widgets.push({
      id: "workspace",
      title: workspaceTabs.find((t) => t.id === workTab)?.label ?? "Workspace",
      content: (
        <div className="flex flex-col h-full -m-4">
          <div className="flex gap-0.5 bg-gray-100 p-1 m-3 mb-0 rounded-lg flex-shrink-0">
            {workspaceTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setWorkTab(tab.id)}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all justify-center whitespace-nowrap min-w-0 flex-1 ${
                  workTab === tab.id ? "bg-white text-brand-navy shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <span className="flex-shrink-0">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-4">{workspaceContent[workTab]}</div>
        </div>
      ),
      defaultLayout: { x: 8, y: 0, w: 4, h: 36 },
      minW: 3,
      minH: 10,
    });

    return (
      <div className="max-w-[1600px] mx-auto py-6">
        {celebrate && <Confetti />}
        {dayHeader}
        <CaptureGuard>
          <DayGridLayout widgets={widgets} />
        </CaptureGuard>
        {footerNav}
      </div>
    );
  }

  // ── Narrow viewports: the original single-column, tabbed flow ──
  return (
    <CaptureGuard>
    <div className="max-w-4xl mx-auto py-4 sm:py-6">
      {celebrate && <Confetti />}
      {dayHeader}

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-5 sm:mb-6 sticky top-16 z-10">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all flex-1 justify-center ${
              activeTab === tab.id ? "bg-white text-brand-navy shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Above the tabs so it is visible whichever tab is open */}
      {completionChecklist}
      {videoPlaylistBlock}

      {activeTab === "lesson" && (
        <>
          {videoBlock}
          {lessonBlock}
        </>
      )}
      {activeTab === "quiz" && quizBlock}
      {activeTab === "assignment" && assignmentBlock}

      <DoubtsThread dayNumber={dayNumber} />
      <NotesPanel dayNumber={dayNumber} />

      {footerNav}
    </div>
    </CaptureGuard>
  );
}
