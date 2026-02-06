"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        await apiFetch("/auth/me");
        setReady(true);
      } catch {
        router.replace("/");
      }
    })();
  }, [router]);

  if (!ready) return null;
  return <>{children}</>;
}
