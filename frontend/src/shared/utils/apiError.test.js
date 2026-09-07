import { describeApiError } from "./apiError";

/**
 * Every branch here corresponds to a real failure someone hit and could not
 * diagnose, because all of them used to read "Registration failed".
 */

const withResponse = (status, data) => ({ response: { status, data } });

describe("no response at all", () => {
  it("names the most likely cause, which is that the API is not running", () => {
    const message = describeApiError(new Error("Network Error"), "fallback");
    expect(message).toMatch(/cannot reach the server/i);
    expect(message).toMatch(/5002/);
  });

  it("distinguishes a timeout from an unreachable server", () => {
    const timeout = Object.assign(new Error("timeout"), { code: "ECONNABORTED" });
    expect(describeApiError(timeout, "fallback")).toMatch(/took too long/i);
  });
});

describe("responses with a status", () => {
  it("explains a 503 as the database rather than the server", () => {
    // This is the paused Atlas cluster case. The API is up; Mongo is not.
    expect(describeApiError(withResponse(503, {}), "fallback"))
      .toMatch(/database is unavailable/i);
  });

  it("reads 409 as an account that already exists", () => {
    expect(describeApiError(withResponse(409, {}), "fallback"))
      .toMatch(/already exists/i);
  });

  it("does not leak the server's internals on a 500", () => {
    const message = describeApiError(
      withResponse(500, { error: "MongoServerError: E11000 at /srv/app/db.js:42" }),
      "fallback"
    );
    expect(message).not.toMatch(/MongoServerError|srv|db\.js/);
    expect(message).toMatch(/server hit an error/i);
  });

  it("prefers the server's own message when there is one", () => {
    expect(describeApiError(withResponse(400, { error: "Password too short" }), "fallback"))
      .toBe("Password too short");
  });

  it("reads a plain string body, which Joi returns", () => {
    expect(describeApiError(withResponse(400, "mail must be a valid email"), "fallback"))
      .toBe("mail must be a valid email");
  });

  it("reads { message } as well as { error }", () => {
    expect(describeApiError(withResponse(401, { message: "Token expired" }), "fallback"))
      .toBe("Token expired");
  });

  it("treats 401 and 403 the same, as a credentials problem", () => {
    expect(describeApiError(withResponse(401, {}), "fallback")).toMatch(/credentials/i);
    expect(describeApiError(withResponse(403, {}), "fallback")).toMatch(/credentials/i);
  });

  it("falls back for a status it has nothing specific to say about", () => {
    expect(describeApiError(withResponse(418, {}), "Registration failed"))
      .toBe("Registration failed");
  });
});
