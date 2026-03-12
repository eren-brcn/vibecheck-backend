const { Schema, model } = require("mongoose");

const meetupGroupSchema = new Schema({
  name: String,
  description: String,
  organiser: { type: Schema.Types.ObjectId, ref: "User" },
  members: [{ type: Schema.Types.ObjectId, ref: "User" }],
  category: {
    type: String,
    enum: ["rock", "pop", "hip-hop", "jazz", "classical", "electronic", "other"]
  },
  imageUrl: String 
});

meetupGroupSchema.virtual("organizer").get(function () {
  return this.organiser;
});

meetupGroupSchema.set("toJSON", { virtuals: true });
meetupGroupSchema.set("toObject", { virtuals: true });

module.exports = model("MeetupGroup", meetupGroupSchema);