const router = require("express").Router();
const axios = require("axios");

router.get("/search/:city", (req, res) => {
  const { city } = req.params;
  const apiKey = process.env.TICKETMASTER_KEY;

  // We add a timeout and a specific User-Agent to help the request go through
  axios.get(`https://app.ticketmaster.com/discovery/v2/events.json`, {
    params: {
      city: city,
      classificationName: 'music',
      apikey: apiKey
    }
  })
  .then(response => {
    const events = response.data._embedded ? response.data._embedded.events : [];
    console.log(` Success! Found ${events.length} concerts in ${city}`);
    res.json(events);
  })
  .catch(err => {
    // This will print the REAL error in your VS Code terminal
    console.log("Ticketmaster API Detail:", err.response ? err.response.data : err.message);
    res.status(500).json({ error: "Could not fetch concerts", details: err.message });
  });
});

module.exports = router;