import { Code2, Flame, Trophy } from "lucide-react";

const HIGHLIGHTS = [
  { icon: Code2, text: "A real project to ship, every single day" },
  { icon: Flame, text: "Daily streaks and XP keep you consistent" },
  { icon: Trophy, text: "Finish with a certificate and a portfolio" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Mobile-only brand strip — the branding panel below is desktop-only,
          so small screens would otherwise open straight into a bare form. */}
      <div className="lg:hidden flex items-center gap-2.5 px-5 pt-6 sm:px-8">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-primary to-brand-cyan flex items-center justify-center flex-shrink-0">
          <span className="text-white font-display font-bold text-base">M</span>
        </div>
        <span className="font-display font-bold text-brand-navy text-base">NOVA LABS</span>
      </div>

      {/* Form side */}
      <div className="flex-1 flex items-center justify-center px-5 py-8 sm:p-8">
        <div className="w-full max-w-md">{children}</div>
      </div>

      {/* Branding side */}
      <div className="hidden lg:flex flex-1 items-center justify-center bg-gradient-to-br from-brand-navy via-brand-deep-blue to-brand-primary relative overflow-hidden">
        {/* Decorative orbs */}
        <div className="pointer-events-none absolute top-20 right-20 w-64 h-64 bg-brand-cyan/20 rounded-full blur-3xl animate-float" />
        <div className="pointer-events-none absolute bottom-20 left-20 w-48 h-48 bg-brand-purple/20 rounded-full blur-3xl animate-float" style={{ animationDelay: "2s" }} />

        <div className="relative z-10 text-center px-12 max-w-md">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-primary to-brand-cyan flex items-center justify-center mx-auto mb-8 shadow-xl shadow-brand-cyan/20">
            <span className="text-white font-display font-bold text-3xl">M</span>
          </div>
          <h2 className="font-display text-3xl font-bold text-white mb-4">NOVA LABS</h2>
          <p className="text-white/70 text-lg mb-10">
            30-Day Full-Stack Challenge.<br />
            Build. Learn. Get Hired.
          </p>

          <div className="space-y-3 text-left">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3 backdrop-blur-sm">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                  <Icon size={16} className="text-brand-cyan" />
                </div>
                <span className="text-sm text-white/80">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
