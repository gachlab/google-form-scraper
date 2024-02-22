
export interface getFormTemplate { (input: GoogleFormInput): Promise<FormResponse> }

export interface GoogleFormsScraper {
  (dependencies?: any): { getFormTemplate: getFormTemplate }
}


export interface FormResponse {
  title: string | undefined
  description: string | undefined
  fields: any
}

// interface Field {
//   name: "sex",
//   type: "radio",
//   value: "",
//   required: true,
//   options: [
//     {
//       name: "genero",
//       prompt: "Femenino",
//       value: "F",
//     },
//     {
//       name: "genero",
//       prompt: "Masculino",
//       value: "M",
//     },
//   ],
// }

export interface ParseError { }

export interface GoogleFormInput { url: string }