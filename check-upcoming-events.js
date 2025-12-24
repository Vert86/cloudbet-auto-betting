require('dotenv').config();
const cloudbetAPI = require('./src/services/cloudbetAPI');

async function checkUpcomingEvents() {
  console.log('CLOUDBET GAMES AVAILABLE - Dec 24, 2025\n');

  const sports = ['basketball', 'ice-hockey', 'american-football'];

  for (const sport of sports) {
    try {
      const events = await cloudbetAPI.getEvents(sport);
      console.log(`${sport}: ${events.length} total games`);

      if (events.length > 0) {
        console.log('  Sample games:');
        events.slice(0, 3).forEach(e => {
          console.log(`    - ${e.home} vs ${e.away}`);
        });
      }
      console.log();
    } catch (error) {
      console.log(`${sport}: Error - ${error.message}\n`);
    }
  }
}

checkUpcomingEvents().catch(console.error);
