const axios = require('axios');

async function testESPN() {
  console.log('Testing ESPN NFL API...\n');

  try {
    const response = await axios.get('https://site.api.espn.com/apis/site/v2/sports/football/nfl/standings', {
      timeout: 10000
    });

    console.log('Response keys:', Object.keys(response.data));
    console.log('\nFull structure (first 2000 chars):');
    console.log(JSON.stringify(response.data, null, 2).slice(0, 2000));

  } catch (error) {
    console.log('Error:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', JSON.stringify(error.response.data).slice(0, 500));
    }
  }
}

testESPN();
