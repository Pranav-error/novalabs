"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Button from "@/components/ui/Button";
import toast from "react-hot-toast";
import { getErrorMessage } from "@/lib/utils";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
const GSI_SRC = "https://accounts.google.com/gsi/client";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: object) => void;
          renderButton: (el: HTMLElement, options: object) => void;
        };
      };
    };
  }
}

/** Renders the official Google sign-in button when NEXT_PUBLIC_GOOGLE_CLIENT_ID
 *  is set; otherwise falls back to the disabled "Coming Soon" button. */
export default function GoogleSignInButton() {
  const { loginWithGoogle } = useAuth();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !containerRef.current) return;

    const render = () => {
      if (!window.google || !containerRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response: { credential: string }) => {
          try {
            await loginWithGoogle(response.credential);
            router.push("/dashboard");
          } catch (err: any) {
            toast.error(getErrorMessage(err, "Google sign-in failed"));
          }
        },
      });
      window.google.accounts.id.renderButton(containerRef.current, {
        theme: "outline",
        size: "large",
        width: containerRef.current.offsetWidth || 360,
        text: "continue_with",
      });
    };

    if (window.google) {
      render();
      return;
    }
    const script = document.createElement("script");
    script.src = GSI_SRC;
    script.async = true;
    script.onload = render;
    script.onerror = () => setFailed(true);
    document.body.appendChild(script);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!GOOGLE_CLIENT_ID || failed) {
    return (
      <Button variant="outline" className="w-full" type="button" disabled>
        Continue with Google (Coming Soon)
      </Button>
    );
  }

  // min-height matches the rendered Google button so the form doesn't jump
  // once the script loads and swaps this from an empty div to the button.
  return <div ref={containerRef} className="flex justify-center min-h-[44px]" />;
}
