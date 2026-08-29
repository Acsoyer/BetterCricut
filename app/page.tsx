"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Layers3, Scissors, Sparkles, WandSparkles } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import "./landing.css";
import "./landing-v31.css";

declare global {
  interface Window {
    google?: { accounts: { id: {
      initialize(options: { client_id: string; callback: (response: { credential: string }) => void; auto_select?: boolean }): void;
      renderButton(element: HTMLElement, options: Record<string, string | number>): void;
      prompt(): void;
    } } };
  }
}

const updates = [
  ["v31", "Direct Google sign-in", "A recognizable Google login with Supabase sessions behind the scenes."],
  ["v30", "Public foundation", "Landing page, membership and protected editor route."],
  ["v29", "Production cleanup", "Cloudflare-ready configuration and a cleaner codebase."],
] as const;

export default function LandingPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);
  const googleButton = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) return;
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return;
    const setupGoogle = () => {
      if (!window.google || !googleButton.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        auto_select: false,
        callback: async ({ credential }) => {
          setBusy(true);
          const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token: credential });
          if (error) setBusy(false);
          else window.location.assign("/editor");
        },
      });
      googleButton.current.replaceChildren();
      window.google.accounts.id.renderButton(googleButton.current, {
        type: "standard", theme: "outline", size: "large", shape: "pill",
        text: "continue_with", logo_alignment: "left", width: 238,
      });
    };
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      if (window.google) setupGoogle();
      else existing.addEventListener("load", setupGoogle, { once: true });
    } else {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = setupGoogle;
      document.head.appendChild(script);
    }
  }, [session]);

  const signIn = () => {
    setBusy(true);
    window.google?.accounts.id.prompt();
    window.setTimeout(() => setBusy(false), 1200);
  };

  return (
    <main className="landing-shell">
      <nav className="landing-nav">
        <div className="landing-brand"><span><Scissors /></span><b>Better Cricut Editor</b></div>
        {session ? <Link className="nav-cta" href="/editor">Open Editor <ArrowRight /></Link> : <button className="nav-cta" onClick={signIn} disabled={busy}>{busy ? "Connecting…" : "Sign in with Google"}</button>}
      </nav>

      <section className="landing-main">
        <div className="hero-copy">
          <span className="eyebrow"><Sparkles /> Built for precise Cricut preparation</span>
          <h1>Turn everyday artwork into clean, cut-ready designs.</h1>
          <p>Remove backgrounds, create cutouts, add editable strokes and export correctly sized SVG, PNG or A4 PDF files from one focused workspace.</p>
          <div className="hero-actions">
            {session ? <Link className="primary-cta" href="/editor">Continue to Editor <ArrowRight /></Link> : <div ref={googleButton} className="official-google-button" aria-label="Continue with Google" />}
            <span>Free during development</span>
          </div>
          <div className="feature-row">
            <span><WandSparkles /> Background refinement</span>
            <span><Scissors /> Cutout & stroke tools</span>
            <span><Layers3 /> Layer-based workspace</span>
          </div>
        </div>

        <aside className="dev-log">
          <header><span>Development log</span><i>Actively building</i></header>
          <div className="log-list">
            {updates.map(([version, title, text]) => <article key={version}><b>{version}</b><div><h2>{title}</h2><p>{text}</p></div></article>)}
          </div>
          <footer>More editing tools, project saving and collaboration are planned.</footer>
        </aside>
      </section>
    </main>
  );
}
