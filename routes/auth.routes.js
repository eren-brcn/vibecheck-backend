const router = require("express").Router();
const User = require("../models/User.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { verifyToken } = require("../middlewares/auth.middlewares");

const isHttpUrl = (value) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const validateSocialUrl = (url, platform) => {
  if (!isHttpUrl(url)) {
    return `${platform} URL must start with http:// or https://`;
  }

  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();
  const path = parsed.pathname.replace(/\/+$/, "");

  if (platform === "Instagram") {
    const validHosts = ["instagram.com", "www.instagram.com", "m.instagram.com"];
    if (!validHosts.includes(hostname)) {
      return "Instagram URL must be an instagram.com link";
    }
    if (!path || path === "/") {
      return "Instagram URL must include a profile path";
    }
  }

  if (platform === "Spotify") {
    const validHosts = ["open.spotify.com", "spotify.com", "www.spotify.com"];
    if (!validHosts.includes(hostname)) {
      return "Spotify URL must be a spotify.com link";
    }
    if (!path || path === "/") {
      return "Spotify URL must include a profile or content path";
    }
  }

  return null;
};

// SIGNUP ROUTE
router.post("/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);

    const newUser = await User.create({ username, email, password: hashedPassword });
    res.status(201).json({ message: "User created successfully", userId: newUser._id });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Signup failed" });
  }
});

// LOGIN ROUTE
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const jwtSecret = process.env.JWT_SECRET || process.env.TOKEN_SECRET;

    if (!jwtSecret) {
      return res.status(500).json({ error: "JWT secret is not configured on the server" });
    }

    const foundUser = await User.findOne({ email });
    if (!foundUser) {
      return res.status(401).json({ message: "User not found" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, foundUser.password);
    if (isPasswordCorrect) {
      // Create the token
      const token = jwt.sign(
        { _id: foundUser._id, id: foundUser._id },
        jwtSecret,
        { expiresIn: "1h" }
      );
      // Return the token in the response
      res.json({ message: "Login successful", user: foundUser, token: token });
    } else {
      res.status(401).json({ message: "Incorrect password" });
    }
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login error" });
  }
});

// CURRENT USER ROUTE (Protected)
router.get("/me", verifyToken, async (req, res) => {
  try {
    const userId = req.payload?._id || req.payload?.id;
    if (!userId) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (err) {
    console.error("/auth/me error:", err);
    res.status(500).json({ message: "Error fetching current user" });
  }
});

// UPDATE CURRENT USER PROFILE (Protected)
router.put("/me", verifyToken, async (req, res) => {
  try {
    const userId = req.payload?._id || req.payload?.id;
    const { username, instagramUrl, spotifyUrl } = req.body;

    if (!userId) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    const updates = {};

    if (typeof username === "string") {
      const trimmedUsername = username.trim();
      if (!trimmedUsername) {
        return res.status(400).json({ message: "Username cannot be empty" });
      }
      updates.username = trimmedUsername;
    }

    if (typeof instagramUrl === "string") {
      const trimmedInstagramUrl = instagramUrl.trim();
      if (!trimmedInstagramUrl) {
        updates.instagramUrl = null;
      } else {
        const instagramError = validateSocialUrl(trimmedInstagramUrl, "Instagram");
        if (instagramError) {
          return res.status(400).json({ message: instagramError });
        }
        updates.instagramUrl = trimmedInstagramUrl;
      }
    }

    if (typeof spotifyUrl === "string") {
      const trimmedSpotifyUrl = spotifyUrl.trim();
      if (!trimmedSpotifyUrl) {
        updates.spotifyUrl = null;
      } else {
        const spotifyError = validateSocialUrl(trimmedSpotifyUrl, "Spotify");
        if (spotifyError) {
          return res.status(400).json({ message: spotifyError });
        }
        updates.spotifyUrl = trimmedSpotifyUrl;
      }
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ message: "No valid profile fields provided" });
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updates, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(updatedUser);
  } catch (err) {
    console.error("/auth/me update error:", err);
    res.status(500).json({ message: "Error updating profile" });
  }
});

// UPDATE CURRENT USER PHOTO (Protected)
router.put("/me/photo", verifyToken, async (req, res) => {
  try {
    const userId = req.payload?._id || req.payload?.id;
    const { imageUrl } = req.body;

    if (!userId) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    if (!imageUrl) {
      return res.status(400).json({ message: "imageUrl is required" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { imageUrl },
      { new: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(updatedUser);
  } catch (err) {
    console.error("/auth/me/photo error:", err);
    res.status(500).json({ message: "Error updating profile photo" });
  }
});

module.exports = router;