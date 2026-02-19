"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useParams } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MarkdownClient, extractMarkdownHeadings } from "@/components/MarkdownClient";
import { apiFetch } from "@/lib/api";
import { formatDate, normalizePost } from "@/lib/posts";

export default function PostPage() {
  const params = useParams();
  const id = params?.id as string;
  const tocScrollFrameRef = useRef<number | null>(null);
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

  useEffect(() => {
    return () => {
      if (tocScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(tocScrollFrameRef.current);
      }
    };
  }, []);

  const tocHeadings = useMemo(() => extractMarkdownHeadings(post?.content || ""), [post?.content]);

  const onTocClick = (event: MouseEvent<HTMLAnchorElement>, headingId: string) => {
    event.preventDefault();
    const target = document.getElementById(headingId);
    if (!target) return;

    if (tocScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(tocScrollFrameRef.current);
      tocScrollFrameRef.current = null;
    }

    const rootStyles = window.getComputedStyle(document.documentElement);
    const headerHeight = Number.parseFloat(rootStyles.getPropertyValue("--site-header-height")) || 0;
    const targetY = Math.max(
      window.scrollY + target.getBoundingClientRect().top - headerHeight - 16,
      0
    );

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.scrollTo(0, targetY);
    } else {
      const startY = window.scrollY;
      const distance = targetY - startY;
      const duration = 220;
      const start = performance.now();
      const animate = (now: number) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 4);
        window.scrollTo(0, startY + distance * eased);
        if (progress < 1) {
          tocScrollFrameRef.current = window.requestAnimationFrame(animate);
        } else {
          tocScrollFrameRef.current = null;
        }
      };
      tocScrollFrameRef.current = window.requestAnimationFrame(animate);
    }

    window.history.replaceState(null, "", `#${headingId}`);
  };

  return (
    <>
      <SiteHeader />
      <main className="container">
        <div className={`post-page-layout${!status && post ? "" : " no-toc"}`}>
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
                  <article className="post-content">
                    <MarkdownClient content={post.content || ""} />
                  </article>
                </>
              )}
            </div>
          </section>
          {!status && post && (
            <aside className="post-toc" aria-label="文章目录">
              <div className="post-toc-title">{post.title}</div>
              {tocHeadings.length > 0 ? (
                <nav className="post-toc-nav">
                  {tocHeadings.map((heading) => (
                    <a
                      key={heading.id}
                      href={`#${heading.id}`}
                      onClick={(event) => onTocClick(event, heading.id)}
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
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
