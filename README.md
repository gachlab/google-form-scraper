# @gachlab/google-forms-scraper

Turn a Google Form into structured JSON — title, description, questions, options
and the endpoint captions of its scales — so you can render the same form in your
own UI.

There is no API key and no OAuth: the scraper reads the page Google serves to an
anonymous visitor and parses it. That is also its main constraint, so read
[The form has to be public](#the-form-has-to-be-public) before anything else.

## Installation

```bash
npm install @gachlab/google-forms-scraper
```

Requires Node 18 or newer (it uses the global `fetch` and `AbortSignal`).

## Usage

```typescript
import { GoogleFormsScraper } from "@gachlab/google-forms-scraper";

const scraper = GoogleFormsScraper();
const form = await scraper.getFormTemplate({
  url: "https://docs.google.com/forms/d/e/YOUR_FORM_ID/viewform",
});
```

```jsonc
{
  "title": "Student Feedback Form",
  "description": "Feedback on \"Review of Syllabus\"",
  "fields": [
    {
      "name": "question-0",
      "prompt": "Email",
      "required": true,
      "placeholder": "Your email",
      "type": "email",
    },
    {
      "name": "question-1",
      "prompt": "Learning value",
      "required": true,
      "placeholder": "",
      "type": "presentation",
      "options": [
        { "prompt": "1" },
        { "prompt": "2" },
        { "prompt": "3" },
        { "prompt": "4" },
        { "prompt": "5" },
      ],
      "min": { "prompt": "Extremely Good" },
      "max": { "prompt": "Extremely Poor" },
    },
  ],
}
```

## The form has to be public

The scraper visits the form the way a stranger with the link would, so anything
that makes Google ask for a sign-in makes the scraper fail. In the form's
**Settings → Responses**, that means:

- **Restrict to users in \<your organisation\>** must be off.
- **Collect email addresses** must not be set to **Verified** — that option alone
  forces a sign-in.

The quickest check is to open the link in a private window. If Google asks you to
sign in, the scraper gets `401` and rejects with a `FormFetchError`.

Use the link from the form's **Send** button, not the one in your address bar
while editing. An `/edit` URL is a `404` for anyone but the owner.

## API

### `GoogleFormsScraper(dependencies?)`

Returns a scraper. Optionally accepts custom `fetch` and `htmlParser`
implementations — see [Custom dependencies](#custom-dependencies).

### `scraper.getFormTemplate(input)`

```typescript
getFormTemplate(input: { url: string; timeoutMs?: number }) => Promise<FormResponse>
```

`timeoutMs` bounds the whole exchange — connecting, headers and body — and
defaults to `DEFAULT_TIMEOUT_MS` (10 000). It must be a positive, finite number;
anything else is refused with a `RangeError`. Fractional values are floored and
anything past `MAX_TIMEOUT_MS` is capped, so a computed remaining budget can be
passed straight through.

```typescript
interface FormResponse {
  title: string | undefined;
  description: string | undefined;
  fields: FormField[];
}

interface FormField {
  name: string; // "question-0", "question-1", ...
  prompt: string; // The question text, with HTML entities decoded
  required: boolean;
  placeholder: string; // "" when the question has none
  type:
    | "radiogroup"
    | "presentation"
    | "list"
    | "textarea"
    | "email"
    | "text"
    | "unknown";
  options?: FormFieldOption[];
  min?: { prompt: string }; // Only when the scale actually has a caption
  max?: { prompt: string };
}

interface FormFieldOption {
  prompt: string;
  isTextField?: boolean; // The "Other:" option, which takes free text
}
```

### Question types

| Google Forms question                        | `type`                            | Carries                                   |
| -------------------------------------------- | --------------------------------- | ----------------------------------------- |
| Short answer                                 | `text`                            |                                           |
| Paragraph                                    | `textarea`                        |                                           |
| Email                                        | `email`                           |                                           |
| Multiple choice                              | `radiogroup`                      | `options`                                 |
| Checkboxes                                   | `list`                            | `options`                                 |
| Linear scale                                 | `presentation`                    | `options`, and `min`/`max` when captioned |
| Multiple-choice grid                         | `presentation`, one field per row | `options`, `min`/`max`                    |
| Dropdown                                     | `dropdown`                        | `options`                                 |
| Section header, image, anything unrecognised | `unknown`                         |                                           |

`presentation` is the linear scale. The name is a historical accident kept for
compatibility with existing consumers.

A dropdown's `options` exclude the "Choose" entry Google renders at the top of the
list. That entry is a UI placeholder, not an answer, and it is identified by its
empty `data-value` rather than by its text — the text is localised by the request.

`min` and `max` are the captions either side of a scale ("Extremely Good" /
"Extremely Poor"). Both are optional in Google Forms, and when the author leaves
them out the fields are **absent** rather than filled with the first and last
option — a range the form never showed is worse than no range at all.

### Failures

`getFormTemplate` rejects with a typed error, so callers do not have to match on
message text:

| Error              | When                                                                                                                                                                                                      |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FormFetchError`   | Google answered but refused the form. `status` carries the code — `401` when the form requires signing in, `404` when the link is an `/edit` URL or the form is gone, `403` when Google refuses outright. |
| `FormTimeoutError` | The exchange outlived `timeoutMs`, which the error carries.                                                                                                                                               |
| `RangeError`       | `timeoutMs` was not a positive, finite number.                                                                                                                                                            |

Anything the transport itself throws (DNS failure, TLS error) propagates
unchanged, so a network fault never arrives disguised as a slow form.

## Custom dependencies

```typescript
import { parse } from "node-html-parser";

const scraper = GoogleFormsScraper({
  fetch: customFetch,
  htmlParser: parse,
});
```

The deadline is enforced by the scraper rather than delegated to the transport, so
a custom `fetch` that ignores the `signal` it is handed is still bounded. An abort
is signalled as well, so a transport that honours it releases the socket instead
of leaking it.

## Limitations

- It parses the HTML Google renders, so a change to that markup can change the
  output. The test fixtures are captured verbatim from live forms rather than
  written by hand, which is what keeps that honest.
- A multiple-choice grid arrives flattened: one field per row, each carrying the
  row label as its `prompt`. The grid itself is not represented.
- Conditional logic ("go to section based on answer") and file uploads are not
  modelled.
- Nothing is submitted: this reads a form, it does not answer one.

## Development

```bash
npm ci
npm test          # node:test via tsx, over src/__tests__/**/*.test.ts
npm run lint      # prettier --check
npm run build     # tsc declarations + esbuild bundles
```

Two of the tests drive a real local socket to prove the deadline actually fires,
so the suite takes a moment longer than a pure unit run.

## Releasing

Publishing is authenticated with npm **Trusted Publishing (OIDC)** — there is no
`NPM_TOKEN`. On npm, under the package's _Access_ settings, the trusted publisher
must name this repository exactly:

| Field             | Value                                                         |
| ----------------- | ------------------------------------------------------------- |
| Organization      | `gachlab`                                                     |
| Repository        | `google-form-scraper` (singular — the package name is plural) |
| Workflow filename | `publish.yml`                                                 |
| Environment       | `npm`                                                         |

Publishing must also be allowed for that route in the same settings page.

To cut a release: bump `version` in `package.json`, refresh the lockfile
(`npm install --package-lock-only`), commit, then tag and publish a GitHub
Release for that tag. The Release is what triggers the workflow — pushing the tag
alone does nothing — and the workflow builds from the tagged commit, so the tag
has to point at the commit you actually want published.

`repository.url` in `package.json` must match this repository, because npm
validates it against the provenance statement and rejects the publish otherwise.

## License

MIT
