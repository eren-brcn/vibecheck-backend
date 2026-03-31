const router = require("express").Router();
const crypto = require("crypto");
const Group = require("../models/MeetupGroup.model");
const { verifyToken } = require("../middlewares/auth.middlewares");

const generateInviteCode = () => crypto.randomBytes(4).toString("hex").toUpperCase();

const getUserIdFromPayload = (payload) => String(payload?._id || payload?.id || "").trim();

// 1. GET ALL GROUPS (Public)
router.get("/", async (req, res) => {
  try {
    // Discover should list only public groups.
    const allGroups = await Group.find({ isPrivate: { $ne: true } }).populate("organiser", "_id");
    res.json(allGroups);
  } catch (err) {
    res.status(500).json({ message: "Error fetching groups" });
  }
});

// 2. GET USER'S JOINED GROUPS (Protected)
router.get("/my-groups", verifyToken, async (req, res) => {
  try {
    const userId = getUserIdFromPayload(req.payload);
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

// 3. GET SINGLE GROUP WITH MEMBERS (Protected for private groups)
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const currentUserId = getUserIdFromPayload(req.payload);
    if (!currentUserId) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    const group = await Group.findById(req.params.id).populate("members", "username email imageUrl");
    if (!group) return res.status(404).json({ message: "Group not found" });

    if (group.isPrivate) {
      const organiserId = group.organiser ? String(group.organiser) : "";
      const isOrganiser = organiserId === currentUserId;
      const isMember = group.members.some((member) => String(member._id || member) === currentUserId);
      if (!isOrganiser && !isMember) {
        return res.status(403).json({ message: "This is a private group. Join with an invite code." });
      }
    }

    res.json(group);
  } catch (err) {
    res.status(500).json({ message: "Error fetching group" });
  }
});

// 4. CREATE GROUP (Protected)
router.post("/", verifyToken, async (req, res) => {
  const { name, category, imageUrl, isPrivate } = req.body;
  try {
    const privateGroup = Boolean(isPrivate);
    const newGroup = await Group.create({
      name,
      category,
      imageUrl,
      isPrivate: privateGroup,
      inviteCode: privateGroup ? generateInviteCode() : null,
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
    const currentUserId = getUserIdFromPayload(req.payload);
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: "Group not found" });

    if (group.organiser && group.organiser.toString() === currentUserId) {
      return res.status(400).json({ message: "Organiser cannot join as a member" });
    }

    if (group.isPrivate) {
      return res.status(403).json({ message: "This is a private group. Use an invite code to join." });
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

// 6. JOIN GROUP BY INVITE CODE (Protected)
router.put("/join-by-invite", verifyToken, async (req, res) => {
  try {
    const currentUserId = getUserIdFromPayload(req.payload);
    const inviteCode = String(req.body?.inviteCode || "").trim().toUpperCase();

    if (!inviteCode) {
      return res.status(400).json({ message: "Invite code is required" });
    }

    const group = await Group.findOne({ inviteCode, isPrivate: true });
    if (!group) {
      return res.status(404).json({ message: "Invalid invite code" });
    }

    if (group.organiser && String(group.organiser) === currentUserId) {
      return res.status(400).json({ message: "You are already the organiser of this group" });
    }

    const updated = await Group.findByIdAndUpdate(
      group._id,
      { $addToSet: { members: currentUserId } },
      { new: true }
    );

    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: "Error joining with invite code" });
  }
});

// 7. LEAVE GROUP (Protected)
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

// 8. KICK MEMBER (Organizer Only)
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

// 9. DELETE ALL MY GROUPS (Organiser Only — bulk)
router.delete("/mine/all", verifyToken, async (req, res) => {
  try {
    const userId = String(req.payload._id || req.payload.id);
    const result = await Group.deleteMany({ organiser: userId });
    res.json({ message: `Deleted ${result.deletedCount} group(s)` });
  } catch (err) {
    res.status(500).json({ message: "Error deleting groups" });
  }
});

// 10. DELETE GROUP (Organizer Only)
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