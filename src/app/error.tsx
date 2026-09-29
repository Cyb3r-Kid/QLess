"use client";
import { Brand } from "@/components/ui";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="centered-page">
      <Brand />
      <div className="join-card">
        <h1>A brief interruption.</h1>
        <p>
          We couldn’t load this page. Your place in the queue is still saved.
        </p>
        <button className="button button-primary" onClick={reset}>
          Try again
        </button>
      </div>
    </main>
  );
}
