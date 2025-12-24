require('dotenv').config();
const multiBookmakerAggregator = require('./src/services/multiBookmakerOddsAggregator');
const advancedBettingStrategy = require('./src/services/advancedBettingStrategy');
const cloudbetAPI = require('./src/services/cloudbetAPI');
const logger = require('./src/utils/logger');

/**
 * DRY RUN - Test the production bot logic WITHOUT placing actual bets
 */
async function dryRun() {
  console.log('\n' + '='.repeat(80));
  console.log('PRODUCTION BOT DRY RUN - NO BETS WILL BE PLACED');
  console.log('='.repeat(80) + '\n');

  try {
    // Test configuration
    const sports = [
      'ice-hockey',
      'basketball',
      'american-football',
      'soccer'
    ];
    const maxBetsPerDay = parseInt(process.env.MAX_BETS_PER_DAY) || 5;

    console.log('Configuration:');
    console.log(`  Sports: ${sports.join(', ')}`);
    console.log(`  Max bets per day: ${maxBetsPerDay}\n`);

    // Get bankroll
    console.log('Fetching account balance...');
    const balance = await cloudbetAPI.getBalance();
    const bankroll = parseFloat(balance.amount || balance.available) || 0;
    console.log(`✅ Bankroll: ${bankroll} ${process.env.CLOUDBET_CURRENCY}\n`);

    if (bankroll === 0) {
      console.error('❌ Zero bankroll - cannot proceed\n');
      return;
    }

    // Collect opportunities from all sports
    console.log('Scanning all sports for opportunities...\n');
    const allOpportunities = [];

    for (const sport of sports) {
      console.log(`📊 Scanning ${sport}...`);
      const opportunities = await multiBookmakerAggregator.findOpportunities(sport);
      console.log(`   Found ${opportunities.length} opportunities\n`);

      if (opportunities.length > 0) {
        allOpportunities.push(...opportunities);
      }
    }

    console.log('='.repeat(80));
    console.log(`Total opportunities across all sports: ${allOpportunities.length}`);
    console.log('='.repeat(80) + '\n');

    // Sort by start time
    console.log('Sorting opportunities by start time (nearest first)...\n');
    allOpportunities.sort((a, b) => {
      const timeA = new Date(a.starts || a.cutoffTime);
      const timeB = new Date(b.starts || b.cutoffTime);
      return timeA - timeB;
    });

    if (allOpportunities.length === 0) {
      console.log('⚠️  No opportunities found\n');
      return;
    }

    const now = new Date();
    console.log('='.repeat(80));
    console.log('OPPORTUNITIES THAT WOULD BE EVALUATED (IN ORDER)');
    console.log('='.repeat(80));
    console.log(`Current time: ${now.toLocaleString()}\n`);

    // Show first 20 opportunities and evaluate them
    let approvedBets = 0;
    const currentExposure = 0;

    for (let i = 0; i < Math.min(20, allOpportunities.length); i++) {
      const opp = allOpportunities[i];
      const startTime = new Date(opp.starts || opp.cutoffTime);
      const hoursAway = (startTime - now) / (1000 * 60 * 60);

      console.log(`\n${i + 1}. ${opp.home} vs ${opp.away}`);
      console.log(`   Sport: ${opp.sport}`);
      console.log(`   Side: ${opp.side} @ ${opp.cloudbetOdds}`);
      console.log(`   Starts: ${startTime.toLocaleString()} (${hoursAway.toFixed(1)}h away)`);
      console.log(`   Bookmakers: ${opp.totalBookmakers} | Sharp books: ${opp.sharpBookCount}`);

      // Evaluate the bet
      try {
        const evaluation = await advancedBettingStrategy.evaluateBet(
          opp,
          bankroll,
          currentExposure
        );

        if (evaluation) {
          approvedBets++;
          console.log(`   ✅ APPROVED - Edge: ${evaluation.edge.toFixed(2)}% | Bet size: ${evaluation.betSize.toFixed(2)} ${process.env.CLOUDBET_CURRENCY}`);
          console.log(`   💰 Expected value: +${evaluation.expectedValue.toFixed(2)} ${process.env.CLOUDBET_CURRENCY}`);

          if (approvedBets >= maxBetsPerDay) {
            console.log(`\n   ⚠️  Daily bet limit (${maxBetsPerDay}) would be reached here`);
            break;
          }
        } else {
          console.log(`   ❌ REJECTED - Did not pass evaluation criteria`);
        }
      } catch (error) {
        console.log(`   ⚠️  Error evaluating: ${error.message}`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('DRY RUN SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total opportunities found: ${allOpportunities.length}`);
    console.log(`Opportunities evaluated: ${Math.min(20, allOpportunities.length)}`);
    console.log(`Bets that would be placed: ${approvedBets}`);
    console.log(`Daily limit: ${maxBetsPerDay}`);
    console.log('');

    if (allOpportunities.length > 0) {
      const firstEvent = allOpportunities[0];
      const firstStart = new Date(firstEvent.starts || firstEvent.cutoffTime);
      const lastEvent = allOpportunities[allOpportunities.length - 1];
      const lastStart = new Date(lastEvent.starts || lastEvent.cutoffTime);

      console.log(`Earliest event: ${firstEvent.home} vs ${firstEvent.away}`);
      console.log(`  Sport: ${firstEvent.sport}`);
      console.log(`  Time: ${firstStart.toLocaleString()}`);
      console.log('');
      console.log(`Latest event: ${lastEvent.home} vs ${lastEvent.away}`);
      console.log(`  Sport: ${lastEvent.sport}`);
      console.log(`  Time: ${lastStart.toLocaleString()}`);
    }

    console.log('='.repeat(80));
    console.log('✅ DRY RUN COMPLETE - No bets were placed');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error during dry run:', error.message);
    console.error(error.stack);
  }
}

dryRun();
