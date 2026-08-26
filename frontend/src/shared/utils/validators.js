/**
 * Client-side form validation.
 *
 * These rules must agree with backend/routes/authRoutes.js. They drifted once
 * already: the server accepted 8-72 character passwords while this file still
 * refused anything over 12, so a valid password was rejected before a request
 * was ever made. Client validation is a convenience; the server is the
 * authority, and disagreeing with it is worse than not validating at all.
 */

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72; // bcrypt's limit, matching the server
const USERNAME_MIN = 3;
const USERNAME_MAX = 32;

export const validateLoginForm = ({ mail, password }) =>
  validateMail(mail) && password.length > 0;

export const validateRegisterForm = ({ mail, password, username }) =>
  validateMail(mail) && validatePassword(password) && validateUsername(username);

const validatePassword = (password) =>
  password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX;

/**
 * The previous pattern ended in `[a-zA-Z]{2,4}`, which rejects every top-level
 * domain longer than four characters -- .local, .online, .institute,
 * .education. For a tool aimed at academics, refusing university domains is not
 * a small thing.
 */
export const validateMail = (mail) => {
  const emailPattern = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
  return emailPattern.test(String(mail || "").trim());
};

const validateUsername = (username) =>
  username.length >= USERNAME_MIN && username.length <= USERNAME_MAX;

export const RULES = { PASSWORD_MIN, PASSWORD_MAX, USERNAME_MIN, USERNAME_MAX };
