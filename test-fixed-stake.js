require('dotenv').config();
const ProductionBot = require('./production-bot');

console.log('🧪 TESTING FIXED STAKE WITH FUNDAMENTAL ANALYSIS\n');
console.log('Configuration:');
console.log(`- USE_FUNDAMENTAL_ANALYSIS: ${process.env.USE_FUNDAMENTAL_ANALYSIS}`);
console.log(`- MIN_PREDICTION_CONFIDENCE: ${process.env.MIN_PREDICTION_CONFIDENCE}`);
console.log(`- BANKROLL_PERCENTAGE_PER_BET: ${process.env.BANKROLL_PERCENTAGE_PER_BET}%`);
console.log(`- MIN_EDGE_PERCENTAGE: ${process.env.MIN_EDGE_PERCENTAGE}%`);
console.log('\nStarting dry run test...\n');

async function test() {
  const bot = new ProductionBot();

  // Run one scan cycle
  await bot.scanAndBet();

  console.log('\n✅ Test complete. Check logs above for:');
  console.log('1. "📊 Using fundamental analysis instead of edge calculation"');
  console.log('2. "💰 Using fixed stake for fundamental analysis bet"');
  console.log('3. "✅ BET APPROVED" (if opportunities found)');
}

test().catch(console.error);
