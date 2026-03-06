const router = require("express").Router();
const User = require("../models/User.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({ username, email, password: hashedPassword });
    res.status(201).json(newUser);
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Signup failed" });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const foundUser = await User.findOne({ email });

    if (!foundUser) {
      return res.status(401).json({ message: "User not found" });
    }

    // Await the password comparison
    const isPasswordCorrect = await bcrypt.compare(password, foundUser.password);

    if (isPasswordCorrect) {
      // Create the token
      const token = jwt.sign({ id: foundUser._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
      
      // Return the token in the response
      res.json({ message: "Login successful", user: foundUser, token: token });
    } else {
      res.status(401).json({ message: "Incorrect password" });
    }
  } catch (err) {
    res.status(500).json({ error: "Login error" });
  }
});

module.exports = router;