"use client";

import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PostCard } from "@/components/PostCard";
import { apiFetch } from "@/lib/api";
import { normalizePost, toPostItem } from "@/lib/posts";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [posts, setPosts] = useState<any[]>([]);
  const [status, setStatus] = useState("加载中...");

  useEffect(() => {
    apiFetch("/posts")
      .then((data) => {
        setPosts((data.items || []).map(normalizePost));
        setStatus("");
      })
      .catch(() => setStatus("暂时无法加载文章"));
  }, []);

  const filtered = query
    ? posts.filter((post) => {
        const text = [post.title, post.summary, post.content, (post.tags || []).join(" ")].join(" ").toLowerCase();
        return text.includes(query.toLowerCase());
      })
    : [];

  return (
    <>
      <SiteHeader />
      <main className="container">
        <section className="form-card">
          <h1 style={{ marginTop: 0 }}>检索文章</h1>
          <p className="meta">支持标题、摘要与正文内容检索。</p>
          <label>
            <input
              type="search"
              placeholder="输入关键词后立即检索"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </section>

        <section style={{ marginTop: "var(--space-6)" }}>
          <div className="row space-between">
            <h2 style={{ margin: 0 }}>检索结果</h2>
            <span className="meta">
              {query ? `共 ${filtered.length} 篇` : `共 ${posts.length} 篇公开文章`}
            </span>
          </div>
          <div className="post-list" style={{ marginTop: "var(--space-4)" }}>
            {status && <div className="notice">{status}</div>}
            {!status && !query && <div className="notice">请输入关键词以开始检索。</div>}
            {!status && query && filtered.length === 0 && (
              <div className="notice">没有找到匹配的文章，请换个关键词试试。</div>
            )}
            {!status && query && filtered.map((post) => <PostCard key={post.id} post={toPostItem(post)} />)}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
