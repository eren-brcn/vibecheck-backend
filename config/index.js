const express = require("express");

// ℹ️ Logs incoming requests and responses to the terminal (useful for debugging)
const logger = require("morgan");

// Middleware configuration
function config(app) {
  // ℹ️ Enables Express to trust reverse proxies (e.g., when deployed behind services like Heroku or Render)
  app.set("trust proxy", 1);
  
  // CORS is already configured in server.js with multi-origin support
  
  // ℹ️ Logs requests in the development environment
  app.use(logger("dev")); 

  // ℹ️ Parses incoming JSON requests
  app.use(express.json()); 

  // ℹ️ Parses incoming request bodies with URL-encoded data (form submissions)
  app.use(express.urlencoded({ extended: false }));
};

module.exports = config