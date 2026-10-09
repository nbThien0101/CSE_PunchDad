const TIER_WEIGHTS = { S: 5, A: 4, B: 3, C: 2, D: 1 };

function tierScore(player) {
  return TIER_WEIGHTS[String(player?.tier || '').trim().toUpperCase()] || 2;
}

export function swapFieldPlayers(data, first, second) {
  if (!data?.teams || !first || !second || first.teamId === second.teamId) return data;
  const firstTeam = data.teams.find(team => team.id === first.teamId);
  const secondTeam = data.teams.find(team => team.id === second.teamId);
  const firstPlayer = firstTeam?.players?.find(player => player.userId === first.userId);
  const secondPlayer = secondTeam?.players?.find(player => player.userId === second.userId);
  if (!firstPlayer || !secondPlayer) return data;

  const teams = data.teams.map(team => {
    const players = team.players.map(player => {
      if (team.id === first.teamId && player.userId === first.userId) return secondPlayer;
      if (team.id === second.teamId && player.userId === second.userId) return firstPlayer;
      return player;
    });
    const hasGoalkeeper = team.goalkeeper && !team.goalkeeper.isPlaceholder;
    const totalTierScore = (hasGoalkeeper ? tierScore(team.goalkeeper) : 0)
      + players.reduce((sum, player) => sum + tierScore(player), 0);
    const count = players.length + (hasGoalkeeper ? 1 : 0);
    return { ...team, players, totalTierScore,
      averageTierScore: count ? Number((totalTierScore / count).toFixed(1)) : 0 };
  });
  const mean = teams.reduce((sum, team) => sum + team.totalTierScore, 0) / teams.length;
  const variance = Number((teams.reduce((sum, team) => sum + (team.totalTierScore - mean) ** 2, 0)
    / teams.length).toFixed(2));
  return { ...data, teams, variance };
}
