import Link from "next/link";
import {
  ArrowRight,
  ScanLine,
  Coffee,
  BellRing,
  MoveUpRight,
} from "lucide-react";
import { Brand, Footer } from "@/components/ui";
import { LandingQueue } from "@/components/landing-queue";
import { publicConfig } from "@/lib/env";
export const dynamic = "force-dynamic";
export default function Home() {
  return (
    <div className="landing shell">
      <header className="landing-nav">
        <Brand />
        <div className="nav-right">
          <span className="campus-name">Sathyabama Canteen</span>
          <Link className="button button-small button-white" href="/admin">
            Counter access <MoveUpRight size={14} />
          </Link>
        </div>
      </header>
      <main>
        <section className="landing-hero">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="live-dot" /> A LITTLE LESS WAITING. A LOT MORE
              BREAK.
            </span>
            <h1>
              Skip the line.
              <br />
              <span>Not your break.</span>
            </h1>
            <p>
              Your time belongs to you. Get a virtual token, grab a seat, and
              come back when it’s your turn.
            </p>
            <a href="#live-queue" className="button button-primary">
              View live queue <ArrowRight size={18} />
            </a>
            <div className="hero-note">
              <span className="tiny-check">✓</span> No app. No sign-up. Just
              scan and go.
            </div>
          </div>
          <div
            className="hero-visual"
            aria-label="Illustration of a Qless digital queue ticket"
          >
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="floating-label label-top">
              <Coffee size={17} /> Your break, uninterrupted.
            </div>
            <div className="illustration-ticket">
              <div className="ticket-top">
                <span className="ticket-wordmark">qless.</span>
                <span className="ticket-mini-label">A BETTER WAY TO WAIT</span>
              </div>
              <div className="ticket-example">YOUR TIME, BACK.</div>
              <div className="ticket-big">
                Take a<br />
                breather<span>.</span>
              </div>
              <div className="ticket-perforation" />
              <div className="ticket-bottom">
                <div>
                  <span>YOUR PLACE</span>
                  <strong>Saved for you.</strong>
                </div>
                <ScanLine size={36} strokeWidth={1.2} />
              </div>
            </div>
            <div className="floating-label label-bottom">
              <span className="check-circle">✓</span> The queue can wait.
            </div>
            <span className="visual-caption">
              LESS STANDING AROUND. MORE MOMENTS LIKE THIS.
            </span>
          </div>
        </section>
        <section className="how-section">
          <div className="section-intro">
            <span className="eyebrow">YOUR BREAK, IN THREE STEPS</span>
            <h2>
              Good things come
              <br />
              without the wait.
            </h2>
          </div>
          {[
            {
              icon: ScanLine,
              n: "01",
              title: "Scan.",
              text: "Scan the canteen QR. Your token is yours, instantly.",
            },
            {
              icon: Coffee,
              n: "02",
              title: "Go.",
              text: "Find your friends. Finish that conversation. Enjoy your break.",
            },
            {
              icon: BellRing,
              n: "03",
              title: "Return.",
              text: "Keep your token open. We’ll show you when to head to the counter.",
            },
          ].map(({ icon: Icon, n, title, text }) => (
            <article className="step" key={n}>
              <div className="step-top">
                <Icon size={23} strokeWidth={1.6} />
                <span>{n}</span>
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </section>
        <LandingQueue config={publicConfig()} />
      </main>
      <Footer />
    </div>
  );
}
