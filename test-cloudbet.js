/**
 * Cloudbet API Connection Test
 * This script tests your Cloudbet API credentials and connection
 */

require('dotenv').config();
const axios = require('axios');

const apiKey = process.env.CLOUDBET_API_KEY;
const currency = process.env.CLOUDBET_CURRENCY || 'BTC';

console.log('\n=== Cloudbet API Connection Test ===\n');

// Check API key is configured
if (!apiKey || apiKey === 'your_cloudbet_api_key_here') {
  console.error('❌ ERROR: API key not configured');
  console.error('');
  console.error('Please create a .env file with your Cloudbet API key:');
  console.error('  CLOUDBET_API_KEY=your_actual_api_key');
  console.error('');
  console.error('To get your API key:');
  console.error('  1. Go to https://www.cloudbet.com/en/account/api');
  console.error('  2. Deposit minimum 10 EUR equivalent');
  console.error('  3. Generate your Trading API Key');
  process.exit(1);
}

console.log('✓ API key found in .env');
console.log(`  API Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 10)}`);
console.log(`  Currency: ${currency}\n`);

// Test endpoints
const testEndpoints = [
  {
    name: 'Sports List',
    method: 'GET',
    url: 'https://sports-api.cloudbet.com/pub/v2/sports',
    description: 'Get available sports'
  },
  {
    name: 'Account Balance',
    method: 'GET',
    url: 'https://sports-api.cloudbet.com/pub/v1/account/balances',
    description: 'Verify account access and check balance'
  },
  {
    name: 'Soccer Events',
    method: 'GET',
    url: 'https://sports-api.cloudbet.com/pub/v2/sports/soccer/events',
    description: 'Fetch soccer events with odds'
  }
];

async function testEndpoint(endpoint) {
  console.log(`Testing: ${endpoint.name}`);
  console.log(`  ${endpoint.method} ${endpoint.url}`);
  console.log(`  ${endpoint.description}`);

  try {
    const response = await axios({
      method: endpoint.method,
      url: endpoint.url,
      headers: {
        'X-API-Key': apiKey,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });

    console.log(`  ✅ SUCCESS (${response.status})`);

    // Display relevant data
    if (endpoint.name === 'Sports List' && response.data.sports) {
      console.log(`  Available sports: ${response.data.sports.map(s => s.name).join(', ')}`);
    } else if (endpoint.name === 'Account Balance' && Array.isArray(response.data)) {
      console.log(`  Balances:`);
      response.data.forEach(bal => {
        console.log(`    ${bal.currency}: Available: ${bal.available}, In Use: ${bal.inUse || 0}`);
      });
    } else if (endpoint.name === 'Soccer Events' && response.data.events) {
      console.log(`  Found ${response.data.events.length} soccer events`);
      if (response.data.events.length > 0) {
        const event = response.data.events[0];
        console.log(`  Sample event: ${event.home?.name || 'Home'} vs ${event.away?.name || 'Away'}`);
      }
    }

    console.log('');
    return true;
  } catch (error) {
    console.log(`  ❌ FAILED`);
    console.log(`  Status: ${error.response?.status || 'No response'}`);
    console.log(`  Status Text: ${error.response?.statusText || 'N/A'}`);

    if (error.response?.data) {
      console.log(`  Error Data:`, JSON.stringify(error.response.data, null, 2));
    }

    if (error.response?.status === 401 || error.response?.status === 403) {
      console.log('\n  🔍 Authentication Error - Possible causes:');
      console.log('     1. Invalid API key');
      console.log('        → Check your API key is correct');
      console.log('     2. API key not activated');
      console.log('        → Ensure you deposited minimum 10 EUR equivalent');
      console.log('     3. Using Affiliate API key instead of Trading API key');
      console.log('        → Get Trading API key from account settings');
    } else if (error.code === 'ENOTFOUND') {
      console.log('\n  🔍 DNS Error - Cannot reach server');
      console.log('     → Check your internet connection');
    } else if (error.code === 'ETIMEDOUT') {
      console.log('\n  🔍 Timeout - Server took too long to respond');
      console.log('     → Try again in a moment');
    }

    console.log('');
    return false;
  }
}

async function runTests() {
  console.log('Starting connection tests...\n');

  let successCount = 0;
  for (const endpoint of testEndpoints) {
    const success = await testEndpoint(endpoint);
    if (success) successCount++;

    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n=== Test Summary ===');
  console.log(`Passed: ${successCount}/${testEndpoints.length}`);

  if (successCount === 0) {
    console.log('\n❌ All tests failed - Cannot connect to Cloudbet API');
    console.log('\nNext steps:');
    console.log('1. Verify your API key is correct in .env file');
    console.log('2. Ensure you have deposited minimum 10 EUR equivalent');
    console.log('3. Make sure you are using the Trading API key, not Affiliate key');
    console.log('4. Check https://www.cloudbet.com/en/account/api');
    process.exit(1);
  } else if (successCount < testEndpoints.length) {
    console.log('\n⚠️  Some tests failed - Partial API access');
    console.log('The system may work but with limited functionality.');
    process.exit(0);
  } else {
    console.log('\n✅ All tests passed - Cloudbet API connection successful!');
    console.log('\nYour system is ready to run!');
    console.log('Start with: npm start');
    process.exit(0);
  }
}

runTests().catch(error => {
  console.error('\n❌ Unexpected error:', error.message);
  process.exit(1);
});
