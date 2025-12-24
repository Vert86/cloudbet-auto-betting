require('dotenv').config();
const axios = require('axios');

async function inspectNFLResponse() {
  const apiKey = process.env.API_SPORTS_KEY;

  try {
    const response = await axios.get('https://v1.american-football.api-sports.io/standings', {
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': 'v1.american-football.api-sports.io'
      },
      params: {
        league: 1,
        season: 2023
      }
    });

    console.log('Full API response structure:\n');
    console.log(JSON.stringify(response.data, null, 2).slice(0, 3000));

  } catch (error) {
    console.log('Error:', error.message);
  }
}

inspectNFLResponse();
