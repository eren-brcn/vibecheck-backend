const router = require("express").Router();
const mongoose = require("mongoose");
const Message = require("../models/Message.model");
const User = require("../models/User.model");
const { verifyToken } = require("../middlewares/auth.middlewares");
const { messageLimiter } = require("../middlewares/rate-limiters");
const { countUnreadForConversation } = require("../utils/message-utils");

router.use(messageLimiter);

router.get("/recent/dms", verifyToken, async (req, res) => {
  try {
    const userId = req.payload.userId;
    const currentUser = await User.findById(userId).select("blockedUsers");
    const blockedIds = new Set((currentUser?.blockedUsers || []).map((id) => String(id)));

    // Find all DM messages where current user is author or recipient
    const messages = await Message.find({
      groupId: null,
      $or: [
        { author: userId },
        { recipientId: userId }
      ]
    })
      .populate("author", "_id username imageUrl")
      .populate("recipientId", "_id username imageUrl")
      .sort({ createdAt: -1 });

    // Group by conversation (other user) and get the most recent message per conversation
    const conversationMap = new Map();

    messages.forEach((message) => {
      // Determine the other user in the conversation
      const otherUserId = String(message.author._id) === String(userId)
        ? String(message.recipientId._id)
        : String(message.author._id);

      if (blockedIds.has(otherUserId)) {
        return;
      }

      if (!conversationMap.has(otherUserId)) {
        const otherUser = String(message.author._id) === String(userId)
          ? message.recipientId
          : message.author;

        // Count unread messages from other user
        const unreadCount = countUnreadForConversation({
          messages,
          otherUserId,
          currentUserId: userId
        });

        conversationMap.set(otherUserId, {
          otherUser,
          lastMessage: message.content,
          lastMessageTime: message.createdAt,
          lastMessageFrom: String(message.author._id) === String(userId) ? 'You' : message.author.username,
          unreadCount
        });
      }
    });

    // Convert map to array and sort by last message time
    const conversations = Array.from(conversationMap.values())
      .sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));

    res.json(conversations);
  } catch (err) {
    console.error("Get recent DMs error:", err);
    res.status(500).json({ message: "Error fetching recent DMs" });
  }
});

router.put("/mark-read/:roomId", verifyToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.payload.userId;

    if (!roomId.includes("_")) {
      return res.status(400).json({ message: "Only DM messages can be marked as read" });
    }

    const [userAId, userBId] = roomId.split("_");

    if (!mongoose.isValidObjectId(userAId) || !mongoose.isValidObjectId(userBId)) {
      return res.status(400).json({ message: "Invalid DM room id" });
    }

    // Mark unread messages from the other user as read
    const otherUserId = String(userAId) === String(userId) ? userBId : userAId;

    await Message.updateMany(
      {
        groupId: null,
        author: otherUserId,
        recipientId: userId,
        read: false
      },
      { read: true }
    );

    res.json({ message: "Messages marked as read" });
  } catch (err) {
    console.error("Mark read error:", err);
    res.status(500).json({ message: "Error marking messages as read" });
  }
});

router.get("/unread-count", verifyToken, async (req, res) => {
  try {
    const userId = req.payload.userId;

    const unreadCount = await Message.countDocuments({
      groupId: null,
      recipientId: userId,
      read: false
    });

    res.json({ unreadCount });
  } catch (err) {
    console.error("Get unread count error:", err);
    res.status(500).json({ message: "Error fetching unread count" });
  }
});

router.get("/:roomId", verifyToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { limit = 30, skip = 0 } = req.query;
    const limitNum = Math.min(Math.max(parseInt(limit) || 30, 1), 100); // Min 1, max 100
    const skipNum = Math.max(parseInt(skip) || 0, 0);

    let query;

    if (roomId.includes("_")) {
      const [userAId, userBId] = roomId.split("_");

      if (!mongoose.isValidObjectId(userAId) || !mongoose.isValidObjectId(userBId)) {
        return res.status(400).json({ message: "Invalid DM room id" });
      }

      query = {
        groupId: null,
        $or: [
          { author: userAId, recipientId: userBId },
          { author: userBId, recipientId: userAId }
        ]
      };
    } else {
      if (!mongoose.isValidObjectId(roomId)) {
        return res.status(400).json({ message: "Invalid group room id" });
      }

      query = { groupId: roomId };
    }

    const totalCount = await Message.countDocuments(query);
    const messages = await Message.find(query)
      .populate("author", "username imageUrl")
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip(skipNum);

    // Reverse to get oldest messages first in chronological order
    messages.reverse();

    res.json({
      messages,
      totalCount,
      limit: limitNum,
      skip: skipNum,
      hasMore: skipNum + limitNum < totalCount
    });
  } catch (err) {
    console.error("Get messages error:", err);
    res.status(500).json({ message: "Error fetching messages" });
  }
});

router.put("/:messageId", verifyToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.payload.userId;
    const content = String(req.body?.content || "").trim();

    if (!content) {
      return res.status(400).json({ message: "Message content is required" });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (String(message.author) !== String(userId)) {
      return res.status(403).json({ message: "Only the author can edit this message" });
    }

    message.content = content;
    message.editedAt = new Date();
    await message.save();

    const populated = await message.populate("author", "username imageUrl");
    return res.json(populated);
  } catch (err) {
    return res.status(500).json({ message: "Error editing message" });
  }
});

router.delete("/:messageId", verifyToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.payload.userId;
    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (String(message.author) !== String(userId)) {
      return res.status(403).json({ message: "Only the author can delete this message" });
    }

    await Message.findByIdAndDelete(messageId);
    return res.json({ message: "Message deleted", messageId });
  } catch (err) {
    return res.status(500).json({ message: "Error deleting message" });
  }
});

router.post("/:messageId/reactions", verifyToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.payload.userId;
    const type = String(req.body?.type || "").trim();

    if (!type) {
      return res.status(400).json({ message: "Reaction type is required" });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    const existingIndex = (message.reactions || []).findIndex(
      (reaction) => String(reaction.userId) === String(userId)
    );

    if (existingIndex >= 0) {
      if (message.reactions[existingIndex].type === type) {
        message.reactions.splice(existingIndex, 1);
      } else {
        message.reactions[existingIndex].type = type;
      }
    } else {
      message.reactions.push({ userId, type });
    }

    await message.save();
    const populated = await message.populate("author", "username imageUrl");
    return res.json(populated);
  } catch (err) {
    return res.status(500).json({ message: "Error updating reactions" });
  }
});

module.exports = router;
