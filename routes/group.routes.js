const router = require("express").Router();
const MeetupGroup = require("../models/MeetupGroup.model");

// POST /api/groups - Create a squad
router.post("/", (req, res) => {
  const { name, description, organiser } = req.body;

  MeetupGroup.create({ name, description, organiser, members: [organiser] })
    .then((newGroup) => {
      console.log("SUCCESS: Group created");
      res.status(201).json(newGroup);
    })
    .catch((err) => {
      console.log("ERROR: Group creation failed");
      console.log(err);
      res.status(500).json(err);
    });
});

module.exports = router;