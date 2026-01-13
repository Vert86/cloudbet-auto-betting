const aggregator = require('./src/services/multiBookmakerOddsAggregator');

(async () => {
  try {
    console.log('Checking what basketball games are labeled as NBA...\n');

    const allBasketballOpps = await aggregator.findOpportunities('basketball');
    console.log(`Total basketball opportunities: ${allBasketballOpps.length}\n`);

    // Group by competition
    const byCompetition = {};
    allBasketballOpps.forEach(opp => {
      const comp = opp.competition || 'Unknown';
      if (!byCompetition[comp]) {
        byCompetition[comp] = [];
      }
      byCompetition[comp].push(opp);
    });

    console.log('COMPETITIONS AVAILABLE:\n');
    Object.keys(byCompetition).sort().forEach(comp => {
      const games = byCompetition[comp];
      console.log(`${comp}: ${games.length} games`);

      // Show first game as example
      if (games.length > 0) {
        console.log(`  Example: ${games[0].home} vs ${games[0].away}\n`);
      }
    });

    // Look for anything that might be NBA
    console.log('\nLOOKING FOR NBA GAMES:');
    const possibleNBA = allBasketballOpps.filter(opp => {
      const comp = (opp.competition || '').toLowerCase();
      const home = (opp.home || '').toLowerCase();
      const away = (opp.away || '').toLowerCase();

      // NBA teams have distinctive names (city + team name)
      const nbaTeamNames = [
        'lakers', 'celtics', 'warriors', 'heat', 'bulls', 'knicks',
        'bucks', 'raptors', 'sixers', '76ers', 'nets', 'mavericks',
        'rockets', 'suns', 'clippers', 'nuggets', 'jazz', 'thunder',
        'blazers', 'spurs', 'pistons', 'pacers', 'hawks', 'hornets',
        'pelicans', 'grizzlies', 'magic', 'timberwolves', 'wizards', 'cavaliers'
      ];

      const hasNBATeam = nbaTeamNames.some(team =>
        home.includes(team) || away.includes(team)
      );

      return comp.includes('nba') || hasNBATeam;
    });

    console.log(`\nFound ${possibleNBA.length} possible NBA games:\n`);
    possibleNBA.forEach((opp, i) => {
      console.log(`${i+1}. ${opp.home} vs ${opp.away}`);
      console.log(`   Competition: "${opp.competition}"`);
      console.log(`   Sport: ${opp.sport}`);
      console.log(`   Start: ${opp.starts}\n`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  }
})();
