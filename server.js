// 1. Loads environment variables from a .env file into process.env
// This MUST be the very first thing in your file to work properly
require("dotenv").config({ override: true });
// 2. Imports Express (a Node.js framework for handling HTTP requests) and initializes the server
const express = require("express");
const app = express();
app.use(express.json());
const cors = require("cors");
app.use(cors());

// 3. Loads and applies global middleware (CORS, JSON parsing, etc.) for server configurations
const config = require("./config");
config(app);

// 4. GET all concerts
app.get('/api/concerts', async (req, res) => {
    try {
        const concerts = await db.collection('concerts').find().toArray();
        res.json(concerts);
    } catch (error) {
        res.status(500).json({ message: "Error fetching concerts" });
    }
});

// 5. Middleware that establishes a database connection. Ensures the connection is created on every request. Required for serverless deployments
const connectDB = require("./db");
app.use(async (req, res, next) => {
    await connectDB()
    next()
})

// 6. Test Route. Can be left and used for waking up the server if idle
app.get("/", (req, res, next) => {
    res.json("All good in here");
});

// 7. Defines and applies route handlers
const indexRouter = require("./routes/index.routes");
app.use("/api", indexRouter);

const uploadRoutes = require("./routes/upload.routes");
app.use("/api/upload", uploadRoutes);

// 8. Centralized error handling (must be placed after routes)
const handleErrors = require("./errors");
handleErrors(app);

// 9. Defines the server port (default: 5005)
const PORT = process.env.PORT || 5005;

// 10. Optional for serverless deployments like Vercel.
app.listen(PORT, () => {
    console.log(`Server listening. Local access on http://localhost:${PORT}`);
});