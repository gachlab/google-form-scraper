import { describe, it, expect, vi } from 'vitest';
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
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 404,
    text: () => Promise.resolve(html),
  });
}

describe('GoogleFormsScraper', () => {
  it('parses form title and description', async () => {
    const scraper = GoogleFormsScraper({ fetch: createMockFetch(MOCK_FORM_HTML), htmlParser: parse });
    const result = await scraper.getFormTemplate({ url: 'https://example.com/form' });
    expect(result.title).toBe('Test Form Title');
    expect(result.description).toBe('Test description');
  });

  it('parses text fields', async () => {
    const scraper = GoogleFormsScraper({ fetch: createMockFetch(MOCK_FORM_HTML), htmlParser: parse });
    const result = await scraper.getFormTemplate({ url: 'https://example.com/form' });
    const textField = result.fields.find(f => f.type === 'text');
    expect(textField).toBeDefined();
    expect(textField!.prompt).toBe('Your Name');
    expect(textField!.required).toBe(true);
  });

  it('parses email fields', async () => {
    const scraper = GoogleFormsScraper({ fetch: createMockFetch(MOCK_FORM_HTML), htmlParser: parse });
    const result = await scraper.getFormTemplate({ url: 'https://example.com/form' });
    const emailField = result.fields.find(f => f.type === 'email');
    expect(emailField).toBeDefined();
    expect(emailField!.required).toBe(true);
  });

  it('parses textarea fields', async () => {
    const scraper = GoogleFormsScraper({ fetch: createMockFetch(MOCK_FORM_HTML), htmlParser: parse });
    const result = await scraper.getFormTemplate({ url: 'https://example.com/form' });
    const textarea = result.fields.find(f => f.type === 'textarea');
    expect(textarea).toBeDefined();
    expect(textarea!.prompt).toBe('Comments');
    expect(textarea!.required).toBe(false);
  });

  it('parses radiogroup fields with options', async () => {
    const scraper = GoogleFormsScraper({ fetch: createMockFetch(MOCK_FORM_HTML), htmlParser: parse });
    const result = await scraper.getFormTemplate({ url: 'https://example.com/form' });
    const radio = result.fields.find(f => f.type === 'radiogroup');
    expect(radio).toBeDefined();
    expect(radio!.options).toHaveLength(2);
    expect(radio!.options![0].prompt).toBe('Male');
    expect(radio!.options![1].prompt).toBe('Female');
  });

  it('returns correct number of fields', async () => {
    const scraper = GoogleFormsScraper({ fetch: createMockFetch(MOCK_FORM_HTML), htmlParser: parse });
    const result = await scraper.getFormTemplate({ url: 'https://example.com/form' });
    expect(result.fields).toHaveLength(4);
  });

  it('throws on failed fetch', async () => {
    const scraper = GoogleFormsScraper({ fetch: createMockFetch('', false), htmlParser: parse });
    await expect(scraper.getFormTemplate({ url: 'https://example.com/form' }))
      .rejects.toThrow('Failed to fetch form: 404');
  });

  it('handles empty form', async () => {
    const emptyHtml = '<html><body></body></html>';
    const scraper = GoogleFormsScraper({ fetch: createMockFetch(emptyHtml), htmlParser: parse });
    const result = await scraper.getFormTemplate({ url: 'https://example.com/form' });
    expect(result.fields).toHaveLength(0);
    expect(result.title).toBeUndefined();
  });
});
