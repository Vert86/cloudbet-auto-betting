require('dotenv').config();
const axios = require('axios');
const config = require('./src/config/config');

/**
 * Debug raw Cloudbet API response
 */
async function debugRawAPI() {
  console.log('DEBUG: Raw Cloudbet API Response\n');
  console.log('='.repeat(80) + '\n');

  try {
    const feedClient = axios.create({
      baseURL: 'https://sports-api.cloudbet.com/pub/v2/odds',
      headers: {
        'X-API-Key': config.cloudbet.apiKey,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Get soccer sport structure
    const sportResp = await feedClient.get('/sports/soccer');
    const categories = sportResp.data.categories || [];

    // Get Premier League
    const allCompetitions = [];
    for (const category of categories) {
      if (category.competitions) {
        allCompetitions.push(...category.competitions);
      }
    }

    const premierLeague = allCompetitions.find(c => c.name.includes('Premier League'));

    if (premierLeague) {
      console.log(`Found competition: ${premierLeague.name}`);
      console.log(`Competition key: ${premierLeague.key}\n`);

      // Get events for Premier League
      const compResp = await feedClient.get(`/competitions/${premierLeague.key}`);
      const events = compResp.data.events || [];

      console.log(`Total events: ${events.length}\n`);

      if (events.length > 0) {
        // Find a match event (has home and away teams)
        const matchEvent = events.find(e => e.home && e.away);

        if (matchEvent) {
          console.log('Sample match event (RAW JSON):\n');
          console.log(JSON.stringify(matchEvent, null, 2));
        } else {
          console.log('No match events found, showing first event:\n');
          console.log(JSON.stringify(events[0], null, 2));
        }
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    console.error(error.stack);
  }
}

debugRawAPI();
