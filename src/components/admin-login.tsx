"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole, LoaderCircle } from "lucide-react";
import { Brand, ErrorNotice } from "./ui";
import { requestJson } from "@/lib/client-api";
export function AdminLogin() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <main className="centered-page login-page">
      <Brand />
      <section className="login-card">
        <span className="status-icon">
          <LockKeyhole size={23} />
        </span>
        <span className="eyebrow">SATHYABAMA CANTEEN</span>
        <h1>Counter access.</h1>
        <p>
          A smoother break starts with you.
          <br />
          Enter your admin PIN to continue.
        </p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy) return;
            setBusy(true);
            setError(null);
            try {
              await requestJson("/api/admin/login", {
                method: "POST",
                body: JSON.stringify({ pin }),
              });
              router.refresh();
            } catch (err) {
              setError((err as Error).message);
              setBusy(false);
            }
          }}
        >
          <label htmlFor="pin">Admin PIN</label>
          <input
            id="pin"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            placeholder="Enter your PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            required
            minLength={4}
            maxLength={128}
            autoFocus
          />
          {error && <ErrorNotice message={error} />}
          <button className="button button-primary" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spinner" size={18} />
            ) : (
              <>
                Continue <ArrowRight size={17} />
              </>
            )}
          </button>
        </form>
        <span className="login-footnote">
          <LockKeyhole size={12} /> For canteen operators only
        </span>
      </section>
      <p className="tagline">Let the queue wait for you.</p>
    </main>
  );
}
