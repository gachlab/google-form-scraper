import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { parse } from "node-html-parser";
import { GoogleFormsScraper } from "../index";

// The stubbed deadline tests prove the scraper asks for an abort. These prove the
// ask actually bites: a real socket, the real global fetch, a server that stalls.

/** A server that accepts the request and then behaves as `mode` dictates. */
const stallingServer = (mode: "no-headers" | "no-body") =>
  new Promise<http.Server>((resolve) => {
    const server = http.createServer((_req, res) => {
      if (mode === "no-body") {
        res.writeHead(200, { "content-type": "text/html" });
        res.write("<html><body>");
        // ...and never end it.
      }
      // "no-headers": never write anything at all.
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });

const urlOf = (server: http.Server) =>
  `http://127.0.0.1:${(server.address() as AddressInfo).port}/form`;

const servers: http.Server[] = [];
after(async () => {
  await Promise.all(
    servers.map((server) => {
      server.closeAllConnections();
      return new Promise<void>((resolve) => server.close(() => resolve()));
    }),
  );
});

describe("GoogleFormsScraper deadline over a real socket", () => {
  const scraper = GoogleFormsScraper({ fetch, htmlParser: parse });

  it(
    "gives up on a server that never sends headers",
    { timeout: 5000 },
    async () => {
      const server = await stallingServer("no-headers");
      servers.push(server);
      const started = Date.now();

      await assert.rejects(
        () => scraper.getFormTemplate({ url: urlOf(server), timeoutMs: 300 }),
        /Timed out fetching form after 300ms/,
      );
      assert.ok(
        Date.now() - started < 3000,
        "should give up near the deadline, not hang",
      );
    },
  );

  it(
    "gives up on a server that sends headers and stalls the body",
    { timeout: 5000 },
    async () => {
      const server = await stallingServer("no-body");
      servers.push(server);
      const started = Date.now();

      await assert.rejects(
        () => scraper.getFormTemplate({ url: urlOf(server), timeoutMs: 300 }),
        /Timed out fetching form after 300ms/,
      );
      assert.ok(
        Date.now() - started < 3000,
        "the deadline must cover the body, not just the headers",
      );
    },
  );
});
