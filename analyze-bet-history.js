const fs = require('fs');

// Read the bet history file
const bets = JSON.parse(fs.readFileSync('data/cloudbet_bets_history.json', 'utf8'));

console.log('\n=== CLOUDBET BET HISTORY ANALYSIS ===\n');

// Basic statistics
console.log('📊 OVERALL STATISTICS');
console.log('─'.repeat(50));
console.log(`Total Bets Placed: ${bets.length}`);
console.log(`Total Stake: ${bets.reduce((sum, bet) => sum + parseFloat(bet.stake), 0).toFixed(2)} USDT`);
console.log(`Total Potential Winnings: ${bets.reduce((sum, bet) => sum + bet.potentialWin, 0).toFixed(2)} USDT`);
console.log(`Average Odds: ${(bets.reduce((sum, bet) => sum + parseFloat(bet.odds), 0) / bets.length).toFixed(2)}`);
console.log(`Average Edge: ${(bets.reduce((sum, bet) => sum + parseFloat(bet.edge), 0) / bets.length).toFixed(2)}%`);

// Bet status breakdown
console.log('\n📈 BET STATUS BREAKDOWN');
console.log('─'.repeat(50));
const statusCounts = {};
bets.forEach(bet => {
  statusCounts[bet.status] = (statusCounts[bet.status] || 0) + 1;
});
Object.entries(statusCounts).forEach(([status, count]) => {
  console.log(`${status}: ${count} bets (${(count/bets.length*100).toFixed(1)}%)`);
});

// Sports breakdown
console.log('\n⚽ SPORTS BREAKDOWN');
console.log('─'.repeat(50));
const sportsBets = {
  Soccer: bets.filter(b => b.market.includes('match_odds') || b.market === 'match_odds_period_first_half'),
  Boxing: bets.filter(b => b.market === 'winner' && (b.home.includes('vs') || b.away.includes('vs') || b.eventKey.includes('-v-'))),
  Tennis: bets.filter(b => (b.market === 'winner' || b.market === 'winner_of_set') && !b.eventKey.match(/boxing|mma|ufc/i)),
  MMA: bets.filter(b => b.market === 'winner' && b.eventKey.match(/ufc|mma/i)),
  AmericanFootball: bets.filter(b => b.market === 'moneyline')
};

Object.entries(sportsBets).forEach(([sport, sportBets]) => {
  if (sportBets.length > 0) {
    console.log(`\n${sport}: ${sportBets.length} bets`);
    console.log(`  Avg Odds: ${(sportBets.reduce((s, b) => s + parseFloat(b.odds), 0) / sportBets.length).toFixed(2)}`);
    console.log(`  Avg Edge: ${(sportBets.reduce((s, b) => s + parseFloat(b.edge), 0) / sportBets.length).toFixed(2)}%`);
    console.log(`  Total Stake: ${sportBets.reduce((s, b) => s + parseFloat(b.stake), 0).toFixed(2)} USDT`);
  }
});

// Market types breakdown
console.log('\n📋 MARKET TYPES');
console.log('─'.repeat(50));
const marketCounts = {};
bets.forEach(bet => {
  marketCounts[bet.market] = (marketCounts[bet.market] || 0) + 1;
});
Object.entries(marketCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([market, count]) => {
    console.log(`${market}: ${count} bets`);
  });

// Selection breakdown (home/away/draw)
console.log('\n🎯 SELECTION BREAKDOWN');
console.log('─'.repeat(50));
const selectionCounts = {};
bets.forEach(bet => {
  selectionCounts[bet.selection] = (selectionCounts[bet.selection] || 0) + 1;
});
Object.entries(selectionCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([selection, count]) => {
    console.log(`${selection}: ${count} bets (${(count/bets.length*100).toFixed(1)}%)`);
  });

// Odds distribution
console.log('\n💰 ODDS DISTRIBUTION');
console.log('─'.repeat(50));
const oddsRanges = {
  'Under 3.0': bets.filter(b => parseFloat(b.odds) < 3).length,
  '3.0 - 4.99': bets.filter(b => parseFloat(b.odds) >= 3 && parseFloat(b.odds) < 5).length,
  '5.0 - 6.99': bets.filter(b => parseFloat(b.odds) >= 5 && parseFloat(b.odds) < 7).length,
  '7.0 - 8.99': bets.filter(b => parseFloat(b.odds) >= 7 && parseFloat(b.odds) < 9).length,
  '9.0+': bets.filter(b => parseFloat(b.odds) >= 9).length,
};
Object.entries(oddsRanges).forEach(([range, count]) => {
  console.log(`${range}: ${count} bets (${(count/bets.length*100).toFixed(1)}%)`);
});

// Edge distribution
console.log('\n📊 EDGE DISTRIBUTION');
console.log('─'.repeat(50));
const edgeRanges = {
  '6.0 - 6.99%': bets.filter(b => parseFloat(b.edge) >= 6 && parseFloat(b.edge) < 7).length,
  '7.0 - 7.99%': bets.filter(b => parseFloat(b.edge) >= 7 && parseFloat(b.edge) < 8).length,
  '8.0 - 8.99%': bets.filter(b => parseFloat(b.edge) >= 8 && parseFloat(b.edge) < 9).length,
  '9.0%+': bets.filter(b => parseFloat(b.edge) >= 9).length,
};
Object.entries(edgeRanges).forEach(([range, count]) => {
  console.log(`${range}: ${count} bets (${(count/bets.length*100).toFixed(1)}%)`);
});

// Top 10 highest odds bets
console.log('\n🎰 TOP 10 HIGHEST ODDS BETS');
console.log('─'.repeat(50));
const sortedByOdds = [...bets].sort((a, b) => parseFloat(b.odds) - parseFloat(a.odds));
sortedByOdds.slice(0, 10).forEach((bet, i) => {
  console.log(`${i+1}. ${bet.home} vs ${bet.away}`);
  console.log(`   Selection: ${bet.selection} | Odds: ${bet.odds} | Edge: ${bet.edge}%`);
  console.log(`   Market: ${bet.market}`);
});

// Top 10 highest edge bets
console.log('\n📈 TOP 10 HIGHEST EDGE BETS');
console.log('─'.repeat(50));
const sortedByEdge = [...bets].sort((a, b) => parseFloat(b.edge) - parseFloat(a.edge));
sortedByEdge.slice(0, 10).forEach((bet, i) => {
  console.log(`${i+1}. ${bet.home} vs ${bet.away}`);
  console.log(`   Selection: ${bet.selection} | Odds: ${bet.odds} | Edge: ${bet.edge}%`);
  console.log(`   Market: ${bet.market}`);
});

// Timeline analysis
console.log('\n📅 TIMELINE ANALYSIS');
console.log('─'.repeat(50));
const firstBet = new Date(bets[0].timestamp);
const lastBet = new Date(bets[bets.length - 1].timestamp);
const timeDiff = lastBet - firstBet;
const minutes = Math.floor(timeDiff / 60000);

console.log(`First Bet: ${firstBet.toLocaleString()}`);
console.log(`Last Bet: ${lastBet.toLocaleString()}`);
console.log(`Duration: ${minutes} minutes`);
console.log(`Betting Rate: ${(bets.length / minutes).toFixed(2)} bets per minute`);

// Unique events
console.log('\n🏆 UNIQUE EVENTS');
console.log('─'.repeat(50));
const uniqueEvents = new Set(bets.map(b => b.eventId));
console.log(`Total Unique Events: ${uniqueEvents.size}`);
console.log(`Average Bets per Event: ${(bets.length / uniqueEvents.size).toFixed(2)}`);

console.log('\n' + '='.repeat(50));
console.log('Analysis Complete!');
console.log('='.repeat(50) + '\n');
