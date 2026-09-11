"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import "./v42.css";
import "./v43.css";
import "./v47.css";
import "./v48.css";
import "./v49.css";
import "./v50.css";
import "./v51.css";
import "./v52.css";
import "./v53.css";
import "./v54.css";
import "./v55.css";
import "./v56.css";
import "./v57.css";
import "./v58.css";
import "./v59.css";
import "./v60.css";
import "./v61.css";
import "./v62.css";
import "./v63.css";
import "./v64.css";
import "./v65.css";
import "./v66.css";
import "./v67.css";
import "./v68.css";
import "./v69.css";
import "./v70.css";
import "./v71.css";
import "./v72.css";
import "./v76.css";
import "./v79.css";
import "./v80.css";
import "./v81.css";
import "./v82.css";
import "./v86.css";
import "./v87.css";
import "./v88.css";
import "./v89.css";
import "./v90.css";
import "./v93.css";

export default function EditorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (!data.session) router.replace("/?login=required");
      else setReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/");
      else setReady(true);
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [router]);

  if (!ready) return <div className="auth-check">Preparing your workspace…</div>;
  return children;
}
