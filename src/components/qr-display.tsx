"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowUpRight, Maximize, ScanLine } from "lucide-react";
import type { LiveConfig } from "@/lib/types";
import { useLiveQueue } from "@/hooks/use-live-queue";
import { formatWait } from "@/lib/queue";
import { Brand, ErrorNotice, LiveBadge } from "./ui";
export function QrDisplay({
  config,
  image,
  url,
  warning,
}: {
  config: LiveConfig;
  image: string | null;
  url: string | null;
  warning: string | null;
}) {
  const { data, connection } = useLiveQueue<{
    waiting: number;
    etaSeconds: number;
    status: string;
  }>("/api/queue", config);
  const [screenError, setScreenError] = useState<string | null>(null);
  return (
    <div className="display-page">
      <header className="display-header">
        <Link className="display-back" href="/admin">
          <ArrowLeft size={17} /> Dashboard
        </Link>
        <Brand />
        <button
          className="icon-button"
          aria-label="Toggle fullscreen"
          title="Toggle fullscreen"
          onClick={async () => {
            try {
              if (document.fullscreenElement) await document.exitFullscreen();
              else await document.documentElement.requestFullscreen();
            } catch {
              setScreenError(
                "Use your browser’s fullscreen control to expand this display.",
              );
            }
          }}
        >
          <Maximize size={20} />
        </button>
      </header>
      <main className="display-main">
        <div className="display-eyebrow">
          <span className="live-dot" /> YOUR BREAK IS TOO GOOD TO SPEND IN LINE
        </div>
        <h1>
          Skip the line.
          <br />
          <span>Not your break.</span>
        </h1>
        <div className="qr-frame">
          {image ? (
            <Image
              src={image}
              alt="Scan to automatically get your Sathyabama Canteen queue token"
              width={360}
              height={360}
              unoptimized
              priority
            />
          ) : (
            <div className="qr-unavailable">
              <ScanLine size={45} />
              <p>Your QR is almost ready.</p>
            </div>
          )}
          <span className="qr-corner corner-tl" />
          <span className="qr-corner corner-tr" />
          <span className="qr-corner corner-bl" />
          <span className="qr-corner corner-br" />
        </div>
        {warning && <ErrorNotice message={warning} />}
        {screenError && <p role="status">{screenError}</p>}
        <h2>
          Scan to get your token <ArrowUpRight size={23} />
        </h2>
        <p className="display-location">
          Sathyabama Canteen <span>·</span> Counter 01
        </p>
        <div className="display-benefits">
          <span>No app</span>
          <i /> <span>No login</span>
          <i />
          <span>Instant token</span>
        </div>
        {data && (
          <div className="display-wait">
            <LiveBadge connection={connection} />
            <span>
              {data.status === "OPEN"
                ? `Current estimated wait: ~${formatWait(data.etaSeconds)}`
                : `Queue ${data.status.toLowerCase()} · existing tokens remain valid`}
            </span>
          </div>
        )}
        {url && (
          <a
            className="display-url"
            href={url}
            target="_blank"
            rel="noreferrer"
          >
            {new URL(url).host}/join/canteen
          </a>
        )}
      </main>
      <footer className="display-footer">Let the queue wait for you.</footer>
    </div>
  );
}
