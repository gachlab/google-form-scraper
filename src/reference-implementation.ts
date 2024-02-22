import type { GoogleFormInput, GoogleFormsScraper, getFormTemplate } from './definitions';
import { parse } from 'node-html-parser';

function getForm(dependencies: { fetch: typeof fetch; htmlParser: typeof parse; }): getFormTemplate {
  return (input: GoogleFormInput) => {
    return dependencies.fetch(input.url)
      .then(response => response.ok ? response.text() : Promise.reject())
      .then(text => parse(text))
      .then(text => {
        return ({
          title: text.querySelector(`div[role="heading"]:first-child`)?.innerText,
          description: text.querySelector(`div[dir="auto"]:nth-child(2)`)?.innerText,
          fields: text.querySelectorAll("div[role='listitem']:not([jsaction])")
            .map((item, index) => Object.assign({
              name: "question-" + index,
              prompt: item.querySelector(`div[role="heading"]`)?.innerText.replace(" *", ""),
              required: item.querySelector(`div[role="heading"]`)?.innerText.includes("*"),
              type: item.querySelector(`div[role="radiogroup"]:not(span[dir='auto'])`) ? "presentation" :
                item.querySelector(`div[role="radiogroup"] span[dir='auto']`) ? "radiogroup" :
                  item.querySelector(`div[role="list"]`) ? "list" :
                    item.querySelector(`textarea`) ? "textarea" :
                      item.querySelector(`input[type='email']`) ? "email" :
                        item.querySelector(`input[type='text']`) ? "text" :
                          "unknown",
            },
              item.querySelectorAll(`div[role="list"]`).length > 0 ? {
                options: item.querySelectorAll(`div[role="list"]`).map(item => ({ prompt: item.querySelector("span[dir='auto']")?.innerText }))
              } : {},
              item.querySelectorAll(`div[role="radiogroup"] span[dir='auto']`).length > 0 ? {
                options: item.querySelectorAll(`div[role="radiogroup"] span[dir='auto']`).map(item => ({ prompt: item.innerText }))
              } : {},

              item.querySelectorAll(`div[role="radiogroup"] label`).length > 0 ? {
                options: item.querySelectorAll(`div[role="radiogroup"] label`).map((_item, index) => ({ prompt: index })),
                min: { prompt: item.querySelectorAll(`div[role="radiogroup"] label`).length > 0 && item.querySelectorAll(`div[role="radiogroup"] label`)[0].parentNode.firstChild?.innerText },
                max: { prompt: item.querySelectorAll(`div[role="radiogroup"] label`).length > 0 && item.querySelectorAll(`div[role="radiogroup"] label`)[0].parentNode.lastChild?.innerText },
              } : {}
            ))
        });
      });
  };
}

export const GoogleFormsScraperReference: GoogleFormsScraper = (dependencies: { fetch: typeof fetch, htmlParser: typeof parse } = {
  fetch, htmlParser: parse
}) => {
  const getFormTemplateReference: getFormTemplate = getForm(dependencies)
  return {
    getFormTemplate: getFormTemplateReference
  }
}