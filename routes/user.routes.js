const router = require("express").Router();
const User = require("../models/User.model");
const Group = require("../models/MeetupGroup.model");
const { verifyToken } = require("../middlewares/auth.middlewares");
const { searchLimiter } = require("../middlewares/rate-limiters");
const socketInstance = require("../socket-instance");
const presenceStore = require("../presence-store");

const getUserIdFromPayload = (payload) => String(payload?._id || payload?.id || "").trim();

const maskEmail = (email) => {
  if (typeof email !== "string") {
    return email;
  }

  const [localPart, domainPart] = email.split("@");
  if (!localPart || !domainPart) {
    return email;
  }

  return `${localPart.slice(0, 2)}****@${domainPart}`;
};

const getFriendRequestStatus = (viewer, targetUserId) => {
  const isFriend = viewer.friends.some((id) => String(id) === targetUserId);
  const outgoing = viewer.sentFriendRequests?.some((id) => String(id) === targetUserId) || false;
  const incoming = viewer.friendRequests.some((id) => String(id) === targetUserId);

  if (isFriend) return "friends";
  if (outgoing) return "sent";
  if (incoming) return "received";
  return "none";
};

const appendNotification = async (userId, payload) => {
  const title = String(payload?.title || "Notification").trim();
  if (!title) {
    return;
  }

  await User.findByIdAndUpdate(userId, {
    $push: {
      notificationHistory: {
        $each: [{
          type: payload?.type || "event",
          title,
          body: String(payload?.body || "").trim(),
          createdAt: new Date()
        }],
        $position: 0,
        $slice: 100
      }
    }
  });
};

// GET USER SETTINGS (Protected)
router.get("/settings", verifyToken, async (req, res) => {
  try {
    const currentUserId = getUserIdFromPayload(req.payload);
    const user = await User.findById(currentUserId).select("settings");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json(user.settings || {});
  } catch (err) {
    return res.status(500).json({ message: "Error fetching settings" });
  }
});

// UPDATE USER SETTINGS (Protected)
router.put("/settings", verifyToken, async (req, res) => {
  try {
    const currentUserId = getUserIdFromPayload(req.payload);
    const allowedFields = [
      "allowFriendRequests",
      "allowMessagesFromFriends",
      "allowMessagesFromEveryone",
      "notifyOnFriendRequest",
      "notifyOnMessage",
      "notifyOnGroupInvite",
      "theme"
    ];

    const settingsUpdate = {};
    allowedFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        settingsUpdate[`settings.${field}`] = req.body[field];
      }
    });

    if (!Object.keys(settingsUpdate).length) {
      return res.status(400).json({ message: "No valid settings provided" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      currentUserId,
      { $set: settingsUpdate },
      { new: true, runValidators: true }
    ).select("settings");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json(updatedUser.settings || {});
  } catch (err) {
    return res.status(500).json({ message: "Error updating settings" });
  }
});

// GET NOTIFICATION HISTORY (Protected)
router.get("/notifications/history", verifyToken, async (req, res) => {
  try {
    const currentUserId = getUserIdFromPayload(req.payload);
    const user = await User.findById(currentUserId).select("notificationHistory");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json(user.notificationHistory || []);
  } catch (err) {
    return res.status(500).json({ message: "Error fetching notification history" });
  }
});

// CLEAR NOTIFICATION HISTORY (Protected)
router.delete("/notifications/history", verifyToken, async (req, res) => {
  try {
    const currentUserId = getUserIdFromPayload(req.payload);
    await User.findByIdAndUpdate(currentUserId, { $set: { notificationHistory: [] } });
    return res.json({ message: "Notification history cleared" });
  } catch (err) {
    return res.status(500).json({ message: "Error clearing notification history" });
  }
});

// GET CONCERT WISHLIST (Protected)
router.get("/concert-wishlist", verifyToken, async (req, res) => {
  try {
    const currentUserId = getUserIdFromPayload(req.payload);
    const user = await User.findById(currentUserId).select("concertWishlist");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json(user.concertWishlist || []);
  } catch (err) {
    return res.status(500).json({ message: "Error fetching wishlist" });
  }
});

// ADD CONCERT TO WISHLIST (Protected)
router.post("/concert-wishlist", verifyToken, async (req, res) => {
  try {
    const currentUserId = getUserIdFromPayload(req.payload);
    const concertId = String(req.body?.concertId || "").trim();
    const name = String(req.body?.name || "").trim();

    if (!concertId || !name) {
      return res.status(400).json({ message: "concertId and name are required" });
    }

    const user = await User.findById(currentUserId).select("concertWishlist");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const exists = (user.concertWishlist || []).some((item) => String(item.concertId) === concertId);
    if (exists) {
      return res.status(400).json({ message: "Concert already saved" });
    }

    await User.findByIdAndUpdate(currentUserId, {
      $push: {
        concertWishlist: {
          concertId,
          name,
          image: req.body?.image || null,
          date: req.body?.date || null,
          city: req.body?.city || "",
          venue: req.body?.venue || "",
          url: req.body?.url || "",
          savedAt: new Date()
        }
      }
    });

    const updated = await User.findById(currentUserId).select("concertWishlist");
    return res.json(updated?.concertWishlist || []);
  } catch (err) {
    return res.status(500).json({ message: "Error saving concert" });
  }
});

// REMOVE CONCERT FROM WISHLIST (Protected)
router.delete("/concert-wishlist/:concertId", verifyToken, async (req, res) => {
  try {
    const currentUserId = getUserIdFromPayload(req.payload);
    const concertId = String(req.params?.concertId || "").trim();
    await User.findByIdAndUpdate(currentUserId, { $pull: { concertWishlist: { concertId } } });

    const updated = await User.findById(currentUserId).select("concertWishlist");
    return res.json(updated?.concertWishlist || []);
  } catch (err) {
    return res.status(500).json({ message: "Error removing concert" });
  }
});

// SEARCH USERS (Protected)
router.get("/search", verifyToken, searchLimiter, async (req, res) => {
  try {
    const currentUserId = getUserIdFromPayload(req.payload);
    const query = String(req.query.q || "").trim();
    const genre = String(req.query.genre || "").trim().toLowerCase();

    if (!query && !genre) {
      return res.json([]);
    }

    const searchFilter = {
      _id: { $ne: currentUserId }
    };

    // Add query-based search if provided
    if (query) {
      const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      searchFilter.$or = [{ username: regex }, { email: regex }];
    }

    // Add genre filter if provided
    if (genre) {
      searchFilter.musicGenre = genre;
    }

    const currentUser = await User.findById(currentUserId).select("friends friendRequests sentFriendRequests blockedUsers");
    const friendIds = new Set((currentUser?.friends || []).map((id) => String(id)));
    const sentIds = new Set((currentUser?.sentFriendRequests || []).map((id) => String(id)));
    const requestFromIds = new Set((currentUser?.friendRequests || []).map((id) => String(id)));
    const blockedIds = new Set((currentUser?.blockedUsers || []).map((id) => String(id)));

    // Filter out blocked users from search results
    const users = await User.find(searchFilter)
      .select("_id username email imageUrl instagramUrl spotifyUrl bio musicGenre")
      .limit(12);

    const withFriendStatus = users
      .filter((user) => !blockedIds.has(String(user._id)))
      .map((user) => {
        const userData = user.toObject();
        userData.email = maskEmail(userData.email);

        return {
          ...userData,
          isFriend: friendIds.has(String(user._id)),
          friendRequestStatus: friendIds.has(String(user._id))
            ? "friends"
            : sentIds.has(String(user._id))
              ? "sent"
              : requestFromIds.has(String(user._id))
                ? "received"
                : "none",
        };
      });

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
router.get("/friends", verifyToken, async (req, res) => {
  try {
    const currentUserId = getUserIdFromPayload(req.payload);
    const currentUser = await User.findById(currentUserId)
      .populate("friends", "_id username imageUrl lastSeen")
      .select("friends");

    if (!currentUser) {
      return res.status(404).json({ message: "Current user not found" });
    }

    const friends = (currentUser.friends || []).map((friend) => {
      const isOnline = presenceStore.isOnline(friend._id);
      return {
        _id: friend._id,
        username: friend.username,
        imageUrl: friend.imageUrl,
        isOnline,
        lastSeen: friend.lastSeen ? new Date(friend.lastSeen).getTime() : null,
      };
    });

    return res.json(friends);
  } catch (err) {
    return res.status(500).json({ message: "Error fetching friends" });
  }
});

// GET USER PUBLIC PROFILE (Protected)
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const currentUserId = getUserIdFromPayload(req.payload);
    const currentUser = await User.findById(currentUserId).select("friends friendRequests sentFriendRequests blockedUsers");
    if (!currentUser) {
      return res.status(404).json({ message: "Current user not found" });
    }

    const user = await User.findById(req.params.id).select("_id username email imageUrl instagramUrl spotifyUrl bio");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const targetId = String(user._id);
    const isFriend = currentUser.friends.some((friendId) => String(friendId) === targetId);
    const isBlocked = (currentUser.blockedUsers || []).some((id) => String(id) === targetId);
    const friendRequestStatus = getFriendRequestStatus(currentUser, targetId);
    const profile = user.toObject();
    profile.email = maskEmail(profile.email);

    res.json({ ...profile, isFriend, friendRequestStatus, isBlocked });
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

    const targetUser = await User.findById(targetUserId).select("friendRequests settings");
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (targetUser?.settings?.allowFriendRequests === false) {
      return res.status(403).json({ message: "This user is not accepting friend requests" });
    }

    const currentUser = await User.findById(currentUserId).select("friends sentFriendRequests username imageUrl");
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
    await appendNotification(targetUserId, {
      type: "friend-request",
      title: "New friend request",
      body: `${currentUser.username} sent you a friend request.`
    });

    // Emit socket event to target user
    socketInstance.getIo()?.to(`notifications:${targetUserId}`).emit("friend-request:new", {
      _id: currentUserId,
      username: currentUser.username,
      imageUrl: currentUser.imageUrl,
    });

    res.json({ message: "Friend request sent" });
  } catch (err) {
    res.status(500).json({ message: "Error sending friend request" });
  }
});

// UNFRIEND USER (Protected)
router.post("/:id/unfriend", verifyToken, async (req, res) => {
  try {
    const currentUserId = getUserIdFromPayload(req.payload);
    const targetUserId = String(req.params.id || "").trim();

    if (!targetUserId) {
      return res.status(400).json({ message: "Target user is required" });
    }

    if (currentUserId === targetUserId) {
      return res.status(400).json({ message: "You cannot unfriend yourself" });
    }

    const currentUser = await User.findById(currentUserId).select("friends");
    const targetUser = await User.findById(targetUserId).select("friends");

    if (!currentUser || !targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    await User.findByIdAndUpdate(currentUserId, { $pull: { friends: targetUserId } });
    await User.findByIdAndUpdate(targetUserId, { $pull: { friends: currentUserId } });

    res.json({ message: "Friend removed" });
  } catch (err) {
    res.status(500).json({ message: "Error removing friend" });
  }
});

// BLOCK USER (Protected)
router.post("/:id/block", verifyToken, async (req, res) => {
  try {
    const currentUserId = getUserIdFromPayload(req.payload);
    const targetUserId = String(req.params.id || "").trim();

    if (!targetUserId) {
      return res.status(400).json({ message: "Target user is required" });
    }

    if (currentUserId === targetUserId) {
      return res.status(400).json({ message: "You cannot block yourself" });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const currentUser = await User.findById(currentUserId).select("blockedUsers friends");
    if (!currentUser) {
      return res.status(404).json({ message: "Current user not found" });
    }

    const isBlocked = (currentUser.blockedUsers || []).some((id) => String(id) === targetUserId);
    if (isBlocked) {
      return res.status(400).json({ message: "User is already blocked" });
    }

    // Block user
    await User.findByIdAndUpdate(currentUserId, { $addToSet: { blockedUsers: targetUserId } });

    // Remove from friends if they were friends
    if (currentUser.friends?.some((id) => String(id) === targetUserId)) {
      await User.findByIdAndUpdate(currentUserId, { $pull: { friends: targetUserId } });
      await User.findByIdAndUpdate(targetUserId, { $pull: { friends: currentUserId } });
    }

    res.json({ message: "User blocked" });
  } catch (err) {
    res.status(500).json({ message: "Error blocking user" });
  }
});

// UNBLOCK USER (Protected)
router.post("/:id/unblock", verifyToken, async (req, res) => {
  try {
    const currentUserId = getUserIdFromPayload(req.payload);
    const targetUserId = String(req.params.id || "").trim();

    if (!targetUserId) {
      return res.status(400).json({ message: "Target user is required" });
    }

    if (currentUserId === targetUserId) {
      return res.status(400).json({ message: "You cannot unblock yourself" });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const currentUser = await User.findById(currentUserId).select("blockedUsers");
    if (!currentUser) {
      return res.status(404).json({ message: "Current user not found" });
    }

    const isBlocked = (currentUser.blockedUsers || []).some((id) => String(id) === targetUserId);
    if (!isBlocked) {
      return res.status(400).json({ message: "User is not blocked" });
    }

    // Unblock user
    await User.findByIdAndUpdate(currentUserId, { $pull: { blockedUsers: targetUserId } });

    res.json({ message: "User unblocked" });
  } catch (err) {
    res.status(500).json({ message: "Error unblocking user" });
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

    const currentUser = await User.findById(currentUserId).select("friendRequests username imageUrl");
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
      socketInstance.getIo()?.to(`notifications:${requesterId}`).emit("friend-request:accepted", {
        userId: currentUserId,
        username: currentUser.username,
        imageUrl: currentUser.imageUrl,
      });
      
      return res.json({ message: "Friend request accepted" });
    }

    // Emit socket event to requester for decline
    socketInstance.getIo()?.to(`notifications:${requesterId}`).emit("friend-request:declined", {
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

    const [targetUser, group, currentUser] = await Promise.all([
      User.findById(targetUserId).select("_id groupInvites"),
      Group.findById(groupId),
      User.findById(currentUserId).select("_id username"),
    ]);

    if (!targetUser) {
      return res.status(404).json({ message: "Target user not found" });
    }

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (!currentUser) {
      return res.status(404).json({ message: "Current user not found" });
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
    await appendNotification(targetUserId, {
      type: "group-invite",
      title: "Private group invite",
      body: `${currentUser.username} invited you to ${group.name}.`
    });

    // Emit socket event to target user
    socketInstance.getIo()?.to(`notifications:${targetUserId}`).emit("group-invite:new", {
      groupId: groupId,
      groupName: group.name,
      invitedBy: currentUserId,
      inviterName: currentUser?.username,
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
      socketInstance.getIo()?.to(`notifications:${inviterId}`).emit("group-invite:accepted", {
        userId: currentUserId,
        groupId: groupId,
      });
    } else {
      // Emit socket event to inviter for decline
      socketInstance.getIo()?.to(`notifications:${inviterId}`).emit("group-invite:declined", {
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
