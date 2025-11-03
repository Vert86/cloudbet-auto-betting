/**
 * Pinnacle API Connection Test
 * This script tests your Pinnacle API credentials and connection
 */

require('dotenv').config();
const axios = require('axios');

const username = process.env.PINNACLE_USERNAME;
const password = process.env.PINNACLE_PASSWORD;
const baseUrl = process.env.PINNACLE_API_BASE_URL || 'https://api.pinnacle.com';

console.log('\n=== Pinnacle API Connection Test ===\n');

// Check credentials are configured
if (!username || !password) {
  console.error('❌ ERROR: Credentials not configured');
  console.error('Please create a .env file with your credentials:');
  console.error('  PINNACLE_USERNAME=your_username');
  console.error('  PINNACLE_PASSWORD=your_password');
  process.exit(1);
}

console.log('✓ Credentials found in .env');
console.log(`  Username: ${username}`);
console.log(`  Password: ${'*'.repeat(password.length)}`);
console.log(`  Base URL: ${baseUrl}\n`);

// Create auth header
const credentials = Buffer.from(`${username}:${password}`).toString('base64');
console.log('✓ Auth header created\n');

// Test endpoints in order of importance
const testEndpoints = [
  {
    name: 'Sports List',
    method: 'GET',
    url: '/v2/sports',
    description: 'Basic endpoint to verify API access'
  },
  {
    name: 'Client Balance',
    method: 'GET',
    url: '/v1/client/balance',
    description: 'Verify account access and check balance'
  }
];

async function testEndpoint(endpoint) {
  console.log(`Testing: ${endpoint.name}`);
  console.log(`  ${endpoint.method} ${endpoint.url}`);
  console.log(`  ${endpoint.description}`);

  try {
    const response = await axios({
      method: endpoint.method,
      url: `${baseUrl}${endpoint.url}`,
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'PinnacleConnectionTest/1.0',
      },
      timeout: 10000,
    });

    console.log(`  ✅ SUCCESS (${response.status})`);
    console.log(`  Response:`, JSON.stringify(response.data, null, 2).substring(0, 500));
    console.log('');
    return true;
  } catch (error) {
    console.log(`  ❌ FAILED`);
    console.log(`  Status: ${error.response?.status || 'No response'}`);
    console.log(`  Status Text: ${error.response?.statusText || 'N/A'}`);

    if (error.response?.data) {
      console.log(`  Error Data:`, JSON.stringify(error.response.data, null, 2));
    }

    if (error.response?.status === 403) {
      console.log('\n  🔍 403 Forbidden - Possible causes:');
      console.log('     1. API access not enabled for your account');
      console.log('        → Contact api@pinnacle.com to request access');
      console.log('     2. Incorrect username or password');
      console.log('        → Verify credentials in your .env file');
      console.log('     3. Account not funded');
      console.log('        → API requires a funded account');
      console.log('     4. IP address not whitelisted');
      console.log('        → Pinnacle allows max 2 IP addresses per account');
    } else if (error.response?.status === 401) {
      console.log('\n  🔍 401 Unauthorized - Authentication failed');
      console.log('     → Check your username and password');
    } else if (error.code === 'ENOTFOUND') {
      console.log('\n  🔍 DNS Error - Cannot reach server');
      console.log('     → Check your internet connection');
      console.log('     → Verify the base URL is correct');
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
    console.log('\n❌ All tests failed - Cannot connect to Pinnacle API');
    console.log('\nNext steps:');
    console.log('1. Verify your credentials are correct');
    console.log('2. Ensure your Pinnacle account is funded');
    console.log('3. Contact api@pinnacle.com to request API access');
    console.log('   (API access was restricted as of July 2025)');
    process.exit(1);
  } else if (successCount < testEndpoints.length) {
    console.log('\n⚠️  Some tests failed - Partial API access');
    process.exit(0);
  } else {
    console.log('\n✅ All tests passed - API connection successful!');
    console.log('You can now run: npm start');
    process.exit(0);
  }
}

runTests().catch(error => {
  console.error('\n❌ Unexpected error:', error.message);
  process.exit(1);
});
