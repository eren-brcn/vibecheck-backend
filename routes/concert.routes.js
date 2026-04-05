const router = require("express").Router();
const axios = require("axios");
const { buildConcertParams } = require("../utils/concert-query");

// GET /api/concerts/search?country=TR&city=Ankara
router.get("/search", async (req, res) => {
  const { country, city, keyword, startDate, endDate } = req.query;
  const apiKey = process.env.TICKETMASTER_KEY;

  try {
    const response = await axios.get(`https://app.ticketmaster.com/discovery/v2/events.json`, {
      params: buildConcertParams({ country, city, keyword, startDate, endDate, apiKey })
    });

    // Return events or an empty array if none found
    res.json(response.data._embedded ? response.data._embedded.events : []);
  } catch (err) {
    console.error("Ticketmaster API Error:", err.message);
    res.status(500).json({ error: "Failed to fetch concert data" });
  }
});

module.exports = router;