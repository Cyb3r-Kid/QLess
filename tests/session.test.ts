import { beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { pinMatches, seal, unseal } from "../src/lib/session";
import { qrConfig } from "../src/lib/env";
import { sameOrigin } from "../src/lib/http";
beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-only-32-characters-minimum-long";
  process.env.ADMIN_PIN = "456789";
});
describe("server session and QR validation", () => {
  it("authenticates correct PIN and rejects incorrect PIN", () => {
    expect(pinMatches("456789")).toBe(true);
    expect(pinMatches("1234")).toBe(false);
  });
  it("validates signed sessions, rejects tampering and expiry", () => {
    const cookie = seal("admin", 60);
    expect(unseal(cookie)).toBe("admin");
    expect(unseal(`${cookie}x`)).toBeNull();
    expect(unseal(seal("admin", -1))).toBeNull();
    expect(unseal(undefined)).toBeNull();
  });
  it.each(["localhost", "127.0.0.1", "0.0.0.0", "[::1]"])(
    "does not generate a mobile QR for %s",
    (host) => {
      process.env.NEXT_PUBLIC_APP_URL = `http://${host}:3000`;
      expect(qrConfig().url).toBeNull();
      expect(qrConfig().warning).toContain("another device");
    },
  );
  it("requires an origin and generates the configured join URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "";
    expect(qrConfig().url).toBeNull();
    process.env.NEXT_PUBLIC_APP_URL = "https://qless.example.com";
    expect(qrConfig().url).toBe("https://qless.example.com/join/canteen");
    process.env.NEXT_PUBLIC_APP_URL = "https://qless.example.com/path";
    expect(qrConfig().url).toBeNull();
  });
  it("accepts the browser hostname behind a wildcard listen address, rejects foreign origins", () => {
    const request = (origin: string) =>
      new Request("http://0.0.0.0:3000/api/join", {
        headers: { origin, host: "localhost:3000" },
      });
    expect(() => sameOrigin(request("http://localhost:3000"))).not.toThrow();
    expect(() => sameOrigin(request("https://foreign.example"))).toThrow(
      "BAD_ORIGIN",
    );
    expect(() =>
      sameOrigin(new Request("http://localhost:3000/api/join")),
    ).toThrow("BAD_ORIGIN");
  });
});
