import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parse } from "node-html-parser";
import { GoogleFormsScraper } from "../index";
import {
  LINEAR_SCALE_ITEM,
  LINEAR_SCALE_WITHOUT_CAPTIONS_ITEM,
  LINEAR_SCALE_WITH_BLANK_CAPTIONS_ITEM,
  LINEAR_SCALE_LOW_CAPTION_ONLY_ITEM,
  LINEAR_SCALE_HIGH_CAPTION_ONLY_ITEM,
  LIST_ITEM,
  MULTIPLE_CHOICE_ITEM,
  formPage,
} from "./fixtures/real-google-form";

const scrape = (html: string) =>
  GoogleFormsScraper({
    fetch: async () =>
      ({ ok: true, status: 200, text: async () => html }) as Response,
    htmlParser: parse,
  }).getFormTemplate({ url: "https://example.com/form" });

describe("GoogleFormsScraper against real Google Forms markup", () => {
  it("decodes HTML entities in the title and description", async () => {
    const result = await scrape(formPage());
    assert.strictEqual(result.title, "Student Feedback Form");
    assert.strictEqual(result.description, 'Feedback on "Review of Syllabus"');
  });

  it("decodes HTML entities in a question prompt", async () => {
    const result = await scrape(formPage(MULTIPLE_CHOICE_ITEM));
    const prompt = result.fields[0].prompt;
    // The captured heading carries a numeric entity (&#160;). Asserting the decoded
    // codepoint rather than a literal keeps the expectation readable.
    assert.ok(prompt.startsWith("3."));
    assert.ok(
      prompt.includes("\u00a0"),
      "the non-breaking space should be decoded",
    );
    assert.doesNotMatch(prompt, /&(#\d+|[a-z]+);/i);
  });

  it("keeps the endpoint captions of a linear scale", async () => {
    const result = await scrape(formPage(LINEAR_SCALE_ITEM));
    const field = result.fields[0];
    assert.deepStrictEqual(
      field.options?.map((o) => o.prompt),
      ["1", "2", "3", "4", "5"],
    );
    assert.deepStrictEqual(field.min, { prompt: "Extremely Good" });
    assert.deepStrictEqual(field.max, { prompt: "Extremely Poor" });
  });

  it("does not invent a range for a multiple-choice question", async () => {
    const result = await scrape(formPage(MULTIPLE_CHOICE_ITEM));
    const field = result.fields[0];
    assert.strictEqual(field.type, "radiogroup");
    assert.strictEqual(field.options?.length, 4);
    // Each label is an only child, so first/last sibling would both resolve to the
    // first option. Emitting that as min/max is worse than emitting nothing.
    assert.strictEqual(field.min, undefined);
    assert.strictEqual(field.max, undefined);
  });

  it("marks a question required without leaving the asterisk in the prompt", async () => {
    const result = await scrape(formPage(MULTIPLE_CHOICE_ITEM));
    assert.strictEqual(result.fields[0].required, true);
    assert.ok(!result.fields[0].prompt.includes("*"));
  });

  it("reports the status when Google refuses the form", async () => {
    const scraper = GoogleFormsScraper({
      fetch: async () =>
        ({ ok: false, status: 401, text: async () => "" }) as Response,
      htmlParser: parse,
    });
    await assert.rejects(
      () => scraper.getFormTemplate({ url: "https://example.com/form" }),
      /Failed to fetch form: 401/,
    );
  });

  it("invents no range for a linear scale that has no captions", async () => {
    // Both endpoint captions are optional in Google Forms. Without them the
    // outermost children of the option holder are the options themselves, and
    // reporting "1" and "5" as the range reads like a caption the author wrote.
    const result = await scrape(formPage(LINEAR_SCALE_WITHOUT_CAPTIONS_ITEM));
    const field = result.fields[0];
    assert.deepStrictEqual(
      field.options?.map((o) => o.prompt),
      ["1", "2", "3", "4", "5"],
    );
    assert.strictEqual(field.min, undefined);
    assert.strictEqual(field.max, undefined);
  });

  it("reads the options of a checkbox question", async () => {
    const result = await scrape(formPage(LIST_ITEM));
    const field = result.fields[0];
    assert.strictEqual(field.type, "list");
    assert.ok((field.options?.length ?? 0) >= 2);
    assert.ok(field.options?.every((o) => o.prompt.length > 0));
  });

  it("invents no range when the caption slots are present but blank", async () => {
    const result = await scrape(
      formPage(LINEAR_SCALE_WITH_BLANK_CAPTIONS_ITEM),
    );
    assert.strictEqual(result.fields[0].min, undefined);
    assert.strictEqual(result.fields[0].max, undefined);
  });

  it("keeps the one caption a scale has when the other is missing", async () => {
    // Both captions are independent in Google Forms. Dropping the one the author did
    // write, because its partner is absent, throws away real copy.
    const low = await scrape(formPage(LINEAR_SCALE_LOW_CAPTION_ONLY_ITEM));
    assert.deepStrictEqual(low.fields[0].min, { prompt: "Extremely Good" });
    assert.strictEqual(low.fields[0].max, undefined);

    const high = await scrape(formPage(LINEAR_SCALE_HIGH_CAPTION_ONLY_ITEM));
    assert.strictEqual(high.fields[0].min, undefined);
    assert.deepStrictEqual(high.fields[0].max, { prompt: "Extremely Poor" });
  });
});
