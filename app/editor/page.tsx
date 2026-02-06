"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminGuard } from "@/components/AdminGuard";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MarkdownClient } from "@/components/MarkdownClient";
import { apiFetch } from "@/lib/api";
import { normalizePost, parseTags, randomId } from "@/lib/posts";

type EditorMode = "post" | "about";

type DraftPayload = {
  mode: EditorMode;
  isNew: boolean;
  updatedAt: string;
  form: EditorForm;
};

type EditorForm = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  tags: string;
  visibility: "public" | "private";
  publishAt: string;
  content: string;
};

const AUTOSAVE_KEY = "blog_autosave";

function toLocalDatetime(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export const dynamic = "force-dynamic";

function EditorContent() {
  const searchParams = useSearchParams();
  const isAbout = searchParams?.has("about") ?? false;
  const postId = searchParams?.get("id");

  const mode: EditorMode = isAbout ? "about" : "post";
  const [form, setForm] = useState<EditorForm>({
    id: "",
    slug: "",
    title: "",
    summary: "",
    tags: "",
    visibility: "public",
    publishAt: "",
    content: ""
  });
  const [isNew, setIsNew] = useState(true);
  const [autosaveEnabled, setAutosaveEnabled] = useState(false);
  const [autosaveHint, setAutosaveHint] = useState("");
  const [restoreDraft, setRestoreDraft] = useState<DraftPayload | null>(null);
  const [actionHint, setActionHint] = useState("");

  useEffect(() => {
    const raw = window.localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as DraftPayload;
      if (parsed.mode !== mode) return;
      setRestoreDraft(parsed);
    } catch {
      setRestoreDraft(null);
    }
  }, [mode]);

  useEffect(() => {
    (async () => {
      try {
        if (mode === "about") {
          const data = await apiFetch("/about");
          setForm((prev) => ({
            ...prev,
            id: "about",
            slug: "about",
            title: "关于我",
            content: data.content || ""
          }));
          setIsNew(false);
          return;
        }

        if (postId) {
          const data = await apiFetch(`/posts/${postId}`);
          const post = normalizePost(data.post || {});
          setForm({
            id: post.id || "",
            slug: post.slug || "",
            title: post.title || "",
            summary: post.summary || "",
            tags: parseTags(post.tags).join(", "),
            visibility: (post.visibility as "public" | "private") || "public",
            publishAt: toLocalDatetime(post.publishAt || ""),
            content: post.content || ""
          });
          setIsNew(false);
        } else {
          const id = `p_${randomId(12)}`;
          const slug = `post-${randomId(10)}`;
          setForm((prev) => ({
            ...prev,
            id,
            slug
          }));
          setIsNew(true);
        }
      } catch {
        setActionHint("加载失败，请稍后重试。");
      }
    })();
  }, [mode, postId]);

  useEffect(() => {
    if (!autosaveEnabled) return;
    const timer = window.setTimeout(() => {
      const payload: DraftPayload = {
        mode,
        isNew,
        updatedAt: new Date().toISOString(),
        form
      };
      window.localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(payload));
      setAutosaveHint(`自动保存于 ${new Date().toLocaleTimeString()}`);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [autosaveEnabled, form, mode, isNew]);

  const previewContent = useMemo(() => form.content || "", [form.content]);

  function restoreAutosave() {
    if (!restoreDraft) return;
    setForm(restoreDraft.form);
    setIsNew(restoreDraft.isNew);
    setAutosaveHint(`已恢复自动保存内容（${new Date(restoreDraft.updatedAt).toLocaleString()}）`);
    setRestoreDraft(null);
  }

  function dismissAutosave() {
    setRestoreDraft(null);
  }

  function clearAutosave() {
    window.localStorage.removeItem(AUTOSAVE_KEY);
    setAutosaveHint("已清除自动保存内容。");
    setRestoreDraft(null);
  }

  async function handleSave(nextStatus: "draft" | "published") {
    setActionHint("");
    if (mode === "about") {
      try {
        await apiFetch("/about", {
          method: "PUT",
          body: JSON.stringify({ content: form.content })
        });
        setActionHint("已更新自我介绍。");
      } catch {
        setActionHint("保存失败，请稍后再试。");
      }
      return;
    }

    if (!form.title.trim()) {
      setActionHint("标题不能为空。");
      return;
    }

    const payload = {
      id: form.id,
      slug: form.slug,
      title: form.title.trim(),
      summary: form.summary.trim(),
      tags: parseTags(form.tags),
      visibility: form.visibility,
      status: nextStatus,
      publishAt: form.publishAt ? new Date(form.publishAt).toISOString() : null,
      content: form.content
    };

    try {
      const data = isNew
        ? await apiFetch("/posts", { method: "POST", body: JSON.stringify(payload) })
        : await apiFetch(`/posts/${form.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      const post = normalizePost(data.post || {});
      setForm({
        id: post.id || form.id,
        slug: post.slug || form.slug,
        title: post.title || form.title,
        summary: post.summary || "",
        tags: parseTags(post.tags).join(", "),
        visibility: (post.visibility as "public" | "private") || form.visibility,
        publishAt: toLocalDatetime(post.publishAt || ""),
        content: post.content || ""
      });
      setIsNew(false);
      setActionHint(nextStatus === "published" ? "发布成功。" : "已暂存为草稿。");
    } catch {
      setActionHint("保存失败，请稍后再试。");
    }
  }

  return (
    <AdminGuard>
      <SiteHeader />
      <main className="container">
        <section className="row space-between">
          <div>
            <h1 id="editorTitle" style={{ marginBottom: "var(--space-2)" }}>
              {mode === "about" ? "编辑自我介绍" : "撰写文章"}
            </h1>
            <p className="meta" id="editorSubtitle">
              {mode === "about" ? "支持 Markdown 实时预览。" : "支持 Markdown 实时预览、暂存与定时发布。"}
            </p>
          </div>
        </section>

        <section className="form-card" style={{ marginTop: "var(--space-5)" }}>
          <div className="toolbar">
            <label className="toggle">
              <input
                type="checkbox"
                checked={autosaveEnabled}
                onChange={(event) => setAutosaveEnabled(event.target.checked)}
              />
              自动保存
            </label>
            <span className="meta">{autosaveHint}</span>
          </div>

          {restoreDraft && (
            <div className="notice" style={{ marginTop: "var(--space-3)" }}>
              发现自动保存内容（{new Date(restoreDraft.updatedAt).toLocaleString()}），
              <button className="link-button" type="button" onClick={restoreAutosave}>
                恢复
              </button>
              或
              <button className="link-button" type="button" onClick={dismissAutosave}>
                忽略
              </button>
            </div>
          )}

          {mode !== "about" && (
            <div style={{ marginTop: "var(--space-4)" }}>
              <div className="row" style={{ gap: "var(--space-4)" }}>
                <label style={{ flex: 1 }}>
                  标题
                  <input
                    value={form.title}
                    onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                    required
                  />
                </label>
                <label style={{ minWidth: 180 }}>
                  文章 ID
                  <input value={form.id} readOnly />
                </label>
              </div>
              <label>
                摘要
                <textarea
                  rows={3}
                  value={form.summary}
                  onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))}
                />
              </label>
              <label>
                标签（逗号分隔）
                <input
                  value={form.tags}
                  onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))}
                  placeholder="比如：随笔, 技术"
                />
              </label>
              <div className="row" style={{ gap: "var(--space-4)" }}>
                <label style={{ minWidth: 200 }}>
                  可见状态
                  <select
                    value={form.visibility}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, visibility: event.target.value as "public" | "private" }))
                    }
                  >
                    <option value="public">公开可见</option>
                    <option value="private">仅自己可见</option>
                  </select>
                </label>
                <label style={{ flex: 1 }}>
                  定时发布时间
                  <input
                    type="datetime-local"
                    value={form.publishAt}
                    onChange={(event) => setForm((prev) => ({ ...prev, publishAt: event.target.value }))}
                  />
                </label>
              </div>
            </div>
          )}

          <div className="editor-grid" style={{ marginTop: "var(--space-5)" }}>
            <div className="editor-pane">
              <label>
                内容（Markdown）
                <textarea
                  value={form.content}
                  onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
                />
              </label>
            </div>
            <div className="preview-pane">
              <div className="meta">实时预览</div>
              <div style={{ marginTop: "var(--space-3)" }}>
                <MarkdownClient content={previewContent} />
              </div>
            </div>
          </div>

          <div className="row" style={{ marginTop: "var(--space-5)" }}>
            {mode !== "about" && (
              <button className="button" type="button" onClick={() => handleSave("published")}>
                发布
              </button>
            )}
            <button
              className="button secondary"
              type="button"
              onClick={() => handleSave("draft")}
            >
              {mode === "about" ? "保存" : "暂存"}
            </button>
            <button className="button secondary" type="button" onClick={clearAutosave}>
              清除自动保存
            </button>
          </div>
          <p className="meta" style={{ marginTop: "var(--space-3)" }}>
            {actionHint}
          </p>
        </section>
      </main>
      <SiteFooter />
    </AdminGuard>
  );
}

export default function EditorPage() {
  return (
    <Suspense fallback={<div className="notice">加载中...</div>}>
      <EditorContent />
    </Suspense>
  );
}
