const { Schema, model } = require("mongoose");

const messageSchema = new Schema({
  content: { type: String, required: true },
  author: { type: Schema.Types.ObjectId, ref: "User" },
  groupId: { type: Schema.Types.ObjectId, ref: "MeetupGroup" }
}, { timestamps: true });

module.exports = model("Message", messageSchema);