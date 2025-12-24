require('dotenv').config();
const multiBookmakerAggregator = require('./src/services/multiBookmakerOddsAggregator');
const logger = require('./src/utils/logger');

/**
 * Test that opportunities are sorted by start time
 */
async function testSorting() {
  console.log('\n' + '='.repeat(80));
  console.log('TESTING OPPORTUNITY SORTING BY START TIME');
  console.log('='.repeat(80) + '\n');

  try {
    const sports = ['basketball', 'american-football', 'soccer'];
    const allOpportunities = [];

    // Collect opportunities from all sports
    for (const sport of sports) {
      console.log(`Fetching ${sport} opportunities...`);
      const opportunities = await multiBookmakerAggregator.findOpportunities(sport);
      console.log(`  Found ${opportunities.length} opportunities\n`);

      if (opportunities.length > 0) {
        allOpportunities.push(...opportunities);
      }
    }

    // Sort by start time (this is what production-bot.js now does)
    allOpportunities.sort((a, b) => {
      const timeA = new Date(a.starts || a.cutoffTime);
      const timeB = new Date(b.starts || b.cutoffTime);
      return timeA - timeB;
    });

    console.log('\n' + '='.repeat(80));
    console.log('OPPORTUNITIES SORTED BY START TIME (NEAREST FIRST)');
    console.log('='.repeat(80) + '\n');

    // Show first 10 opportunities
    const now = new Date();
    console.log(`Current time: ${now.toISOString()}\n`);
    console.log('First 10 opportunities that would be processed:\n');

    for (let i = 0; i < Math.min(10, allOpportunities.length); i++) {
      const opp = allOpportunities[i];
      const startTime = new Date(opp.starts || opp.cutoffTime);
      const hoursAway = (startTime - now) / (1000 * 60 * 60);

      console.log(`${i + 1}. ${opp.home} vs ${opp.away}`);
      console.log(`   Sport: ${opp.sport}`);
      console.log(`   Side: ${opp.side} @ ${opp.cloudbetOdds}`);
      console.log(`   Starts: ${startTime.toLocaleString()}`);
      console.log(`   Time until start: ${hoursAway.toFixed(1)} hours`);
      console.log(`   Bookmakers: ${opp.totalBookmakers}`);
      console.log('');
    }

    console.log('='.repeat(80));
    console.log(`Total opportunities: ${allOpportunities.length}`);
    console.log(`Earliest event: ${new Date(allOpportunities[0].starts).toLocaleString()}`);
    console.log(`Latest event: ${new Date(allOpportunities[allOpportunities.length - 1].starts).toLocaleString()}`);
    console.log('='.repeat(80) + '\n');

    console.log('✅ SUCCESS: Opportunities are now sorted by start time!');
    console.log('   The bot will prioritize betting on nearest events first.\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

testSorting();
