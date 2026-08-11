"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { BadgeCheck, ShieldX, SearchX, Award } from "lucide-react";
import api from "@/lib/api";

interface VerificationResult {
  valid: boolean;
  name: string;
  tier: string;
  issued_at: string;
  status: string;
}

export default function VerifyCertificatePage() {
  const params = useParams();
  const certId = params.certId as string;

  const [result, setResult] = useState<VerificationResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/verify/${certId}`)
      .then((res) => setResult(res.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [certId]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        {loading ? (
          <p className="text-gray-400">Verifying certificate…</p>
        ) : notFound ? (
          <>
            <SearchX size={48} className="mx-auto mb-4 text-gray-300" />
            <h1 className="text-xl font-bold text-brand-navy mb-2">Certificate not found</h1>
            <p className="text-sm text-gray-500">
              No certificate exists with ID <code className="text-xs">{certId}</code>.
            </p>
          </>
        ) : result ? (
          <>
            {result.valid ? (
              <BadgeCheck size={48} className="mx-auto mb-4 text-green-500" />
            ) : (
              <ShieldX size={48} className="mx-auto mb-4 text-red-500" />
            )}
            <h1 className="text-xl font-bold text-brand-navy mb-1">
              {result.valid ? "Valid certificate" : "Certificate revoked"}
            </h1>
            <p className="text-sm text-gray-500 mb-6">
              Issued by NOVA LABS — 30-Day Full-Stack Challenge
            </p>
            <div className="space-y-3 text-left">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Learner</span>
                <span className="font-semibold text-brand-navy">{result.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Certificate tier</span>
                <span className="font-semibold text-brand-navy inline-flex items-center gap-1.5">
                  <Award size={14} className="text-brand-primary" />
                  {result.tier}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Issued</span>
                <span className="font-semibold text-brand-navy">
                  {result.issued_at ? new Date(result.issued_at).toLocaleDateString() : "—"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Status</span>
                <span className={`font-semibold ${result.valid ? "text-green-600" : "text-red-600"}`}>
                  {result.status}
                </span>
              </div>
            </div>
          </>
        ) : null}

        <Link
          href="/"
          className="inline-block mt-8 text-sm text-brand-primary font-semibold hover:underline"
        >
          About the 30-Day Challenge →
        </Link>
      </div>
    </div>
  );
}
