"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Brand, ErrorNotice, Loading } from "./ui";
import { requestJson } from "@/lib/client-api";
// Reuse the in-flight promise through StrictMode remounts and repeat effects.
let joining: Promise<{ id: string }> | null = null;
async function join() {
  const perform = async () => {
    // Establish a signed, httpOnly identity before allocating a database token.
    await requestJson("/api/session", { method: "POST" });
    return requestJson<{ id: string }>("/api/join", { method: "POST" });
  };
  if (navigator.locks) return navigator.locks.request("qless-join", perform);
  return perform();
}
export function JoinQueue() {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    joining ??= join().finally(() => {
      joining = null;
    });
    joining
      .then(({ id }) => {
        if (alive) router.replace(`/token/${id}`);
      })
      .catch((err) => {
        if (alive) setError(err.message);
      });
    return () => {
      alive = false;
    };
  }, [attempt, router]);
  return (
    <main className="centered-page">
      <Brand />
      <div className="join-card">
        <span className="eyebrow">SATHYABAMA CANTEEN</span>
        <h1>A little less waiting.</h1>
        {error ? (
          <ErrorNotice
            message={error}
            onRetry={() => {
              setError(null);
              setAttempt((a) => a + 1);
            }}
          />
        ) : (
          <Loading text="Joining the queue…" />
        )}
        <p className="muted">Finding your place. Your break starts here.</p>
      </div>
      <p className="tagline">Let the queue wait for you.</p>
    </main>
  );
}
