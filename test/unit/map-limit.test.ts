import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mapLimit } from "../../src/core/util/map-limit.ts";

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

describe("mapLimit", () => {
  it("returns results in input order even when completion order differs", async () => {
    const result = await mapLimit([3, 1, 2, 4], 2, async (n) => {
      await delay(n * 5);
      return n * 10;
    });
    assert.deepEqual(result, [30, 10, 20, 40]);
  });

  it("never exceeds the concurrency limit", async () => {
    let active = 0;
    let maxActive = 0;
    await mapLimit(Array.from({ length: 10 }, (_, i) => i), 3, async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await delay(5);
      active--;
    });
    assert.ok(maxActive <= 3, `maxActive was ${maxActive}`);
  });

  it("reports progress exactly once per completed item", async () => {
    const seen: number[] = [];
    await mapLimit([1, 2, 3, 4, 5], 2, async () => {}, (done, total) => {
      assert.equal(total, 5);
      seen.push(done);
    });
    assert.deepEqual(seen.slice().sort(), [1, 2, 3, 4, 5]);
  });

  it("handles empty input without spinning up workers", async () => {
    const out = await mapLimit<number, number>([], 3, async () => {
      throw new Error("should not be called");
    });
    assert.deepEqual(out, []);
  });

  it("clamps concurrency to item count when smaller", async () => {
    let active = 0;
    let maxActive = 0;
    await mapLimit([1, 2], 10, async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await delay(5);
      active--;
    });
    assert.ok(maxActive <= 2);
  });

  it("rejects with the first error encountered", async () => {
    await assert.rejects(
      () =>
        mapLimit([1, 2, 3], 2, async (n) => {
          if (n === 2) throw new Error(`boom ${n}`);
          await delay(10);
          return n;
        }),
      /boom 2/,
    );
  });

  it("rejects invalid concurrency", async () => {
    await assert.rejects(() => mapLimit([1, 2], 0, async (n) => n));
    await assert.rejects(() => mapLimit([1, 2], -1, async (n) => n));
  });
});
