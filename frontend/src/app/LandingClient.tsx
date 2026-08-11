"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Space_Grotesk } from "next/font/google";
import "./landing.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
});

const TICKER_LINES = [
  "Ship 4 live apps. Not 4 PDFs.",
  "Code from Day 1 — no setup, ever.",
  "Top 20% get a guaranteed paid stipend.",
  "AI writes your resume. You write the code.",
  "60 days. 4 apps. 1 internship letter.",
  "Most bootcamps teach. We make you ship.",
  "Day 1 is free. The rest, you have to earn.",
];

const CURRICULUM_PHASES = [
  { id: "1", num: "1", title: "Web Foundations", range: "Days 1–5", final: false },
  { id: "2", num: "2", title: "React Frontend", range: "Days 6–10", final: false },
  { id: "3", num: "3", title: "Full-Stack", range: "Days 11–15", final: false },
  { id: "4", num: "4", title: "DevOps & Deploy", range: "Days 16–20", final: false },
  { id: "5", num: "5", title: "Advanced + DSA", range: "Days 21–25", final: false },
  { id: "6", num: "★", title: "Career Launch", range: "Days 26–30", final: true },
];

function useRevealOnScroll(containerRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const targets = container.querySelectorAll<HTMLElement>(
      ".gam-card, .badge-chip, .cert-card, .pj, .bn, .proof-card"
    );
    if (!("IntersectionObserver" in window) || targets.length === 0) return;

    const reveal = (el: HTMLElement) => {
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    };
    targets.forEach((t) => {
      t.style.opacity = "0";
      t.style.transform = "translateY(14px)";
      t.style.transition = "opacity .5s ease, transform .5s ease";
    });
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            reveal(e.target as HTMLElement);
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.05 }
    );
    targets.forEach((t) => io.observe(t));
    const failSafe = setTimeout(() => targets.forEach(reveal), 2500);
    return () => {
      io.disconnect();
      clearTimeout(failSafe);
    };
  }, [containerRef]);
}

export default function LandingClient() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tickIndex, setTickIndex] = useState(0);
  const [tickVisible, setTickVisible] = useState(true);
  const [activePhase, setActivePhase] = useState("6");

  useEffect(() => {
    const interval = setInterval(() => {
      setTickVisible(false);
      setTimeout(() => {
        setTickIndex((i) => (i + 1) % TICKER_LINES.length);
        setTickVisible(true);
      }, 280);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  useRevealOnScroll(containerRef);

  return (
    <div className={`nova-landing ${spaceGrotesk.variable}`} ref={containerRef}>
      {/* NAV */}
      <nav>
        <div className="nl">
          NOVA <span className="nl-badge">LABS</span>
        </div>
        <ul className="nm">
          <li><a href="#programme">Programme</a></li>
          <li><a href="#curriculum">Curriculum</a></li>
          <li><a href="#certificates">Certificates</a></li>
          <li><a href="#dashboard">Dashboard</a></li>
          <li><Link href="/login">Apply</Link></li>
        </ul>
        <Link href="/login" className="n-cta">Apply Now — Day 1 Free →</Link>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-bg1"></div>
        <div className="hero-bg2"></div>
        <div className="hero-grid-bg"></div>
        <div className="hero-inner">
          <div className="intern-pill">Virtual Internship Programme · Cohort 2024</div>
          <div className="hero-ticker">
            <span className="tick-prefix">▸</span>
            <span className="tick-text" style={{ opacity: tickVisible ? 1 : 0 }}>
              {TICKER_LINES[tickIndex]}
            </span>
            <span className="tick-cursor"></span>
          </div>
          <h1>
            The 2-month internship that makes you <span className="accent">hireable</span> —<br />
            not just <span className="accent2">certifiable</span>
          </h1>
          <p className="hero-sub">
            30 days of intensive training. Then 30 days of real project work. Ship 4 live apps, earn a stipend if you
            perform, and walk out with a portfolio that speaks louder than any degree.
          </p>
          <div className="hero-hook">
            <p>
              Most bootcamps give you a certificate and wish you luck.{" "}
              <strong>Nova Labs gives you a credential earned through code you actually wrote</strong> — and then puts
              that code in front of companies who are actively hiring.
            </p>
          </div>
          <div className="hero-btns">
            <Link href="/login" className="btn-p">Apply for the Internship →</Link>
            <a href="#programme" className="btn-s">See how it works</a>
          </div>
          <div className="hero-stats">
            <div className="hs"><span className="hs-n">60</span><span className="hs-l">Day programme</span></div>
            <div className="hs"><span className="hs-n">4</span><span className="hs-l">Live projects built</span></div>
            <div className="hs"><span className="hs-n">₹1,299</span><span className="hs-l">All-in price</span></div>
            <div className="hs"><span className="hs-n">Stipend</span><span className="hs-l">For top performers</span></div>
          </div>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="marquee">
        <div className="marquee-track">
          <span>🚀 4 live apps shipped, not screenshots</span>
          <span className="hl">★ Guaranteed stipend for the top 20%</span>
          <span>🆓 Day 1 is completely free, no card</span>
          <span className="hl2">🤖 AI resume builder included for life</span>
          <span>🏅 30+ badges, real leaderboard rank</span>
          <span>🔒 Certificates verified publicly</span>
          <span>💬 Mentor-backed doubt threads</span>
          <span>🚀 4 live apps shipped, not screenshots</span>
          <span className="hl">★ Guaranteed stipend for the top 20%</span>
          <span>🆓 Day 1 is completely free, no card</span>
          <span className="hl2">🤖 AI resume builder included for life</span>
          <span>🏅 30+ badges, real leaderboard rank</span>
          <span>🔒 Certificates verified publicly</span>
          <span>💬 Mentor-backed doubt threads</span>
        </div>
      </div>

      {/* HOOK BANNER */}
      <section style={{ background: "var(--off)", padding: "60px 5%" }}>
        <div className="si">
          <div className="hook-banner">
            <h2>
              You already have access to ChatGPT, Copilot, and every AI tool on the planet.<br />
              <em>But AI can&apos;t save you if you don&apos;t understand what you&apos;re building.</em>
            </h2>
            <p>
              The engineers who will dominate the next decade aren&apos;t the ones who avoid AI — they&apos;re the
              ones who deeply understand foundations, so they can direct, debug, and deploy what AI produces. Nova
              Labs is built for exactly that future.
            </p>
          </div>
        </div>
      </section>

      {/* TWO MONTH PROGRAMME */}
      <section className="months" id="programme">
        <div className="si">
          <p className="ey dark-ey">The programme</p>
          <h2 className="st dark-st">Two months. Two very different missions.</h2>
          <p className="ss dark-ss">
            Month 1 is your training ground. Month 2 is your proving ground. Both matter. Only Month 2 determines
            your stipend.
          </p>
          <div className="month-vs">
            <span className="month-vs-line"></span>
            <span className="month-vs-badge">THE COURSE → THE INTERNSHIP</span>
            <span className="month-vs-line"></span>
          </div>
          <div className="months-wrap">
            <div className="month-card m1">
              <div className="month-num">01</div>
              <span className="month-badge">
                Month 1 · Days 1–30<span className="month-tag">This is the course</span>
              </span>
              <h3>Train like a developer.<br />Think like an engineer.</h3>
              <p className="mc-sub">
                30 structured days covering HTML to Docker — every concept converted into something you can deploy,
                not just describe.
              </p>
              <ul className="mc-list">
                <li><span className="mc-check">✓</span><span>HTML/CSS/JS → React → FastAPI → MongoDB stack</span></li>
                <li><span className="mc-check">✓</span><span>4 project builds with rubric-based grading</span></li>
                <li><span className="mc-check">✓</span><span>Live code editor — no setup, code from Day 1</span></li>
                <li><span className="mc-check">✓</span><span>Auto-evaluated assignments with instant feedback</span></li>
                <li><span className="mc-check">✓</span><span>Docker, CI/CD, system design, and DSA prep</span></li>
                <li><span className="mc-check">✓</span><span>AI resume builder + portfolio auto-generated</span></li>
                <li><span className="mc-check">✓</span><span>XP, streaks, badges, leaderboards — daily motivation</span></li>
                <li><span className="mc-check">✓</span><span>Day 1 is completely free — no card required</span></li>
              </ul>
            </div>
            <div className="month-card m2">
              <div className="guarantee-ribbon">GUARANTEED FOR TOP 20%</div>
              <div className="month-num">02</div>
              <span className="month-badge">
                Month 2 · Days 31–60<span className="month-tag">This is the real internship</span>
              </span>
              <h3>Work like an intern.<br />Earn like one too.</h3>
              <p className="mc-sub">
                Real product work, real deadlines, real feedback. You&apos;ll be assigned to a live project track and
                contribute code that actually ships.
              </p>
              <ul className="mc-list">
                <li><span className="mc-check">✓</span><span>Work on a structured real-world product track</span></li>
                <li><span className="mc-check">✓</span><span>Weekly code reviews from senior mentors</span></li>
                <li><span className="mc-check">✓</span><span>Pair programming and collaborative PR reviews</span></li>
                <li><span className="mc-check">✓</span><span>Performance reviewed across 5 criteria</span></li>
                <li><span className="mc-check">✓</span><span>LinkedIn endorsements from Nova Labs mentors</span></li>
                <li><span className="mc-check">✓</span><span>Formal internship completion letter issued</span></li>
                <li><span className="mc-check">✓</span><span>Alumni network + referral pipeline for hiring</span></li>
                <li>
                  <span className="mc-check" style={{ color: "var(--gold)" }}>★</span>
                  <span style={{ color: "rgba(255,255,255,.9)", fontWeight: 600 }}>Top performers earn a paid stipend</span>
                </li>
              </ul>
              <div className="stipend-box">
                <p>
                  🏆 <strong>Stipend-based internship is not guaranteed for everyone — it is earned.</strong> Interns
                  who score in the top 20% on Month 2 performance criteria (code quality, shipping velocity, review
                  responsiveness, and collaboration) are eligible for a stipend and an extended engagement with the
                  Nova Labs team.
                </p>
              </div>
              <div className="guarantee-callout">
                <span className="gc-ic">💰</span>
                <p>
                  <strong>The rule is published, not a black box:</strong> hit the top 20% on the public rubric and
                  your paid stipend is guaranteed — no committee vote, no favourites.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI ADVANTAGE */}
      <section className="ai-adv" id="ai-advantage">
        <div className="si">
          <div className="ai-grid">
            <div className="ai-text">
              <p className="ey">The AI edge</p>
              <h2 className="st">Everyone is vibe coding.<br />Only some will survive it.</h2>
              <p className="ss">
                AI tools like Cursor, Copilot, and ChatGPT are incredible — but only for people who understand what
                they&apos;re generating. We train you to be that person.
              </p>
              <div className="ai-point">
                <div className="ai-icon t">🧠</div>
                <div>
                  <h4>You&apos;ll understand every line AI writes</h4>
                  <p>
                    When Copilot generates a JWT auth flow or a MongoDB aggregation pipeline, you&apos;ll know exactly
                    what to fix, extend, and when to throw it away.
                  </p>
                </div>
              </div>
              <div className="ai-point">
                <div className="ai-icon g">⚡</div>
                <div>
                  <h4>Your AI-assisted output will be 10x more reliable</h4>
                  <p>
                    Developers who understand foundations ship AI-generated code with 90% fewer bugs. Those who
                    don&apos;t spend hours debugging hallucinations.
                  </p>
                </div>
              </div>
              <div className="ai-point">
                <div className="ai-icon p">🎯</div>
                <div>
                  <h4>You&apos;ll prompt like a senior engineer</h4>
                  <p>
                    Knowing Docker, REST architecture, and database schemas lets you write prompts that produce
                    production-grade code — not prototype spaghetti.
                  </p>
                </div>
              </div>
            </div>
            <div className="ai-visual">
              <div className="code-window">
                <div className="cw-bar">
                  <div className="cw-dot" style={{ background: "#ef4444" }}></div>
                  <div className="cw-dot" style={{ background: "#f59e0b" }}></div>
                  <div className="cw-dot" style={{ background: "#10b981" }}></div>
                </div>
                <span className="cl3"># After Nova Labs — you know exactly what this does</span><br />
                <span className="cl2">@app</span><span className="cl1">.post</span><span className="cl5">(&quot;/tasks&quot;)</span><br />
                <span className="cl2">async def</span> <span className="cl4">create_task</span>
                <span className="cl5">(task: TaskModel, user: User = Depends(get_current_user)):</span><br />
                &nbsp;&nbsp;<span className="cl3"># Copilot wrote this. You understand why it&apos;s correct.</span><br />
                &nbsp;&nbsp;<span className="cl1">result</span> = <span className="cl2">await</span> db.tasks.
                <span className="cl4">insert_one</span>
                <span className="cl5">({"{"}</span><span className="cl4">**task.dict()</span>,{" "}
                <span className="cl1">&quot;user_id&quot;</span>: user.id<span className="cl5">{"}"})</span><br />
                &nbsp;&nbsp;<span className="cl2">return</span>{" "}
                <span className="cl5">{"{"}</span><span className="cl1">&quot;id&quot;</span>: str
                <span className="cl5">(</span>result.inserted_id<span className="cl5">){"}"}</span>
              </div>
              <div className="ai-stat-row">
                <div className="ai-stat"><span className="ai-stat-n teal-txt">10x</span><span className="ai-stat-l">Faster shipping with AI + foundations</span></div>
                <div className="ai-stat"><span className="ai-stat-n gold-txt">90%</span><span className="ai-stat-l">Fewer AI-generated bugs you&apos;ll catch</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* LIVE EDITOR DEMO */}
      <section className="editor-sec" id="editor">
        <div className="si">
          <p className="ey">No setup, ever</p>
          <h2 className="st">Code from Day 1 — right in the browser</h2>
          <p className="ss">
            No installs, no environment errors, no &quot;it works on my machine.&quot; Every lesson ships with a live
            editor and an instant quiz check, so you know you&apos;ve actually understood it before you move on.
          </p>
          <div className="editor-wrap">
            <div className="editor-panel">
              <div className="ed-bar">
                <div className="ed-tabs">
                  <span className="ed-tab on">Your code</span>
                  <span className="ed-tab">Expected output</span>
                </div>
                <button className="ed-run">▶ Run code</button>
              </div>
              <div className="ed-body">
                <span className="ln">1</span><span className="tok-cm">// Day 14 — protect this route with a JWT check</span><br />
                <span className="ln">2</span><span className="tok-kw">function</span> <span className="tok-fn">requireAuth</span>(req, res, next) {"{"}<br />
                <span className="ln">3</span>&nbsp;&nbsp;<span className="tok-kw">const</span> <span className="tok-var">token</span> = req.headers[<span className="tok-str">&apos;authorization&apos;</span>];<br />
                <span className="ln">4</span>&nbsp;&nbsp;<span className="tok-kw">if</span> (!<span className="tok-var">token</span>) <span className="tok-kw">return</span> res.status(<span className="tok-fn">401</span>).send();<br />
                <span className="ln">5</span>&nbsp;&nbsp;<span className="tok-kw">const</span> <span className="tok-var">user</span> = <span className="tok-fn">verify</span>(<span className="tok-var">token</span>);<br />
                <span className="ln">6</span>&nbsp;&nbsp;req.user = <span className="tok-var">user</span>;<br />
                <span className="ln">7</span>&nbsp;&nbsp;<span className="tok-fn">next</span>();<br />
                <span className="ln">8</span>{"}"}
              </div>
              <div className="ed-output">
                <div className="ed-output-label">Console output</div>
                <div className="ed-output-line">✓ Route protected — unauthenticated request returned 401</div>
                <div className="ed-output-line">✓ All 3 test cases passed</div>
              </div>
            </div>
            <div className="quiz-mock">
              <div className="quiz-mock-h"><h4>Quick check — Day 14, Q4/10</h4><span>4/10</span></div>
              <p style={{ fontSize: "13.5px", color: "var(--muted)", marginBottom: "16px" }}>
                Why store the access token in memory instead of localStorage?
              </p>
              <div className="qopt wrong"><span className="qdot">✕</span><span>It&apos;s faster to read on every request</span></div>
              <div className="qopt correct"><span className="qdot">✓</span><span>It prevents theft via XSS since scripts can&apos;t read it</span></div>
              <div className="qopt"><span className="qdot"></span><span>localStorage has a smaller size limit</span></div>
              <div className="quiz-exp">
                <strong>Why:</strong> Anything in localStorage is readable by any script on the page. Keeping the
                access token in memory only means a successful XSS attack still can&apos;t steal it.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* QUOTE BANNER 1 */}
      <section className="quote-banner on-light">
        <div className="qb-mark">&quot;</div>
        <p className="qb-text">
          A free YouTube tutorial teaches you to <em>copy</em>. Nova Labs teaches you to{" "}
          <span className="pink-em">ship</span>.
        </p>
        <p className="qb-sub">THE DIFFERENCE BETWEEN A CERTIFICATE AND A CAREER</p>
      </section>

      {/* GAMIFICATION */}
      <section className="gamif">
        <div className="sec-blob" style={{ top: "-10%", right: "-8%", width: "420px", height: "420px", background: "radial-gradient(circle,rgba(244,114,182,.1) 0%,transparent 70%)" }}></div>
        <div className="sec-blob" style={{ bottom: "-15%", left: "-5%", width: "380px", height: "380px", background: "radial-gradient(circle,rgba(34,211,238,.08) 0%,transparent 70%)" }}></div>
        <div className="si">
          <p className="ey dark-ey">Engagement system</p>
          <h2 className="st dark-st">Built to keep you showing up — every single day</h2>
          <p className="ss dark-ss">
            Completion is the real skill. We&apos;ve engineered the platform around the psychology of habit, progress
            visibility, and peer competition.
          </p>
          <div className="gam-grid">
            <div className="gam-card">
              <span className="gam-emoji">⚡</span>
              <h3>XP &amp; levels</h3>
              <p>Earn experience points for every lesson, quiz, assignment, and project. Watch your level climb daily — visible to your entire cohort.</p>
            </div>
            <div className="gam-card">
              <span className="gam-emoji">🔥</span>
              <h3>Daily streaks</h3>
              <p>Build your streak. Break it and you feel it. Completion streaks are tracked publicly and factor into your final performance score.</p>
            </div>
            <div className="gam-card">
              <span className="gam-emoji">🏅</span>
              <h3>Achievement badges</h3>
              <p>First Deploy, 7-Day Streak, Bug Squasher, Top Reviewer, Docker Wizard — 30+ badges you actually want to show on your LinkedIn.</p>
            </div>
            <div className="gam-card">
              <span className="gam-emoji">📊</span>
              <h3>Leaderboard</h3>
              <p>Weekly and all-time. Batch-based so you&apos;re competing with your peers, not thousands of strangers. Friendly pressure that drives real completion.</p>
            </div>
          </div>
          <div className="leaderboard">
            <div className="lb-title">🏆 This week&apos;s leaderboard — Cohort July 2024</div>
            <div className="lb-row"><span className="lb-pos pos1">#1</span><div className="lb-av" style={{ background: "rgba(244,114,182,.2)", color: "var(--teal)" }}>AR</div><span className="lb-name">Ananya R.</span><span className="lb-xp">2,840 XP</span><span className="lb-streak">🔥 12-day streak</span></div>
            <div className="lb-row"><span className="lb-pos pos2">#2</span><div className="lb-av" style={{ background: "rgba(167,139,250,.2)", color: "#c4b5fd" }}>RK</div><span className="lb-name">Rohit K.</span><span className="lb-xp">2,615 XP</span><span className="lb-streak">🔥 9-day streak</span></div>
            <div className="lb-row"><span className="lb-pos pos3">#3</span><div className="lb-av" style={{ background: "rgba(34,211,238,.2)", color: "var(--gold)" }}>SP</div><span className="lb-name">Sneha P.</span><span className="lb-xp">2,490 XP</span><span className="lb-streak">🔥 14-day streak</span></div>
            <div className="lb-row"><span className="lb-pos" style={{ color: "rgba(255,255,255,.4)" }}>#4</span><div className="lb-av" style={{ background: "rgba(255,255,255,.07)", color: "rgba(255,255,255,.4)" }}>VS</div><span className="lb-name" style={{ color: "rgba(255,255,255,.4)" }}>Vikram S.</span><span className="lb-xp" style={{ color: "rgba(255,255,255,.3)" }}>2,310 XP</span><span className="lb-streak">🔥 6-day streak</span></div>
          </div>
          <p className="ey dark-ey" style={{ marginTop: "56px" }}>30+ badges to chase</p>
          <h3 style={{ fontFamily: "var(--D)", fontSize: "22px", fontWeight: 700, color: "var(--white)", marginBottom: "8px" }}>
            Earn them. Flex them on LinkedIn.
          </h3>
          <p className="ss dark-ss" style={{ marginBottom: 0 }}>A background job awards these the moment you earn them — toast notification and all.</p>
          <div className="badge-wall">
            <div className="badge-chip"><span className="badge-ic">🎯</span><h5>Day 1 Complete</h5><span className="badge-rarity r-common">Common</span></div>
            <div className="badge-chip bc-rare"><span className="badge-ic">💯</span><h5>Perfect Quiz</h5><span className="badge-rarity r-rare">Rare</span></div>
            <div className="badge-chip bc-epic"><span className="badge-ic">🚀</span><h5>First Deploy</h5><span className="badge-rarity r-epic">Epic</span></div>
            <div className="badge-chip"><span className="badge-ic">🐛</span><h5>Bug Squasher</h5><span className="badge-rarity r-common">Common</span></div>
            <div className="badge-chip bc-rare"><span className="badge-ic">🔥</span><h5>Week Warrior</h5><span className="badge-rarity r-rare">Rare</span></div>
            <div className="badge-chip bc-legendary"><span className="badge-ic">👑</span><h5>30-Day Legend</h5><span className="badge-rarity r-legendary">Legendary</span></div>
            <div className="badge-chip bc-rare"><span className="badge-ic">🙋</span><h5>Helpful Human</h5><span className="badge-rarity r-rare">Rare</span></div>
            <div className="badge-chip bc-epic"><span className="badge-ic">⭐</span><h5>Excellence Project</h5><span className="badge-rarity r-epic">Epic</span></div>
            <div className="badge-chip"><span className="badge-ic">🌅</span><h5>Early Bird</h5><span className="badge-rarity r-common">Common</span></div>
            <div className="badge-chip"><span className="badge-ic">🦉</span><h5>Night Owl</h5><span className="badge-rarity r-common">Common</span></div>
            <div className="badge-chip bc-rare"><span className="badge-ic">⚡</span><h5>Speed Runner</h5><span className="badge-rarity r-rare">Rare</span></div>
            <div className="badge-chip bc-epic"><span className="badge-ic">🏁</span><h5>All 30 Days</h5><span className="badge-rarity r-epic">Epic</span></div>
          </div>
        </div>
      </section>

      {/* CERTIFICATES */}
      <section className="cert-sec" id="certificates">
        <div className="sec-blob" style={{ top: "-20%", left: "30%", width: "500px", height: "500px", background: "radial-gradient(circle,rgba(167,139,250,.08) 0%,transparent 70%)" }}></div>
        <div className="si">
          <p className="ey dark-ey">Proof that holds up</p>
          <h2 className="st dark-st">Five certificate tiers. Each one harder to fake than the last.</h2>
          <p className="ss dark-ss">
            No participation trophies. Every certificate is tied to work you actually shipped, and every one is
            publicly verifiable by anyone you send it to.
          </p>
          <div className="cert-row">
            <div className="cert-card cc1">
              <span className="cert-tier" style={{ color: "rgba(255,255,255,.6)" }}>Tier 1</span>
              <h4>Participation</h4>
              <p>Awarded the moment you finish Day 1 — completely free, no payment needed.</p>
              <span className="ck">Auto-issued · Day 1</span>
            </div>
            <div className="cert-card cc2">
              <span className="cert-tier" style={{ color: "var(--gold)" }}>Tier 2</span>
              <h4>Completion</h4>
              <p>All 30 days submitted. You showed up and finished what you started.</p>
              <span className="ck">Auto-issued · Day 30</span>
            </div>
            <div className="cert-card cc3">
              <span className="cert-tier" style={{ color: "#67e8f9" }}>Tier 3</span>
              <h4>Merit</h4>
              <p>All 30 days, ≥70% average quiz score, and all 4 projects submitted.</p>
              <span className="ck">Auto-issued · 24hrs after Day 30</span>
            </div>
            <div className="cert-card cc4">
              <span className="cert-tier" style={{ color: "var(--purple)" }}>Tier 4</span>
              <h4>Excellence</h4>
              <p>≥90% average quiz score and all 4 projects deployed live, scoring 80+.</p>
              <span className="ck">Auto-issued · After mentor review</span>
            </div>
            <div className="cert-card cc5">
              <span className="cert-tier" style={{ color: "var(--pink)" }}>Tier 5</span>
              <h4>Internship Candidate</h4>
              <p>Top 5% of your cohort by XP, a 95+ project, and a manual portfolio review.</p>
              <span className="ck">Hand-reviewed · Admin approval</span>
            </div>
          </div>
          <div className="verify-box">
            <span className="verify-label">Anyone — a recruiter, a hiring manager — can verify a certificate is real:</span>
            <input type="text" placeholder="Paste certificate ID, e.g. 9f2a-7c41-…" disabled />
            <button className="verify-btn">Verify →</button>
          </div>
        </div>
      </section>

      {/* RESUME AI TOOL */}
      <section className="resume-sec">
        <div className="si">
          <div className="resume-wrap">
            <div>
              <p className="ey">AI Resume builder</p>
              <h2 className="st">Your resume writes itself — from your actual code</h2>
              <p className="ss">
                Every project, every commit, every achievement on the platform auto-populates your resume. Then our
                AI scores it and tells you exactly what to fix before you send it to a recruiter.
              </p>
              <div className="value-row">
                <div className="vr-icon">📋</div>
                <div><h4>Auto-filled from your real work</h4><p>The platform tracks every project you deploy, every PR you submit, every skill you unlock — and populates your resume with specific, recruiter-ready bullet points.</p></div>
              </div>
              <div className="value-row">
                <div className="vr-icon">🤖</div>
                <div><h4>ATS score + rewrite suggestions</h4><p>Our AI scans your resume against common ATS systems and gives you a score out of 100. It highlights weak phrasing, missing keywords, and formatting issues — and tells you exactly how to fix them.</p></div>
              </div>
              <div className="value-row">
                <div className="vr-icon" style={{ background: "rgba(34,211,238,.1)" }}>🌐</div>
                <div><h4>Auto-generated public portfolio site</h4><p>A live portfolio page at novalabs.com/u/yourname — with all 4 projects, GitHub links, and your certificate tier. Ready to share with one link.</p></div>
              </div>
            </div>
            <div className="resume-mock">
              <div className="rm-header">
                <div className="rm-dots">
                  <div className="rm-dot" style={{ background: "#ef4444" }}></div>
                  <div className="rm-dot" style={{ background: "#f59e0b" }}></div>
                  <div className="rm-dot" style={{ background: "#10b981" }}></div>
                </div>
                <span className="rm-title">Nova Labs — AI Resume Analyser</span>
              </div>
              <div className="rm-body">
                <div className="rm-score-ring">
                  <div className="score-circle"><div className="score-inner">82</div></div>
                  <div className="score-info"><h4>ATS Score: Good</h4><p>3 quick fixes will push this to 94+</p></div>
                </div>
                <div className="rm-tags">
                  <span className="rm-tag rt-green">✓ Strong action verbs</span>
                  <span className="rm-tag rt-green">✓ Quantified impact</span>
                  <span className="rm-tag rt-amber">⚠ Missing: Docker keyword</span>
                  <span className="rm-tag rt-red">✗ LinkedIn URL missing</span>
                </div>
                <ul className="rm-list">
                  <li><span className="ok">✓</span> &quot;Built and deployed a full-stack task manager with JWT auth&quot; — strong</li>
                  <li><span className="ok">✓</span> MongoDB, FastAPI, React — keywords detected</li>
                  <li><span className="warn">⚠</span> Add &quot;containerised with Docker&quot; to project 1</li>
                  <li><span className="warn">⚠</span> Spell out &quot;4 endpoints&quot; → &quot;12 REST API endpoints&quot;</li>
                  <li><span className="bad">✗</span> No GitHub profile link found — add it</li>
                </ul>
              </div>
            </div>
          </div>
          <p className="ey" style={{ marginTop: "56px" }}>From code to career, automatically</p>
          <h3 style={{ fontFamily: "var(--D)", fontSize: "20px", fontWeight: 700, color: "var(--text)", marginBottom: "6px" }}>
            No manual resume writing. Ever.
          </h3>
          <div className="resume-flow">
            <div className="rf-step">
              <h6>01 · You ship</h6>
              <p>You submit Project 1 — a Task Manager with JWT auth and a MongoDB aggregation pipeline.</p>
              <code>git push origin main</code>
            </div>
            <div className="rf-arrow">→</div>
            <div className="rf-step">
              <h6>02 · AI extracts</h6>
              <p>The platform reads your rubric score, stack tags, and commit history — no manual entry.</p>
              <code>auth: ✓ · mongo: ✓ · score: 91</code>
            </div>
            <div className="rf-arrow">→</div>
            <div className="rf-step">
              <h6>03 · Resume writes itself</h6>
              <p>A recruiter-ready bullet point appears on your resume, instantly.</p>
              <code>&quot;Built full-stack app with JWT auth, 12 REST endpoints&quot;</code>
            </div>
          </div>
        </div>
      </section>

      {/* QUOTE BANNER 2 */}
      <section className="quote-banner on-dark">
        <div className="qb-mark">&quot;</div>
        <p className="qb-text">Recruiters don&apos;t read certificates. <em>They read GitHub commits and live URLs.</em></p>
        <p className="qb-sub">WHY EVERY PROJECT HERE IS DEPLOYED, NOT JUST SUBMITTED</p>
      </section>

      {/* DASHBOARD */}
      <section className="dash-sec" id="dashboard">
        <div className="si">
          <p className="ey dark-ey">Intern dashboard</p>
          <h2 className="st dark-st">You&apos;ll always know exactly where you stand</h2>
          <p className="ss dark-ss">
            A detailed analytics dashboard shows your progress, skill coverage, XP trajectory, and how you compare to
            your cohort — updated in real time.
          </p>
          <div className="dash-mock">
            <div className="dash-header">
              <span>Nova Labs — Intern Dashboard</span>
              <span style={{ fontSize: "12px", color: "rgba(255,255,255,.4)" }}>Day 18 / 60 · Cohort July 2024</span>
            </div>
            <div className="dash-grid">
              <div className="dash-metric"><span className="dm-n" style={{ color: "var(--teal)" }}>1,840</span><span className="dm-l">XP earned</span></div>
              <div className="dash-metric"><span className="dm-n" style={{ color: "var(--gold)" }}>🔥 11</span><span className="dm-l">Day streak</span></div>
              <div className="dash-metric"><span className="dm-n" style={{ color: "var(--purple)" }}>#3</span><span className="dm-l">Cohort rank</span></div>
              <div className="dash-metric"><span className="dm-n" style={{ color: "#34d399" }}>2</span><span className="dm-l">Projects shipped</span></div>
            </div>
            <div className="dash-progress">
              <div className="day-track">
                <h4>30-day progress</h4>
                <div className="days-grid">
                  {Array.from({ length: 30 }, (_, i) => i + 1).map((day) => (
                    <div
                      key={day}
                      className={`dg-day ${day < 18 ? "dg-done" : day === 18 ? "dg-today" : "dg-lock"}`}
                    >
                      {day}
                    </div>
                  ))}
                </div>
              </div>
              <div className="skill-bars">
                <h4>Skill coverage</h4>
                <div className="sb-item"><div className="sb-label"><span>HTML/CSS/JS</span><span style={{ color: "var(--teal)" }}>100%</span></div><div className="sb-track"><div className="sb-fill" style={{ width: "100%", background: "var(--teal)" }}></div></div></div>
                <div className="sb-item"><div className="sb-label"><span>React</span><span style={{ color: "var(--teal)" }}>80%</span></div><div className="sb-track"><div className="sb-fill" style={{ width: "80%", background: "var(--teal)" }}></div></div></div>
                <div className="sb-item"><div className="sb-label"><span>FastAPI</span><span style={{ color: "var(--gold)" }}>60%</span></div><div className="sb-track"><div className="sb-fill" style={{ width: "60%", background: "var(--gold)" }}></div></div></div>
                <div className="sb-item"><div className="sb-label"><span>MongoDB</span><span style={{ color: "rgba(255,255,255,.3)" }}>0%</span></div><div className="sb-track"><div className="sb-fill" style={{ width: "0%", background: "var(--teal)" }}></div></div></div>
                <div className="sb-item"><div className="sb-label"><span>Docker</span><span style={{ color: "rgba(255,255,255,.3)" }}>0%</span></div><div className="sb-track"><div className="sb-fill" style={{ width: "0%", background: "var(--teal)" }}></div></div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WHY PAY */}
      <section className="why-pay">
        <div className="si">
          <div className="pay-grid">
            <div className="pay-card">
              <h3>Why does this cost ₹1,299 if you believe in accessible education?</h3>
              <div className="pay-line"><span className="pay-icon">📚</span><p><strong>6 months of curriculum research</strong> went into sequencing 30 days so nothing is wasted. Every day unlocks at the right moment. That architecture has real value.</p></div>
              <div className="pay-line"><span className="pay-icon">🛠️</span><p><strong>A full platform had to be built</strong> — live editor, auto-evaluation engine, dashboard, AI resume tool, certificate system. This isn&apos;t a Notion doc and a Zoom link.</p></div>
              <div className="pay-line"><span className="pay-icon">👨‍🏫</span><p><strong>Mentors are real engineers</strong> with real opportunity cost. Code reviews, mock interviews, and doubt resolution are not free.</p></div>
              <div className="pay-line"><span className="pay-icon">💡</span><p><strong>₹1,299 is not the cost of the programme</strong> — it&apos;s a commitment signal. Free programmes have 3% completion. A small financial stake creates accountability.</p></div>
              <div className="research-stats">
                <div className="rs"><span className="rs-n">6+</span><span className="rs-l">Months of research</span></div>
                <div className="rs"><span className="rs-n">1,200+</span><span className="rs-l">Lines of curriculum</span></div>
                <div className="rs"><span className="rs-n">10–20x</span><span className="rs-l">Cheaper than alternatives</span></div>
                <div className="rs"><span className="rs-n">86%</span><span className="rs-l">Contribution margin</span></div>
              </div>
            </div>
            <div className="research-right">
              <p className="ey">The honest case</p>
              <h2 className="st">What you&apos;re actually getting for ₹1,299</h2>
              <p className="ss">
                Compare this to anything else on the market and the question stops being &quot;why does this cost
                money&quot; and starts being &quot;why does this cost so little&quot;.
              </p>
              <div className="value-row">
                <div className="vr-icon">🎓</div>
                <div><h4>A structured 60-day internship programme</h4><p>Not a course. An internship — with phases, milestones, mentors, reviews, and a completion letter from a registered company.</p></div>
              </div>
              <div className="value-row">
                <div className="vr-icon" style={{ background: "rgba(34,211,238,.1)" }}>🚀</div>
                <div><h4>4 live, deployed applications</h4><p>Not mockups. Not screenshots. Real URLs, real GitHub repos, real commit history. Each one goes on your resume immediately.</p></div>
              </div>
              <div className="value-row">
                <div className="vr-icon" style={{ background: "rgba(167,139,250,.1)" }}>🤖</div>
                <div><h4>AI resume builder + portfolio site</h4><p>Tools that standalone would cost ₹500–2,000/month. Included in your ₹1,299 for life.</p></div>
              </div>
              <div className="value-row" style={{ borderBottom: "none" }}>
                <div className="vr-icon" style={{ background: "rgba(34,211,238,.1)" }}>💰</div>
                <div><h4>A real shot at a stipend</h4><p>No other programme at this price level offers performance-based compensation. Show up, perform, and get paid.</p></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CURRICULUM */}
      <section className="curr" id="curriculum">
        <div className="si">
          <p className="ey">Month 1 curriculum</p>
          <h2 className="st">30 days. No filler. All build.</h2>
          <p className="ss">
            Every single day produces something real. If a day doesn&apos;t ship something, it doesn&apos;t make the
            cut. Click a phase to see exactly what you&apos;ll build — we&apos;ve opened on Phase 6, because
            that&apos;s the phase that actually gets you hired.
          </p>
          <div className="curr-explorer">
            <div className="curr-sidebar">
              {CURRICULUM_PHASES.map((p) => (
                <div
                  key={p.id}
                  className={`cs-item ${p.final ? "final" : ""} ${activePhase === p.id ? "active" : ""}`}
                  onClick={() => setActivePhase(p.id)}
                >
                  <span className="cs-num">{p.num}</span>
                  <div className="cs-meta">
                    <h5>{p.title}{p.final && <span className="cs-final-tag">Final</span>}</h5>
                    <span>{p.range}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="curr-content">
              <div className={`cs-panel ${activePhase === "1" ? "active" : ""}`}>
                <div className="cs-panel-head"><h3>Web Foundations</h3><span className="cs-panel-badge">Phase 1 / 6</span></div>
                <p className="cs-panel-sub">Where it all starts — and Day 1 is free, so you can try before you commit to anything.</p>
                <div className="cs-day-list">
                  <div className="cs-day"><span className="cs-day-n fr">D1 ★</span><div className="cs-day-body"><h6>HTML Foundations — Free</h6><p>Semantic structure, forms, first published page</p></div></div>
                  <div className="cs-day"><span className="cs-day-n">D2</span><div className="cs-day-body"><h6>CSS, Flexbox &amp; Responsive</h6><p>Layouts, breakpoints, styled personal page</p></div></div>
                  <div className="cs-day"><span className="cs-day-n">D3</span><div className="cs-day-body"><h6>JavaScript Fundamentals</h6><p>Variables, functions, DOM, event handling</p></div></div>
                  <div className="cs-day"><span className="cs-day-n">D4</span><div className="cs-day-body"><h6>Advanced JS — Async/Await</h6><p>Promises, first live API interactions</p></div></div>
                  <div className="cs-day"><span className="cs-day-n">D5</span><div className="cs-day-body"><h6>Git &amp; GitHub</h6><p>Version control, branching, first public repo</p></div></div>
                </div>
              </div>
              <div className={`cs-panel ${activePhase === "2" ? "active" : ""}`}>
                <div className="cs-panel-head"><h3>React Frontend</h3><span className="cs-panel-badge">Phase 2 / 6</span></div>
                <p className="cs-panel-sub">From static pages to interactive UIs — and your first backend endpoint.</p>
                <div className="cs-day-list">
                  <div className="cs-day"><span className="cs-day-n">D6</span><div className="cs-day-body"><h6>React Basics</h6><p>Components, props, JSX</p></div></div>
                  <div className="cs-day"><span className="cs-day-n">D7</span><div className="cs-day-body"><h6>React Hooks</h6><p>useState, useEffect, custom hooks</p></div></div>
                  <div className="cs-day"><span className="cs-day-n">D8</span><div className="cs-day-body"><h6>API Integration</h6><p>Live weather app, loading &amp; error states</p></div></div>
                  <div className="cs-day"><span className="cs-day-n">D9</span><div className="cs-day-body"><h6>UI Polishing &amp; Design</h6><p>Design tokens, glassmorphism UI</p></div></div>
                  <div className="cs-day"><span className="cs-day-n">D10</span><div className="cs-day-body"><h6>FastAPI Basics</h6><p>First Python backend endpoints</p></div></div>
                </div>
              </div>
              <div className={`cs-panel ${activePhase === "3" ? "active" : ""}`}>
                <div className="cs-panel-head"><h3>Full-Stack</h3><span className="cs-panel-badge">Phase 3 / 6</span></div>
                <p className="cs-panel-sub">Frontend meets backend meets database — and your first deployed app.</p>
                <div className="cs-day-list">
                  <div className="cs-day"><span className="cs-day-n">D11</span><div className="cs-day-body"><h6>MongoDB Basics</h6><p>Cloud DB, CRUD, async queries</p></div></div>
                  <div className="cs-day"><span className="cs-day-n">D12</span><div className="cs-day-body"><h6>Backend CRUD at Scale</h6><p>Pagination, search, aggregation</p></div></div>
                  <div className="cs-day"><span className="cs-day-n">D13</span><div className="cs-day-body"><h6>Full-Stack Integration</h6><p>React → FastAPI → MongoDB</p></div></div>
                  <div className="cs-day"><span className="cs-day-n">D14</span><div className="cs-day-body"><h6>Authentication (JWT)</h6><p>Signup, login, protected routes</p></div></div>
                  <div className="cs-day"><span className="cs-day-n fr">D15 ●</span><div className="cs-day-body"><h6>Project 1 — Task Manager</h6><p>First deployed full-stack app</p></div></div>
                </div>
              </div>
              <div className={`cs-panel ${activePhase === "4" ? "active" : ""}`}>
                <div className="cs-panel-head"><h3>DevOps &amp; Deploy</h3><span className="cs-panel-badge">Phase 4 / 6</span></div>
                <p className="cs-panel-sub">Containerise it, ship it live, and make your GitHub recruiter-ready.</p>
                <div className="cs-day-list">
                  <div className="cs-day"><span className="cs-day-n fr">D16 ●</span><div className="cs-day-body"><h6>Project 2 — Notes App</h6><p>Markdown editor, public sharing</p></div></div>
                  <div className="cs-day"><span className="cs-day-n">D17</span><div className="cs-day-body"><h6>Docker</h6><p>Containerise frontend &amp; backend</p></div></div>
                  <div className="cs-day"><span className="cs-day-n">D18</span><div className="cs-day-body"><h6>Deployment</h6><p>Live on Vercel + Railway</p></div></div>
                  <div className="cs-day"><span className="cs-day-n">D19</span><div className="cs-day-body"><h6>Resume &amp; GitHub</h6><p>ATS resume, polished GitHub</p></div></div>
                  <div className="cs-day"><span className="cs-day-n fr">D20 ●</span><div className="cs-day-body"><h6>Project 3 — SaaS Dashboard</h6><p>Charts, KPIs, analytics</p></div></div>
                </div>
              </div>
              <div className={`cs-panel ${activePhase === "5" ? "active" : ""}`}>
                <div className="cs-panel-head"><h3>Advanced + DSA</h3><span className="cs-panel-badge">Phase 5 / 6</span></div>
                <p className="cs-panel-sub">The interview-prep layer most bootcamps skip entirely.</p>
                <div className="cs-day-list">
                  <div className="cs-day"><span className="cs-day-n">D21</span><div className="cs-day-body"><h6>Advanced React</h6><p>Context, memoisation, lazy loading</p></div></div>
                  <div className="cs-day"><span className="cs-day-n">D22</span><div className="cs-day-body"><h6>Testing</h6><p>Unit, component, API tests</p></div></div>
                  <div className="cs-day"><span className="cs-day-n">D23</span><div className="cs-day-body"><h6>CI/CD Pipeline</h6><p>GitHub Actions, auto-deploy</p></div></div>
                  <div className="cs-day"><span className="cs-day-n">D24</span><div className="cs-day-body"><h6>System Design</h6><p>Scalability, caching, SQL vs NoSQL</p></div></div>
                  <div className="cs-day"><span className="cs-day-n">D25</span><div className="cs-day-body"><h6>DSA for Interviews</h6><p>10 solved problems, complexity analysis</p></div></div>
                </div>
              </div>
              <div className={`cs-panel ${activePhase === "6" ? "active" : ""}`}>
                <div className="cs-panel-head"><h3>Career Launch</h3><span className="cs-panel-badge">Phase 6 / 6 — Final phase</span></div>
                <p className="cs-panel-sub">
                  This is the phase that actually gets you hired — interview reps, your personal brand, and the
                  project that proves initiative, not just instruction-following.
                </p>
                <div className="cs-day-list">
                  <div className="cs-day"><span className="cs-day-n">D26</span><div className="cs-day-body"><h6>Mock Interview Prep</h6><p>Technical &amp; HR rounds, STAR method</p></div></div>
                  <div className="cs-day"><span className="cs-day-n">D27</span><div className="cs-day-body"><h6>LinkedIn &amp; Branding</h6><p>Profile, content strategy, networking</p></div></div>
                  <div className="cs-day"><span className="cs-day-n fr">D28 ●</span><div className="cs-day-body"><h6>Project 4 — Open Build</h6><p>Your idea, your stack, your initiative</p></div></div>
                  <div className="cs-day"><span className="cs-day-n">D29</span><div className="cs-day-body"><h6>Peer Code Review</h6><p>Give &amp; receive feedback, engineering-style</p></div></div>
                  <div className="cs-day"><span className="cs-day-n">D30</span><div className="cs-day-body"><h6>Final Polish &amp; Graduation</h6><p>Every project and profile audited</p></div></div>
                </div>
                <div className="cs-final-banner">
                  <strong>Graduate Day 30 and you don&apos;t stop here</strong> — Month 2 starts immediately. This
                  phase is the bridge from &quot;I finished a course&quot; to &quot;I&apos;m ready for the
                  internship.&quot;
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROJECTS */}
      <section className="proj">
        <div className="si">
          <p className="ey dark-ey">What you&apos;ll build</p>
          <h2 className="st dark-st">4 live apps. Not mockups. Not exercises.<br />Real URLs the world can access.</h2>
          <p className="ss dark-ss">Every project is graded on a 100-point rubric. Every project goes live on the internet. Every project goes on your resume.</p>
          <div className="proj-grid proj-scroll">
            <div className="pj"><div className="pj-n">01</div><h3>Task Manager App</h3><p>Full JWT auth, MongoDB aggregation, paginated REST API, live filters. Resume line: &quot;Built full-stack app with 12 endpoints, auth, and real-time stats.&quot;</p><div className="pj-tags"><span className="pj-tag">React</span><span className="pj-tag">FastAPI</span><span className="pj-tag">MongoDB</span><span className="pj-tag">JWT</span></div></div>
            <div className="pj"><div className="pj-n">02</div><h3>Notes / Blog App</h3><p>Markdown editor with live preview, auto-save debounce, public share links, full-text search across notes and tags.</p><div className="pj-tags"><span className="pj-tag">Markdown</span><span className="pj-tag">Debounce</span><span className="pj-tag">Full-text search</span></div></div>
            <div className="pj"><div className="pj-n">03</div><h3>SaaS Analytics Dashboard</h3><p>KPI cards, live charts from real backend data, sortable paginated tables, fully responsive analytics layout.</p><div className="pj-tags"><span className="pj-tag">Recharts</span><span className="pj-tag">CSS Grid</span><span className="pj-tag">Aggregation</span></div></div>
            <div className="pj"><div className="pj-n">04</div><h3>Open Build — Your Idea</h3><p>Month 2&apos;s foundation. Scoped by you, built by you, shipped by you. Habit tracker, expense tracker, job board — proof of real initiative.</p><div className="pj-tags"><span className="pj-tag">Your stack</span><span className="pj-tag">Your idea</span><span className="pj-tag">Your proof</span></div></div>
          </div>
          <div className="proj-hint">↔ Scroll to see all 4 projects</div>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="benefits">
        <div className="si">
          <p className="ey">Everything included</p>
          <h2 className="st">What ₹1,299 gets you — all of it, no add-ons</h2>
          <p className="ss">Every feature below is included for every intern from Day 1. Nothing is gated behind a &quot;premium&quot; tier.</p>
          <div className="ben-grid">
            <div className="bn"><span className="bn-icon">🤖</span><h3>AI resume builder</h3><p>Auto-fills from your platform activity, scores your ATS compatibility, and gives line-by-line rewrite suggestions.</p></div>
            <div className="bn"><span className="bn-icon">📊</span><h3>Detailed analytics dashboard</h3><p>Track XP, streak, cohort rank, skill coverage, project scores, and performance trajectory in real time.</p></div>
            <div className="bn"><span className="bn-icon">🏅</span><h3>Badges &amp; gamification</h3><p>30+ achievement badges you actually want to show off. First Deploy, Bug Squasher, Docker Wizard, and more.</p></div>
            <div className="bn"><span className="bn-icon">🌐</span><h3>Public portfolio site</h3><p>Auto-generated at novalabs.com/u/yourname — all 4 projects, live links, GitHub, and your certificate tier.</p></div>
            <div className="bn"><span className="bn-icon">🎤</span><h3>AI mock interviews</h3><p>Topic-wise question sets with AI-scored readiness. Technical and HR rounds — both simulated before the real thing.</p></div>
            <div className="bn"><span className="bn-icon">👥</span><h3>Cohort community</h3><p>Peer code reviews, doubt resolution threads, project showcases, and a leaderboard that creates real accountability.</p></div>
          </div>
        </div>
      </section>

      {/* COMMUNITY */}
      <section className="comm-sec" id="community">
        <div className="si">
          <p className="ey">Never stuck for long</p>
          <h2 className="st">Stuck on Day 14? Your whole cohort — and a mentor — has your back</h2>
          <p className="ss">
            Every day has its own doubt thread. Ask, get an answer, move on. Mentors mark the best answer
            &quot;Official&quot; so it&apos;s the first thing the next confused learner sees.
          </p>
          <div className="comm-wrap">
            <div className="comm-post">
              <div className="comm-top">
                <div className="comm-av" style={{ background: "#22d3ee" }}>VS</div>
                <span className="comm-name">Vikram S.</span>
                <span className="comm-tag">· Day 14 · 2 hours ago</span>
              </div>
              <p className="comm-q">My refresh token endpoint keeps returning 401 even right after login. Is the cookie not being set?</p>
              <div className="comm-reply">
                <strong>Mentor — Aditi N.</strong> <span className="official-pill">OFFICIAL ANSWER</span><br />
                Check that your cookie has <code>httpOnly</code> and <code>sameSite</code> set, and that your
                frontend fetch call includes <code>credentials: &apos;include&apos;</code> — that&apos;s the usual
                culprit.
              </div>
            </div>
            <div className="comm-post">
              <div className="comm-top">
                <div className="comm-av" style={{ background: "#a78bfa" }}>PR</div>
                <span className="comm-name">Priya R.</span>
                <span className="comm-tag">· Day 20 · Yesterday</span>
              </div>
              <p className="comm-q">Just deployed my SaaS dashboard project — Recharts + FastAPI aggregation pipeline live for the first time 🎉</p>
              <div className="comm-reply"><strong>14 upvotes</strong> · 6 replies — &quot;the chart loading state is so smooth, what did you use?&quot;</div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="pricing" id="pricing">
        <div className="si">
          <p className="ey">Apply now</p>
          <h2 className="st">Priced so price is never the reason you don&apos;t start</h2>
          <p className="ss">Day 1 is free. The full 60-day internship — training + real project work + stipend eligibility — is ₹1,299.</p>
          <div className="price-wrap">
            <div className="price-card">
              <div className="price-big">₹1,299</div>
              <div className="price-gst">+ 18% GST = ₹1,532.82 total</div>
              <ul className="price-fl">
                <li><span className="pf-ck">✓</span><span>Day 1 completely free — no card required</span></li>
                <li><span className="pf-ck">✓</span><span>60-day virtual internship programme</span></li>
                <li><span className="pf-ck">✓</span><span>Month 1: 30 days structured training</span></li>
                <li><span className="pf-ck">✓</span><span>Month 2: 30 days real project work</span></li>
                <li><span className="pf-ck">✓</span><span>Formal internship completion letter</span></li>
                <li><span className="pf-ck" style={{ color: "var(--gold)" }}>★</span><span>Stipend eligibility for top 20% performers</span></li>
                <li><span className="pf-ck">✓</span><span>AI resume builder + public portfolio site</span></li>
                <li><span className="pf-ck">✓</span><span>Detailed analytics dashboard</span></li>
                <li><span className="pf-ck">✓</span><span>Badges, gamification, leaderboards</span></li>
                <li><span className="pf-ck">✓</span><span>Referral: ₹100 off for a friend, ₹100 back</span></li>
              </ul>
              <Link href="/login" className="price-btn" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>Apply — Start Day 1 Free →</Link>
            </div>
            <div>
              <table className="cmp-table">
                <thead><tr><th></th><th>Traditional bootcamp</th><th className="hl">Nova Labs</th></tr></thead>
                <tbody>
                  <tr><td className="rl">Price</td><td>₹25K – ₹1L+</td><td className="hl">₹1,299</td></tr>
                  <tr><td className="rl">Day 1 trial</td><td>Rarely offered</td><td className="hl">Completely free</td></tr>
                  <tr><td className="rl">Format</td><td>Course only</td><td className="hl">Internship (2 months)</td></tr>
                  <tr><td className="rl">Projects shipped</td><td>1, sometimes 0</td><td className="hl">4, all deployed live</td></tr>
                  <tr><td className="rl">Stipend possibility</td><td>Never</td><td className="hl">Yes — for top 20%</td></tr>
                  <tr><td className="rl">Internship letter</td><td>No</td><td className="hl">Yes, from Nova Labs Pvt Ltd</td></tr>
                  <tr><td className="rl">AI resume tool</td><td>Paid add-on</td><td className="hl">Included free</td></tr>
                  <tr><td className="rl">Dashboard analytics</td><td>No</td><td className="hl">Real-time, detailed</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* MARKET */}
      <section className="market">
        <div className="si">
          <p className="ey">Market opportunity</p>
          <h2 className="st">A massive, underserved market — and we&apos;re priced for it</h2>
          <p className="ss">India&apos;s demand for practical tech skills vastly exceeds the supply of affordable, outcome-driven programmes targeting Tier 2/3 cities and self-learners.</p>
          <div className="tam-g">
            <div className="tam t1"><span className="tam-l">TAM</span><span className="tam-n">₹25,000+ Cr</span><p className="tam-d">India&apos;s online tech-skilling &amp; coding education market — students and early professionals seeking job-ready skills.</p></div>
            <div className="tam t2"><span className="tam-l">SAM</span><span className="tam-n">₹4,200+ Cr</span><p className="tam-d">Price-sensitive majority seeking affordable, project-based, outcome-driven programmes in Tier 2/3 cities.</p></div>
            <div className="tam t3"><span className="tam-l">SOM</span><span className="tam-n">₹18 Cr</span><p className="tam-d">12–18 month target: ~1.2 lakh paying interns via referral-led, low-CAC growth.</p></div>
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="proof">
        <div className="si">
          <p className="ey dark-ey">What interns say</p>
          <h2 className="st dark-st">From &quot;I know a bit of Python&quot; to &quot;I deployed four live apps&quot;</h2>
          <p className="ss dark-ss">Early cohort voices — real people who showed up for 30 days and walked out with a portfolio recruiters actually notice.</p>
          <div className="proof-grid">
            <div className="proof-card">
              <div className="proof-stars">★★★★★</div>
              <p>&quot;The dashboard showing my streak and cohort rank genuinely made me log in every single day. I&apos;ve never finished an online course before. I finished this.&quot;</p>
              <div className="proof-author"><div className="pa-av" style={{ background: "rgba(244,114,182,.2)", color: "var(--teal)" }}>AR</div><div><div className="pa-name">Ananya R.</div><div className="pa-role">B.Tech, Tier 2 city → Frontend Role</div></div></div>
            </div>
            <div className="proof-card">
              <div className="proof-stars">★★★★★</div>
              <p>&quot;I tried Cursor and GitHub Copilot after finishing Month 1 and it was a completely different experience. I actually understood what it was generating. That&apos;s the real value.&quot;</p>
              <div className="proof-author"><div className="pa-av" style={{ background: "rgba(167,139,250,.2)", color: "#c4b5fd" }}>RK</div><div><div className="pa-name">Rohit K.</div><div className="pa-role">Self-taught → Full-stack Intern at SaaS startup</div></div></div>
            </div>
            <div className="proof-card">
              <div className="proof-stars">★★★★★</div>
              <p>&quot;The resume AI tool flagged things I would have sent to 50 recruiters without fixing. By the time I applied, my ATS score was 91. I got callbacks within a week.&quot;</p>
              <div className="proof-author"><div className="pa-av" style={{ background: "rgba(34,211,238,.2)", color: "var(--gold)" }}>SP</div><div><div className="pa-name">Sneha P.</div><div className="pa-role">CSE graduate → Internship at Bengaluru startup</div></div></div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="fcta">
        <div className="fcta-inner">
          <div className="fcta-tag">Day 1 is free — no card required</div>
          <h2>
            60 days from now, you&apos;ll either have<br />
            <em>4 live apps and an internship letter</em> —<br />
            or you&apos;ll be exactly where you are today.
          </h2>
          <p>
            The AI tools are already here. The market is already moving. The only question is whether you&apos;ll
            understand enough to direct them — or spend your career debugging their mistakes.
          </p>
          <div className="fcta-btns">
            <Link href="/login" className="btn-p" style={{ fontSize: "17px", padding: "17px 38px" }}>Apply for the Internship →</Link>
            <a href="mailto:internship@novalabs.com" className="btn-s" style={{ fontSize: "15px", padding: "17px 26px" }}>Talk to the team</a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="fi">
          <div>
            <div className="fl">NOVA <span>LABS</span></div>
            <div style={{ marginTop: "6px", fontSize: "13px" }}>Powered by Nova Labs Private Limited</div>
          </div>
          <div className="flinks">
            <a href="https://www.novalabs.com">www.novalabs.com</a>
            <a href="mailto:internship@novalabs.com">internship@novalabs.com</a>
            <a href="https://linkedin.com/company/novalabs">LinkedIn</a>
          </div>
          <div style={{ fontSize: "13px" }}>© 2024 Nova Labs Private Limited</div>
        </div>
      </footer>
    </div>
  );
}
