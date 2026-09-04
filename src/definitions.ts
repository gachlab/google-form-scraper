/** How long the whole exchange with Google may take before the attempt is dropped. */
export const DEFAULT_TIMEOUT_MS = 10_000;

/** Node refuses timers longer than this, so a larger budget is capped at it. */
export const MAX_TIMEOUT_MS = 2_147_483_647;

/** Google answered, but refused to serve the form (401 for sign-in only, 404, ...). */
export class FormFetchError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Failed to fetch form: ${status}`);
    this.name = "FormFetchError";
    this.status = status;
  }
}

/** The exchange -- connecting, headers or body -- outlived its budget. */
export class FormTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Timed out fetching form after ${timeoutMs}ms`);
    this.name = "FormTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export interface GoogleFormInput {
  url: string;
  /**
   * How long the whole exchange with Google may take -- connecting, headers and
   * body -- before the attempt is abandoned. Defaults to `DEFAULT_TIMEOUT_MS`.
   */
  timeoutMs?: number;
}

export interface FormFieldOption {
  prompt: string;
  isTextField?: boolean;
}

export interface FormFieldRange {
  prompt: string;
}

export interface FormField {
  name: string;
  prompt: string;
  required: boolean;
  placeholder: string;
  type:
    | "radiogroup"
    | "presentation"
    | "list"
    | "textarea"
    | "email"
    | "text"
    | "unknown";
  options?: FormFieldOption[];
  min?: FormFieldRange;
  max?: FormFieldRange;
}

export interface FormResponse {
  title: string | undefined;
  description: string | undefined;
  fields: FormField[];
}

export interface GoogleFormsScraper {
  getFormTemplate(input: GoogleFormInput): Promise<FormResponse>;
}

export type GoogleFormsScraperFactory = (dependencies?: {
  fetch: typeof globalThis.fetch;
  htmlParser: typeof import("node-html-parser").parse;
}) => GoogleFormsScraper;
