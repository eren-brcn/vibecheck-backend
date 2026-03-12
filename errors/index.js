// ℹ️ Middleware to handle 404 and generic errors in the application

function handleErrors(app) {
  
  // ℹ️ Handles requests to undefined routes (404 Not Found)
  app.use((req, res, next) => {
    res.status(404).json({ message: "This route does not exist" });
  });

  // ℹ️ Centralized generic error handling middleware. whenever you call next(error), this middleware will handle the error
  app.use((err, req, res, next) => {

    // always logs the error
    console.error("ERROR", req.method, req.path, err);

    const cloudinaryError = err?.error || null;
    const statusFromCloudinary = cloudinaryError?.http_code || err?.http_code;
    const messageFromCloudinary = cloudinaryError?.message || err?.message;

    if (!res.headersSent && statusFromCloudinary) {
      const isAuthError = statusFromCloudinary === 401 || /signature|api_secret mismatch/i.test(messageFromCloudinary || '');
      return res.status(statusFromCloudinary).json({
        message: isAuthError
          ? "Cloudinary authentication failed. Verify CLOUDINARY cloud name, API key, and API secret in server .env"
          : messageFromCloudinary || "Cloudinary request failed"
      });
    }

    // Sends a generic server error response if headers haven't been sent
    if (!res.headersSent) {
      res
        .status(500)
        .json({
          message: "Internal server error. Check the server console for details",
        });
    }
  });
};

module.exports = handleErrors