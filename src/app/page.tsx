"use client";
import styles from "./page.module.css";
import { useEffect, useState } from "react";

export default function Home() {
  const [password, setPassword] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [cooldownUntil, setCooldownUntil] = useState<number>(0);
  const [error, setError] = useState<string>("");

  const isCoolingDown = Date.now() < cooldownUntil;

  useEffect(() => {
    if (!cooldownUntil) return;
    const interval = setInterval(() => {
      // force re-render to recompute isCoolingDown
      setCooldownUntil((prev) => prev);
    }, 500);
    return () => clearInterval(interval);
  }, [cooldownUntil]);

  async function run() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(`Request failed. ${data.error || "Unknown error"}`);
      } else {
        // Only start cooldown if request succeeded
        setCooldownUntil(Date.now() + 60_000);
      }
    } catch (e) {
      const msg = e instanceof Error
        ? e.message
        : typeof e === "string"
        ? e
        : (e && typeof e === "object" && "message" in e)
        ? String((e as any).message)
        : "Unknown error";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%", maxWidth: 440 }}>
          <input
            className={styles.input}
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading || isCoolingDown}
          />
          <button className={styles.button} onClick={run} disabled={loading || !password || isCoolingDown}>
            {loading ? "Running..." : isCoolingDown ? "Wait 60s" : "Run"}
          </button>
          {error && <div style={{ color: "red" }}>{error}</div>}
          {/* No command output shown per requirements */}
        </div>
      </main>
    </div>
  );
}
