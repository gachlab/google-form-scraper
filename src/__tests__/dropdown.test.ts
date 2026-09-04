import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parse } from "node-html-parser";
import { GoogleFormsScraper } from "../index";
import { DROPDOWN_ITEM, formPage } from "./fixtures/real-google-form";

const scrape = (html: string) =>
  GoogleFormsScraper({
    fetch: async () =>
      ({ ok: true, status: 200, text: async () => html }) as Response,
    htmlParser: parse,
  }).getFormTemplate({ url: "https://example.com/form" });

describe("dropdown questions", () => {
  it("recognises a dropdown instead of giving up on it", async () => {
    const result = await scrape(formPage(DROPDOWN_ITEM));
    assert.strictEqual(result.fields[0].type, "dropdown");
    assert.strictEqual(result.fields[0].prompt, "Name of Department");
    assert.strictEqual(result.fields[0].required, true);
  });

  it("drops the placeholder Google renders as the first option", async () => {
    const result = await scrape(formPage(DROPDOWN_ITEM));
    const options = result.fields[0].options ?? [];
    // The fixture ships 17 `role="option"` nodes; the first is the "Choose"
    // placeholder, which is not an answer anyone should be offered.
    assert.strictEqual(options.length, 16);
    assert.ok(!options.some((o) => o.prompt === "Choose"));
    assert.strictEqual(options[0].prompt, "Computer Science and Engineering");
  });

  it("decodes entities in dropdown options", async () => {
    const result = await scrape(formPage(DROPDOWN_ITEM));
    const options = result.fields[0].options ?? [];
    assert.ok(
      options.some((o) => o.prompt === "Information Science & Engineering"),
      "the &amp; in the captured markup should come back decoded",
    );
    assert.ok(options.every((o) => !/&(#\d+|[a-z]+);/i.test(o.prompt)));
  });
});
