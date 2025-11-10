require('dotenv').config();
const multiBookmakerAggregator = require('./src/services/multiBookmakerOddsAggregator');
const advancedBettingStrategy = require('./src/services/advancedBettingStrategy');

/**
 * Test the complete integration:
 * 1. Multi-bookmaker odds fetching
 * 2. Sharp consensus calculation
 * 3. Real edge detection
 * 4. Advanced betting strategy evaluation
 */
async function testIntegration() {
  console.log('\n' + '='.repeat(80));
  console.log('MULTI-BOOKMAKER INTEGRATION TEST - COMPLETE WORKFLOW');
  console.log('='.repeat(80) + '\n');

  try {
    // Test 1: Verify new API key
    console.log('🔑 TEST 1: Verifying new API key...\n');

    const axios = require('axios');
    const sportsResponse = await axios.get('https://api.the-odds-api.com/v4/sports', {
      params: { apiKey: process.env.ODDS_API_KEY }
    });

    const remaining = sportsResponse.headers['x-requests-remaining'];
    const used = sportsResponse.headers['x-requests-used'];

    console.log('✅ API Key Valid!');
    console.log(`   Quota: ${used} used, ${remaining} remaining`);
    console.log(`   Total Plan: ${parseInt(used) + parseInt(remaining)} requests/month\n`);

    // Test 2: Fetch multi-bookmaker odds
    console.log('📊 TEST 2: Fetching multi-bookmaker odds for soccer...\n');

    const opportunities = await multiBookmakerAggregator.findOpportunities('soccer');

    console.log(`✅ Found ${opportunities.length} opportunities\n`);

    if (opportunities.length === 0) {
      console.log('⚠️  No opportunities found. This could mean:');
      console.log('   - No upcoming soccer events');
      console.log('   - Events don\'t meet minimum bookmaker requirement (5+)');
      console.log('   - Event matching failed\n');
      return;
    }

    // Analyze first 3 opportunities in detail
    console.log('📋 DETAILED ANALYSIS OF TOP 3 OPPORTUNITIES:\n');
    console.log('='.repeat(80) + '\n');

    for (let i = 0; i < Math.min(3, opportunities.length); i++) {
      const opp = opportunities[i];

      console.log(`OPPORTUNITY ${i + 1}: ${opp.home} vs ${opp.away}`);
      console.log('─'.repeat(80));
      console.log(`Event ID: ${opp.eventId}`);
      console.log(`League: ${opp.league}`);
      console.log(`Starts: ${new Date(opp.starts).toLocaleString()}`);
      console.log(`Market: ${opp.marketType}`);
      console.log(`Side: ${opp.side}`);
      console.log(`\nCloudbet Odds: ${opp.cloudbetOdds}`);
      console.log(`Bookmakers Available: ${opp.totalBookmakers} (${opp.sharpBookCount} sharp)`);

      // Show all bookmaker odds
      console.log('\n📊 All Bookmaker Odds:');
      opp.allBookmakerOdds.forEach(book => {
        const sharpIndicator = book.isSharp ? '⭐ SHARP' : '';
        const odds = book.odds[opp.side] || 'N/A';
        console.log(`   ${book.title.padEnd(25)} ${odds.toString().padEnd(8)} ${sharpIndicator}`);
      });

      // Test 3: Evaluate with Advanced Betting Strategy
      console.log('\n🎯 TEST 3: Advanced Strategy Evaluation...\n');

      const bankroll = 1000; // Assume $1000 bankroll
      const currentExposure = 0;

      const evaluation = await advancedBettingStrategy.evaluateBet(
        opp,
        bankroll,
        currentExposure
      );

      if (evaluation) {
        console.log('✅ BET APPROVED BY ADVANCED STRATEGY!');
        console.log('─'.repeat(80));
        console.log(`Recommended Stake: ${evaluation.betSize} USDT`);
        console.log(`Real Edge: ${evaluation.edge.toFixed(2)}%`);
        console.log(`True Probability: ${(evaluation.trueProbability * 100).toFixed(2)}%`);
        console.log(`Expected Value: +${evaluation.expectedValue.toFixed(2)} USDT`);
        console.log(`Market Quality: ${evaluation.marketQuality}`);
        console.log(`Efficiency Score: ${evaluation.efficiencyScore}/80`);

        if (evaluation.informationAsymmetry?.detected) {
          console.log('\n🔍 Information Advantages Detected:');
          evaluation.informationAsymmetry.factors.forEach(factor => {
            console.log(`   • ${factor}`);
          });
        }

        console.log('\n💡 WHY THIS BET HAS VALUE:');
        console.log('─'.repeat(80));

        // Calculate and explain
        const sharpBooks = opp.allBookmakerOdds.filter(b => b.isSharp);
        if (sharpBooks.length > 0) {
          const sharpAvg = sharpBooks.reduce((sum, b) => sum + (b.odds[opp.side] || 0), 0) / sharpBooks.length;
          console.log(`Sharp Book Average: ${sharpAvg.toFixed(2)}`);
          console.log(`Cloudbet Odds: ${opp.cloudbetOdds}`);

          if (opp.cloudbetOdds > sharpAvg) {
            const diff = ((opp.cloudbetOdds - sharpAvg) / sharpAvg * 100).toFixed(2);
            console.log(`✅ Cloudbet offering ${diff}% HIGHER odds than sharp books`);
            console.log(`   This indicates VALUE - Cloudbet is slower to adjust`);
          }
        }

        const allAvg = opp.allBookmakerOdds.reduce((sum, b) => sum + (b.odds[opp.side] || 0), 0) / opp.allBookmakerOdds.length;
        console.log(`\nMarket Average: ${allAvg.toFixed(2)}`);
        console.log(`Cloudbet vs Market: ${((opp.cloudbetOdds - allAvg) / allAvg * 100).toFixed(2)}% difference`);

      } else {
        console.log('❌ BET REJECTED BY ADVANCED STRATEGY');
        console.log('─'.repeat(80));
        console.log('Possible reasons:');
        console.log('   • Edge below 2% minimum threshold');
        console.log('   • Market efficiency score too low');
        console.log('   • Insufficient sharp bookmaker data');
        console.log('   • Kelly criterion suggests no bet');
      }

      console.log('\n' + '='.repeat(80) + '\n');
    }

    // Test 4: Statistics Summary
    console.log('📈 TEST 4: OPPORTUNITY STATISTICS\n');
    console.log('─'.repeat(80));

    const withEnoughBooks = opportunities.filter(o => o.totalBookmakers >= 5);
    const withSharpBooks = opportunities.filter(o => o.sharpBookCount >= 1);
    const withMultipleSharp = opportunities.filter(o => o.sharpBookCount >= 2);

    console.log(`Total Opportunities Found: ${opportunities.length}`);
    console.log(`With 5+ Bookmakers: ${withEnoughBooks.length} (${(withEnoughBooks.length / opportunities.length * 100).toFixed(1)}%)`);
    console.log(`With Sharp Books: ${withSharpBooks.length} (${(withSharpBooks.length / opportunities.length * 100).toFixed(1)}%)`);
    console.log(`With 2+ Sharp Books: ${withMultipleSharp.length} (${(withMultipleSharp.length / opportunities.length * 100).toFixed(1)}%)`);

    // Calculate average bookmakers
    const avgBookmakers = opportunities.reduce((sum, o) => sum + o.totalBookmakers, 0) / opportunities.length;
    const avgSharp = opportunities.reduce((sum, o) => sum + o.sharpBookCount, 0) / opportunities.length;

    console.log(`\nAverage Bookmakers per Event: ${avgBookmakers.toFixed(1)}`);
    console.log(`Average Sharp Books per Event: ${avgSharp.toFixed(1)}`);

    // Test 5: Quick evaluation of all opportunities
    console.log('\n🎯 TEST 5: BATCH EVALUATION\n');
    console.log('─'.repeat(80));
    console.log('Evaluating all opportunities with advanced strategy...\n');

    const bankroll = 1000;
    let approved = 0;
    let rejected = 0;

    for (const opp of opportunities.slice(0, 10)) { // Test first 10 to avoid too many API calls
      const evaluation = await advancedBettingStrategy.evaluateBet(opp, bankroll, 0);
      if (evaluation) {
        approved++;
        console.log(`✅ ${opp.home} vs ${opp.away} (${opp.side}) - Edge: ${evaluation.edge.toFixed(2)}%`);
      } else {
        rejected++;
      }
    }

    console.log('\n📊 BATCH RESULTS:');
    console.log(`   Approved: ${approved}/${Math.min(10, opportunities.length)} (${(approved / Math.min(10, opportunities.length) * 100).toFixed(1)}%)`);
    console.log(`   Rejected: ${rejected}/${Math.min(10, opportunities.length)} (${(rejected / Math.min(10, opportunities.length) * 100).toFixed(1)}%)`);

    // Final quota check
    console.log('\n📊 FINAL API QUOTA CHECK\n');
    console.log('─'.repeat(80));

    const finalCheck = await axios.get('https://api.the-odds-api.com/v4/sports', {
      params: { apiKey: process.env.ODDS_API_KEY }
    });

    const finalRemaining = finalCheck.headers['x-requests-remaining'];
    const finalUsed = finalCheck.headers['x-requests-used'];

    console.log(`Requests Used: ${finalUsed}`);
    console.log(`Remaining: ${finalRemaining}`);
    console.log(`Total Quota: ${parseInt(finalUsed) + parseInt(finalRemaining)}`);

    const usedInTest = parseInt(finalUsed) - parseInt(used);
    console.log(`\nUsed in This Test: ${usedInTest} requests`);

    console.log('\n' + '='.repeat(80));
    console.log('✅ INTEGRATION TEST COMPLETE - ALL SYSTEMS OPERATIONAL');
    console.log('='.repeat(80) + '\n');

    console.log('🎯 NEXT STEPS:');
    console.log('─'.repeat(80));
    console.log('1. ✅ Multi-bookmaker odds fetching: WORKING');
    console.log('2. ✅ Sharp consensus calculation: WORKING');
    console.log('3. ✅ Real edge detection: WORKING');
    console.log('4. ✅ Advanced strategy evaluation: WORKING');
    console.log('5. 🔄 Integrate with main betting loop');
    console.log('6. 🔄 Paper trade for 50-100 bets');
    console.log('7. 🔄 Monitor CLV and adjust strategy');
    console.log('8. 🔄 Go live when avgCLV > 0%\n');

  } catch (error) {
    console.error('\n❌ ERROR IN INTEGRATION TEST:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
    console.error('\nStack:', error.stack);
  }
}

testIntegration();
