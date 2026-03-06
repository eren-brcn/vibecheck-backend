const router = require("express").Router();
const MeetupGroup = require("../models/MeetupGroup.model");

// POST /api/groups - Create a new squad
router.post("/", (req, res) => {
  const { name, description, organiser } = req.body;

  MeetupGroup.create({ name, description, organiser, members: [organiser] })
    .then((newGroup) => {
      console.log("Group created");
      res.status(201).json(newGroup);
    })
    .catch((err) => {
      console.log("Group creation error:", err);
      res.status(500).json(err);
    });
});

// POST /api/groups/:groupId/join - Add user to group
router.post("/:groupId/join", (req, res) => {
  const { groupId } = req.params;
  const { userId } = req.body;

  MeetupGroup.findByIdAndUpdate(groupId, { $addToSet: { members: userId } }, { new: true })
    .then((updatedGroup) => {
      console.log("User joined group");
      res.json(updatedGroup);
    })
    .catch((err) => {
      console.log("Join error:", err);
      res.status(500).json(err);
    });
});

// POST /api/groups/:groupId/leave - Remove user from group
router.post("/:groupId/leave", (req, res) => {
  const { groupId } = req.params;
  const { userId } = req.body;

  MeetupGroup.findByIdAndUpdate(groupId, { $pull: { members: userId } }, { new: true })
    .then((updatedGroup) => {
      console.log("User left group");
      res.json(updatedGroup);
    })
    .catch((err) => {
      console.log("Leave error:", err);
      res.status(500).json(err);
    });
});

module.exports = router;