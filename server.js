// 1. Loads environment variables from a .env file into process.env
// This MUST be the very first thing in your file to work properly
require("dotenv").config({ override: true });
// 2. Imports Express (a Node.js framework for handling HTTP requests) and initializes the server
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const Message = require("./models/Message.model");
const User = require("./models/User.model");
const { sanitizeMessageContent, isDmBlocked } = require("./utils/dm-policy");
const connectDB = require("./db");
const presenceStore = require("./presence-store");
const app = express();
app.use(express.json());
const cors = require("cors");

const allowedExact = new Set([
    "http://localhost:5173",
    "http://localhost:5174",
    "https://vibecheck-sigma-virid.vercel.app",
    "https://vibecheck-git-main-eren-brcns-projects.vercel.app",
    ...(process.env.ORIGIN ? [process.env.ORIGIN] : [])
]);
const allowedPreview = /^https:\/\/vibecheck-[a-z0-9-]+-eren-brcns-projects\.vercel\.app$/;

const originChecker = (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedExact.has(origin) || allowedPreview.test(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
};

app.use(cors({ origin: originChecker, credentials: true }));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: originChecker,
        methods: ["GET", "POST"]
    }
});

const socketInstance = require('./socket-instance');
socketInstance.setIo(io);

const runDataMigrations = async () => {
    await connectDB();

    const result = await User.updateMany(
        { notificationHistory: { $exists: true } },
        { $unset: { notificationHistory: "" } }
    );

    if (result.modifiedCount > 0) {
        console.log(`Migration: removed legacy notificationHistory from ${result.modifiedCount} user(s).`);
    }
};

const getSocketToken = (socket) => {
    const authToken = socket.handshake?.auth?.token;
    if (typeof authToken === "string" && authToken.trim()) {
        return authToken.trim();
    }

    const headerToken = socket.handshake?.headers?.authorization;
    if (typeof headerToken === "string" && headerToken.startsWith("Bearer ")) {
        return headerToken.slice(7).trim();
    }

    return null;
};

const emitPresenceForUserAndFriends = async (userId, isOnline) => {
    await connectDB();
    const user = await User.findById(userId).select("friends");
    if (!user) {
        return;
    }

    const roomIds = new Set([String(userId)]);
    (user.friends || []).forEach((friendId) => {
        roomIds.add(String(friendId));
    });

    const payload = { userId: String(userId), isOnline: Boolean(isOnline) };
    roomIds.forEach((id) => {
        io.to(`notifications:${id}`).emit("presence:update", payload);
    });
};

io.use((socket, next) => {
    (async () => {
    try {
        const token = getSocketToken(socket);
        if (!token) {
            return next(new Error("Unauthorized"));
        }

        const secret = process.env.JWT_SECRET || process.env.TOKEN_SECRET;
        if (!secret) {
            return next(new Error("Server JWT secret is missing"));
        }

        const payload = jwt.verify(token, secret);
        const userId = String(payload?._id || payload?.id || "").trim();
        if (!userId) {
            return next(new Error("Unauthorized"));
        }

        await connectDB();
        const user = await User.findById(userId).select("isActive");
        if (!user || user.isActive === false) {
            return next(new Error("Unauthorized"));
        }

        socket.data.userId = userId;
        return next();
    } catch {
        return next(new Error("Unauthorized"));
    }
    })();
});

io.on("connection", (socket) => {
    console.log(`User Connected: ${socket.id}`);
    const userId = String(socket.data?.userId || "").trim();

    if (userId) {
        const onlineResult = presenceStore.setOnline(userId, socket.id);
        if (onlineResult.changed) {
            emitPresenceForUserAndFriends(userId, true).catch((err) => {
                console.error("Presence online emit error:", err);
            });
        }
    }

    socket.on("join-notifications", () => {
        if (!userId) {
            return;
        }

        socket.join(`notifications:${userId}`);
        console.log(`User ${userId} joined notifications room: notifications:${userId}`);
    });

    socket.on("join_room", (room) => {
        socket.join(room);
        console.log(`User with ID: ${socket.id} joined room: ${room}`);
    });

    socket.on("send_message", async (data) => {
        try {
            await connectDB();

            const { content, author, groupId, recipientId, roomId } = data;
            const sanitized = sanitizeMessageContent(content);
            if (!sanitized.ok) {
                socket.emit("message_error", { message: sanitized.reason });
                return;
            }
            const safeContent = sanitized.content;

            if (recipientId && !groupId) {
                const [sender, recipient] = await Promise.all([
                    User.findById(author).select("blockedUsers friends"),
                    User.findById(recipientId).select("blockedUsers friends settings")
                ]);

                if (!sender || !recipient) {
                    socket.emit("message_error", { message: "User not found" });
                    return;
                }

                if (isDmBlocked({
                    senderBlockedUsers: sender.blockedUsers,
                    recipientBlockedUsers: recipient.blockedUsers,
                    senderId: author,
                    recipientId
                })) {
                    socket.emit("message_error", { message: "Cannot send message to this user" });
                    return;
                }

                const isFriend = (recipient.friends || []).some((id) => String(id) === String(author));
                if (recipient?.settings?.allowMessagesFromEveryone !== true) {
                    if (recipient?.settings?.allowMessagesFromFriends === true && !isFriend) {
                        socket.emit("message_error", { message: "This user only accepts messages from friends" });
                        return;
                    }
                }
            }

            const newMessage = await Message.create({
                content: safeContent,
                author,
                groupId,
                recipientId
            });

            const populatedMessage = await newMessage.populate("author", "username");
            const targetRoom = groupId || roomId || recipientId;
            io.to(targetRoom).emit("receive_message", populatedMessage);

            // Emit message notification to recipient
            if (recipientId && !groupId) {
                const senderName = (await User.findById(author).select("username"))?.username || "User";
                io.to(`notifications:${recipientId}`).emit("message:new", {
                    fromUser: senderName,
                    content: safeContent
                });
            }
        } catch (error) {
            console.error("Socket message save error:", error);
            socket.emit("message_error", { message: "Failed to send message" });
        }
    });

    socket.on("typing", ({ roomId }) => {
        if (!roomId || !userId) {
            return;
        }

        socket.to(roomId).emit("typing", { userId });
    });

    socket.on("disconnect", () => {
        const result = presenceStore.setOffline(socket.id);
        if (result.changed && result.userId) {
            User.findByIdAndUpdate(result.userId, { lastSeen: new Date() }).catch((err) => {
                console.error("Last seen update error:", err);
            });
            emitPresenceForUserAndFriends(result.userId, false).catch((err) => {
                console.error("Presence offline emit error:", err);
            });
        }
        console.log("User Disconnected", socket.id);
    });
});

// 3. Loads and applies global middleware (CORS, JSON parsing, etc.) for server configurations
const config = require("./config");
config(app);

// 4. Middleware that establishes a database connection. Ensures the connection is created on every request. Required for serverless deployments
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

runDataMigrations().catch((err) => {
    console.error("Data migration failed:", err);
});

// 10. Optional for serverless deployments like Vercel.
server.listen(PORT, () => {
    console.log(`Server listening. Local access on http://localhost:${PORT}`);
});