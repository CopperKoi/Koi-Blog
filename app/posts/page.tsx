"use client";

import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PostCard, PostItem } from "@/components/PostCard";
import { apiFetch } from "@/lib/api";
import { toPostItem } from "@/lib/posts";

export default function PostsPage() {
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [status, setStatus] = useState("加载中...");

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch("/posts");
        setPosts((data.items || []).map(toPostItem));
        setStatus("");
      } catch {
        setStatus("暂时无法加载文章");
      }
    })();
  }, []);

  return (
    <>
      <SiteHeader />
      <main className="container">
        <section className="row space-between">
          <div>
            <h1 style={{ marginBottom: "var(--space-2)" }}>文章总览</h1>
            <p className="meta">这里展示所有公开文章，按发布时间排序。</p>
          </div>
        </section>

        <section className="post-list" style={{ marginTop: "var(--space-5)" }}>
          {status && <div className="notice">{status}</div>}
          {!status && posts.length === 0 ? (
            <div className="notice">暂无公开文章，稍后再来看看吧。</div>
          ) : (
            posts.map((post) => <PostCard key={post.id} post={post} />)
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
