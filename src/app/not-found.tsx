import Link from "next/link";
import { Brand } from "@/components/ui";
export default function NotFound() {
  return (
    <main className="centered-page">
      <Brand />
      <div className="join-card">
        <span className="eyebrow">A SMALL DETOUR</span>
        <h1>This page stepped out.</h1>
        <p>Scan the canteen QR to find your token, or head back home.</p>
        <Link href="/" className="button button-primary">
          Back to Qless
        </Link>
      </div>
    </main>
  );
}
