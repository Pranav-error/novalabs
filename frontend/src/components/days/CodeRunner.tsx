"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Loader2, Terminal, Eye } from "lucide-react";
import Button from "@/components/ui/Button";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";

/** Wraps user JS so console output and errors are posted back to the parent. */
function jsHarness(code: string): string {
  return `<!doctype html><html><body><script>
const _log = [];
const _send = () => parent.postMessage({ source: "code-runner", lines: _log }, "*");
["log","info","warn","error"].forEach((m) => {
  const orig = console[m];
  console[m] = (...args) => {
    _log.push(args.map((a) => { try { return typeof a === "object" ? JSON.stringify(a) : String(a); } catch { return String(a); } }).join(" "));
    orig.apply(console, args);
  };
});
window.addEventListener("error", (e) => { _log.push("Error: " + e.message); _send(); });
try {
  ${code}
} catch (e) { _log.push("Error: " + e.message); }
_send();
<\/script></body></html>`;
}

export default function CodeRunner({ language, code }: { language: string; code: string }) {
  const [output, setOutput] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [previewDoc, setPreviewDoc] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isHtml = language === "html";
  const isJs = language === "javascript";
  const isPython = language === "python";

  // Live preview for HTML — 500ms debounce after last keypress
  useEffect(() => {
    if (!isHtml) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setPreviewDoc(code), 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [code, isHtml]);

  // Receive console output from the JS sandbox iframe
  useEffect(() => {
    if (!isJs) return;
    const onMessage = (e: MessageEvent) => {
      if (e.data?.source === "code-runner") {
        setOutput(e.data.lines.length ? e.data.lines : ["(no output)"]);
        setRunning(false);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [isJs]);

  const runJs = () => {
    setRunning(true);
    setOutput([]);
    setPreviewDoc(jsHarness(code));
    // Fallback if the sandbox never reports back
    setTimeout(() => setRunning(false), 5000);
  };

  const runPython = async () => {
    setRunning(true);
    setOutput(["Running…"]);
    try {
      const { data } = await api.post("/execute/python", { code });
      const lines: string[] = [];
      if (data.stdout) lines.push(...data.stdout.replace(/\n$/, "").split("\n"));
      if (data.stderr) lines.push(...data.stderr.replace(/\n$/, "").split("\n"));
      setOutput(lines.length ? lines : ["(no output)"]);
    } catch (err: any) {
      setOutput([getErrorMessage(err, "Could not run code. Check your connection and try again.")]);
    } finally {
      setRunning(false);
    }
  };

  if (!isHtml && !isJs && !isPython) return null;

  return (
    <div className="mt-3 space-y-3">
      {(isJs || isPython) && (
        <Button size="sm" variant="outline" onClick={isJs ? runJs : runPython} disabled={running}>
          {running ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Play size={14} className="mr-1.5" />}
          {running ? "Running…" : "Run Code"}
        </Button>
      )}

      {isHtml && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Eye size={12} /> Live preview
          </p>
          <iframe
            sandbox="allow-scripts"
            srcDoc={previewDoc}
            className="w-full h-64 bg-white border border-gray-200 rounded-xl"
            title="Live preview"
          />
        </div>
      )}

      {isJs && previewDoc && (
        <iframe sandbox="allow-scripts" srcDoc={previewDoc} className="hidden" title="JS sandbox" />
      )}

      {(isJs || isPython) && output.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Terminal size={12} /> Output
          </p>
          <pre className="bg-gray-900 text-green-400 text-xs rounded-xl p-4 overflow-x-auto max-h-64 whitespace-pre-wrap">
            {output.join("\n")}
          </pre>
        </div>
      )}
    </div>
  );
}
