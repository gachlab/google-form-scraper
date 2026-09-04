import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parse } from "node-html-parser";
import {
  GoogleFormsScraper,
  FormTimeoutError,
  FormFetchError,
  DEFAULT_TIMEOUT_MS,
} from "../index";

const EMPTY_PAGE = "<html><body></body></html>";

/** Resolves once `signal` aborts, rejecting with whatever reason it carries. */
const rejectsWhenAborted = (signal: AbortSignal | undefined) =>
  new Promise<never>((_, reject) => {
    signal?.addEventListener("abort", () => reject(signal.reason));
  });

describe("GoogleFormsScraper deadline", () => {
  it("gives up when the server never answers", { timeout: 2000 }, async () => {
    const scraper = GoogleFormsScraper({
      fetch: ((_url: string, init?: RequestInit) =>
        rejectsWhenAborted(
          init?.signal ?? undefined,
        )) as typeof globalThis.fetch,
      htmlParser: parse,
    });

    await assert.rejects(
      () =>
        scraper.getFormTemplate({
          url: "https://example.com/form",
          timeoutMs: 25,
        }),
      /Timed out fetching form after 25ms/,
    );
  });

  it("hands fetch an abort signal", async () => {
    let seen: RequestInit | undefined;
    const scraper = GoogleFormsScraper({
      fetch: (async (_url: string, init?: RequestInit) => {
        seen = init;
        return {
          ok: true,
          status: 200,
          text: async () => EMPTY_PAGE,
        } as Response;
      }) as typeof globalThis.fetch,
      htmlParser: parse,
    });

    await scraper.getFormTemplate({ url: "https://example.com/form" });
    assert.ok(seen?.signal, "fetch should receive a signal");
    assert.strictEqual(seen!.signal!.aborted, false);
  });

  it(
    "keeps the deadline running while the body is read",
    { timeout: 2000 },
    async () => {
      // The headers come back at once; the body never finishes. Bounding only the
      // fetch call would let this hang forever.
      const scraper = GoogleFormsScraper({
        fetch: (async (_url: string, init?: RequestInit) => ({
          ok: true,
          status: 200,
          text: () => rejectsWhenAborted(init?.signal ?? undefined),
        })) as unknown as typeof globalThis.fetch,
        htmlParser: parse,
      });

      await assert.rejects(
        () =>
          scraper.getFormTemplate({
            url: "https://example.com/form",
            timeoutMs: 25,
          }),
        /Timed out fetching form after 25ms/,
      );
    },
  );

  it("does not dress an unrelated failure up as a timeout", async () => {
    // The deadline is implemented with a catch. Anything that is not the deadline
    // firing has to come out untouched, or a DNS failure reads as a slow form.
    const boom = new TypeError("fetch failed");
    const scraper = GoogleFormsScraper({
      fetch: (async () => {
        throw boom;
      }) as unknown as typeof globalThis.fetch,
      htmlParser: parse,
    });

    await assert.rejects(
      () => scraper.getFormTemplate({ url: "https://example.com/form" }),
      (error: unknown) => {
        assert.strictEqual(error, boom);
        return true;
      },
    );
  });

  it(
    "bounds a transport that ignores the abort signal",
    { timeout: 2000 },
    async () => {
      // The README invites injecting a custom fetch, and a wrapper that drops the
      // second argument never sees the signal. The budget has to hold anyway.
      const scraper = GoogleFormsScraper({
        fetch: ((_url: string) =>
          new Promise(() => {})) as unknown as typeof globalThis.fetch,
        htmlParser: parse,
      });

      await assert.rejects(
        () =>
          scraper.getFormTemplate({
            url: "https://example.com/form",
            timeoutMs: 25,
          }),
        FormTimeoutError,
      );
    },
  );

  it("rejects a timeout that no timer can honour", async () => {
    const scraper = GoogleFormsScraper({
      fetch: (async () => ({
        ok: true,
        status: 200,
        text: async () => EMPTY_PAGE,
      })) as unknown as typeof globalThis.fetch,
      htmlParser: parse,
    });

    for (const timeoutMs of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      await assert.rejects(
        () =>
          scraper.getFormTemplate({
            url: "https://example.com/form",
            timeoutMs,
          }),
        RangeError,
        `timeoutMs=${timeoutMs} should be refused`,
      );
    }
  });

  it("accepts a fractional or oversized budget instead of crashing", async () => {
    let seen: RequestInit | undefined;
    const scraper = GoogleFormsScraper({
      fetch: (async (_url: string, init?: RequestInit) => {
        seen = init;
        return { ok: true, status: 200, text: async () => EMPTY_PAGE };
      }) as unknown as typeof globalThis.fetch,
      htmlParser: parse,
    });

    // A caller passing a remaining budget computes fractions; Node's timer would
    // throw RangeError on those and silently clamp anything past 2^31-1.
    await scraper.getFormTemplate({
      url: "https://example.com/form",
      timeoutMs: 1500.5,
    });
    await scraper.getFormTemplate({
      url: "https://example.com/form",
      timeoutMs: 2 ** 31,
    });
    assert.ok(seen?.signal);
  });

  it("reports a refusal as FormFetchError carrying the status", async () => {
    const scraper = GoogleFormsScraper({
      fetch: (async () => ({
        ok: false,
        status: 401,
        text: async () => "",
      })) as unknown as typeof globalThis.fetch,
      htmlParser: parse,
    });

    await assert.rejects(
      () => scraper.getFormTemplate({ url: "https://example.com/form" }),
      (error: unknown) => {
        assert.ok(error instanceof FormFetchError);
        assert.strictEqual(error.status, 401);
        return true;
      },
    );
  });

  it("exposes the default budget from the package entry point", () => {
    assert.strictEqual(typeof DEFAULT_TIMEOUT_MS, "number");
    assert.ok(DEFAULT_TIMEOUT_MS > 0);
  });
});
