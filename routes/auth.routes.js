const router = require("express").Router();
const User = require("../models/User.model");

// POST /api/auth/signup
router.post("/signup", (req, res) => {
  const { username, email, password } = req.body;

  User.create({ username, email, password })
    .then((newUser) => {
      console.log("SUCCESS: User created in DB");
      res.status(201).json(newUser);
    })
    .catch((err) => {
      console.log("ERROR: Signup failed");
      console.log(err);
      res.status(500).json(err);
    });
});

module.exports = router;