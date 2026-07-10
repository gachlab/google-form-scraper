export interface GoogleFormInput {
  url: string;
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
