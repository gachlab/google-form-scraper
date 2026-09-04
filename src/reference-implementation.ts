import type {
  GoogleFormInput,
  FormResponse,
  FormField,
  GoogleFormsScraperFactory,
} from "./definitions";
import {
  DEFAULT_TIMEOUT_MS,
  MAX_TIMEOUT_MS,
  FormFetchError,
  FormTimeoutError,
} from "./definitions";
import { parse } from "node-html-parser";

const normalizeTimeout = (value: number | undefined): number => {
  if (value === undefined) return DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(value) || value <= 0)
    throw new RangeError(
      `timeoutMs must be a positive, finite number of milliseconds; received ${value}`,
    );
  return Math.min(Math.floor(value), MAX_TIMEOUT_MS);
};

/**
 * Fetches the form page under a single deadline.
 *
 * Two things the deadline has to survive. It covers reading the body as well as
 * receiving the headers -- a response whose body never finishes arriving hangs just
 * as hard as one whose headers never do. And it does not depend on the transport
 * honouring the abort: an injected `fetch` that drops the second argument would
 * otherwise get no deadline at all, so the budget is raced against the work rather
 * than merely signalled to it. The abort still fires, so a well-behaved transport
 * releases the socket instead of leaking it.
 */
async function readForm(
  dependencies: { fetch: typeof globalThis.fetch },
  input: GoogleFormInput,
): Promise<string> {
  const timeoutMs = normalizeTimeout(input.timeoutMs);
  const controller = new AbortController();
  let expire: ReturnType<typeof setTimeout>;

  const deadline = new Promise<never>((_, reject) => {
    expire = setTimeout(() => {
      // Abort with the very error the race rejects with. A transport that honours
      // the signal rejects with `signal.reason`, and it fires synchronously here --
      // so whichever of the two paths settles first, the caller sees the same
      // FormTimeoutError rather than a bare AbortError.
      const expired = new FormTimeoutError(timeoutMs);
      controller.abort(expired);
      reject(expired);
    }, timeoutMs);
  });
  const within = <T>(work: Promise<T>) => Promise.race([work, deadline]);

  try {
    const response = await within(
      dependencies.fetch(input.url, { signal: controller.signal }),
    );
    if (!response.ok) throw new FormFetchError(response.status);
    return await within(response.text());
  } finally {
    clearTimeout(expire!);
  }
}

// Google serves question text with HTML entities left encoded (&#39;, &quot;, &#160;).
// node-html-parser's `text` decodes them; `innerText` hands back the raw source, which
// would put "&quot;check-in&quot;" in front of a respondent. Every field below reads
// user-facing copy, so all of them go through `text`.
function getForm(dependencies: {
  fetch: typeof globalThis.fetch;
  htmlParser: typeof parse;
}) {
  return async (input: GoogleFormInput): Promise<FormResponse> => {
    const html = dependencies.htmlParser(await readForm(dependencies, input));

    const fields: FormField[] = html
      .querySelectorAll("div[role='listitem']:not([jsaction])")
      .map((item, index) => {
        const heading = item.querySelector("div[role='heading']");
        const headingText = heading?.text ?? "";
        const radioSpans = item.querySelectorAll(
          "div[role='radiogroup'] span[dir='auto']",
        );
        const radioLabels = item.querySelectorAll(
          "div[role='radiogroup'] label",
        );
        const listItems = item.querySelectorAll(
          "div[role='list'] div[role='listitem']",
        );
        // A dropdown's first `role="option"` is a UI placeholder ("Choose"),
        // localised by the request, and its `data-value` is the empty string.
        // That empty value is what identifies it; the text cannot be relied on.
        const dropdownOptions = item
          .querySelectorAll("div[role='listbox'] div[role='option']")
          .filter((option) => (option.getAttribute("data-value") ?? "") !== "");

        const field: FormField = {
          name: `question-${index}`,
          prompt: headingText.replace(" *", ""),
          required: headingText.includes("*"),
          placeholder: item.querySelector("div[aria-hidden=true]")?.text ?? "",
          type:
            radioSpans.length > 0
              ? "radiogroup"
              : item.querySelector("div[role='radiogroup']")
                ? "presentation"
                : item.querySelector("div[role='list']")
                  ? "list"
                  : item.querySelector("div[role='listbox']")
                    ? "dropdown"
                    : item.querySelector("textarea")
                      ? "textarea"
                      : item.querySelector("input[type='email']")
                        ? "email"
                        : item.querySelector("input[type='text']")
                          ? "text"
                          : "unknown",
        };

        if (dropdownOptions.length > 0) {
          field.options = dropdownOptions.map((option) => ({
            prompt: option.text,
          }));
        } else if (listItems.length > 0) {
          field.options = listItems.map((li) => ({
            prompt: li.querySelector("span[dir='auto']")?.text ?? "",
            ...(li.querySelector("input[type='text']")
              ? { isTextField: true }
              : {}),
          }));
        } else if (radioSpans.length > 0) {
          field.options = radioSpans.map((span) => ({
            prompt: span.text,
          }));
        } else if (radioLabels.length > 0) {
          field.options = radioLabels.map((label) => ({
            prompt: label.text,
            ...(label.parentNode.querySelector("input[type='text']")
              ? { isTextField: true }
              : {}),
          }));
          // A linear scale puts its endpoint captions either side of the options,
          // but both captions are optional. Without them the outermost children ARE
          // the first and last option, and reporting those as the range invents a
          // caption the form never showed -- "1" to "5" reads exactly like a real
          // one to whoever renders it. Only siblings that are not options count.
          const holder = radioLabels[0].parentNode;
          const options = new Set<unknown>(radioLabels);
          const first = holder.firstChild;
          const last = holder.lastChild;
          const caption = (node: { text: string } | null | undefined) =>
            node && !options.has(node) && node.text.trim().length > 0
              ? node.text
              : undefined;
          const min = caption(first);
          const max = caption(last);
          if (min !== undefined && max !== undefined && first !== last) {
            field.min = { prompt: min };
            field.max = { prompt: max };
          }
        }

        return field;
      });

    return {
      title: html.querySelector("div[role='heading']:first-child")?.text,
      description: html.querySelector("div[dir='auto']:nth-child(2)")?.text,
      fields,
    };
  };
}

export const GoogleFormsScraperReference: GoogleFormsScraperFactory = (
  dependencies = { fetch: globalThis.fetch, htmlParser: parse },
) => ({
  getFormTemplate: getForm(dependencies),
});
