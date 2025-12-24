const axios = require('axios');

async function testESPNScoreboard() {
  console.log('Testing ESPN NFL Scoreboard API...\n');

  try {
    // Try getting team data from scoreboard
    const response = await axios.get('https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams', {
      timeout: 10000
    });

    console.log('✅ Got response!\n');

    if (response.data && response.data.sports) {
      const teams = response.data.sports[0]?.leagues[0]?.teams || [];
      console.log(`Found ${teams.length} teams\n`);

      // For each team, get their record
      const teamDetails = teams.slice(0, 3).map(t => t.team);

      for (const team of teamDetails) {
        console.log(`${team.displayName}:`);
        console.log(`  - Record: ${team.record?.items?.[0]?.summary || 'N/A'}`);
        console.log(`  - ID: ${team.id}`);
      }
    }

  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

testESPNScoreboard();
