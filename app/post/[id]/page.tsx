"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MarkdownClient } from "@/components/MarkdownClient";
import { apiFetch } from "@/lib/api";
import { formatDate, normalizePost } from "@/lib/posts";

export default function PostPage() {
  const params = useParams();
  const id = params?.id as string;
  const [post, setPost] = useState<any>(null);
  const [status, setStatus] = useState("加载中...");

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const data = await apiFetch(`/posts/${id}`);
        setPost(normalizePost(data.post));
        setStatus("");
      } catch {
        setStatus("文章不存在或已下线");
      }
    })();
  }, [id]);

  return (
    <>
      <SiteHeader />
      <main className="container">
        <section className="card">
          <div className="card-body">
            {status && <div className="notice">{status}</div>}
            {!status && post && (
              <>
                <div className="row space-between">
                  <div>
                    <h1 style={{ marginBottom: "var(--space-2)" }}>{post.title}</h1>
                    <div className="meta">{formatDate(post.publishAt || post.createdAt)}</div>
                  </div>
                  <div className="row">
                    {(post.tags || []).map((tag: string) => (
                      <span className="badge" key={tag}>{tag}</span>
                    ))}
                  </div>
                </div>
                <div className="divider" />
                <MarkdownClient content={post.content || ""} />
              </>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
