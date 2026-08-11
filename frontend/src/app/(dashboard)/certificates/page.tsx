"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Award, Download, Share2, Lock, CheckCircle2 } from "lucide-react";

interface Certificate {
  id: string;
  tier: number;
  tier_name: string;
  status: string;
  issued_at: string;
}

const tiers = [
  { tier: 1, name: "Participation", description: "Complete Day 1", color: "#2F67C7" },
  { tier: 2, name: "Completion", description: "Complete all 30 days", color: "#32D3E6" },
  { tier: 3, name: "Merit", description: "30 days + 70% avg quiz + all projects", color: "#8A2BBE" },
  { tier: 4, name: "Excellence", description: "90% quiz avg + all projects 80+", color: "#D21D8E" },
  { tier: 5, name: "Internship Candidate", description: "Excellence + top 5% + portfolio review", color: "#F02B8F" },
];

export default function CertificatesPage() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/certificates/me")
      .then((res) => setCertificates(res.data))
      .catch(() => setCertificates([]))
      .finally(() => setLoading(false));
  }, []);

  const earnedMap = new Map(
    certificates.filter((c) => c.status === "issued").map((c) => [c.tier, c])
  );

  return (
    <div className="py-4 sm:py-6 lg:py-8 space-y-5 sm:space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
          <Award size={18} className="text-brand-primary" />
        </div>
        <h1 className="font-display text-xl sm:text-2xl font-bold text-brand-navy">Certificates</h1>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="p-4 sm:p-5 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gray-200 flex-shrink-0" />
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="h-4 w-48 max-w-full bg-gray-200 rounded" />
                  <div className="h-3 w-64 max-w-full bg-gray-100 rounded" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {tiers.map((t) => {
            const earned = earnedMap.get(t.tier);
            const isEarned = !!earned;

            return (
              <Card
                key={t.tier}
                className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 ${
                  isEarned ? "border-brand-primary/15" : ""
                }`}
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div
                    className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isEarned ? "" : "opacity-30 grayscale"
                    }`}
                    style={{ background: t.color }}
                  >
                    {isEarned ? (
                      <Award size={24} className="text-white" />
                    ) : (
                      <Lock size={20} className="text-white" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-brand-navy">
                        Tier {t.tier} — {t.name}
                      </h3>
                      {isEarned ? (
                        <Badge variant="success">
                          <CheckCircle2 size={12} className="mr-1" />
                          Earned
                        </Badge>
                      ) : (
                        <Badge>Locked</Badge>
                      )}
                    </div>
                    {isEarned && earned.issued_at ? (
                      <p className="text-sm text-gray-500 mt-0.5">
                        Issued on{" "}
                        {new Date(earned.issued_at).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400 mt-0.5">
                        Requirement: {t.description}
                      </p>
                    )}
                  </div>
                </div>

                {isEarned && (
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 sm:flex-none"
                      onClick={async () => {
                        try {
                          const res = await api.get(
                            `/certificates/${earned.id}/download`,
                            { responseType: "blob" }
                          );
                          const url = URL.createObjectURL(res.data);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `novalabs-certificate-${earned.tier}.pdf`;
                          a.click();
                          URL.revokeObjectURL(url);
                        } catch {
                          toast.error("Could not download certificate");
                        }
                      }}
                    >
                      <Download size={16} className="mr-1.5" />
                      Download
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 sm:flex-none"
                      onClick={() => {
                        const url = `${window.location.origin}/verify/${earned.id}`;
                        navigator.clipboard.writeText(url);
                        toast.success("Verification link copied");
                      }}
                    >
                      <Share2 size={16} className="mr-1.5" />
                      Share
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
