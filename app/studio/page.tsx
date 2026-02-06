"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminGuard } from "@/components/AdminGuard";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { apiFetch } from "@/lib/api";

export const dynamic = "force-dynamic";

export default function StudioPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    (async () => {
      const data = await apiFetch("/posts?view=admin");
      setPosts(data.items || []);
    })();
  }, []);

  async function reload() {
    const data = await apiFetch("/posts?view=admin");
    setPosts(data.items || []);
  }

  function getStatus(post: any) {
    if (post.status === "draft") return "draft";
    if (post.visibility === "private") return "private";
    if (post.publish_at && new Date(post.publish_at) > new Date()) return "scheduled";
    return "published";
  }

  async function handleDelete(id: string) {
    if (!window.confirm("确定删除这篇文章吗？此操作不可恢复。")) return;
    await apiFetch(`/posts/${id}`, { method: "DELETE" });
    await reload();
  }

  const filtered = posts.filter((post) => {
    if (filter === "all") return true;
    if (filter === "draft") return post.status === "draft";
    if (filter === "private") return post.visibility === "private";
    if (filter === "scheduled") return post.publish_at && new Date(post.publish_at) > new Date();
    if (filter === "published") return post.status === "published" && post.visibility === "public" && (!post.publish_at || new Date(post.publish_at) <= new Date());
    return true;
  });

  return (
    <AdminGuard>
      <SiteHeader />
      <main className="container">
        <section className="row space-between">
          <div>
            <h1 style={{ marginBottom: "var(--space-2)" }}>管理文章</h1>
            <p className="meta">集中管理文章状态与内容更新。</p>
          </div>
        </section>

        <section className="card" style={{ marginTop: "var(--space-5)" }}>
          <div className="card-body">
            <div className="row">
              <span className="badge">全部 {posts.length}</span>
              <span className="badge status-draft">暂存 {posts.filter((p) => getStatus(p) === "draft").length}</span>
              <span className="badge status-private">私密 {posts.filter((p) => getStatus(p) === "private").length}</span>
              <span className="badge status-scheduled">定时 {posts.filter((p) => getStatus(p) === "scheduled").length}</span>
              <span className="badge">已发布 {posts.filter((p) => getStatus(p) === "published").length}</span>
            </div>
          </div>
        </section>

        <section style={{ marginTop: "var(--space-5)" }}>
          <div className="row space-between">
            <h2 style={{ margin: 0 }}>文章列表</h2>
            <label className="row" style={{ gap: "var(--space-2)" }}>
              <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                <option value="all">全部</option>
                <option value="published">已发布</option>
                <option value="draft">暂存</option>
                <option value="private">私密</option>
                <option value="scheduled">定时</option>
              </select>
            </label>
          </div>
          <div className="post-list" style={{ marginTop: "var(--space-4)" }}>
            {filtered.length === 0 ? (
              <div className="notice">暂无匹配的文章。</div>
            ) : (
              filtered.map((post) => (
                <article className="card" key={post.id}>
                  <div className="card-body">
                    <div className="row space-between">
                      <div>
                        <h3 style={{ marginBottom: "var(--space-2)" }}>{post.title}</h3>
                        <p className="meta">更新于 {new Date(post.updated_at || post.updatedAt).toLocaleString()}</p>
                      </div>
                      {getStatus(post) === "draft" && <span className="badge status-draft">暂存</span>}
                      {getStatus(post) === "private" && <span className="badge status-private">私密</span>}
                      {getStatus(post) === "scheduled" && <span className="badge status-scheduled">定时</span>}
                      {getStatus(post) === "published" && <span className="badge">公开</span>}
                    </div>
                    <p>{post.summary || ""}</p>
                    <div className="card-actions">
                      <Link className="link-button" href={`/editor?id=${post.id}`}>编辑文章</Link>
                      <button className="link-button" type="button" onClick={() => handleDelete(post.id)}>删除文章</button>
                      <span className="meta">{post.visibility === "private" ? "仅自己可见" : "公开可见"}</span>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </AdminGuard>
  );
}
