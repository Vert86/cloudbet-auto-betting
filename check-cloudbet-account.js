const cloudbetAPI = require('./src/services/cloudbetAPI');

async function checkAccount() {
  console.log('=== CHECKING CLOUDBET ACCOUNT ===\n');

  try {
    // Get current balance
    console.log('1. Fetching current balance...');
    const balance = await cloudbetAPI.getBalance();
    console.log('Current balance:', JSON.stringify(balance, null, 2));

    // Try to fetch bet history from Cloudbet API
    console.log('\n2. Attempting to fetch bet history from Cloudbet API...');

    // Check what methods are available
    console.log('\nAvailable API methods:');
    console.log(Object.keys(cloudbetAPI).filter(k => typeof cloudbetAPI[k] === 'function').join(', '));

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

checkAccount();
