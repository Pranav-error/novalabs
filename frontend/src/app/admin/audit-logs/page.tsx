"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { ScrollText, ChevronLeft, ChevronRight } from "lucide-react";

interface AuditLog {
  id: string;
  admin_id: string;
  action_type: string;
  target_type: string | null;
  target_id: string | null;
  created_at: string;
}

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/admin/audit-logs?page=${page}&limit=50`)
      .then((res) => setLogs(res.data.logs))
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="space-y-5 sm:space-y-6 lg:space-y-8">
      <div>
        <h1 className="font-display text-xl sm:text-2xl font-bold text-brand-navy flex items-center gap-2">
          <ScrollText size={22} className="text-brand-primary" /> Audit Logs
        </h1>
        <p className="text-xs text-gray-400 mt-1">
          Every admin action is recorded here. Logs are immutable — there is no delete.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[30vh]">
          <div className="w-10 h-10 border-4 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <Card className="max-w-sm mx-auto text-center py-12 sm:py-16 px-5">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <ScrollText size={24} className="text-gray-300" />
          </div>
          <p className="text-gray-400">No admin actions recorded yet.</p>
        </Card>
      ) : (
        <>
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 rounded-xl border border-gray-100 bg-white shadow-sm">
            <table className="min-w-[480px] w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-gray-400 border-b border-gray-100">
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Target</th>
                  <th className="px-4 py-3">When</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/70 transition-colors">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-brand-primary/5 font-mono text-xs font-semibold text-brand-navy">
                        {l.action_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-xs text-gray-400 truncate max-w-[220px]">
                      {l.target_type ? `${l.target_type} · ${(l.target_id || "").slice(0, 8)}…` : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                      {new Date(l.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft size={14} className="mr-1" /> Prev
            </Button>
            <span className="text-xs text-gray-400">Page {page}</span>
            <Button size="sm" variant="outline" disabled={logs.length < 50} onClick={() => setPage((p) => p + 1)}>
              Next <ChevronRight size={14} className="ml-1" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
