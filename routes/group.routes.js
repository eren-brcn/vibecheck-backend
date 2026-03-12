const router = require("express").Router();
const Group = require("../models/MeetupGroup.model");
const { verifyToken } = require("../middlewares/auth.middlewares");

// 1. GET ALL GROUPS (Public)
router.get("/", async (req, res) => {
  try {
    const allGroups = await Group.find().populate("organiser", "_id");
    res.json(allGroups);
  } catch (err) {
    res.status(500).json({ message: "Error fetching groups" });
  }
});

// 2. GET USER'S JOINED GROUPS (Protected)
router.get("/my-groups", verifyToken, async (req, res) => {
  try {
    const userId = String(req.payload._id || req.payload.id);
    const myGroups = await Group.find({
      $or: [{ members: userId }, { organiser: userId }]
    })
      .populate("members", "username email imageUrl")
      .populate("organiser", "_id");
    res.json(myGroups);
  } catch (err) {
    res.status(500).json({ message: "Error fetching your groups" });
  }
});

// 3. GET SINGLE GROUP WITH MEMBERS (Public)
router.get("/:id", async (req, res) => {
  try {
    const group = await Group.findById(req.params.id).populate("members", "username email imageUrl");
    if (!group) return res.status(404).json({ message: "Group not found" });
    res.json(group);
  } catch (err) {
    res.status(500).json({ message: "Error fetching group" });
  }
});

// 4. CREATE GROUP (Protected)
router.post("/", verifyToken, async (req, res) => {
  const { name, category, imageUrl } = req.body;
  try {
    const newGroup = await Group.create({
      name,
      category,
      imageUrl,
      organiser: req.payload._id, // Set the creator as the organiser
      members: []
    });
    res.status(201).json(newGroup);
  } catch (err) {
    res.status(400).json({ message: "Error creating group" });
  }
});

// 5. JOIN GROUP (Protected)
router.put("/join/:id", verifyToken, async (req, res) => {
  try {
    const currentUserId = String(req.payload._id || req.payload.id);
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: "Group not found" });

    if (group.organiser && group.organiser.toString() === currentUserId) {
      return res.status(400).json({ message: "Organiser cannot join as a member" });
    }

    const updated = await Group.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { members: currentUserId } },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: "Error joining group" });
  }
});

// 5. LEAVE GROUP (Protected)
router.put("/leave/:id", verifyToken, async (req, res) => {
  try {
    const currentUserId = req.payload?._id || req.payload?.id;
    if (!currentUserId) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: "Group not found" });

    if (group.organiser && group.organiser.toString() === currentUserId.toString()) {
      return res.status(403).json({ message: "Organiser cannot leave their own group. Delete it instead." });
    }

    const updated = await Group.findByIdAndUpdate(
      req.params.id,
      { $pull: { members: currentUserId } },
      { new: true }
    );

    if (updated && updated.members.length === 0) {
      await Group.findByIdAndDelete(req.params.id);
      return res.json({ message: "Group deleted as it has no members" });
    }

    res.json(updated);
  } catch (err) {
    console.error("Leave group error:", err.message);
    res.status(400).json({ message: err.message || "Error leaving group" });
  }
});

// 6. KICK MEMBER (Organizer Only)
router.put("/kick/:groupId/:userId", verifyToken, async (req, res) => {
  const { groupId, userId } = req.params;
  try {
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    // Security check: Only the organiser can perform this action
    const kickRequesterId = String(req.payload._id || req.payload.id);
    if (group.organiser.toString() !== kickRequesterId) {
      return res.status(403).json({ message: "Only the organiser can kick members!" });
    }
    
    // Perform the kick
    const updated = await Group.findByIdAndUpdate(groupId, { $pull: { members: userId } }, { new: true });

    if (updated && updated.members.length === 0) {
      await Group.findByIdAndDelete(groupId);
      return res.json({ message: "Group deleted as it has no members" });
    }

    res.json({ message: "User kicked successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error", err });
  }
});

// 7. DELETE ALL MY GROUPS (Organiser Only — bulk)
router.delete("/mine/all", verifyToken, async (req, res) => {
  try {
    const userId = String(req.payload._id || req.payload.id);
    const result = await Group.deleteMany({ organiser: userId });
    res.json({ message: `Deleted ${result.deletedCount} group(s)` });
  } catch (err) {
    res.status(500).json({ message: "Error deleting groups" });
  }
});

// 8. DELETE GROUP (Organizer Only)
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const requesterId = String(req.payload._id || req.payload.id);
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: "Group not found" });
    if (group.organiser.toString() !== requesterId) {
      return res.status(403).json({ message: "Only the organiser can delete the group!" });
    }
    await Group.findByIdAndDelete(req.params.id);
    res.json({ message: "Group deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting group" });
  }
});

module.exports = router;