"use client";

import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MarkdownClient } from "@/components/MarkdownClient";
import { apiFetch } from "@/lib/api";

export default function AboutPage() {
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("加载中...");

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch("/about");
        setContent(data.content || "");
        setStatus("");
      } catch {
        setStatus("暂时无法加载自我介绍");
      }
    })();
  }, []);

  return (
    <>
      <SiteHeader />
      <main className="container">
        <section className="card">
          <div className="card-body">
            {status && <div className="notice">{status}</div>}
            {!status && <MarkdownClient content={content} />}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
