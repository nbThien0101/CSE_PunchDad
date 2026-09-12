/**
 * Team Balancer Service
 * Chia team cân bằng dựa theo Tier và ràng buộc Thủ môn (GK)
 * Mỗi đội đúng 5 người (1 Thủ môn + 4 Cầu thủ sân).
 */

const TIER_WEIGHTS = {
  S: 5,
  A: 4,
  B: 3,
  C: 2,
  D: 1,
};

const DEFAULT_TIER_WEIGHT = 2; // Unranked / null

const TEAM_CONFIGS = [
  { name: 'Team Xanh Dương', color: '#2563eb', bg: '#eff6ff' },
  { name: 'Team Cam', color: '#ea580c', bg: '#fff7ed' },
  { name: 'Team Xanh Lá', color: '#16a34a', bg: '#f0fdf4' },
  { name: 'Team Đỏ', color: '#dc2626', bg: '#fef2f2' },
  { name: 'Team Tím', color: '#9333ea', bg: '#faf5ff' },
  { name: 'Team Vàng', color: '#ca8a04', bg: '#fefce8' },
  { name: 'Team Xám', color: '#475569', bg: '#f8fafc' },
  { name: 'Team Hồng', color: '#db2777', bg: '#fdf2f8' },
];

/**
 * Lấy điểm số của 1 tier
 */
function getTierScore(tier) {
  if (!tier) return DEFAULT_TIER_WEIGHT;
  const normalized = String(tier).trim().toUpperCase();
  return TIER_WEIGHTS[normalized] || DEFAULT_TIER_WEIGHT;
}

/**
 * Tính tổng điểm của một đội
 */
function calculateTeamScore(team) {
  let score = 0;
  if (team.goalkeeper && !team.goalkeeper.isPlaceholder) {
    score += getTierScore(team.goalkeeper.tier);
  }
  if (Array.isArray(team.players)) {
    for (const p of team.players) {
      score += getTierScore(p.tier);
    }
  }
  return score;
}

/**
 * Tính phương sai của các đội
 */
function calculateVariance(teams) {
  const scores = teams.map(calculateTeamScore);
  const mean = scores.reduce((sum, s) => sum + s, 0) / (scores.length || 1);
  return scores.reduce((acc, s) => acc + Math.pow(s - mean, 2), 0) / (scores.length || 1);
}

/**
 * Fisher-Yates shuffle an array
 */
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Xáo trộn ngẫu nhiên các cầu thủ có CÙNG tierScore,
 * nhưng vẫn giữ nguyên thứ tự ưu tiên giảm dần giữa các Tier khác nhau:
 * Tier S -> Tier A -> Tier B -> Tier C -> Tier D -> Unranked
 */
function sortAndRandomizeByTier(players) {
  // Nhóm theo tierScore
  const groups = {};
  for (const p of players) {
    const score = p.tierScore;
    if (!groups[score]) groups[score] = [];
    groups[score].push(p);
  }

  // Lấy danh sách tierScore giảm dần (5 -> 4 -> 3 -> 2 -> 1)
  const sortedScores = Object.keys(groups)
    .map(Number)
    .sort((a, b) => b - a);

  // Với mỗi mức điểm Tier, xáo trộn ngẫu nhiên danh sách cầu thủ thuộc tier đó
  const randomizedList = [];
  for (const score of sortedScores) {
    const shuffledGroup = shuffleArray(groups[score]);
    randomizedList.push(...shuffledGroup);
  }

  return randomizedList;
}

/**
 * Gợi ý số lượng đội dựa trên số người vote
 */
function getSuggestedTeamCounts(joinCount) {
  if (joinCount < 10) return [2];

  const standard = Math.floor(joinCount / 5);
  const options = [];

  // Ví dụ 24 người -> có thể chia 4 đội (dư 4 dự bị) hoặc 5 đội (xoay tua 1 GK)
  // 21 người -> 4 đội (dư 1 dự bị)
  // 20 người -> 4 đội
  if (standard >= 2) {
    options.push(standard);
  }

  // Nếu dư 4 người (vd: 14, 19, 24, 29), có thể chia thêm 1 team dùng lại GK
  if (joinCount % 5 === 4) {
    const extended = Math.ceil(joinCount / 5);
    if (!options.includes(extended)) {
      options.push(extended);
    }
  }

  // Luôn cho phép admin linh hoạt chọn từ 2 đến Math.max(standard, Math.ceil(joinCount/5))
  const maxPossible = Math.max(2, Math.ceil(joinCount / 5));
  const fullRange = [];
  for (let i = 2; i <= Math.min(maxPossible, 6); i++) {
    fullRange.push(i);
  }

  return {
    recommended: joinCount % 5 === 4 ? Math.ceil(joinCount / 5) : Math.floor(joinCount / 5),
    available: fullRange,
  };
}

/**
 * Thuật toán chia team
 * @param {Array} voters - Danh sách votes (status = JOIN), sắp xếp theo votedAt ASC
 * @param {Object} options - { teamCount?: number, goalkeeperOverrides?: { [userId]: boolean } }
 */
function balanceTeams(voters, options = {}) {
  // Lọc chỉ lấy những người JOIN
  const joinVotes = voters
    .filter(v => v.status === 'JOIN')
    .sort((a, b) => new Date(a.votedAt) - new Date(b.votedAt));

  const totalJoin = joinVotes.length;
  if (totalJoin < 4) {
    throw new Error('Cần ít nhất 4 người tham gia để chia đội');
  }

  // Xác định số đội
  let teamCount = options.teamCount;
  if (!teamCount || teamCount < 2) {
    const suggestions = getSuggestedTeamCounts(totalJoin);
    teamCount = suggestions.recommended || 2;
  }

  // Mỗi đội 5 người -> Tổng số slot cầu thủ
  const totalSlotsNeeded = teamCount * 5;

  // Lấy các ứng viên theo thứ tự vote sớm nhất
  // Nếu totalJoin >= totalSlotsNeeded: lấy đúng totalSlotsNeeded người sớm nhất
  // Nếu totalJoin < totalSlotsNeeded: lấy toàn bộ người hiện có, phần thiếu sẽ dùng lại GK luân phiên
  const selectedCount = Math.min(totalJoin, totalSlotsNeeded);
  const selectedVotes = joinVotes.slice(0, selectedCount);
  const reserveVotes = joinVotes.slice(selectedCount);

  // Chuẩn bị danh sách cầu thủ được chọn
  const players = selectedVotes.map((v, index) => {
    const user = v.user || {};
    // Kiểm tra override GK từ options nếu có
    const isGK = options.goalkeeperOverrides && options.goalkeeperOverrides[user.id] !== undefined
      ? Boolean(options.goalkeeperOverrides[user.id])
      : Boolean(user.isGoalkeeper);

    return {
      userId: user.id,
      displayName: user.displayName,
      avatar: user.avatar || null,
      tier: user.tier || null,
      tierScore: getTierScore(user.tier),
      isGoalkeeper: isGK,
      votedAt: v.votedAt,
      voteOrder: index + 1,
    };
  });

  // Tách thủ môn và cầu thủ sân
  const gkList = players.filter(p => p.isGoalkeeper);
  let fieldList = players.filter(p => !p.isGoalkeeper);

  // Khởi tạo các đội
  const teams = [];
  for (let i = 0; i < teamCount; i++) {
    const cfg = TEAM_CONFIGS[i % TEAM_CONFIGS.length];
    teams.push({
      id: `team-${i + 1}`,
      name: cfg.name,
      color: cfg.color,
      bg: cfg.bg,
      goalkeeper: null,
      players: [],
      totalTierScore: 0,
      averageTierScore: 0,
    });
  }

  // ==========================================
  // BƯỚC 1: Phân bổ Thủ môn (Goalkeeper)
  // ==========================================
  // BƯỚC 1: Phân bổ Thủ môn (Goalkeeper)
  // ==========================================
  // Sắp xếp và xáo trộn ngẫu nhiên thủ môn có CÙNG tier
  const randomizedGKs = sortAndRandomizeByTier(gkList);

  if (randomizedGKs.length >= teamCount) {
    // Trường hợp 1: Số GK >= số đội
    // Lấy teamCount GK đầu và phân bổ vào các đội
    const selectedGKs = randomizedGKs.slice(0, teamCount);
    for (let i = 0; i < teamCount; i++) {
      teams[i].goalkeeper = {
        ...selectedGKs[i],
        role: 'GK',
        isShared: false,
      };
    }
    // Các thủ môn dư sẽ thi đấu như cầu thủ sân bình thường!
    const surplusGKs = randomizedGKs.slice(teamCount).map(gk => ({
      ...gk,
      role: 'FIELD',
      isGoalkeeperOriginal: true,
    }));
    fieldList = [...fieldList, ...surplusGKs];
  } else if (randomizedGKs.length > 0) {
    // Trường hợp 2: Số GK < số đội (nhưng có ít nhất 1 GK)
    // Xáo trộn ngẫu nhiên thứ tự các GK sẵn có để mỗi lần chia, đội nhận GK luân phiên khác nhau
    const shuffledGKs = shuffleArray(randomizedGKs);
    for (let i = 0; i < shuffledGKs.length; i++) {
      teams[i].goalkeeper = {
        ...shuffledGKs[i],
        role: 'GK',
        isShared: false,
      };
    }
    // Các đội còn lại dùng lại / luân phiên thủ môn từ danh sách GK sẵn có
    for (let i = shuffledGKs.length; i < teamCount; i++) {
      const rotatingGK = shuffledGKs[i % shuffledGKs.length];
      teams[i].goalkeeper = {
        ...rotatingGK,
        role: 'GK',
        isShared: true,
        sharedFrom: teams[i % shuffledGKs.length].name,
      };
    }
  } else {
    // Trường hợp 3: Không có ai đăng ký GK
    // Đánh dấu luân phiên bắt gôn
    for (let i = 0; i < teamCount; i++) {
      teams[i].goalkeeper = {
        userId: `rotating-gk-${i + 1}`,
        displayName: 'Thủ môn luân phiên',
        avatar: null,
        tier: null,
        tierScore: DEFAULT_TIER_WEIGHT,
        isGoalkeeper: true,
        isPlaceholder: true,
        role: 'GK',
      };
    }
  }

  // ==========================================
  // BƯỚC 2: Phân bổ Cầu thủ sân (Field Players)
  // ==========================================
  // XÁO TRỘN NGẪU NHIÊN giữa các cầu thủ có CÙNG tier,
  // nhưng vẫn bảo toàn thứ tự giảm dần giữa các Tier (S -> A -> B -> C -> D)
  fieldList = sortAndRandomizeByTier(fieldList);

  // Mỗi đội cần 4 cầu thủ sân
  const slotsPerTeam = 4;

  // Thuật toán Greedy Snake Draft với Random Tie-Breaking (ngẫu nhiên hóa khi các đội bằng điểm)
  for (const player of fieldList) {
    // Tìm điểm số thấp nhất hiện tại trong số các đội còn slot
    let minScore = Infinity;
    for (const t of teams) {
      if (t.players.length < slotsPerTeam) {
        const currentScore = calculateTeamScore(t);
        if (currentScore < minScore) {
          minScore = currentScore;
        }
      }
    }

    // Lọc tất cả các đội có cùng minScore (hòa điểm) và còn slot
    const tiedCandidateTeams = teams.filter(
      t => t.players.length < slotsPerTeam && calculateTeamScore(t) === minScore
    );

    // Chọn ngẫu nhiên 1 đội trong số các đội có cùng minScore để phá vỡ tính rập khuôn
    if (tiedCandidateTeams.length > 0) {
      const selectedTeam = tiedCandidateTeams[Math.floor(Math.random() * tiedCandidateTeams.length)];
      selectedTeam.players.push({
        ...player,
        role: 'FIELD',
      });
    }
  }

  // Nếu số lượng cầu thủ sân bị thiếu (ví dụ: trường hợp 24 người chia 5 đội, mỗi đội 5 slot = 25, thiếu 1 người)
  // Nhưng slot thiếu đã được giải quyết bằng việc 1 GK được dùng lại (isShared) ở Bước 1!
  // Đảm bảo mỗi đội đủ 4 cầu thủ sân nếu tổng số fieldList đủ 4 * teamCount.
  // Nếu fieldList < 4 * teamCount (do thiếu người), đội nào thiếu sẽ có ghi chú rõ ràng.

  // ==========================================
  // BƯỚC 3: Tối ưu hóa cân bằng (2-Opt Swap)
  // ==========================================
  let improved = true;
  let iterations = 0;
  const maxIterations = 50;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    let currentVar = calculateVariance(teams);

    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const teamA = teams[i];
        const teamB = teams[j];

        // Thử hoán đổi từng cặp cầu thủ sân giữa teamA và teamB
        for (let pA = 0; pA < teamA.players.length; pA++) {
          for (let pB = 0; pB < teamB.players.length; pB++) {
            // Hoán đổi tạm thời
            const temp = teamA.players[pA];
            teamA.players[pA] = teamB.players[pB];
            teamB.players[pB] = temp;

            const newVar = calculateVariance(teams);
            if (newVar < currentVar - 0.001) {
              currentVar = newVar;
              improved = true;
            } else {
              // Hoàn trả nếu không cải thiện
              teamB.players[pB] = teamA.players[pA];
              teamA.players[pA] = temp;
            }
          }
        }
      }
    }
  }

  // Cập nhật lại tổng điểm và điểm trung bình cho từng đội
  for (const team of teams) {
    team.totalTierScore = calculateTeamScore(team);
    const totalMembers = (team.goalkeeper && !team.goalkeeper.isPlaceholder ? 1 : 0) + team.players.length;
    team.averageTierScore = totalMembers > 0 ? Number((team.totalTierScore / totalMembers).toFixed(1)) : 0;
  }

  // Chuẩn bị danh sách dự bị (Reserves)
  const reserves = reserveVotes.map((v, index) => {
    const user = v.user || {};
    return {
      userId: user.id,
      displayName: user.displayName,
      avatar: user.avatar || null,
      tier: user.tier || null,
      isGoalkeeper: Boolean(user.isGoalkeeper),
      votedAt: v.votedAt,
      reserveOrder: index + 1,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    teamCount,
    totalVoters: totalJoin,
    activePlayersCount: selectedCount,
    reservesCount: reserves.length,
    teams,
    reserves,
    variance: Number(calculateVariance(teams).toFixed(2)),
  };
}

module.exports = {
  getTierScore,
  getSuggestedTeamCounts,
  balanceTeams,
};
