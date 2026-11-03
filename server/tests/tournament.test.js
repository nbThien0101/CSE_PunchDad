const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateStandings,
  generateGroupFixtures,
  generateKnockoutFixtures,
  syncKnockoutProgression,
  calculatePlayerStats,
  recalculateTournamentTeams,
  balanceTournamentTeams,
  formatTournamentPayload,
} = require('../src/services/tournament.service');

test('calculateStandings correctly calculates points and goal difference', () => {
  const teams = [
    { id: 't1', name: 'Đội A', group: 'A' },
    { id: 't2', name: 'Đội B', group: 'A' },
  ];
  const fixtures = [
    {
      id: 'f1',
      stage: 'GROUP',
      group: 'A',
      homeTeamId: 't1',
      awayTeamId: 't2',
      homeScore: 3,
      awayScore: 1,
      status: 'FINISHED',
    },
  ];

  const standings = calculateStandings(teams, fixtures);
  assert.equal(standings.length, 1);
  assert.equal(standings[0].group, 'A');

  const rows = standings[0].rows;
  assert.equal(rows[0].teamId, 't1');
  assert.equal(rows[0].points, 3);
  assert.equal(rows[0].won, 1);
  assert.equal(rows[0].goalDifference, 2);

  assert.equal(rows[1].teamId, 't2');
  assert.equal(rows[1].points, 0);
  assert.equal(rows[1].lost, 1);
  assert.equal(rows[1].goalDifference, -2);
});

test('calculateStandings prioritizes Points -> Head-to-Head -> Goal Difference -> Goals For', () => {
  const teams = [
    { id: 't1', name: 'Đội 1', group: 'A' },
    { id: 't2', name: 'Đội 2', group: 'A' },
    { id: 't3', name: 'Đội 3', group: 'A' },
  ];

  // t1 thắng t2 (1-0) nhưng chỉ thắng t3 (1-0) -> 6 điểm, HS +2
  // t2 thua t1 (0-1) nhưng thắng t3 (5-0) -> 3 điểm? Không, để t1 và t2 bằng điểm:
  // Giả sử 4 đội: t1, t2 cùng 6 điểm, t1 thắng t2 trực tiếp dù t2 có hiệu số cao hơn
  const teams4 = [
    { id: 't1', name: 'Đội 1', group: 'A' },
    { id: 't2', name: 'Đội 2', group: 'A' },
    { id: 't3', name: 'Đội 3', group: 'A' },
    { id: 't4', name: 'Đội 4', group: 'A' },
  ];
  const fixtures = [
    // t1 thắng t2 2-1 (đối đầu t1 thắng t2)
    { id: 'm1', stage: 'GROUP', group: 'A', homeTeamId: 't1', awayTeamId: 't2', homeScore: 2, awayScore: 1, status: 'FINISHED' },
    // t1 thắng t3 1-0, nhưng thua t4 0-2 -> t1 có 6 điểm, BT 3, BB 3, HS 0
    { id: 'm2', stage: 'GROUP', group: 'A', homeTeamId: 't1', awayTeamId: 't3', homeScore: 1, awayScore: 0, status: 'FINISHED' },
    { id: 'm3', stage: 'GROUP', group: 'A', homeTeamId: 't1', awayTeamId: 't4', homeScore: 0, awayScore: 2, status: 'FINISHED' },
    // t2 thắng t3 4-0, thắng t4 4-0 -> t2 có 6 điểm, BT 9, BB 2, HS +7
    { id: 'm4', stage: 'GROUP', group: 'A', homeTeamId: 't2', awayTeamId: 't3', homeScore: 4, awayScore: 0, status: 'FINISHED' },
    { id: 'm5', stage: 'GROUP', group: 'A', homeTeamId: 't2', awayTeamId: 't4', homeScore: 4, awayScore: 0, status: 'FINISHED' },
    // t3 hòa t4 2-2 -> t4 có 4 điểm, t3 có 1 điểm
    { id: 'm6', stage: 'GROUP', group: 'A', homeTeamId: 't3', awayTeamId: 't4', homeScore: 2, awayScore: 2, status: 'FINISHED' },
  ];

  const standings = calculateStandings(teams4, fixtures);
  const rows = standings[0].rows;

  // t1 và t2 đều có 6 điểm, nhưng t1 thắng t2 đối đầu nên t1 phải xếp hạng 1, t2 xếp hạng 2!
  assert.equal(rows[0].teamId, 't1');
  assert.equal(rows[1].teamId, 't2');
  assert.equal(rows[0].points, 6);
  assert.equal(rows[1].points, 6);

  // Khi đối đầu hòa nhau -> xét tới hiệu số bàn thắng -> số bàn thắng ghi được
  const fixturesTieH2H = [
    { id: 'n1', stage: 'GROUP', group: 'A', homeTeamId: 't1', awayTeamId: 't2', homeScore: 1, awayScore: 1, status: 'FINISHED' },
    { id: 'n2', stage: 'GROUP', group: 'A', homeTeamId: 't1', awayTeamId: 't3', homeScore: 2, awayScore: 1, status: 'FINISHED' }, // t1: 4đ, HS +1, BT 3
    { id: 'n3', stage: 'GROUP', group: 'A', homeTeamId: 't2', awayTeamId: 't3', homeScore: 3, awayScore: 2, status: 'FINISHED' }, // t2: 4đ, HS +1, BT 4
  ];
  const standingsTie = calculateStandings(teams, fixturesTieH2H);
  // t1 và t2 cùng 4 điểm, đối đầu hòa 1-1, cùng hiệu số +1, nhưng t2 ghi 4 bàn > t1 ghi 3 bàn -> t2 xếp trên
  assert.equal(standingsTie[0].rows[0].teamId, 't2');
  assert.equal(standingsTie[0].rows[1].teamId, 't1');
});

test('generateKnockoutFixtures pairs 1A vs 2B, 1B vs 2A, optional bottom match, and syncKnockoutProgression advances winners/losers', () => {
  const teams = [
    { id: 'a1', name: 'Đội A1', group: 'A' },
    { id: 'a2', name: 'Đội A2', group: 'A' },
    { id: 'a3', name: 'Đội A3', group: 'A' },
    { id: 'b1', name: 'Đội B1', group: 'B' },
    { id: 'b2', name: 'Đội B2', group: 'B' },
    { id: 'b3', name: 'Đội B3', group: 'B' },
  ];

  const groupFixtures = [
    { id: 'g1', stage: 'GROUP', group: 'A', homeTeamId: 'a1', awayTeamId: 'a2', homeScore: 2, awayScore: 0, status: 'FINISHED' },
    { id: 'g2', stage: 'GROUP', group: 'A', homeTeamId: 'a2', awayTeamId: 'a3', homeScore: 2, awayScore: 0, status: 'FINISHED' },
    { id: 'g3', stage: 'GROUP', group: 'B', homeTeamId: 'b1', awayTeamId: 'b2', homeScore: 3, awayScore: 1, status: 'FINISHED' },
    { id: 'g4', stage: 'GROUP', group: 'B', homeTeamId: 'b2', awayTeamId: 'b3', homeScore: 2, awayScore: 1, status: 'FINISHED' },
  ];

  const allFixtures = generateKnockoutFixtures(teams, groupFixtures, { includeBottomMatch: true });
  const ko = allFixtures.filter((f) => f.stage === 'KNOCKOUT');

  const sf1 = ko.find((f) => f.matchCode === 'SF1');
  const sf2 = ko.find((f) => f.matchCode === 'SF2');
  const bottom = ko.find((f) => f.matchCode === 'PL_BOTTOM');
  const third = ko.find((f) => f.matchCode === 'THIRD_PLACE');
  const finalMatch = ko.find((f) => f.matchCode === 'FINAL');

  // Nhất A (a1) gặp Nhì B (b2)
  assert.equal(sf1.homeTeamId, 'a1');
  assert.equal(sf1.awayTeamId, 'b2');

  // Nhất B (b1) gặp Nhì A (a2)
  assert.equal(sf2.homeTeamId, 'b1');
  assert.equal(sf2.awayTeamId, 'a2');

  // 2 đội cuối bảng (a3 vs b3)
  assert.equal(bottom.homeTeamId, 'a3');
  assert.equal(bottom.awayTeamId, 'b3');

  assert.ok(third);
  assert.ok(finalMatch);

  // Giả lập kết quả Bán kết 1 (a1 thắng b2 3-1) và Bán kết 2 (b1 hòa a2 2-2, a2 thắng Pen 4-3)
  sf1.homeScore = 3;
  sf1.awayScore = 1;
  sf1.status = 'FINISHED';

  sf2.homeScore = 2;
  sf2.awayScore = 2;
  sf2.homePenScore = 3;
  sf2.awayPenScore = 4;
  sf2.status = 'FINISHED';

  const synced = syncKnockoutProgression(allFixtures);
  const syncedThird = synced.find((f) => f.matchCode === 'THIRD_PLACE');
  const syncedFinal = synced.find((f) => f.matchCode === 'FINAL');

  // Vào chung kết là cặp thắng ở vòng knockout (a1 vs a2)
  assert.equal(syncedFinal.homeTeamId, 'a1');
  assert.equal(syncedFinal.awayTeamId, 'a2');

  // Tranh hạng 3 là cặp thua ở vòng knockout (b2 vs b1)
  assert.equal(syncedThird.homeTeamId, 'b2');
  assert.equal(syncedThird.awayTeamId, 'b1');
});

test('calculatePlayerStats aggregates goals, assists, and MVP votes accurately', () => {
  const teams = [
    {
      id: 't1',
      name: 'Đội A',
      color: '#e11d48',
      players: [
        { userId: 'u1', displayName: 'Nguyễn Tiến Linh', tier: 'A+' },
        { userId: 'u2', displayName: 'Nguyễn Quang Hải', tier: 'S+' },
      ],
    },
  ];
  const fixtures = [
    {
      id: 'f1',
      status: 'FINISHED',
      goals: [
        { id: 'g1', teamId: 't1', scorerId: 'u1', scorerName: 'Nguyễn Tiến Linh', assistId: 'u2', assistName: 'Nguyễn Quang Hải' },
        { id: 'g2', teamId: 't1', scorerId: 'u1', scorerName: 'Nguyễn Tiến Linh', assistId: 'u2', assistName: 'Nguyễn Quang Hải' },
        { id: 'g3', teamId: 't1', scorerId: 'u2', scorerName: 'Nguyễn Quang Hải', assistId: 'u1', assistName: 'Nguyễn Tiến Linh' },
      ],
    },
  ];
  const mvpVoting = {
    isOpen: true,
    votes: [
      { voterId: 'v1', candidateId: 'u2' },
      { voterId: 'v2', candidateId: 'u2' },
      { voterId: 'v3', candidateId: 'u1' },
    ],
  };

  const { topScorers, topAssists, mvpWinner } = calculatePlayerStats(teams, fixtures, [], mvpVoting);

  assert.equal(topScorers[0].userId, 'u1');
  assert.equal(topScorers[0].goals, 2);
  assert.equal(topAssists[0].userId, 'u2');
  assert.equal(topAssists[0].assists, 2);
  assert.equal(mvpWinner.userId, 'u2');
  assert.equal(mvpWinner.mvpVotes, 2);
});

test('generateGroupFixtures pairs all teams in each group', () => {
  const teams = [
    { id: 't1', name: 'Đội 1', group: 'A' },
    { id: 't2', name: 'Đội 2', group: 'A' },
    { id: 't3', name: 'Đội 3', group: 'A' },
  ];

  const fixtures = generateGroupFixtures(teams);
  assert.equal(fixtures.length, 3); // 3 match pairings for 3 teams
  assert.equal(fixtures.every((f) => f.stage === 'GROUP'), true);
});

test('formatTournamentPayload formats tournament state and permission flags', () => {
  const raw = {
    id: 'cup-1',
    title: 'Giải thử nghiệm',
    createdById: 'user-admin',
    organizerIds: ['user-admin'],
    state: {
      phase: 'DRAFT',
      registrations: [{ userId: 'user-1', positions: ['GK'] }],
      teams: [],
      fixtures: [],
    },
    revision: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const payloadAdmin = formatTournamentPayload(raw, 'user-admin', 'ADMIN');
  assert.equal(payloadAdmin.canManage, true);
  assert.equal(payloadAdmin.canRegister, true);

  const payloadMember = formatTournamentPayload(raw, 'user-1', 'MEMBER');
  assert.equal(payloadMember.canManage, false);
  assert.equal(payloadMember.canRegister, true);
  assert.notEqual(payloadMember.myRegistration, null);
  assert.deepEqual(payloadMember.myRegistration.positions, ['GK']);
});

test('balanceTournamentTeams splits 42 players into 6 balanced teams with goalkeepers and captains', () => {
  const tiers = ['S+', 'S', 'A+', 'A', 'B+', 'B', 'C+', 'C', 'D'];
  const registrations = Array.from({ length: 42 }, (_, i) => ({
    userId: `user-${i + 1}`,
    displayName: `Player ${i + 1}`,
    username: `player${i + 1}`,
    tier: tiers[i % tiers.length],
    positions: i < 6 ? ['GK'] : ['FIXO', 'ALA_LEFT'],
  }));

  const teams = balanceTournamentTeams(registrations, { teamCount: 6, playersPerTeam: 7 });

  assert.equal(teams.length, 6);
  // Each team must have 7 players
  for (const team of teams) {
    assert.equal(team.players.length, 7);
    // Each team has exactly 1 GK
    const gks = team.players.filter((p) => p.position === 'GK');
    assert.equal(gks.length, 1);
    // Has a designated captain
    assert.ok(team.captainId);
    assert.ok(team.captainName);
    assert.ok(team.totalTierScore > 0);
  }

  // All 42 players are present exactly once
  const assigned = teams.flatMap((t) => t.players.map((p) => p.userId));
  assert.equal(assigned.length, 42);
  assert.equal(new Set(assigned).size, 42);

  // Manual swap between teams recalculates team tier scores properly
  const swapped = structuredClone(teams);
  const temp = swapped[0].players[1];
  swapped[0].players[1] = swapped[1].players[1];
  swapped[1].players[1] = temp;
  const recalculated = recalculateTournamentTeams(swapped);
  assert.equal(recalculated.length, 6);
  assert.ok(recalculated[0].totalTierScore > 0);
});
