const router = require("express").Router();
const axios = require("axios");

router.get("/search/:city", (req, res) => {
  const { city } = req.params;
  const apiKey = process.env.TICKETMASTER_KEY;

  console.log("Searching Ticketmaster for city:", city);

  axios.get(`https://app.ticketmaster.com/discovery/v2/events.json?city=${city}&classificationName=music&apikey=${apiKey}`)
    .then(response => {
      const events = response.data._embedded ? response.data._embedded.events : [];
      console.log("Found events:", events.length);
      res.json(events);
    })
    .catch(err => {
      console.log("Ticketmaster Error:", err.message);
      res.status(500).json({ error: "Could not fetch concerts" });
    });
});

module.exports = router;