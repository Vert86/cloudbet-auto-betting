require('dotenv').config();
const multiBookmakerAggregator = require('./src/services/multiBookmakerOddsAggregator');

/**
 * Debug why opportunities are being rejected
 */
async function debugOpportunityRejection() {
  console.log('\n' + '='.repeat(80));
  console.log('DEBUGGING OPPORTUNITY REJECTION - WHY NO BETS?');
  console.log('='.repeat(80) + '\n');

  const MIN_EDGE = parseFloat(process.env.MIN_EDGE_PERCENTAGE || '5.0');
  const MIN_BOOKMAKERS = parseInt(process.env.MIN_BOOKMAKERS || '5');
  const MIN_EFFICIENCY = parseFloat(process.env.MIN_EFFICIENCY_SCORE || '20');
  const MIN_ODDS = parseFloat(process.env.MIN_ODDS || '1.50');
  const MAX_ODDS = parseFloat(process.env.MAX_ODDS || '4.00');

  console.log('📋 Current Criteria:');
  console.log(`   MIN_EDGE_PERCENTAGE: ${MIN_EDGE}%`);
  console.log(`   MIN_BOOKMAKERS: ${MIN_BOOKMAKERS}`);
  console.log(`   MIN_EFFICIENCY_SCORE: ${MIN_EFFICIENCY}`);
  console.log(`   MIN_ODDS: ${MIN_ODDS}`);
  console.log(`   MAX_ODDS: ${MAX_ODDS}\n`);

  // Focus on basketball (NBA) since user asked about it
  console.log('🏀 Fetching basketball opportunities...\n');

  const opportunities = await multiBookmakerAggregator.findOpportunities('basketball');

  console.log(`Total opportunities found: ${opportunities.length}\n`);

  if (opportunities.length === 0) {
    console.log('❌ No opportunities found. This could mean:');
    console.log('   1. No basketball events available');
    console.log('   2. CloudBet API is down');
    console.log('   3. The Odds API has no data\n');
    return;
  }

  // Categorize rejection reasons
  const rejectionReasons = {
    edgeTooLow: [],
    notEnoughBookmakers: [],
    efficiencyTooLow: [],
    oddsOutOfRange: [],
    multipleReasons: [],
    wouldPass: []
  };

  opportunities.forEach(opp => {
    const reasons = [];

    // Check each criterion
    const edge = parseFloat(opp.edge || 0);
    const bookmakers = parseInt(opp.totalBookmakers || 0);
    const efficiency = parseFloat(opp.efficiencyScore || 0);
    const odds = parseFloat(opp.cloudbetOdds || 0);

    if (edge < MIN_EDGE) reasons.push('edge');
    if (bookmakers < MIN_BOOKMAKERS) reasons.push('bookmakers');
    if (efficiency < MIN_EFFICIENCY) reasons.push('efficiency');
    if (odds < MIN_ODDS || odds > MAX_ODDS) reasons.push('odds');

    // Categorize
    if (reasons.length === 0) {
      rejectionReasons.wouldPass.push(opp);
    } else if (reasons.length === 1) {
      if (reasons[0] === 'edge') rejectionReasons.edgeTooLow.push(opp);
      else if (reasons[0] === 'bookmakers') rejectionReasons.notEnoughBookmakers.push(opp);
      else if (reasons[0] === 'efficiency') rejectionReasons.efficiencyTooLow.push(opp);
      else if (reasons[0] === 'odds') rejectionReasons.oddsOutOfRange.push(opp);
    } else {
      rejectionReasons.multipleReasons.push({ opp, reasons });
    }
  });

  // Report findings
  console.log('📊 REJECTION ANALYSIS:\n');

  console.log(`✅ Would Pass All Criteria: ${rejectionReasons.wouldPass.length}`);
  console.log(`❌ Edge Too Low (<${MIN_EDGE}%): ${rejectionReasons.edgeTooLow.length}`);
  console.log(`❌ Not Enough Bookmakers (<${MIN_BOOKMAKERS}): ${rejectionReasons.notEnoughBookmakers.length}`);
  console.log(`❌ Efficiency Too Low (<${MIN_EFFICIENCY}): ${rejectionReasons.efficiencyTooLow.length}`);
  console.log(`❌ Odds Out of Range (${MIN_ODDS}-${MAX_ODDS}): ${rejectionReasons.oddsOutOfRange.length}`);
  console.log(`❌ Multiple Issues: ${rejectionReasons.multipleReasons.length}\n`);

  // Show examples of rejections
  if (rejectionReasons.edgeTooLow.length > 0) {
    console.log('📉 EDGE TOO LOW - Top 5 examples:');
    rejectionReasons.edgeTooLow.slice(0, 5).forEach((opp, i) => {
      console.log(`\n${i + 1}. ${opp.home} vs ${opp.away}`);
      console.log(`   Edge: ${opp.edge}% (need ${MIN_EDGE}%)`);
      console.log(`   Odds: ${opp.cloudbetOdds} | Bookmakers: ${opp.totalBookmakers}`);
      console.log(`   Efficiency: ${opp.efficiencyScore}`);
      console.log(`   Starts: ${new Date(opp.starts).toLocaleString()}`);
    });
    console.log('');
  }

  if (rejectionReasons.notEnoughBookmakers.length > 0) {
    console.log('📊 NOT ENOUGH BOOKMAKERS - Top 5 examples:');
    rejectionReasons.notEnoughBookmakers.slice(0, 5).forEach((opp, i) => {
      console.log(`\n${i + 1}. ${opp.home} vs ${opp.away}`);
      console.log(`   Bookmakers: ${opp.totalBookmakers} (need ${MIN_BOOKMAKERS})`);
      console.log(`   Edge: ${opp.edge}% | Odds: ${opp.cloudbetOdds}`);
      console.log(`   Efficiency: ${opp.efficiencyScore}`);
    });
    console.log('');
  }

  if (rejectionReasons.multipleReasons.length > 0) {
    console.log('🔴 MULTIPLE ISSUES - Top 5 examples:');
    rejectionReasons.multipleReasons.slice(0, 5).forEach(({ opp, reasons }, i) => {
      console.log(`\n${i + 1}. ${opp.home} vs ${opp.away}`);
      console.log(`   Failing: ${reasons.join(', ')}`);
      console.log(`   Edge: ${opp.edge}% | Bookmakers: ${opp.totalBookmakers}`);
      console.log(`   Efficiency: ${opp.efficiencyScore} | Odds: ${opp.cloudbetOdds}`);
    });
    console.log('');
  }

  // Show what would pass with relaxed criteria
  console.log('='.repeat(80));
  console.log('💡 RECOMMENDATION: TEST RELAXED CRITERIA');
  console.log('='.repeat(80) + '\n');

  const relaxedCriteria = [
    { edge: 4, bookmakers: 4, efficiency: 15 },
    { edge: 3, bookmakers: 4, efficiency: 15 },
    { edge: 4, bookmakers: 5, efficiency: 20 }
  ];

  relaxedCriteria.forEach(criteria => {
    const passing = opportunities.filter(opp => {
      return parseFloat(opp.edge || 0) >= criteria.edge &&
             parseInt(opp.totalBookmakers || 0) >= criteria.bookmakers &&
             parseFloat(opp.efficiencyScore || 0) >= criteria.efficiency &&
             parseFloat(opp.cloudbetOdds || 0) >= MIN_ODDS &&
             parseFloat(opp.cloudbetOdds || 0) <= MAX_ODDS;
    });

    console.log(`With MIN_EDGE=${criteria.edge}%, MIN_BOOKMAKERS=${criteria.bookmakers}, MIN_EFFICIENCY=${criteria.efficiency}:`);
    console.log(`   → ${passing.length} bets would be approved\n`);
  });

  // Show best opportunities that almost qualify
  console.log('='.repeat(80));
  console.log('🌟 BEST OPPORTUNITIES (Closest to Qualifying)');
  console.log('='.repeat(80) + '\n');

  // Sort by edge (highest first)
  const sortedByEdge = [...opportunities].sort((a, b) =>
    parseFloat(b.edge || 0) - parseFloat(a.edge || 0)
  );

  sortedByEdge.slice(0, 10).forEach((opp, i) => {
    console.log(`${i + 1}. ${opp.home} vs ${opp.away}`);
    console.log(`   🎯 Edge: ${opp.edge}% (${parseFloat(opp.edge) >= MIN_EDGE ? '✅' : '❌'} need ${MIN_EDGE}%)`);
    console.log(`   📊 Bookmakers: ${opp.totalBookmakers} (${opp.totalBookmakers >= MIN_BOOKMAKERS ? '✅' : '❌'} need ${MIN_BOOKMAKERS})`);
    console.log(`   ⚡ Efficiency: ${opp.efficiencyScore} (${parseFloat(opp.efficiencyScore) >= MIN_EFFICIENCY ? '✅' : '❌'} need ${MIN_EFFICIENCY})`);
    console.log(`   💰 Odds: ${opp.cloudbetOdds} (${opp.cloudbetOdds >= MIN_ODDS && opp.cloudbetOdds <= MAX_ODDS ? '✅' : '❌'} need ${MIN_ODDS}-${MAX_ODDS})`);
    console.log(`   ⏰ Starts: ${new Date(opp.starts).toLocaleString()}`);
    console.log('');
  });

  console.log('='.repeat(80));
  console.log('✅ Analysis complete!');
  console.log('='.repeat(80) + '\n');
}

debugOpportunityRejection().catch(console.error);
