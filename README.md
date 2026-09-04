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
getFormTemplate(input: { url: string; timeoutMs?: number }) => Promise<FormResponse>
```

Fetches and parses a Google Form.

`timeoutMs` bounds the whole exchange -- connecting, headers and body -- and defaults
to `DEFAULT_TIMEOUT_MS` (10 000). It must be a positive, finite number; anything else
is refused with a `RangeError`. Fractional values are floored and anything past
`MAX_TIMEOUT_MS` is capped, so a computed remaining budget can be passed as-is.

Returns:

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
  min?: { prompt: string };     // Scale endpoint caption, when the form has one
  max?: { prompt: string };     // Scale endpoint caption, when the form has one
}
```

### Failures

`getFormTemplate` rejects with a typed error, so callers do not have to match on
message text:

| Error | When |
| --- | --- |
| `FormFetchError` | Google answered but refused the form. `status` carries the code -- `401` when the form requires signing in, `404` when the link is an `/edit` URL or the form is gone. |
| `FormTimeoutError` | The exchange outlived `timeoutMs`. `timeoutMs` carries the budget that expired. |
| `RangeError` | `timeoutMs` was not a positive, finite number. |

Anything the transport itself throws (DNS failure, TLS error) propagates unchanged.

## Custom Dependencies

You can inject custom `fetch` and HTML parser for testing or server-side environments:

```typescript
import { parse } from 'node-html-parser';

const scraper = GoogleFormsScraper({
  fetch: customFetch,
  htmlParser: parse,
});
```

The deadline is enforced by the scraper, not delegated to the transport, so a custom
`fetch` that ignores the `signal` it is handed is still bounded. An abort is signalled
as well, so a transport that honours it releases the socket instead of leaking it.
