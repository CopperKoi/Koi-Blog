"use client";

import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { FriendList, Friend } from "@/components/FriendList";
import { apiFetch } from "@/lib/api";

export default function FriendsPage() {
  const [items, setItems] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [admin, setAdmin] = useState(false);
  const [hint, setHint] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const friends = await apiFetch("/friends");
        setItems(friends.items || []);
        try {
          const me = await apiFetch("/auth/me");
          setAdmin(Boolean(me?.user));
        } catch {
          setAdmin(false);
        }
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function reload() {
    const data = await apiFetch("/friends");
    setItems(data.items || []);
  }

  async function handleAdd() {
    setHint("");
    const titleInput = document.getElementById("friendTitle") as HTMLInputElement;
    const urlInput = document.getElementById("friendUrl") as HTMLInputElement;
    const noteInput = document.getElementById("friendNote") as HTMLTextAreaElement;

    if (!titleInput.value.trim() || !urlInput.value.trim()) {
      setHint("站点名称与链接不能为空。");
      return;
    }

    try {
      await apiFetch("/friends", {
        method: "POST",
        body: JSON.stringify({
          title: titleInput.value.trim(),
          url: urlInput.value.trim(),
          note: noteInput.value.trim()
        })
      });
      titleInput.value = "";
      urlInput.value = "";
      noteInput.value = "";
      setHint("已添加友链。");
      await reload();
    } catch {
      setHint("添加失败，请稍后再试。");
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("确定删除该友链吗？")) return;
    await apiFetch(`/friends/${id}`, { method: "DELETE" });
    await reload();
  }

  async function handleMove(id: string, direction: "up" | "down") {
    await apiFetch(`/friends/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ direction })
    });
    await reload();
  }

  async function handleEdit(id: string) {
    const friend = items.find((item) => item.id === id);
    if (!friend) return;
    const title = prompt("站点名称", friend.title) || friend.title;
    const url = prompt("站点链接", friend.url) || friend.url;
    const note = prompt("备注（显示在链接上方）", friend.note || "") || friend.note || "";
    await apiFetch(`/friends/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title, url, note })
    });
    await reload();
  }

  return (
    <>
      <SiteHeader />
      <main className="container">
        <section className="row space-between">
          <div>
            <h1 style={{ marginBottom: "var(--space-2)" }}>友链</h1>
            <p className="meta">欢迎交换友链，可以添加 CopperKoi 的 QQ：2582212050 申请交换。</p>
          </div>
        </section>

        {admin && (
          <section className="form-card" style={{ marginTop: "var(--space-5)" }}>
            <h2 style={{ marginTop: 0 }}>新增友链</h2>
            <div className="grid">
              <label>
                站点名称
                <input id="friendTitle" placeholder="例如：某某的博客" />
              </label>
              <label>
                跳转链接
                <input id="friendUrl" placeholder="https://example.com" />
              </label>
              <label>
                备注（显示在链接上方）
                <textarea id="friendNote" rows={3} placeholder="可以写一句简短介绍"></textarea>
              </label>
            </div>
            <div className="row" style={{ marginTop: "var(--space-4)" }}>
              <button className="button" type="button" onClick={handleAdd}>
                添加友链
              </button>
              <span className="meta">{hint}</span>
            </div>
          </section>
        )}

        <section style={{ marginTop: "var(--space-6)" }}>
          <div className="row space-between">
            <h2 style={{ margin: 0 }}>友链列表</h2>
            <span className="meta">{loading ? "加载中" : `共 ${items.length} 个站点`}</span>
          </div>
          {loading ? (
            <div className="notice">加载中...</div>
          ) : (
            <FriendList
              items={items}
              admin={admin}
              onDelete={handleDelete}
              onMove={handleMove}
              onEdit={handleEdit}
            />
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
