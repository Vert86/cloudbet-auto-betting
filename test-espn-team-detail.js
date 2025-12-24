const axios = require('axios');

async function testESPNTeamDetail() {
  console.log('Testing ESPN NFL Team Detail API...\n');

  try {
    // Try getting Kansas City Chiefs (team ID 12)
    const response = await axios.get('https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/12', {
      timeout: 10000
    });

    console.log('✅ Got team detail!\n');

    if (response.data && response.data.team) {
      const team = response.data.team;
      console.log(`Team: ${team.displayName}`);
      console.log(`Full name: ${team.name}`);

      // Look for record
      if (team.record) {
        console.log('\nRecord found:');
        console.log(JSON.stringify(team.record, null, 2).slice(0, 500));
      }

      if (team.standingSummary) {
        console.log('\nStanding summary:', team.standingSummary);
      }

      // Check if there's a nextEvent or record in the team object
      console.log('\nAll team keys:', Object.keys(team));
    }

  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

testESPNTeamDetail();
