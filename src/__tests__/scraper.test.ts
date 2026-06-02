import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'node-html-parser';
import { GoogleFormsScraper } from '../index';

const MOCK_FORM_HTML = `
<html>
<body>
  <div role="heading">Test Form Title</div>
  <div dir="auto">Test description</div>
  <div role="listitem">
    <div role="heading">Your Name *</div>
    <input type="text" />
  </div>
  <div role="listitem">
    <div role="heading">Your Email *</div>
    <input type="email" />
  </div>
  <div role="listitem">
    <div role="heading">Comments</div>
    <textarea></textarea>
  </div>
  <div role="listitem">
    <div role="heading">Gender *</div>
    <div role="radiogroup">
      <span dir="auto">Male</span>
      <span dir="auto">Female</span>
    </div>
  </div>
</body>
</html>`;

function createMockFetch(html: string, ok = true) {
  return mock.fn(async () => ({
    ok,
    status: ok ? 200 : 404,
    text: () => Promise.resolve(html),
  }));
}

describe('GoogleFormsScraper', () => {
  it('parses form title and description', async () => {
    const scraper = GoogleFormsScraper({ fetch: createMockFetch(MOCK_FORM_HTML), htmlParser: parse });
    const result = await scraper.getFormTemplate({ url: 'https://example.com/form' });
    assert.strictEqual(result.title, 'Test Form Title');
    assert.strictEqual(result.description, 'Test description');
  });

  it('parses text fields', async () => {
    const scraper = GoogleFormsScraper({ fetch: createMockFetch(MOCK_FORM_HTML), htmlParser: parse });
    const result = await scraper.getFormTemplate({ url: 'https://example.com/form' });
    const textField = result.fields.find(f => f.type === 'text');
    assert.ok(textField !== undefined);
    assert.strictEqual(textField!.prompt, 'Your Name');
    assert.strictEqual(textField!.required, true);
  });

  it('parses email fields', async () => {
    const scraper = GoogleFormsScraper({ fetch: createMockFetch(MOCK_FORM_HTML), htmlParser: parse });
    const result = await scraper.getFormTemplate({ url: 'https://example.com/form' });
    const emailField = result.fields.find(f => f.type === 'email');
    assert.ok(emailField !== undefined);
    assert.strictEqual(emailField!.required, true);
  });

  it('parses textarea fields', async () => {
    const scraper = GoogleFormsScraper({ fetch: createMockFetch(MOCK_FORM_HTML), htmlParser: parse });
    const result = await scraper.getFormTemplate({ url: 'https://example.com/form' });
    const textarea = result.fields.find(f => f.type === 'textarea');
    assert.ok(textarea !== undefined);
    assert.strictEqual(textarea!.prompt, 'Comments');
    assert.strictEqual(textarea!.required, false);
  });

  it('parses radiogroup fields with options', async () => {
    const scraper = GoogleFormsScraper({ fetch: createMockFetch(MOCK_FORM_HTML), htmlParser: parse });
    const result = await scraper.getFormTemplate({ url: 'https://example.com/form' });
    const radio = result.fields.find(f => f.type === 'radiogroup');
    assert.ok(radio !== undefined);
    assert.strictEqual(radio!.options!.length, 2);
    assert.strictEqual(radio!.options![0].prompt, 'Male');
    assert.strictEqual(radio!.options![1].prompt, 'Female');
  });

  it('returns correct number of fields', async () => {
    const scraper = GoogleFormsScraper({ fetch: createMockFetch(MOCK_FORM_HTML), htmlParser: parse });
    const result = await scraper.getFormTemplate({ url: 'https://example.com/form' });
    assert.strictEqual(result.fields.length, 4);
  });

  it('throws on failed fetch', async () => {
    const scraper = GoogleFormsScraper({ fetch: createMockFetch('', false), htmlParser: parse });
    await assert.rejects(() => scraper.getFormTemplate({ url: 'https://example.com/form' }), /Failed to fetch form: 404/);
  });

  it('handles empty form', async () => {
    const emptyHtml = '<html><body></body></html>';
    const scraper = GoogleFormsScraper({ fetch: createMockFetch(emptyHtml), htmlParser: parse });
    const result = await scraper.getFormTemplate({ url: 'https://example.com/form' });
    assert.strictEqual(result.fields.length, 0);
    assert.strictEqual(result.title, undefined);
  });
});
