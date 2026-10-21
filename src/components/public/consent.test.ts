import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConsentCheckbox } from "./fields";

describe("LOPDP consent checkbox", () => {
  it("includes a /privacidad link next to the checkbox", () => {
    const html = renderToStaticMarkup(
      createElement(ConsentCheckbox, { id: "c", text: "Acepto que mis datos se usen para responder a mi consulta." }),
    );
    expect(html).toMatch(/type="checkbox"/);
    expect(html).toMatch(/href="\/privacidad"/);
  });
});
