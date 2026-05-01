# @gachlab/google-forms-scraper

Parse any public Google Form URL into structured JSON. Extract titles, descriptions, fields, options, and validation rules.

## Installation

```bash
npm install @gachlab/google-forms-scraper
```

## Usage

```typescript
import { GoogleFormsScraper } from '@gachlab/google-forms-scraper';

const scraper = GoogleFormsScraper();
const form = await scraper.getFormTemplate({
  url: 'https://docs.google.com/forms/d/e/YOUR_FORM_ID/viewform',
});

console.log(form.title);
console.log(form.description);
console.log(form.fields);
```

## API

### `GoogleFormsScraper(dependencies?)`

Factory function that returns a scraper instance. Optionally accepts custom `fetch` and `htmlParser` implementations for testing or server-side use.

### `scraper.getFormTemplate(input)`

```typescript
getFormTemplate(input: { url: string }) => Promise<FormResponse>
```

Fetches and parses a Google Form. Returns:

```typescript
interface FormResponse {
  title: string | undefined;
  description: string | undefined;
  fields: FormField[];
}

interface FormField {
  name: string;          // "question-0", "question-1", etc.
  prompt: string;        // The question text
  required: boolean;     // Whether the field is required
  placeholder: string;   // Placeholder text if any
  type: 'radiogroup' | 'presentation' | 'list' | 'textarea' | 'email' | 'text' | 'unknown';
  options?: FormFieldOption[];  // For radio/list fields
  min?: { prompt: string };     // For scale fields
  max?: { prompt: string };     // For scale fields
}
```

## Custom Dependencies

You can inject custom `fetch` and HTML parser for testing or server-side environments:

```typescript
import { parse } from 'node-html-parser';

const scraper = GoogleFormsScraper({
  fetch: customFetch,
  htmlParser: parse,
});
```
