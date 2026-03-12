const { Schema, model } = require("mongoose");

const messageSchema = new Schema(
  {
    content: { type: String, required: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // Make groupId optional to allow dm and group messages
    groupId: { type: Schema.Types.ObjectId, ref: "MeetupGroup", default: null },
    recipientId: { type: Schema.Types.ObjectId, ref: "User", default: null }
  },
  { timestamps: true }
);

module.exports = model("Message", messageSchema);