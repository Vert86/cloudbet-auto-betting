const fs = require('fs');

const bets = JSON.parse(fs.readFileSync('data/production_bets.json', 'utf8'));
console.log('Total bets in production_bets.json:', bets.length);
console.log('\nLast 10 bets:\n');

bets.slice(-10).forEach((b, i) => {
  console.log(`${bets.length - 10 + i + 1}. ${b.timestamp}`);
  console.log(`   Event: ${b.opportunity?.home} vs ${b.opportunity?.away}`);
  console.log(`   Side: ${b.opportunity?.side}`);
  console.log(`   Odds: ${b.opportunity?.cloudbetOdds}`);
  console.log(`   Stake: ${b.evaluation?.betSize} USDT`);
  console.log(`   Success: ${b.success}`);
  if (b.result) {
    console.log(`   Bet ID: ${b.result.id}`);
    console.log(`   Status: ${b.result.status}`);
  }
  if (b.error) {
    console.log(`   Error: ${b.error}`);
  }
  console.log('');
});

// Summary
const successful = bets.filter(b => b.success).length;
const failed = bets.filter(b => !b.success).length;
console.log('\n='.repeat(60));
console.log('SUMMARY:');
console.log(`Total Bets Attempted: ${bets.length}`);
console.log(`Successfully Placed: ${successful}`);
console.log(`Failed: ${failed}`);
console.log('='.repeat(60));
