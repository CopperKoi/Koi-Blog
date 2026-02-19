"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MarkdownClient, extractMarkdownHeadings } from "@/components/MarkdownClient";
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

  const tocHeadings = useMemo(() => extractMarkdownHeadings(post?.content || ""), [post?.content]);

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
                <div className="post-layout">
                  <article className="post-content">
                    <MarkdownClient content={post.content || ""} />
                  </article>
                  <aside className="post-toc" aria-label="文章目录">
                    <div className="post-toc-title">目录</div>
                    {tocHeadings.length > 0 ? (
                      <nav className="post-toc-nav">
                        {tocHeadings.map((heading) => (
                          <a
                            key={heading.id}
                            href={`#${heading.id}`}
                            className={`post-toc-link level-${heading.level}`}
                          >
                            {heading.text}
                          </a>
                        ))}
                      </nav>
                    ) : (
                      <div className="meta">暂无可导航标题</div>
                    )}
                  </aside>
                </div>
              </>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
