const { Schema, model } = require("mongoose");

const userSchema = new Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  deactivatedAt: { type: Date, default: null },
  imageUrl: { type: String, default: null },
  bio: { type: String, default: null, maxlength: 500 },
  musicGenre: { type: String, default: null },
  instagramUrl: { type: String, default: null },
  spotifyUrl: { type: String, default: null },
  lastSeen: { type: Date, default: Date.now },
  friends: [{ type: Schema.Types.ObjectId, ref: "User" }],
  friendRequests: [{ type: Schema.Types.ObjectId, ref: "User" }],
  sentFriendRequests: [{ type: Schema.Types.ObjectId, ref: "User" }],
  blockedUsers: [{ type: Schema.Types.ObjectId, ref: "User" }],
  settings: {
    allowFriendRequests: { type: Boolean, default: true },
    allowMessagesFromFriends: { type: Boolean, default: true },
    allowMessagesFromEveryone: { type: Boolean, default: false },
    notifyOnFriendRequest: { type: Boolean, default: true },
    notifyOnMessage: { type: Boolean, default: true },
    notifyOnGroupInvite: { type: Boolean, default: true },
    theme: { type: String, enum: ["dark", "light"], default: "dark" }
  },
  concertWishlist: [
    {
      concertId: { type: String, required: true },
      name: { type: String, required: true },
      image: { type: String, default: null },
      date: { type: String, default: null },
      city: { type: String, default: "" },
      venue: { type: String, default: "" },
      url: { type: String, default: "" },
      savedAt: { type: Date, default: Date.now }
    }
  ],
  groupInvites: [
    {
      group: { type: Schema.Types.ObjectId, ref: "MeetupGroup", required: true },
      invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
      createdAt: { type: Date, default: Date.now }
    }
  ]
});

module.exports = model("User", userSchema);