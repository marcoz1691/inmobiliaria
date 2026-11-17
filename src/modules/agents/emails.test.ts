import { describe, expect, it } from "vitest";
import { resetPasswordEmail } from "./emails";

describe("resetPasswordEmail", () => {
  it("carries the link in both parts and escapes it in the HTML", () => {
    const url = 'https://portal.test/api/auth/reset-password/abc?callbackURL=/panel/restablecer&x="<b>';
    const mail = resetPasswordEmail("agente@example.com", url);
    expect(mail.to).toBe("agente@example.com");
    expect(mail.text).toContain(url);
    expect(mail.html).not.toContain('"<b>');
    expect(mail.html).toContain("&#38;x=&#34;&#60;b&#62;");
    expect(mail.text).toMatch(/1 hora/);
  });
});
