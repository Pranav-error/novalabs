"use client";

import { Fragment, useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { ChevronDown, ChevronUp, Send, FileCheck2 } from "lucide-react";

interface Submission {
  id: string;
  day_number: number;
  learner_name: string;
  learner_email: string;
  submission_type: string;
  submitted_at: string;
  status: string;
  content?: string;
}

interface SubmissionsResponse {
  submissions: Submission[];
  total: number;
}

export default function AdminSubmissionsPage() {
  const [data, setData] = useState<SubmissionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/submissions/pending", {
        params: { page },
      });
      setData(res.data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const handleScore = async (id: string) => {
    const score = parseInt(scores[id] || "0", 10);
    if (score < 1 || score > 100) return;

    setSubmitting(id);
    try {
      await api.patch(`/admin/submissions/${id}/score`, {
        score,
        feedback: feedbacks[id] || "",
      });
      // Remove scored submission from the list
      setData((prev) =>
        prev
          ? {
              ...prev,
              submissions: prev.submissions.filter((s) => s.id !== id),
              total: prev.total - 1,
            }
          : prev
      );
      setExpandedId(null);
    } catch {
      // silently fail
    } finally {
      setSubmitting(null);
    }
  };

  const statusVariant = (status: string) => {
    switch (status) {
      case "scored":
        return "success" as const;
      case "submitted":
        return "warning" as const;
      default:
        return "default" as const;
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h1 className="font-display text-xl sm:text-2xl font-bold text-brand-navy">Submission Review</h1>
        <p className="text-sm text-gray-400 mt-1">
          Review pending assignment and quiz submissions from learners.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[30vh]">
          <div className="w-10 h-10 border-4 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
        </div>
      ) : !data || data.submissions.length === 0 ? (
        <Card className="max-w-sm mx-auto text-center py-12 sm:py-16">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <FileCheck2 size={24} className="text-gray-300" />
          </div>
          <p className="text-gray-400">No pending submissions to review.</p>
        </Card>
      ) : (
        <>
          <p className="text-sm text-gray-500">
            {data.total} pending submission{data.total !== 1 ? "s" : ""}
          </p>

          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    <th className="px-4 sm:px-6 py-3.5 sm:py-4">Day</th>
                    <th className="px-4 sm:px-6 py-3.5 sm:py-4">Learner</th>
                    <th className="px-4 sm:px-6 py-3.5 sm:py-4">Type</th>
                    <th className="px-4 sm:px-6 py-3.5 sm:py-4">Submitted</th>
                    <th className="px-4 sm:px-6 py-3.5 sm:py-4">Status</th>
                    <th className="px-4 sm:px-6 py-3.5 sm:py-4 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.submissions.map((sub, idx) => (
                    <Fragment key={sub.id}>
                      <tr
                        onClick={() =>
                          setExpandedId(
                            expandedId === sub.id ? null : sub.id
                          )
                        }
                        className={`border-t border-gray-50 cursor-pointer transition-colors hover:bg-brand-primary/5 ${
                          idx % 2 === 1 ? "bg-gray-50/50" : ""
                        }`}
                      >
                        <td className="px-4 sm:px-6 py-3.5 sm:py-4 font-semibold text-brand-navy whitespace-nowrap">
                          Day {sub.day_number}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 sm:py-4">
                          <div className="min-w-0">
                            <span className="font-medium text-brand-navy block truncate">
                              {sub.learner_name}
                            </span>
                            <span className="block text-xs text-gray-400 truncate">
                              {sub.learner_email}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 sm:py-4">
                          <Badge variant="info">{sub.submission_type}</Badge>
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-gray-500 whitespace-nowrap">
                          {new Date(sub.submitted_at).toLocaleDateString(
                            "en-IN",
                            {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 sm:py-4">
                          <Badge variant={statusVariant(sub.status)}>
                            {sub.status}
                          </Badge>
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 sm:py-4">
                          {expandedId === sub.id ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </td>
                      </tr>

                      {expandedId === sub.id && (
                        <tr className="bg-brand-primary/5">
                          <td colSpan={6} className="px-4 sm:px-6 py-5 sm:py-6">
                            {sub.content && (
                              <div className="mb-4">
                                <h4 className="text-xs font-semibold uppercase text-gray-400 mb-2">
                                  Submission Content
                                </h4>
                                <div className="bg-white rounded-xl p-4 border border-gray-100 text-sm text-brand-navy whitespace-pre-wrap break-words">
                                  {sub.content}
                                </div>
                              </div>
                            )}

                            <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
                              <div className="w-full sm:w-32">
                                <Input
                                  label="Score (1-100)"
                                  type="number"
                                  min={1}
                                  max={100}
                                  value={scores[sub.id] || ""}
                                  onChange={(e) =>
                                    setScores((prev) => ({
                                      ...prev,
                                      [sub.id]: e.target.value,
                                    }))
                                  }
                                  placeholder="Score"
                                />
                              </div>
                              <div className="flex-1 w-full">
                                <label className="block text-sm font-medium text-brand-navy mb-1.5">
                                  Feedback
                                </label>
                                <textarea
                                  value={feedbacks[sub.id] || ""}
                                  onChange={(e) =>
                                    setFeedbacks((prev) => ({
                                      ...prev,
                                      [sub.id]: e.target.value,
                                    }))
                                  }
                                  placeholder="Write feedback for the learner..."
                                  rows={3}
                                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-brand-navy placeholder:text-gray-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary text-sm resize-none"
                                />
                              </div>
                              <Button
                                size="sm"
                                disabled={
                                  submitting === sub.id ||
                                  !scores[sub.id] ||
                                  parseInt(scores[sub.id]) < 1 ||
                                  parseInt(scores[sub.id]) > 100
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleScore(sub.id);
                                }}
                                className="shrink-0 w-full sm:w-auto"
                              >
                                {submitting === sub.id ? (
                                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                  <>
                                    <Send className="w-4 h-4 mr-2" />
                                    Submit Score
                                  </>
                                )}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Pagination */}
          <div className="flex justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={data.submissions.length < 20}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
