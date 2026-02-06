"use client";

import { useState } from "react";
import { AdminGuard } from "@/components/AdminGuard";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { apiFetch } from "@/lib/api";

export const dynamic = "force-dynamic";

export default function SslPage() {
  const [cert, setCert] = useState("");
  const [key, setKey] = useState("");
  const [status, setStatus] = useState("");

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>, setter: (value: string) => void) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setter(text);
  }

  async function handleSubmit() {
    setStatus("");
    if (!cert.trim() || !key.trim()) {
      setStatus("请同时提供证书与私钥内容。");
      return;
    }
    try {
      await apiFetch("/admin/ssl", {
        method: "PUT",
        body: JSON.stringify({ cert, key })
      });
      setStatus("已更新 SSL 证书文件。请按需重载服务。");
    } catch {
      setStatus("更新失败，请检查文件内容与权限配置。");
    }
  }

  return (
    <AdminGuard>
      <SiteHeader />
      <main className="container">
        <section className="row space-between">
          <div>
            <h1 style={{ marginBottom: "var(--space-2)" }}>更新 SSL 证书</h1>
            <p className="meta">可直接粘贴证书与私钥内容，或选择证书文件上传。</p>
          </div>
        </section>

        <section className="form-card" style={{ marginTop: "var(--space-5)" }}>
          <div className="grid">
            <label>
              证书文件（PEM）
              <input type="file" accept=".pem,.crt,.cer" onChange={(event) => handleFile(event, setCert)} />
            </label>
            <label>
              私钥文件（KEY）
              <input type="file" accept=".key" onChange={(event) => handleFile(event, setKey)} />
            </label>
            <label>
              证书内容
              <textarea rows={6} value={cert} onChange={(event) => setCert(event.target.value)} />
            </label>
            <label>
              私钥内容
              <textarea rows={6} value={key} onChange={(event) => setKey(event.target.value)} />
            </label>
          </div>
          <div className="row" style={{ marginTop: "var(--space-4)" }}>
            <button className="button" type="button" onClick={handleSubmit}>
              更新证书
            </button>
            <span className="meta">{status}</span>
          </div>
        </section>
      </main>
      <SiteFooter />
    </AdminGuard>
  );
}
