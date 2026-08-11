"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Github,
  Linkedin,
  Zap,
  CalendarDays,
  Award,
  Medal,
  ExternalLink,
  Star,
  SearchX,
} from "lucide-react";

interface PortfolioBadge {
  badge_slug: string;
  earned_at: string;
}

interface PortfolioProject {
  day_number: number;
  github_url: string | null;
  live_url: string | null;
  description: string | null;
  stack_tags: string[];
  score: number | null;
  submitted_at: string;
}

interface PortfolioCertificate {
  tier: number;
  issued_at: string;
}

interface GitHubRepo {
  name: string;
  description: string | null;
  html_url: string;
  stars: number;
  language: string | null;
  updated_at: string | null;
}

interface PortfolioData {
  name: string;
  bio: string | null;
  github_url: string | null;
  linkedin_url: string | null;
  member_since: string;
  total_xp: number;
  days_completed: number;
  badges: PortfolioBadge[];
  projects: PortfolioProject[];
  certificates: PortfolioCertificate[];
  github_repos: GitHubRepo[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const CERT_TIERS: Record<number, { name: string; color: string }> = {
  1: { name: "Participation", color: "#2F67C7" },
  2: { name: "Completion", color: "#32D3E6" },
  3: { name: "Merit", color: "#8A2BBE" },
  4: { name: "Excellence", color: "#D21D8E" },
  5: { name: "Internship Candidate", color: "#F02B8F" },
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatBadgeName(slug: string) {
  return slug
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function PublicPortfolioPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  const [data, setData] = useState<PortfolioData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/portfolio/${slug}`);
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        setData(await res.json());
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-primary" />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <SearchX size={48} className="text-gray-300 mb-4" />
        <h1 className="text-2xl font-bold text-brand-navy mb-2">
          Portfolio not found
        </h1>
        <p className="text-gray-500 mb-6 text-center">
          The portfolio you&apos;re looking for doesn&apos;t exist or has been
          removed.
        </p>
        <Link
          href="/"
          className="px-5 py-2.5 rounded-xl bg-brand-primary text-white font-medium hover:opacity-90 transition-opacity"
        >
          Go to NOVA LABS
        </Link>
      </div>
    );
  }

  const stats = [
    { icon: Zap, label: "Total XP", value: String(data.total_xp) },
    {
      icon: CalendarDays,
      label: "Days Completed",
      value: `${data.days_completed}/30`,
    },
    { icon: Medal, label: "Badges", value: String(data.badges.length) },
    {
      icon: Award,
      label: "Certificates",
      value: String(data.certificates.length),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-gradient-to-r from-brand-primary to-brand-deep-blue">
        <div className="max-w-4xl mx-auto px-4 py-12 md:py-16">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            <div className="w-24 h-24 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center shrink-0">
              <span className="text-3xl font-bold text-white">
                {getInitials(data.name)}
              </span>
            </div>
            <div className="text-center md:text-left">
              <h1 className="text-3xl font-bold text-white">{data.name}</h1>
              {data.bio && (
                <p className="text-white/80 mt-2 max-w-xl">{data.bio}</p>
              )}
              <div className="flex items-center justify-center md:justify-start gap-3 mt-4">
                {data.github_url && (
                  <a
                    href={data.github_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
                    aria-label="GitHub"
                  >
                    <Github size={18} />
                  </a>
                )}
                {data.linkedin_url && (
                  <a
                    href={data.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
                    aria-label="LinkedIn"
                  >
                    <Linkedin size={18} />
                  </a>
                )}
                <span className="text-sm text-white/70">
                  Member since{" "}
                  {new Date(data.member_since).toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pb-12">
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 -mt-8">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center"
            >
              <stat.icon
                size={20}
                className="mx-auto text-brand-primary mb-1"
              />
              <p className="text-2xl font-bold text-brand-navy">
                {stat.value}
              </p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Projects */}
        <section className="mt-10">
          <h2 className="text-xl font-bold text-brand-navy mb-4">Projects</h2>
          {data.projects.length === 0 ? (
            <p className="text-gray-500 text-sm">No projects submitted yet.</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {data.projects.map((project, i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-brand-primary/10 text-brand-primary">
                      Day {project.day_number}
                    </span>
                    {project.score !== null && (
                      <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-600">
                        <Star size={12} />
                        {project.score}/100
                      </span>
                    )}
                  </div>
                  {project.description && (
                    <p className="text-sm text-gray-600 mb-3 flex-1">
                      {project.description}
                    </p>
                  )}
                  {project.stack_tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {project.stack_tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-4 mt-auto pt-2 border-t border-gray-50">
                    {project.github_url && (
                      <a
                        href={project.github_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-sm font-medium text-brand-primary hover:underline"
                      >
                        <Github size={14} />
                        GitHub
                      </a>
                    )}
                    {project.live_url && (
                      <a
                        href={project.live_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-sm font-medium text-brand-primary hover:underline"
                      >
                        <ExternalLink size={14} />
                        Live Demo
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* GitHub repositories */}
        {data.github_repos?.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-bold text-brand-navy mb-4">
              GitHub Repositories
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {data.github_repos.map((repo) => (
                <a
                  key={repo.html_url}
                  href={repo.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col hover:border-brand-primary/40 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-brand-navy">
                      <Github size={14} className="text-brand-primary" />
                      {repo.name}
                    </span>
                    <span className="flex items-center gap-1 text-xs font-semibold text-amber-600">
                      <Star size={12} />
                      {repo.stars}
                    </span>
                  </div>
                  {repo.description && (
                    <p className="text-sm text-gray-600 mb-3 flex-1">
                      {repo.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-auto pt-2 text-xs text-gray-400">
                    {repo.language && (
                      <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {repo.language}
                      </span>
                    )}
                    {repo.updated_at && (
                      <span>
                        Updated{" "}
                        {new Date(repo.updated_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Badges */}
        {data.badges.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-bold text-brand-navy mb-4">Badges</h2>
            <div className="flex flex-wrap gap-3">
              {data.badges.map((badge) => (
                <div
                  key={badge.badge_slug}
                  className="flex items-center gap-2 bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-2.5"
                >
                  <Medal size={16} className="text-brand-primary" />
                  <div>
                    <p className="text-sm font-medium text-brand-navy">
                      {formatBadgeName(badge.badge_slug)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(badge.earned_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Certificates */}
        {data.certificates.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-bold text-brand-navy mb-4">
              Certificates
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {data.certificates.map((cert) => {
                const tier = CERT_TIERS[cert.tier] || {
                  name: `Tier ${cert.tier}`,
                  color: "#2F67C7",
                };
                return (
                  <div
                    key={cert.tier}
                    className="flex items-center gap-4 bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
                  >
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${tier.color}1A` }}
                    >
                      <Award size={22} style={{ color: tier.color }} />
                    </div>
                    <div>
                      <p
                        className="font-bold text-brand-navy"
                        style={{ color: tier.color }}
                      >
                        {tier.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        Issued{" "}
                        {new Date(cert.issued_at).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white py-6">
        <p className="text-center text-sm text-gray-500">
          Built with{" "}
          <Link
            href="/"
            className="font-semibold text-brand-primary hover:underline"
          >
            NOVA LABS 30-Day Challenge
          </Link>
        </p>
      </footer>
    </div>
  );
}
