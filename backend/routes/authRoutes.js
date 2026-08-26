const express = require("express");
const router = express.Router();
const authControllers = require("../controllers/auth/authControllers");
const Joi = require("joi");
const validator = require("express-joi-validation").createValidator({});
const auth = require("../middleware/auth");

// bcrypt hashes to a fixed width and accepts up to 72 bytes, so a short
// maximum buys nothing and costs users their passphrases. 12 characters ruled
// out "correct horse battery staple" while allowing "Passw0rd1234".
const PASSWORD = Joi.string().min(8).max(72).required();

const registerSchema = Joi.object({
  username: Joi.string().min(3).max(32).required(),
  password: PASSWORD,
  mail: Joi.string().email().required(),
});

const loginSchema = Joi.object({
  // Deliberately looser than registration: an account created under the old
  // rules must still be able to log in.
  password: Joi.string().min(1).max(72).required(),
  mail: Joi.string().email().required(),
});

router.post(
  "/register",
  validator.body(registerSchema),
  authControllers.controllers.postRegister
);
router.post(
  "/login",
  validator.body(loginSchema),
  authControllers.controllers.postLogin
);

// test route to verify if our middleware is working
router.get("/test", auth, (req, res) => {
  res.send("request passed");
});

module.exports = router;
