require('dotenv').config();
const multiBookmakerAggregator = require('./src/services/multiBookmakerOddsAggregator');

async function testTodaysEvents() {
  console.log('Testing for events happening today...\n');

  const sports = ['icehockey', 'basketball', 'american-football', 'soccer'];

  for (const sport of sports) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Sport: ${sport.toUpperCase()}`);
    console.log('='.repeat(60));

    try {
      const opportunities = await multiBookmakerAggregator.findOpportunities(sport);

      if (opportunities.length === 0) {
        console.log('No opportunities found.');
        continue;
      }

      // Group by event and time
      const eventMap = new Map();
      opportunities.forEach(opp => {
        const key = `${opp.home} vs ${opp.away}`;
        if (!eventMap.has(key)) {
          eventMap.set(key, {
            event: key,
            starts: opp.starts,
            opportunities: []
          });
        }
        eventMap.get(key).opportunities.push(opp);
      });

      const events = Array.from(eventMap.values());

      // Sort by time
      events.sort((a, b) => new Date(a.starts) - new Date(b.starts));

      console.log(`\nFound ${opportunities.length} opportunities across ${events.length} events\n`);

      // Show events happening in next 48 hours
      const now = new Date();
      const next48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

      const soonEvents = events.filter(e => {
        const eventTime = new Date(e.starts);
        return eventTime < next48h;
      });

      if (soonEvents.length > 0) {
        console.log(`✅ ${soonEvents.length} events in next 48 hours:\n`);

        soonEvents.slice(0, 10).forEach((e, i) => {
          const eventTime = new Date(e.starts);
          const hoursAway = (eventTime - now) / (1000 * 60 * 60);

          console.log(`${i + 1}. ${e.event}`);
          console.log(`   Starts: ${eventTime.toLocaleString()}`);
          console.log(`   Time: ${hoursAway.toFixed(1)} hours away`);
          console.log(`   Opportunities: ${e.opportunities.length}`);
          console.log('');
        });

        if (soonEvents.length > 10) {
          console.log(`... and ${soonEvents.length - 10} more events\n`);
        }
      } else {
        console.log('⚠️  No events in next 48 hours');
      }

    } catch (error) {
      console.error(`Error: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Summary: Bot will now scan these sports for daily action!');
  console.log('='.repeat(60));
}

testTodaysEvents();
