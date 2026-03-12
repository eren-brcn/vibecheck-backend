const router = require("express").Router();

router.get("/", (req, res) => res.json("All good!"));

router.use("/auth", require("./auth.routes"));
router.use("/groups", require("./group.routes"));
router.use("/concerts", require("./concert.routes")); 
router.use("/messages", require("./message.routes"));

module.exports = router;