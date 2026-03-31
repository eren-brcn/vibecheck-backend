const { Schema, model } = require("mongoose");

const userSchema = new Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  imageUrl: { type: String, default: null },
  instagramUrl: { type: String, default: null },
  spotifyUrl: { type: String, default: null },
  friends: [{ type: Schema.Types.ObjectId, ref: "User" }],
  friendRequests: [{ type: Schema.Types.ObjectId, ref: "User" }],
  sentFriendRequests: [{ type: Schema.Types.ObjectId, ref: "User" }],
  groupInvites: [
    {
      group: { type: Schema.Types.ObjectId, ref: "MeetupGroup", required: true },
      invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
      createdAt: { type: Date, default: Date.now }
    }
  ]
});

module.exports = model("User", userSchema);