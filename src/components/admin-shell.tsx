"use client";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpRight,
  History,
  LayoutGrid,
  LogOut,
  Settings2,
} from "lucide-react";
import { Brand } from "./ui";
import { requestJson } from "@/lib/client-api";
export function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  if (path === "/admin/display") return <>{children}</>;
  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="admin-header-inner">
          <Brand />
          <div className="admin-workspace">
            <span className="header-divider" />
            <span>
              Sathyabama Canteen{" "}
              <span className="workspace-label">WORKSPACE</span>
            </span>
          </div>
          <div className="admin-account">
            <span className="operator-avatar">SC</span>
            <span>Counter operator</span>
            <button
              className="icon-button"
              title="Sign out"
              aria-label="Sign out"
              onClick={async () => {
                await requestJson("/api/admin/logout", { method: "POST" });
                router.refresh();
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </header>
      <div className="admin-body">
        <nav className="admin-nav" aria-label="Admin navigation">
          {[
            { href: "/admin", label: "Overview", icon: LayoutGrid },
            { href: "/admin/history", label: "History", icon: History },
            { href: "/admin/settings", label: "Settings", icon: Settings2 },
          ].map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={path === href ? "active" : ""}
              aria-current={path === href ? "page" : undefined}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
          <Link href="/" className="view-site">
            View site <ArrowUpRight size={14} />
          </Link>
        </nav>
        {children}
        <footer className="admin-footer">
          <span>Qless · Sathyabama Canteen</span>
          <span>Let the queue wait for you.</span>
        </footer>
      </div>
    </div>
  );
}
