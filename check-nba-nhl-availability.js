const api = require('./src/services/cloudbetAPI');
const logger = require('./src/utils/logger');

async function checkGames() {
  console.log('================================================================================');
  console.log('CLOUDBET GAME AVAILABILITY CHECK - December 21, 2025');
  console.log('================================================================================\n');

  // Check NBA
  console.log('🏀 Checking for NBA games...\n');
  try {
    const basketballEvents = await api.getEvents('basketball');
    console.log(`Total basketball events found: ${basketballEvents.length}\n`);

    const nbaTeams = [
      'Lakers', 'Celtics', 'Warriors', 'Knicks', 'Heat', 'Bucks',
      'Suns', 'Mavericks', 'Nets', 'Clippers', '76ers', 'Raptors',
      'Bulls', 'Nuggets', 'Grizzlies', 'Cavaliers', 'Hawks', 'Timberwolves'
    ];

    const nbaGames = basketballEvents.filter(e =>
      nbaTeams.some(team => e.home.includes(team) || e.away.includes(team))
    );

    if (nbaGames.length > 0) {
      console.log(`✅ Found ${nbaGames.length} NBA games:\n`);
      nbaGames.forEach((game, i) => {
        console.log(`${i + 1}. ${game.home} vs ${game.away}`);
      });
    } else {
      console.log('❌ No NBA games found on CloudBet');
      console.log('\nSample basketball events (likely college):');
      basketballEvents.slice(0, 5).forEach((game, i) => {
        console.log(`${i + 1}. ${game.home} vs ${game.away}`);
      });
    }
  } catch (error) {
    console.log('❌ Error fetching basketball events:', error.message);
  }

  console.log('\n' + '='.repeat(80) + '\n');

  // Check NHL
  console.log('🏒 Checking for NHL games...\n');
  try {
    const hockeyEvents = await api.getEvents('ice-hockey');
    console.log(`Total ice-hockey events found: ${hockeyEvents.length}\n`);

    const nhlTeams = [
      'Bruins', 'Maple Leafs', 'Rangers', 'Oilers', 'Canadiens', 'Penguins',
      'Red Wings', 'Capitals', 'Stars', 'Devils', 'Predators', 'Avalanche',
      'Wild', 'Jets', 'Senators', 'Sabres', 'Golden Knights'
    ];

    const nhlGames = hockeyEvents.filter(e =>
      nhlTeams.some(team => e.home.includes(team) || e.away.includes(team))
    );

    if (nhlGames.length > 0) {
      console.log(`✅ Found ${nhlGames.length} NHL games:\n`);
      nhlGames.forEach((game, i) => {
        console.log(`${i + 1}. ${game.home} vs ${game.away}`);
      });
    } else {
      console.log('❌ No NHL games found on CloudBet');
      if (hockeyEvents.length > 0) {
        console.log('\nSample ice-hockey events:');
        hockeyEvents.slice(0, 5).forEach((game, i) => {
          console.log(`${i + 1}. ${game.home} vs ${game.away}`);
        });
      }
    }
  } catch (error) {
    console.log('❌ Error fetching ice-hockey events:', error.message);
  }

  console.log('\n' + '='.repeat(80) + '\n');
  console.log('Check complete. Real NBA/NHL games scheduled today:');
  console.log('- NBA: 6+ games starting 3:30 PM - 10:00 PM EST');
  console.log('- NHL: 9 games starting 1:00 PM - 8:00 PM EST');
  console.log('\nIf not showing above, CloudBet may load them closer to game time.');
  console.log('Check back in 1-2 hours or when games start.');
  console.log('================================================================================\n');
}

checkGames().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
