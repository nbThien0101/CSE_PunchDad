const WEIGHTS = { S: 5, A: 4, B: 3, C: 2, D: 1 };
const score = tier => WEIGHTS[String(tier || '').trim().toUpperCase()] || 2;

export function recalculateTeams(data) {
  const teams = data.teams.map(team => {
    const hasGK = Boolean(team.goalkeeper && !team.goalkeeper.isPlaceholder);
    const totalTierScore = (hasGK ? score(team.goalkeeper.tier) : 0)
      + team.players.reduce((sum, p) => sum + score(p.tier), 0);
    const count = team.players.length + (hasGK ? 1 : 0);
    return { ...team, totalTierScore,
      averageTierScore: count ? Number((totalTierScore / count).toFixed(1)) : 0 };
  });
  const mean = teams.reduce((sum, team) => sum + team.totalTierScore, 0) / (teams.length || 1);
  const variance = teams.reduce((sum, team) => sum + (team.totalTierScore - mean) ** 2, 0)
    / (teams.length || 1);
  return { ...data, teams, variance: Number(variance.toFixed(2)) };
}

export function swapFieldPlayers(data, first, second) {
  if (!Array.isArray(data?.teams) || !first || !second) return data;
  const firstTeam = data.teams.find(team => team.id === first.teamId);
  const secondTeam = data.teams.find(team => team.id === second.teamId);
  const a = firstTeam?.players?.find(p => p.userId === first.userId);
  const b = secondTeam?.players?.find(p => p.userId === second.userId);
  if (!a || !b || a.userId === b.userId) return data;
  const teams = data.teams.map(team => ({
    ...team,
    players: team.players.map(p => {
      if (team.id === first.teamId && p.userId === a.userId) return b;
      if (team.id === second.teamId && p.userId === b.userId) return a;
      return p;
    }),
  }));
  return recalculateTeams({ ...data, teams });
}
