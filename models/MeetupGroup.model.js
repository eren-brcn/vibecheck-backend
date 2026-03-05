const { Schema, model } = require("mongoose");

const meetupGroupSchema = new Schema({
  name: String,
  description: String,
  organiser: { type: Schema.Types.ObjectId, ref: "User" },
  members: [{ type: Schema.Types.ObjectId, ref: "User" }]
});

module.exports = model("MeetupGroup", meetupGroupSchema);