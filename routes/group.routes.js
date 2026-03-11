const router = require("express").Router();
const Group = require("../models/MeetupGroup.model");
const { verifyToken } = require("../middlewares/auth.middlewares");

// 1. GET ALL GROUPS (Public)
router.get("/", async (req, res) => {
  try {
    const allGroups = await Group.find();
    res.json(allGroups);
  } catch (err) {
    res.status(500).json({ message: "Error fetching groups" });
  }
});

// 2. CREATE GROUP (Protected)
router.post("/", verifyToken, async (req, res) => {
  const { name } = req.body;
  try {
    const newGroup = await Group.create({ name });
    res.status(201).json(newGroup);
  } catch (err) {
    res.status(400).json({ message: "Error creating group" });
  }
});

// 3. JOIN GROUP (Protected)
router.put("/join/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  
const userId = req.payload.id;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized: No user ID found in token" });
  }

  try {
    const updated = await Group.findByIdAndUpdate(
      id,
      { $addToSet: { members: userId } },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: "Error joining group" });
  }
});

module.exports = router;