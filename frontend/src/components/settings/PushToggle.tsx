"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { currentSubscription, disablePush, enablePush, pushSupported } from "@/lib/push";

export default function PushToggle() {
  const [supported, setSupported] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      setSupported(pushSupported());
      setEnabled(!!(await currentSubscription()));
      setReady(true);
    })();
  }, []);

  const toggle = async () => {
    setBusy(true);
    try {
      if (enabled) {
        await disablePush();
        setEnabled(false);
        toast.success("Notifications turned off");
      } else {
        const res = await enablePush();
        if (!res.ok) {
          toast.error(res.reason || "Couldn't turn on notifications");
          return;
        }
        setEnabled(true);
        toast.success("Notifications turned on");
      }
    } catch {
      toast.error("Couldn't change your notification setting");
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/me/push/test");
      if (data.delivered > 0) toast.success("Sent — check your notifications");
      else toast.error("No browsers are subscribed yet");
    } catch {
      toast.error("Couldn't send the test notification");
    } finally {
      setBusy(false);
    }
  };

  if (!ready) return null;

  return (
    <Card className="p-5 sm:p-6 lg:p-7">
      <div className="flex items-start gap-3 mb-1">
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
            enabled ? "bg-brand-primary/10" : "bg-gray-100"
          }`}
        >
          {enabled ? (
            <Bell size={14} className="text-brand-primary" />
          ) : (
            <BellOff size={14} className="text-gray-400" />
          )}
        </div>
        <h2 className="font-display text-base font-bold text-brand-navy pt-0.5">
          Browser notifications
        </h2>
      </div>
      <p className="text-sm text-gray-500 mt-1 mb-4">
        {supported
          ? "Get told when your assignment is reviewed, a badge lands, or someone answers your doubt — even when this tab is closed."
          : "This browser can't show notifications. On iPhone, add NOVA LABS to your Home Screen first."}
      </p>
      {supported && (
        <Button
          variant={enabled ? "outline" : "primary"}
          size="sm"
          onClick={toggle}
          disabled={busy}
          className="w-full sm:w-auto"
        >
          {busy ? "Working..." : enabled ? "Turn off" : "Turn on"}
        </Button>
      )}

      {enabled && (
        <button
          onClick={sendTest}
          disabled={busy}
          className="mt-3 text-sm text-brand-primary hover:underline disabled:opacity-50 block"
        >
          Send a test notification
        </button>
      )}
    </Card>
  );
}
