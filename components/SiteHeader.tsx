"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { apiFetch, buildApiUrl } from "@/lib/api";

const THEME_KEY = "blog_theme";

export function SiteHeader() {
  const headerRef = useRef<HTMLElement>(null);
  const [theme, setTheme] = useState("system");
  const [isAdmin, setIsAdmin] = useState(false);
  const [apiStatus, setApiStatus] = useState<"idle" | "ok" | "fail">("idle");
  const isDev = process.env.NODE_ENV === "development";

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const root = document.documentElement;
    const syncHeight = () => {
      root.style.setProperty("--site-header-height", `${header.offsetHeight}px`);
    };
    syncHeight();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(syncHeight) : null;
    observer?.observe(header);
    window.addEventListener("resize", syncHeight);
    return () => {
      window.removeEventListener("resize", syncHeight);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_KEY) || "system";
    setTheme(stored);
    applyTheme(stored, false);
    (async () => {
      try {
        const me = await apiFetch("/auth/me");
        setIsAdmin(Boolean(me?.user));
      } catch {
        setIsAdmin(false);
      }
    })();
    if (isDev) {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 3000);
      fetch(buildApiUrl("/about"), { signal: controller.signal })
        .then((res) => {
          if (!res.ok) throw new Error("bad");
          setApiStatus("ok");
        })
        .catch(() => setApiStatus("fail"))
        .finally(() => window.clearTimeout(timer));
      return () => {
        window.clearTimeout(timer);
        controller.abort();
      };
    }
  }, []);

  function applyTheme(value: string, animate = true) {
    const root = document.documentElement;
    const setTheme = () => {
      if (value === "system") {
        root.removeAttribute("data-theme");
      } else {
        root.setAttribute("data-theme", value);
      }
      window.localStorage.setItem(THEME_KEY, value);
    };

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const docWithTransition = document as Document & {
      startViewTransition?: (callback: () => void) => { finished?: Promise<unknown> };
    };
    if (animate && !prefersReduced && typeof docWithTransition.startViewTransition === "function") {
      const transition = docWithTransition.startViewTransition(() => {
        setTheme();
      });
      transition?.finished?.catch(() => {});
      return;
    }

    setTheme();
  }

  return (
    <header ref={headerRef} className="site-header">
      <div className="container nav">
        <div className="nav-left">
          <Link className="logo" href="/">CopperKoi Blog</Link>
          <nav className="nav-links">
            <Link href="/posts">Article</Link>
            <Link href="/search">Search</Link>
            <Link href="/about">About</Link>
            <Link href="/friends">Friends</Link>
            {isAdmin && (
              <>
                <Link href="/studio-i10v32wn1220">Manage</Link>
                <Link href="/editor-i10v32wn1220?new=1">New</Link>
                <Link href="/editor-i10v32wn1220?about=1">Update About</Link>
                <Link href="/ssl-i10v32wn1220">Update Certificate</Link>
                <button
                  className="link-button"
                  type="button"
                  onClick={async () => {
                    try {
                      await apiFetch("/auth/logout", { method: "POST" });
                    } finally {
                      window.location.href = "/";
                    }
                  }}
                >
                  LogOut
                </button>
              </>
            )}
          </nav>
        </div>
        <div className="theme-controls">
          {isDev && (
            <span className={`dev-status ${apiStatus}`}>
              {apiStatus === "ok" ? "后端可用" : apiStatus === "fail" ? "后端不可达" : "后端检测中"}
            </span>
          )}
          <select
            value={theme}
            onChange={(event) => {
              const value = event.target.value;
              setTheme(value);
              applyTheme(value);
            }}
          >
            <option value="system">System</option>
            <option value="light">Light Mode</option>
            <option value="dark">Dark Mode</option>
          </select>
        </div>
      </div>
    </header>
  );
}
