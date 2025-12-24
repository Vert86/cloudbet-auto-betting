require('dotenv').config();
const telegramNotifier = require('./src/utils/telegramNotifier');

/**
 * Test Telegram notifications
 */
async function testTelegram() {
  console.log('\n' + '='.repeat(80));
  console.log('TESTING TELEGRAM NOTIFICATIONS');
  console.log('='.repeat(80) + '\n');

  console.log('Bot Token:', process.env.TELEGRAM_BOT_TOKEN ? '✓ Set' : '✗ Missing');
  console.log('Chat ID:', process.env.TELEGRAM_CHAT_ID ? '✓ Set' : '✗ Missing');
  console.log('');

  // Test 1: Simple message
  console.log('Test 1: Sending simple test message...');
  const test1 = await telegramNotifier.sendMessage('🧪 Test message from CloudBet Automation Bot!');
  console.log(test1 ? '✅ Success\n' : '❌ Failed\n');

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 2: Bet placed notification
  console.log('Test 2: Sending bet placed notification...');
  const test2 = await telegramNotifier.sendBetPlaced({
    home: 'Manchester City',
    away: 'Liverpool',
    sport: 'soccer',
    side: 'home',
    odds: 2.15,
    stake: 5.50,
    edge: 8.35,
    currency: 'USDT',
  });
  console.log(test2 ? '✅ Success\n' : '❌ Failed\n');

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 3: Session summary
  console.log('Test 3: Sending session summary...');
  const sessionStart = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
  const test3 = await telegramNotifier.sendSessionSummary({
    startTime: sessionStart,
    endTime: new Date(),
    betsPlaced: 5,
    totalStaked: 25.50,
    dailyProfit: 3.75,
    betDetails: [
      {
        home: 'Lakers',
        away: 'Warriors',
        sport: 'basketball',
        side: 'home',
        odds: 1.85,
        stake: 5.00,
        edge: 6.5,
      },
      {
        home: 'Patriots',
        away: 'Chiefs',
        sport: 'american-football',
        side: 'away',
        odds: 2.35,
        stake: 4.50,
        edge: 9.2,
      },
      {
        home: 'Maple Leafs',
        away: 'Bruins',
        sport: 'ice-hockey',
        side: 'home',
        odds: 1.95,
        stake: 6.00,
        edge: 7.8,
      },
      {
        home: 'Real Madrid',
        away: 'Barcelona',
        sport: 'soccer',
        side: 'draw',
        odds: 3.25,
        stake: 5.00,
        edge: 5.3,
      },
      {
        home: 'Chelsea',
        away: 'Arsenal',
        sport: 'soccer',
        side: 'away',
        odds: 2.10,
        stake: 5.00,
        edge: 8.1,
      },
    ],
    currency: 'USDT',
  });
  console.log(test3 ? '✅ Success\n' : '❌ Failed\n');

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 4: Bet result (win)
  console.log('Test 4: Sending bet result (WIN)...');
  const test4 = await telegramNotifier.sendBetResult({
    home: 'Heat',
    away: 'Celtics',
    result: 'WIN',
    odds: 2.20,
    stake: 5.00,
    profit: 6.00,
    currency: 'USDT',
  });
  console.log(test4 ? '✅ Success\n' : '❌ Failed\n');

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 5: Bet result (loss)
  console.log('Test 5: Sending bet result (LOSS)...');
  const test5 = await telegramNotifier.sendBetResult({
    home: 'Knicks',
    away: 'Nets',
    result: 'LOSS',
    odds: 1.75,
    stake: 4.00,
    profit: -4.00,
    currency: 'USDT',
  });
  console.log(test5 ? '✅ Success\n' : '❌ Failed\n');

  console.log('='.repeat(80));
  console.log('✅ All tests completed!');
  console.log('Check your Telegram chat to see the messages.');
  console.log('='.repeat(80) + '\n');
}

testTelegram().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
