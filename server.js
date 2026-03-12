// 1. Loads environment variables from a .env file into process.env
// This MUST be the very first thing in your file to work properly
require("dotenv").config({ override: true });
// 2. Imports Express (a Node.js framework for handling HTTP requests) and initializes the server
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const Message = require("./models/Message.model");
const connectDB = require("./db");
const app = express();
app.use(express.json());
const cors = require("cors");

const CLIENT_ORIGIN = process.env.ORIGIN || "http://localhost:5173";
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: CLIENT_ORIGIN,
        methods: ["GET", "POST"]
    }
});

io.on("connection", (socket) => {
    console.log(`User Connected: ${socket.id}`);

    socket.on("join_room", (room) => {
        socket.join(room);
        console.log(`User with ID: ${socket.id} joined room: ${room}`);
    });

    socket.on("send_message", async (data) => {
        try {
            await connectDB();

            const { content, author, groupId, recipientId, roomId } = data;

            const newMessage = await Message.create({
                content,
                author,
                groupId,
                recipientId
            });

            const populatedMessage = await newMessage.populate("author", "username");
            const targetRoom = groupId || roomId || recipientId;
            io.to(targetRoom).emit("receive_message", populatedMessage);
        } catch (error) {
            console.error("Socket message save error:", error);
            socket.emit("message_error", { message: "Failed to send message" });
        }
    });

    socket.on("disconnect", () => {
        console.log("User Disconnected", socket.id);
    });
});

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
server.listen(PORT, () => {
    console.log(`Server listening. Local access on http://localhost:${PORT}`);
});