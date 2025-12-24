const fs = require('fs');

const bets = JSON.parse(fs.readFileSync('data/production_bets.json', 'utf-8'));

// Filter Nov 29 bets
const nov29Bets = bets.filter(b => {
  if (b.createTime) {
    return b.createTime.startsWith('2025-11-29');
  }
  if (b.placedAt) {
    return b.placedAt.startsWith('2025-11-29');
  }
  return false;
});

console.log('\n='.repeat(80));
console.log('AUTOMATION BETS ON NOV 29, 2025');
console.log('='.repeat(80) + '\n');

console.log(`Total automation bets placed: ${nov29Bets.length}\n`);

if (nov29Bets.length === 0) {
  console.log('No automation bets found for Nov 29.\n');
  console.log('The bets in your screenshot appear to be MANUAL bets.\n');
  process.exit(0);
}

// Group by status
const pending = nov29Bets.filter(b => b.status === 'PENDING_ACCEPTANCE' || b.status === 'ACCEPTED');
const won = nov29Bets.filter(b => b.result === 'won');
const lost = nov29Bets.filter(b => b.result === 'lost');

console.log('Status Breakdown:');
console.log(`  Pending/Accepted: ${pending.length}`);
console.log(`  Won: ${won.length}`);
console.log(`  Lost: ${lost.length}\n`);

console.log('All Nov 29 Automation Bets:\n');
nov29Bets.forEach((bet, i) => {
  console.log(`${i + 1}. Event: ${bet.eventName || bet.event || 'Unknown'}`);
  console.log(`   Market: ${bet.marketUrl || bet.marketType || 'Unknown'}`);
  console.log(`   Selection: ${bet.side || bet.selection || 'Unknown'}`);
  console.log(`   Stake: ${bet.stake} USDT @ ${bet.price || bet.odds}`);
  console.log(`   Time: ${bet.createTime || bet.placedAt}`);
  console.log(`   Status: ${bet.status || bet.result || 'Unknown'}`);
  console.log('');
});

console.log('='.repeat(80));
console.log('ANALYSIS');
console.log('='.repeat(80) + '\n');

// Check if markets are half-time
const halfTimeMarkets = nov29Bets.filter(b => {
  const market = (b.marketUrl || b.marketType || '').toLowerCase();
  return market.includes('half') || market.includes('period');
});

if (halfTimeMarkets.length > 0) {
  console.log(`⚠️  WARNING: ${halfTimeMarkets.length} bets on HALF-TIME markets detected!`);
  console.log('   The market filtering may not be working correctly.\n');
} else {
  console.log('✅ No half-time markets detected - filtering is working!\n');
}

console.log('Market distribution:');
const marketCounts = {};
nov29Bets.forEach(b => {
  const market = b.marketUrl || b.marketType || 'Unknown';
  marketCounts[market] = (marketCounts[market] || 0) + 1;
});
Object.entries(marketCounts).forEach(([market, count]) => {
  console.log(`  ${market}: ${count} bets`);
});
console.log('');
