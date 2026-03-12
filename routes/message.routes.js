const router = require("express").Router();
const mongoose = require("mongoose");
const Message = require("../models/Message.model");
const { verifyToken } = require("../middlewares/auth.middlewares");

router.get("/:roomId", verifyToken, async (req, res) => {
  try {
    const { roomId } = req.params;

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

    const messages = await Message.find(query)
      .populate("author", "username")
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    console.error("Get messages error:", err);
    res.status(500).json({ message: "Error fetching messages" });
  }
});

module.exports = router;
