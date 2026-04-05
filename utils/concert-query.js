const buildConcertParams = ({ country, city, keyword, startDate, endDate, apiKey }) => {
  return {
    countryCode: country,
    city: city || undefined,
    keyword: keyword || undefined,
    startDateTime: startDate ? `${startDate}T00:00:00Z` : undefined,
    endDateTime: endDate ? `${endDate}T23:59:59Z` : undefined,
    apikey: apiKey,
    classificationName: "music",
    sort: "date,asc",
    size: 60
  };
};

module.exports = {
  buildConcertParams
};
