import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConsentCheckbox } from "./fields";

describe("LOPDP consent checkbox", () => {
  // Contacto, ficha and embudo all render ConsentCheckbox. The privacy page exists at
  // /privacidad; the control itself currently has no link next to the checkbox.
  it.fails("includes a /privacidad link next to the checkbox", () => {
    const html = renderToStaticMarkup(
      createElement(ConsentCheckbox, { id: "c", text: "Acepto que mis datos se usen para responder a mi consulta." }),
    );
    expect(html).toMatch(/type="checkbox"/);
    expect(html).toMatch(/href="\/privacidad"/);
  });
});
