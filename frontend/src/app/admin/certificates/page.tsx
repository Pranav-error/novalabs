"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import toast from "react-hot-toast";
import { Award, ShieldX, Download, ExternalLink } from "lucide-react";

interface Cert {
  id: string;
  tier: number;
  learner_name: string;
  issued_at: string;
  status: string;
}

const TIER_NAMES: Record<number, string> = {
  1: "Participation",
  2: "Completion",
  3: "Merit",
  4: "Excellence",
  5: "Internship Candidate",
};

export default function AdminCertificatesPage() {
  const [certs, setCerts] = useState<Cert[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await api.get("/admin/certificates/pending");
      setCerts(res.data.certificates);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const revoke = async (id: string) => {
    if (!confirm("Revoke this certificate? It will show as invalid on the public verification page.")) return;
    await api.post(`/admin/certificates/${id}/revoke`);
    toast.success("Certificate revoked");
    load();
  };

  const exportCsv = async () => {
    const res = await api.get("/admin/export/certificates", { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = "certificates.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 sm:space-y-6 lg:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-brand-navy flex items-center gap-2">
            <Award size={22} className="text-brand-primary" /> Certificates
          </h1>
          <p className="text-xs text-gray-400 mt-1">Issued certificates across all tiers.</p>
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv} className="w-full sm:w-auto">
          <Download size={14} className="mr-1.5" /> Export CSV
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[30vh]">
          <div className="w-10 h-10 border-4 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
        </div>
      ) : certs.length === 0 ? (
        <Card className="max-w-sm mx-auto text-center py-12 sm:py-16 px-5">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Award size={24} className="text-gray-300" />
          </div>
          <p className="text-gray-400">No certificates issued yet.</p>
        </Card>
      ) : (
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="min-w-[640px] w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-gray-400 border-b border-gray-100">
                <th className="px-4 py-3">Learner</th>
                <th className="px-4 py-3">Tier</th>
                <th className="px-4 py-3 hidden sm:table-cell">Issued</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {certs.map((c) => (
                <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/70 transition-colors">
                  <td className="px-4 py-3 font-semibold text-brand-navy whitespace-nowrap">{c.learner_name}</td>
                  <td className="px-4 py-3">
                    <Badge variant={c.tier >= 4 ? "success" : "info"}>
                      T{c.tier} · {TIER_NAMES[c.tier]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-xs text-gray-400 whitespace-nowrap">
                    {new Date(c.issued_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={c.status === "active" ? "success" : "danger"}>{c.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                      <a
                        href={`/verify/${c.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-primary hover:underline text-xs inline-flex items-center gap-1"
                      >
                        <ExternalLink size={12} /> Verify
                      </a>
                      {c.status === "active" && (
                        <Button size="sm" variant="outline" onClick={() => revoke(c.id)}>
                          <ShieldX size={13} className="mr-1 text-red-500" /> Revoke
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
