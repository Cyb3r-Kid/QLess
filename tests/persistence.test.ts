import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

it("preserves committed PostgreSQL data across an abrupt process exit", async () => {
  const directory = await mkdtemp(join(tmpdir(), "qless-restart-test-"));
  await promisify(execFile)(process.execPath, [
    "--input-type=module",
    "-e",
    `
    import { PGlite } from '@electric-sql/pglite';
    const db = new PGlite(process.argv[1]);
    await db.exec('create table restart_check (value int); insert into restart_check values (42)');
    process.exit(0);
  `,
    directory,
  ]);
  const db = new PGlite(directory);
  try {
    const result = await db.query<{ value: number }>(
      "select value from restart_check",
    );
    expect(result.rows[0].value).toBe(42);
  } finally {
    await db.close();
  }
});
