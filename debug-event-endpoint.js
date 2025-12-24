require('dotenv').config();
const cloudbetAPI = require('./src/services/cloudbetAPI');

/**
 * Debug /events/{eventId} endpoint to see if date is there
 */
async function debugEventEndpoint() {
  console.log('DEBUG: Cloudbet /events/{eventId} Endpoint\n');
  console.log('='.repeat(80) + '\n');

  try {
    // First get an event ID
    const result = await cloudbetAPI.getSportEvents('soccer');
    const matchEvent = result.events.find(e => e.home && e.away);

    if (matchEvent) {
      console.log(`Testing with event: ${matchEvent.home} vs ${matchEvent.away}`);
      console.log(`Event ID: ${matchEvent.id || matchEvent.eventId}\n`);

      // Get detailed event data
      const eventData = await cloudbetAPI.getEventOdds(matchEvent.id || matchEvent.eventId);

      console.log('Event data keys:', Object.keys(eventData).join(', '));
      console.log('\nFull event data:\n');
      console.log(JSON.stringify(eventData, null, 2).substring(0, 2000));
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

debugEventEndpoint();
