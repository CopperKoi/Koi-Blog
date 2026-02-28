"use client";

import { useCallback, useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { TravelMap } from "@/components/TravelMap";
import { apiFetch } from "@/lib/api";

type TravelMark = {
  adcode: number;
  name: string;
};

export default function TravelPage() {
  const [marks, setMarks] = useState<TravelMark[]>([]);
  const [admin, setAdmin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [hint, setHint] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [travelData, me] = await Promise.all([
          apiFetch("/travel"),
          apiFetch("/auth/me").catch(() => ({ user: null }))
        ]);

        const list = Array.isArray(travelData?.items) ? travelData.items : [];
        const normalized = list
          .map((item: { adcode?: unknown; name?: unknown }) => ({
            adcode: Number(item?.adcode),
            name: String(item?.name || "")
          }))
          .filter((item: TravelMark) => Number.isInteger(item.adcode) && item.adcode > 0 && item.name);

        setMarks(normalized);
        setAdmin(Boolean(me?.user));
      } catch {
        setHint("旅行地图数据加载失败，请稍后重试。");
      }
    })();
  }, []);

  const toggleMark = useCallback((adcode: number, name: string) => {
    if (!admin) return;

    setMarks((prev) => {
      const exists = prev.some((item) => item.adcode === adcode);
      if (exists) {
        return prev.filter((item) => item.adcode !== adcode);
      }
      return [...prev, { adcode, name }].sort((a, b) => a.adcode - b.adcode);
    });
    setDirty(true);
    setHint("已更新本地标记，记得点击保存。");
  }, [admin]);

  const saveMarks = async () => {
    if (!admin || saving) return;
    setSaving(true);
    setHint("");
    try {
      await apiFetch("/travel", {
        method: "PATCH",
        body: JSON.stringify({ items: marks })
      });
      setDirty(false);
      setHint("旅行足迹已保存。");
    } catch {
      setHint("保存失败，请重试。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SiteHeader />
      <main className="container">
        <section className="row space-between">
          <div>
            <h1 style={{ marginBottom: "var(--space-2)" }}>Travel</h1>
            <p className="meta">仅统计 2025 年之后的旅程，这是我和我的朋友们的回忆。</p>
          </div>
          {admin ? (
            <div className="row">
              <button className="button" type="button" onClick={saveMarks} disabled={!dirty || saving}>
                {saving ? "保存中..." : dirty ? "保存标记" : "已保存"}
              </button>
            </div>
          ) : null}
        </section>

        <section className="card travel-card" style={{ marginTop: "var(--space-5)" }}>
          <TravelMap
            marks={marks}
            editable={admin}
            onToggle={toggleMark}
          />
        </section>
        {hint && <div className="meta" style={{ marginTop: "var(--space-3)" }}>{hint}</div>}
      </main>
      <SiteFooter />
    </>
  );
}
