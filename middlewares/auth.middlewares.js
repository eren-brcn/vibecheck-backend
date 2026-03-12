const jwt = require("jsonwebtoken")

function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;
    if (!token) {
      return res.status(401).json({ errorMessage: "Missing or invalid Authorization header" });
    }
    
    // Keep compatibility with either env var name.
    const secret = process.env.JWT_SECRET || process.env.TOKEN_SECRET;
    if (!secret) {
      throw new Error("JWT secret is not defined in environment variables");
    }

    const payload = jwt.verify(token, secret);
    if (!payload._id && payload.id) {
      payload._id = payload.id;
    }
    
    // we extract the payload from the token and pass it to the route inside the request.
    req.payload = payload;

    next(); // continue with the route
  } catch (error) {
    // console.log(error)
    // 1. there is no token
    // 2. the token was invalid (it was tampered with)
    // 3. the token has expired
    console.log("JWT Verification Error:", error.message);
    res.status(401).json({ errorMessage: "There is no token. Or token is invalid or expired." });
  }
}

function verifyAdmin(req, res, next) {
  // this is a protection middleware that checks if the user is of type admin
  // IT WILL ALWAYS BE USED AFTER verifyToken

  if (req.payload.role === "admin") {
    next(); // you are an admin, continue with the route.
  } else {
    res.status(401).json({ errorMessage: "Route only for admins, you are not an admin, get out" });
  }
}

module.exports = {
  verifyToken,
  verifyAdmin
};