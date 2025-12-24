require('dotenv').config();
const cloudbetAPI = require('./src/services/cloudbetAPI');

/**
 * Debug Cloudbet event date format
 */
async function debugDates() {
  console.log('DEBUG: Cloudbet Event Date Format\n');
  console.log('='.repeat(80) + '\n');

  try {
    const result = await cloudbetAPI.getSportEvents('soccer');

    console.log(`Total Events: ${result.events.length}\n`);

    // Check first 5 events
    console.log('First 5 Events with Date Information:\n');

    for (let i = 0; i < Math.min(5, result.events.length); i++) {
      const event = result.events[i];
      console.log(`${i + 1}. ${event.home} vs ${event.away}`);
      console.log(`   Competition: ${event.competition?.name || 'Unknown'}`);
      console.log(`   Status: ${event.status}`);
      console.log(`   Raw 'starts' value: ${event.starts}`);
      console.log(`   Type of 'starts': ${typeof event.starts}`);
      console.log(`   Parsed Date: ${new Date(event.starts)}`);
      console.log(`   ISO String: ${new Date(event.starts).toISOString()}`);
      console.log(`   All event keys: ${Object.keys(event).join(', ')}`);
      console.log('');
    }

    // Check if there's a Premier League event
    const eplEvent = result.events.find(e => e.competition?.name === 'Premier League');
    if (eplEvent) {
      console.log('Sample Premier League Event (Full Object):');
      console.log(JSON.stringify(eplEvent, null, 2));
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

debugDates();
