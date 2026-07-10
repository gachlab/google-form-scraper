import type {
  GoogleFormInput,
  FormResponse,
  FormField,
  GoogleFormsScraperFactory,
} from "./definitions";
import { parse } from "node-html-parser";

function getForm(dependencies: {
  fetch: typeof globalThis.fetch;
  htmlParser: typeof parse;
}) {
  return async (input: GoogleFormInput): Promise<FormResponse> => {
    const response = await dependencies.fetch(input.url);
    if (!response.ok)
      throw new Error(`Failed to fetch form: ${response.status}`);

    const html = dependencies.htmlParser(await response.text());

    const fields: FormField[] = html
      .querySelectorAll("div[role='listitem']:not([jsaction])")
      .map((item, index) => {
        const heading = item.querySelector("div[role='heading']");
        const headingText = heading?.innerText ?? "";
        const radioSpans = item.querySelectorAll(
          "div[role='radiogroup'] span[dir='auto']",
        );
        const radioLabels = item.querySelectorAll(
          "div[role='radiogroup'] label",
        );
        const listItems = item.querySelectorAll(
          "div[role='list'] div[role='listitem']",
        );

        const field: FormField = {
          name: `question-${index}`,
          prompt: headingText.replace(" *", ""),
          required: headingText.includes("*"),
          placeholder:
            item.querySelector("div[aria-hidden=true]")?.innerText ?? "",
          type:
            radioSpans.length > 0
              ? "radiogroup"
              : item.querySelector("div[role='radiogroup']")
                ? "presentation"
                : item.querySelector("div[role='list']")
                  ? "list"
                  : item.querySelector("textarea")
                    ? "textarea"
                    : item.querySelector("input[type='email']")
                      ? "email"
                      : item.querySelector("input[type='text']")
                        ? "text"
                        : "unknown",
        };

        if (listItems.length > 0) {
          field.options = listItems.map((li) => ({
            prompt: li.querySelector("span[dir='auto']")?.innerText ?? "",
            ...(li.querySelector("input[type='text']")
              ? { isTextField: true }
              : {}),
          }));
        } else if (radioSpans.length > 0) {
          field.options = radioSpans.map((span) => ({
            prompt: span.innerText,
          }));
        } else if (radioLabels.length > 0) {
          field.options = radioLabels.map((label) => ({
            prompt: label.innerText,
            ...(label.parentNode.querySelector("input[type='text']")
              ? { isTextField: true }
              : {}),
          }));
          const firstParent = radioLabels[0].parentNode;
          field.min = { prompt: firstParent.firstChild?.innerText ?? "" };
          field.max = { prompt: firstParent.lastChild?.innerText ?? "" };
        }

        return field;
      });

    return {
      title: html.querySelector("div[role='heading']:first-child")?.innerText,
      description: html.querySelector("div[dir='auto']:nth-child(2)")
        ?.innerText,
      fields,
    };
  };
}

export const GoogleFormsScraperReference: GoogleFormsScraperFactory = (
  dependencies = { fetch: globalThis.fetch, htmlParser: parse },
) => ({
  getFormTemplate: getForm(dependencies),
});
