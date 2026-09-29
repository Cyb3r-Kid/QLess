import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { metrics, studentView } from "../src/lib/queue";
import type { Snapshot } from "../src/lib/types";

let db: PGlite;
async function snapshot(id: string | null = null): Promise<Snapshot> {
  return (
    await db.query<{ result: Snapshot }>(
      "select qless_snapshot($1) as result",
      [id],
    )
  ).rows[0].result;
}
async function join(browser = randomUUID()) {
  return (
    await db.query<{ result: { id: string; recovered: boolean } }>(
      "select qless_join($1) as result",
      [browser],
    )
  ).rows[0].result;
}
async function action(name: string, value = {}, expected?: string | null) {
  const s = await snapshot();
  return db.query("select qless_action($1,$2,$3,$4)", [
    name,
    s.session.id,
    expected === undefined
      ? (s.tokens.find((t) => t.status === "SERVING")?.id ?? null)
      : expected,
    JSON.stringify(value),
  ]);
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    "create role anon; create role authenticated; create role service_role bypassrls;",
  );
  await db.exec(await readFile("supabase/migrations/001_qless.sql", "utf8"));
});
beforeEach(async () => {
  // This database is an isolated in-memory test instance. Each test has a fresh
  // session, while history preservation is exercised within its own test.
  await db.exec(
    "reset role; truncate queue_events, tokens, queue_sessions; insert into queue_sessions(canteen_id) select id from canteens; update settings set default_service_seconds=90, almost_turn_threshold=2;",
  );
});
afterAll(async () => {
  await db.close();
});

describe("the actual PostgreSQL queue functions", () => {
  it("allocates Q-001 then Q-002 with UUID identities", async () => {
    const a = await join();
    const b = await join();
    const s = await snapshot();
    expect(a.id).not.toBe(b.id);
    expect(s.tokens.map((t) => t.display_token)).toEqual(["Q-001", "Q-002"]);
  });
  it("allocates unique numbers for 30 simultaneous join requests", async () => {
    await Promise.all(Array.from({ length: 30 }, () => join()));
    const s = await snapshot();
    expect(new Set(s.tokens.map((t) => t.sequence_number)).size).toBe(30);
    expect(s.session.next_sequence).toBe(31);
  });
  it("recovers the same browser token including simultaneous scans", async () => {
    const browser = randomUUID();
    const results = await Promise.all(
      Array.from({ length: 8 }, () => join(browser)),
    );
    expect(new Set(results.map((t) => t.id)).size).toBe(1);
    expect((await snapshot()).tokens).toHaveLength(1);
    expect((await join(browser)).recovered).toBe(true);
  });
  it.each(["CLOSED", "PAUSED"])(
    "blocks new tokens when %s, but recovers existing tokens",
    async (status) => {
      const browser = randomUUID();
      const first = await join(browser);
      await action("status", { status });
      await expect(join()).rejects.toThrow(`QUEUE_${status}`);
      expect((await join(browser)).id).toBe(first.id);
    },
  );
  it("calls the earliest waiting token and only one serving token", async () => {
    await join();
    await join();
    await action("advance");
    const s = await snapshot();
    expect(s.tokens.filter((t) => t.status === "SERVING")).toHaveLength(1);
    expect(s.tokens[0].status).toBe("SERVING");
    expect(s.tokens[0].called_at).not.toBeNull();
  });
  it("database constraint rejects two serving tokens", async () => {
    await join();
    const second = await join();
    await action("advance");
    await expect(
      db.query(
        "update tokens set status='SERVING', called_at=now() where id=$1",
        [second.id],
      ),
    ).rejects.toThrow("one_serving_per_session");
  });
  it("completes and calls next atomically, recording timestamps", async () => {
    await join();
    await join();
    await action("advance");
    await action("advance");
    const s = await snapshot();
    expect(s.tokens.map((t) => t.status)).toEqual(["COMPLETED", "SERVING"]);
    expect(s.tokens[0].completed_at).not.toBeNull();
  });
  it("rejects stale double-clicks without consuming another token", async () => {
    await action("demo");
    const s = await snapshot();
    const id = s.tokens[0].id;
    const results = await Promise.allSettled([
      db.query("select qless_action('advance',$1,$2,'{}')", [s.session.id, id]),
      db.query("select qless_action('advance',$1,$2,'{}')", [s.session.id, id]),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      (await snapshot()).tokens.find((t) => t.status === "SERVING")
        ?.display_token,
    ).toBe("Q-002");
  });
  it("skips current token and serves the next one", async () => {
    await action("demo");
    await action("skip");
    const s = await snapshot();
    expect(s.tokens[0].status).toBe("SKIPPED");
    expect(s.tokens[0].skipped_at).not.toBeNull();
    expect(s.tokens[1].status).toBe("SERVING");
  });
  it("calculates ahead from waiting records only; excludes completed and skipped", async () => {
    await action("demo");
    const judge = await join();
    let s = await snapshot();
    expect(
      studentView(
        s,
        s.tokens.find((t) => t.id === judge.id)!,
      ).ahead,
    ).toBe(4);
    await action("advance");
    await action("skip");
    s = await snapshot();
    expect(
      studentView(
        s,
        s.tokens.find((t) => t.id === judge.id)!,
      ).ahead,
    ).toBe(2);
  });
  it("runs Q-006 from scan through next, serving, and completed", async () => {
    await action("demo");
    const judge = await join();
    for (const ahead of [4, 3, 2, 1, 0]) {
      const s = await snapshot();
      expect(
        studentView(
          s,
          s.tokens.find((t) => t.id === judge.id)!,
        ).ahead,
      ).toBe(ahead);
      await action("advance");
    }
    expect(
      (await snapshot()).tokens.find((t) => t.id === judge.id)?.status,
    ).toBe("SERVING");
    await action("advance");
    expect(
      (await snapshot()).tokens.find((t) => t.id === judge.id)?.status,
    ).toBe("COMPLETED");
  });
  it("resets numbers, cancels active tokens, preserves old history and token lookup", async () => {
    const old = await join();
    const oldSession = (await snapshot()).session.id;
    await action("new_session");
    await join();
    const s = await snapshot();
    expect(s.tokens[0].display_token).toBe("Q-001");
    expect(s.history.find((t) => t.id === old.id)?.status).toBe("CANCELLED");
    expect((await snapshot(old.id)).session.id).toBe(oldSession);
    expect((await snapshot(old.id)).session.ended_at).not.toBeNull();
  });
  it("rejects a mutation from a previous queue session", async () => {
    const old = (await snapshot()).session.id;
    await action("new_session");
    await expect(
      db.query("select qless_action('advance',$1,null,'{}')", [old]),
    ).rejects.toThrow("STALE_SESSION");
  });
  it("loads marked demo data and next scan gets Q-006", async () => {
    await action("demo");
    await join();
    const s = await snapshot();
    expect(s.tokens.filter((t) => t.is_demo)).toHaveLength(5);
    expect(s.tokens[0].status).toBe("SERVING");
    expect(s.tokens[5].display_token).toBe("Q-006");
    expect(s.tokens[5].is_demo).toBe(false);
  });
  it("does not silently replace a real queue with demo data", async () => {
    await join();
    await expect(action("demo")).rejects.toThrow("DEMO_NEEDS_EMPTY_SESSION");
  });
  it("clears demo tokens but preserves real tokens and history", async () => {
    await action("demo");
    const real = await join();
    await action("clear_demo");
    const s = await snapshot();
    expect(
      s.tokens.filter((t) => t.is_demo && t.status === "CANCELLED"),
    ).toHaveLength(5);
    expect(s.tokens.find((t) => t.id === real.id)?.status).toBe("SERVING");
  });
  it("uses a 90s fallback ETA, ignores demo service durations", async () => {
    await action("demo");
    const real = await join();
    let s = await snapshot();
    expect(
      studentView(
        s,
        s.tokens.find((t) => t.id === real.id)!,
      ).etaSeconds,
    ).toBe(360);
    await action("advance");
    s = await snapshot();
    expect(metrics(s).serviceSeconds).toBe(90);
  });
  it("uses genuine completed timestamps for average service and wait", async () => {
    const a = await join();
    await action("advance");
    await action("advance");
    await db.query(
      "update tokens set joined_at=now()-interval '5 minutes', called_at=now()-interval '2 minutes', completed_at=now() where id=$1",
      [a.id],
    );
    const m = metrics(await snapshot());
    expect(m.served).toBeGreaterThan(0);
    const s = await snapshot();
    s.history = s.history.filter((t) => t.id === a.id);
    expect(metrics(s).serviceSeconds).toBe(120);
    expect(metrics(s).averageWait).toBe(180);
  });
  it("handles an empty queue without creating a token or serving duplicates", async () => {
    await action("advance");
    expect((await snapshot()).tokens).toHaveLength(0);
    await expect(action("skip")).rejects.toThrow("NOT_SERVING");
  });
  it("invalid token UUID is not found", async () => {
    await expect(snapshot(randomUUID())).rejects.toThrow("TOKEN_NOT_FOUND");
  });
  it("enforces setting bounds and updates fallback timing", async () => {
    await action("settings", {
      default_service_seconds: 120,
      almost_turn_threshold: 3,
    });
    expect((await snapshot()).settings.default_service_seconds).toBe(120);
    await expect(
      action("settings", {
        default_service_seconds: -1,
        almost_turn_threshold: 2,
      }),
    ).rejects.toThrow();
    await action("settings", {
      default_service_seconds: 90,
      almost_turn_threshold: 2,
    });
  });
  it("increments the public signal on token and session changes without leaking identities", async () => {
    const before = await db.query<{ revision: number }>(
      "select revision from queue_signals",
    );
    await join();
    const after = await db.query<{ revision: number }>(
      "select revision from queue_signals",
    );
    expect(Number(after.rows[0].revision)).toBeGreaterThan(
      Number(before.rows[0].revision),
    );
    const s = await snapshot();
    expect(s.tokens[0]).not.toHaveProperty("anonymous_session_id");
  });
  it("denies anonymous table access and queue mutations, allows only realtime signal reads", async () => {
    await db.exec("set role anon");
    await expect(db.query("select * from tokens")).rejects.toThrow(
      "permission denied",
    );
    await expect(
      db.query("select qless_join($1)", [randomUUID()]),
    ).rejects.toThrow("permission denied");
    await expect(
      db.query("select * from queue_signals"),
    ).resolves.toHaveProperty("rows");
    await db.exec("reset role");
  });
  it("throttles PIN guesses through a persistent database counter", async () => {
    const key = randomUUID();
    for (let i = 0; i < 10; i++)
      expect(
        (
          await db.query<{ allowed: boolean }>(
            "select qless_auth_attempt($1) as allowed",
            [key],
          )
        ).rows[0].allowed,
      ).toBe(true);
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select qless_auth_attempt($1) as allowed",
          [key],
        )
      ).rows[0].allowed,
    ).toBe(false);
  });
});
