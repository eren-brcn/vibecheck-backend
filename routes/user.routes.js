const router = require("express").Router();
const User = require("../models/User.model");
const Group = require("../models/MeetupGroup.model");
const { verifyToken } = require("../middlewares/auth.middlewares");
const { io } = require("../server");

const getUserIdFromPayload = (payload) => String(payload?._id || payload?.id || "").trim();

const getFriendRequestStatus = (viewer, targetUserId) => {
  const isFriend = viewer.friends.some((id) => String(id) === targetUserId);
  const outgoing = viewer.sentFriendRequests?.some((id) => String(id) === targetUserId) || false;
  const incoming = viewer.friendRequests.some((id) => String(id) === targetUserId);

  if (isFriend) return "friends";
  if (outgoing) return "sent";
  if (incoming) return "received";
  return "none";
};

// SEARCH USERS (Protected)
router.get("/search", verifyToken, async (req, res) => {
  try {
    const currentUserId = getUserIdFromPayload(req.payload);
    const query = String(req.query.q || "").trim();

    if (!query) {
      return res.json([]);
    }

    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const currentUser = await User.findById(currentUserId).select("friends friendRequests sentFriendRequests");
    const friendIds = new Set((currentUser?.friends || []).map((id) => String(id)));
    const sentIds = new Set((currentUser?.sentFriendRequests || []).map((id) => String(id)));
    const requestFromIds = new Set((currentUser?.friendRequests || []).map((id) => String(id)));

    const users = await User.find({
      _id: { $ne: currentUserId },
      $or: [{ username: regex }, { email: regex }],
    })
      .select("_id username email imageUrl instagramUrl spotifyUrl")
      .limit(12);

    const withFriendStatus = users.map((user) => ({
      ...user.toObject(),
      isFriend: friendIds.has(String(user._id)),
      friendRequestStatus: friendIds.has(String(user._id))
        ? "friends"
        : sentIds.has(String(user._id))
          ? "sent"
          : requestFromIds.has(String(user._id))
            ? "received"
            : "none",
    }));

    res.json(withFriendStatus);
  } catch (err) {
    res.status(500).json({ message: "Error searching users" });
  }
});

// GET NOTIFICATIONS (Protected)
router.get("/notifications", verifyToken, async (req, res) => {
  try {
    const currentUserId = getUserIdFromPayload(req.payload);
    const user = await User.findById(currentUserId)
      .populate("friendRequests", "_id username email imageUrl")
      .populate("groupInvites.group", "_id name")
      .populate("groupInvites.invitedBy", "_id username imageUrl")
      .select("friendRequests groupInvites");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const friendRequests = (user.friendRequests || []).map((requester) => ({
      _id: requester._id,
      fromUser: requester,
      type: "friend-request"
    }));

    const groupInvites = (user.groupInvites || [])
      .filter((invite) => invite.group && invite.invitedBy)
      .map((invite) => ({
        _id: invite._id,
        group: invite.group,
        invitedBy: invite.invitedBy,
        createdAt: invite.createdAt,
        type: "group-invite"
      }));

    res.json({
      count: friendRequests.length + groupInvites.length,
      friendRequests,
      groupInvites
    });
  } catch (err) {
    res.status(500).json({ message: "Error fetching notifications" });
  }
});

// GET USER PUBLIC PROFILE (Protected)
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const currentUserId = getUserIdFromPayload(req.payload);
    const currentUser = await User.findById(currentUserId).select("friends friendRequests sentFriendRequests");
    if (!currentUser) {
      return res.status(404).json({ message: "Current user not found" });
    }

    const user = await User.findById(req.params.id).select("_id username email imageUrl instagramUrl spotifyUrl");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const targetId = String(user._id);
    const isFriend = currentUser.friends.some((friendId) => String(friendId) === targetId);
    const friendRequestStatus = getFriendRequestStatus(currentUser, targetId);
    res.json({ ...user.toObject(), isFriend, friendRequestStatus });
  } catch (err) {
    res.status(500).json({ message: "Error fetching user profile" });
  }
});

// SEND FRIEND REQUEST (Protected)
router.post("/:id/friend", verifyToken, async (req, res) => {
  try {
    const currentUserId = getUserIdFromPayload(req.payload);
    const targetUserId = String(req.params.id || "").trim();

    if (!targetUserId) {
      return res.status(400).json({ message: "Target user is required" });
    }

    if (currentUserId === targetUserId) {
      return res.status(400).json({ message: "You cannot add yourself as a friend" });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const currentUser = await User.findById(currentUserId).select("friends sentFriendRequests");
    if (!currentUser) {
      return res.status(404).json({ message: "Current user not found" });
    }

    if (currentUser.friends.some((id) => String(id) === targetUserId)) {
      return res.status(400).json({ message: "You are already friends" });
    }

    if (currentUser.sentFriendRequests?.some((id) => String(id) === targetUserId)) {
      return res.status(400).json({ message: "Friend request already sent" });
    }

    if (targetUser.friendRequests?.some((id) => String(id) === currentUserId)) {
      return res.status(400).json({ message: "Friend request already sent" });
    }

    await User.findByIdAndUpdate(targetUserId, { $addToSet: { friendRequests: currentUserId } });
    await User.findByIdAndUpdate(currentUserId, { $addToSet: { sentFriendRequests: targetUserId } });

    // Emit socket event to target user
    io.to(`notifications:${targetUserId}`).emit("friend-request:new", {
      _id: currentUserId,
      username: currentUser.username,
      imageUrl: currentUser.imageUrl,
    });

    res.json({ message: "Friend request sent" });
  } catch (err) {
    res.status(500).json({ message: "Error sending friend request" });
  }
});

// RESPOND TO FRIEND REQUEST (Protected)
router.post("/friend-requests/:requesterId/:action", verifyToken, async (req, res) => {
  try {
    const currentUserId = getUserIdFromPayload(req.payload);
    const requesterId = String(req.params.requesterId || "").trim();
    const action = String(req.params.action || "").trim().toLowerCase();

    if (!["accept", "decline"].includes(action)) {
      return res.status(400).json({ message: "Action must be accept or decline" });
    }

    const currentUser = await User.findById(currentUserId).select("friendRequests");
    if (!currentUser) {
      return res.status(404).json({ message: "Current user not found" });
    }

    if (!currentUser.friendRequests.some((id) => String(id) === requesterId)) {
      return res.status(404).json({ message: "Friend request not found" });
    }

    await User.findByIdAndUpdate(currentUserId, { $pull: { friendRequests: requesterId } });
    await User.findByIdAndUpdate(requesterId, { $pull: { sentFriendRequests: currentUserId } });

    if (action === "accept") {
      await User.findByIdAndUpdate(currentUserId, { $addToSet: { friends: requesterId } });
      await User.findByIdAndUpdate(requesterId, { $addToSet: { friends: currentUserId } });
      
      // Emit socket event to requester
      io.to(`notifications:${requesterId}`).emit("friend-request:accepted", {
        userId: currentUserId,
        username: currentUser.username,
        imageUrl: currentUser.imageUrl,
      });
      
      return res.json({ message: "Friend request accepted" });
    }

    // Emit socket event to requester for decline
    io.to(`notifications:${requesterId}`).emit("friend-request:declined", {
      userId: currentUserId,
    });

    return res.json({ message: "Friend request declined" });
  } catch (err) {
    res.status(500).json({ message: "Error responding to friend request" });
  }
});

// SEND GROUP INVITE TO USER (Protected)
router.post("/group-invites", verifyToken, async (req, res) => {
  try {
    const currentUserId = getUserIdFromPayload(req.payload);
    const targetUserId = String(req.body?.targetUserId || "").trim();
    const groupId = String(req.body?.groupId || "").trim();

    if (!targetUserId || !groupId) {
      return res.status(400).json({ message: "targetUserId and groupId are required" });
    }

    if (targetUserId === currentUserId) {
      return res.status(400).json({ message: "You cannot invite yourself" });
    }

    const [targetUser, group] = await Promise.all([
      User.findById(targetUserId).select("_id groupInvites"),
      Group.findById(groupId),
    ]);

    if (!targetUser) {
      return res.status(404).json({ message: "Target user not found" });
    }

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (!group.isPrivate) {
      return res.status(400).json({ message: "Only private groups can send direct invites" });
    }

    if (String(group.organiser) !== currentUserId) {
      return res.status(403).json({ message: "Only the organiser can send invites" });
    }

    if (String(group.organiser) === targetUserId || group.members.some((id) => String(id) === targetUserId)) {
      return res.status(400).json({ message: "User is already in this group" });
    }

    const alreadyInvited = (targetUser.groupInvites || []).some(
      (invite) => String(invite.group) === groupId
    );
    if (alreadyInvited) {
      return res.status(400).json({ message: "Invite already sent to this user" });
    }

    await User.findByIdAndUpdate(targetUserId, {
      $push: { groupInvites: { group: groupId, invitedBy: currentUserId } }
    });

    // Emit socket event to target user
    io.to(`notifications:${targetUserId}`).emit("group-invite:new", {
      groupId: groupId,
      groupName: group.name,
      invitedBy: currentUserId,
      inviterName: currentUser.username,
    });

    res.json({ message: "Group invite sent" });
  } catch (err) {
    res.status(500).json({ message: "Error sending group invite" });
  }
});

// RESPOND TO GROUP INVITE (Protected)
router.post("/group-invites/:inviteId/:action", verifyToken, async (req, res) => {
  try {
    const currentUserId = getUserIdFromPayload(req.payload);
    const inviteId = String(req.params.inviteId || "").trim();
    const action = String(req.params.action || "").trim().toLowerCase();

    if (!["accept", "decline"].includes(action)) {
      return res.status(400).json({ message: "Action must be accept or decline" });
    }

    const user = await User.findById(currentUserId).select("groupInvites");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const invite = user.groupInvites.find((item) => String(item._id) === inviteId);
    if (!invite) {
      return res.status(404).json({ message: "Invite not found" });
    }

    const groupId = invite.group;
    const inviterId = invite.invitedBy;

    if (action === "accept") {
      await Group.findByIdAndUpdate(groupId, { $addToSet: { members: currentUserId } });
      
      // Emit socket event to inviter
      io.to(`notifications:${inviterId}`).emit("group-invite:accepted", {
        userId: currentUserId,
        groupId: groupId,
      });
    } else {
      // Emit socket event to inviter for decline
      io.to(`notifications:${inviterId}`).emit("group-invite:declined", {
        userId: currentUserId,
        groupId: groupId,
      });
    }

    await User.findByIdAndUpdate(currentUserId, { $pull: { groupInvites: { _id: inviteId } } });

    if (action === "accept") {
      return res.json({ message: "Group invite accepted" });
    }
    return res.json({ message: "Group invite declined" });
  } catch (err) {
    res.status(500).json({ message: "Error responding to group invite" });
  }
});

module.exports = router;
