const test = require("node:test");
const assert = require("node:assert/strict");
const { buildConcertParams } = require("../utils/concert-query");

test("buildConcertParams maps filters to ticketmaster params", () => {
  const params = buildConcertParams({
    country: "US",
    city: "Austin",
    keyword: "rock",
    startDate: "2026-04-01",
    endDate: "2026-04-30",
    apiKey: "abc"
  });

  assert.equal(params.countryCode, "US");
  assert.equal(params.city, "Austin");
  assert.equal(params.keyword, "rock");
  assert.equal(params.startDateTime, "2026-04-01T00:00:00Z");
  assert.equal(params.endDateTime, "2026-04-30T23:59:59Z");
  assert.equal(params.classificationName, "music");
  assert.equal(params.sort, "date,asc");
});
