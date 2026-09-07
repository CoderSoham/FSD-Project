import { validateLoginForm, validateRegisterForm, validateMail, RULES } from "./validators";

/**
 * These rules exist to save a round trip, not to decide anything. The server is
 * the authority. So the thing worth testing is not that they reject bad input,
 * it is that they never reject input the server would have accepted.
 *
 * That is exactly how they broke before: this file capped passwords at 12
 * characters while the server allowed 72, so a perfectly valid password failed
 * without a request ever being made.
 */

describe("email", () => {
  it("accepts the long top level domains universities actually use", () => {
    // The old pattern ended in [a-zA-Z]{2,4} and rejected every one of these.
    for (const mail of [
      "a@dept.university.edu",
      "r@imperial.ac.uk",
      "s@example.institute",
      "s@example.education",
      "person@sub.domain.online",
    ]) {
      expect(validateMail(mail)).toBe(true);
    }
  });

  it("accepts ordinary addresses", () => {
    expect(validateMail("ada@example.com")).toBe(true);
    expect(validateMail("ada.lovelace+tag@example.co.in")).toBe(true);
  });

  it("rejects addresses with no domain part", () => {
    expect(validateMail("ada@example")).toBe(false);
    expect(validateMail("ada@")).toBe(false);
    expect(validateMail("@example.com")).toBe(false);
    expect(validateMail("ada example.com")).toBe(false);
  });

  it("survives being handed nothing", () => {
    expect(validateMail(undefined)).toBe(false);
    expect(validateMail(null)).toBe(false);
    expect(validateMail("")).toBe(false);
  });

  it("ignores surrounding whitespace, since a paste often carries it", () => {
    expect(validateMail("  ada@example.com  ")).toBe(true);
  });
});

describe("login form", () => {
  it("needs a valid address and some password", () => {
    expect(validateLoginForm({ mail: "ada@example.com", password: "x" })).toBe(true);
  });

  it("does not apply the registration password rules", () => {
    // An existing account may predate the current minimum. Refusing to let
    // someone try their own password is the wrong side to err on.
    expect(validateLoginForm({ mail: "ada@example.com", password: "old" })).toBe(true);
  });

  it("refuses an empty password", () => {
    expect(validateLoginForm({ mail: "ada@example.com", password: "" })).toBe(false);
  });
});

describe("register form", () => {
  const valid = { mail: "ada@example.com", password: "devpassword", username: "ada" };

  it("accepts a plausible signup", () => {
    expect(validateRegisterForm(valid)).toBe(true);
  });

  it("accepts a password right at the server's upper bound", () => {
    const password = "x".repeat(RULES.PASSWORD_MAX);
    expect(validateRegisterForm({ ...valid, password })).toBe(true);
  });

  it("accepts a password right at the server's lower bound", () => {
    const password = "x".repeat(RULES.PASSWORD_MIN);
    expect(validateRegisterForm({ ...valid, password })).toBe(true);
  });

  it("rejects one character below the minimum", () => {
    const password = "x".repeat(RULES.PASSWORD_MIN - 1);
    expect(validateRegisterForm({ ...valid, password })).toBe(false);
  });

  it("rejects one character above the maximum", () => {
    // bcrypt silently ignores anything past 72 bytes, so a longer password
    // would not mean what the person typing it thinks it means.
    const password = "x".repeat(RULES.PASSWORD_MAX + 1);
    expect(validateRegisterForm({ ...valid, password })).toBe(false);
  });

  it("checks the username length at both ends", () => {
    expect(validateRegisterForm({ ...valid, username: "x".repeat(RULES.USERNAME_MIN) })).toBe(true);
    expect(validateRegisterForm({ ...valid, username: "x".repeat(RULES.USERNAME_MIN - 1) })).toBe(false);
    expect(validateRegisterForm({ ...valid, username: "x".repeat(RULES.USERNAME_MAX) })).toBe(true);
    expect(validateRegisterForm({ ...valid, username: "x".repeat(RULES.USERNAME_MAX + 1) })).toBe(false);
  });
});
