const FLEX_ELIGIBLE = {
  FLEX: ["RB", "WR", "TE"],
  SUPER_FLEX: ["QB", "RB", "WR", "TE"],
  WRRB_FLEX: ["RB", "WR"],
  REC_FLEX: ["WR", "TE"],
};

export function scoringKey(league) {
  const rec = league?.scoring_settings?.rec ?? 0;
  if (rec >= 1) return "pts_ppr";
  if (rec > 0) return "pts_half_ppr";
  return "pts_std";
}

export function buildProjectionMap(projections, key) {
  const map = new Map();
  for (const row of projections) {
    if (!row || !row.player_id) continue;
    const pts = row.stats?.[key];
    map.set(row.player_id, typeof pts === "number" ? pts : 0);
  }
  return map;
}

export function buildOwnedSet(rosters) {
  const owned = new Set();
  for (const r of rosters) {
    for (const pid of r.players || []) owned.add(pid);
  }
  return owned;
}

function slotEligible(slot, position) {
  if (slot === position) return true;
  if (FLEX_ELIGIBLE[slot]) return FLEX_ELIGIBLE[slot].includes(position);
  return false;
}

export function pairStartersToSlots(league, myRoster, playersById) {
  const startingSlots = (league.roster_positions || []).filter(
    (s) => s !== "BN" && s !== "IR" && s !== "TAXI"
  );
  const starters = myRoster.starters || [];
  return startingSlots.map((slot, i) => {
    const pid = starters[i];
    const player = pid && pid !== "0" ? playersById[pid] : null;
    return { slot, playerId: pid, player };
  });
}

export function findUpgrades({
  slot,
  currentPlayerId,
  currentPts,
  ownedSet,
  playersById,
  projectionMap,
  trendingAddIds,
  limit = 3,
}) {
  const candidates = [];
  for (const [pid, player] of Object.entries(playersById)) {
    if (ownedSet.has(pid)) continue;
    if (pid === currentPlayerId) continue;
    if (!player?.position) continue;
    if (!slotEligible(slot, player.position)) continue;
    if (player.status && ["Inactive", "Retired"].includes(player.status)) continue;
    const pts = projectionMap.get(pid) ?? 0;
    if (pts <= 0) continue;
    candidates.push({
      playerId: pid,
      name: `${player.first_name} ${player.last_name}`,
      team: player.team || "FA",
      position: player.position,
      projected: pts,
      trending: trendingAddIds.has(pid),
    });
  }
  candidates.sort((a, b) => b.projected - a.projected);
  return candidates.slice(0, limit).map((c) => ({
    ...c,
    delta: +(c.projected - currentPts).toFixed(1),
  }));
}

export function verdictFor(currentPts, bestUpgrade) {
  if (!bestUpgrade) {
    return {
      label: "HOLD",
      reason: "No meaningfully better option is currently available.",
    };
  }
  const delta = bestUpgrade.projected - currentPts;
  if (delta >= 4) {
    return {
      label: "ADD",
      reason: `${bestUpgrade.name} projects for ${delta.toFixed(
        1
      )} more points this week — worth the waiver claim or pickup.`,
    };
  }
  if (delta >= 1.5) {
    return {
      label: "STREAM",
      reason: `${bestUpgrade.name} is a modest upgrade (+${delta.toFixed(
        1
      )} pts). Reasonable speculative add if you have a free bench/waiver slot.`,
    };
  }
  return {
    label: "HOLD",
    reason: "Your current starter projects about the same or better. Not worth the move.",
  };
}

// Looks at a player's last few completed weeks of ACTUAL scoring to gauge
// how volatile ("boom/bust") vs. steady they've been.
export function buildBoomBustMap(weeklyStatsList, key) {
  const perPlayer = new Map();
  weeklyStatsList.forEach((weekRows) => {
    for (const row of weekRows) {
      if (!row || !row.player_id) continue;
      const pts = row.stats?.[key];
      if (typeof pts !== "number") continue;
      if (!perPlayer.has(row.player_id)) perPlayer.set(row.player_id, []);
      perPlayer.get(row.player_id).push(pts);
    }
  });
  const result = new Map();
  for (const [pid, arr] of perPlayer.entries()) {
    if (arr.length === 0) continue;
    const floor = Math.min(...arr);
    const ceiling = Math.max(...arr);
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    result.set(pid, {
      floor: +floor.toFixed(1),
      ceiling: +ceiling.toFixed(1),
      avg: +avg.toFixed(1),
      weeks: arr.length,
    });
  }
  return result;
}
