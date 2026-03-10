const router = require("express").Router();
const MeetupGroup = require("../models/MeetupGroup.model");

// GET ALL GROUPS
router.get("/", async (req, res) => {
  try {
    const allGroups = await MeetupGroup.find().populate("organiser members");
    res.json(allGroups);
  } catch (err) {
    res.status(500).json({ error: "Could not fetch groups" });
  }
});

// JOIN GROUP
router.post("/:groupId/join", async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId } = req.body;

    const updatedGroup = await MeetupGroup.findByIdAndUpdate(
      groupId,
      { $addToSet: { members: userId } },
      { new: true }
    );
    
    res.json(updatedGroup);
  } catch (err) {
    res.status(500).json({ error: "Join failed" });
  }
});
// LEAVE GROUP
router.post("/:groupId/leave", async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId } = req.body;

    const updatedGroup = await MeetupGroup.findByIdAndUpdate(
      groupId,
      { $pull: { members: userId } },
      { new: true }
    );

    res.json(updatedGroup);
  } catch (err) {
    res.status(500).json({ error: "Leave failed" });
  }
});

// UPDATE: Modify a group (e.g., name, description)
router.put("/:groupId", async (req, res) => {
  try {
    const updatedGroup = await MeetupGroup.findByIdAndUpdate(
      req.params.groupId, 
      req.body, 
      { new: true }
    );
    res.json(updatedGroup);
  } catch (err) {
    res.status(500).json({ error: "Update failed" });
  }
});

// DELETE: Remove a group
router.delete("/:groupId", async (req, res) => {
  try {
    await MeetupGroup.findByIdAndDelete(req.params.groupId);
    res.json({ message: "Group deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Delete failed" });
  }
});


module.exports = router;

