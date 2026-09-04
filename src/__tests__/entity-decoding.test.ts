import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parse } from "node-html-parser";
import { GoogleFormsScraper } from "../index";
import {
  ENTITY_PLACEHOLDER_ITEM,
  ENTITY_LINEAR_SCALE_ITEM,
  ENTITY_MULTIPLE_CHOICE_ITEM,
  ENTITY_LIST_ITEM,
  entityPage,
} from "./fixtures/real-google-form";

const scrape = (html: string) =>
  GoogleFormsScraper({
    fetch: async () =>
      ({ ok: true, status: 200, text: async () => html }) as Response,
    htmlParser: parse,
  }).getFormTemplate({ url: "https://example.com/form" });

// One assertion per place the parser reads user-facing copy. Reverting any single
// `text` back to `innerText` has to turn one of these red -- that is the whole
// point of the fixtures these run on.
describe("every string the scraper reads is decoded", () => {
  it("decodes the form title", async () => {
    const result = await scrape(entityPage());
    assert.strictEqual(result.title, 'Encuesta de salida — "Hotel Sol"');
  });

  it("decodes the form description", async () => {
    const result = await scrape(entityPage());
    assert.strictEqual(result.description, 'Feedback on "Review of Syllabus"');
  });

  it("decodes a question prompt", async () => {
    const result = await scrape(entityPage(ENTITY_MULTIPLE_CHOICE_ITEM));
    assert.ok(result.fields[0].prompt.includes(" "));
    assert.doesNotMatch(result.fields[0].prompt, /&(#\d+|[a-z]+);/i);
  });

  it("decodes a field placeholder", async () => {
    const result = await scrape(entityPage(ENTITY_PLACEHOLDER_ITEM));
    assert.strictEqual(result.fields[0].placeholder, "Tu respuesta 'opcional'");
  });

  it("decodes the options of a multiple-choice question", async () => {
    const result = await scrape(entityPage(ENTITY_MULTIPLE_CHOICE_ITEM));
    assert.strictEqual(
      result.fields[0].options?.[0].prompt,
      'Sí — con "late check-out"',
    );
  });

  it("decodes the options of a checkbox question", async () => {
    const result = await scrape(entityPage(ENTITY_LIST_ITEM));
    assert.strictEqual(
      result.fields[0].options?.[0].prompt,
      'Habitación "Deluxe"',
    );
  });

  it("decodes the options of a linear scale", async () => {
    const result = await scrape(entityPage(ENTITY_LINEAR_SCALE_ITEM));
    assert.strictEqual(result.fields[0].options?.[0].prompt, "1 ");
  });

  it("decodes the endpoint captions of a linear scale", async () => {
    const result = await scrape(entityPage(ENTITY_LINEAR_SCALE_ITEM));
    assert.deepStrictEqual(result.fields[0].min, { prompt: 'Muy "malo"' });
    assert.deepStrictEqual(result.fields[0].max, {
      prompt: "Excelente & rápido",
    });
  });
});
