/**
 * Turn an axios failure into something a user can act on.
 *
 * Every auth failure used to surface as "Registration failed" regardless of
 * cause, so a paused database, a duplicate email and a short password were
 * indistinguishable. The most common real case -- the API not running at all --
 * produced the least informative message.
 */
export const describeApiError = (exception, fallback) => {
  // No response at all: the request never reached a server.
  if (exception && !exception.response) {
    if (exception.code === "ECONNABORTED") return "The server took too long to respond.";
    return "Cannot reach the server. Is the API running on port 5002?";
  }

  const { status, data } = exception?.response || {};

  // Joi and our controllers return either a string or { error }.
  const detail =
    typeof data === "string" ? data : data?.error || data?.message;

  if (status === 503) return detail || "The server is up but its database is unavailable.";
  if (status === 409) return detail || "That account already exists.";
  if (status === 400) return detail || "Some of those details were not accepted.";
  if (status === 401 || status === 403) return detail || "Those credentials were not accepted.";
  if (status >= 500) return "The server hit an error. Check its logs.";

  return detail || fallback;
};
