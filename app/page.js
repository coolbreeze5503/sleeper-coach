"use client";

import { useState } from "react";
import {
  getUser,
  getUserLeagues,
  getLeague,
  getRosters,
  getLeagueUsers,
  getNflState,
  getAllPlayers,
  getWeekProjections,
  getTrending,
} from "../lib/sleeper";
import {
  scoringKey,
  buildProjectionMap,
  buildOwnedSet,
  pairStartersToSlots,
  findUpgrades,
  verdictFor,
} from "../lib/recommend";

const STAGES = {
  USERNAME: "username",
  LEAGUE: "league",
  LOADING: "loading",
  PLAN: "plan",
};

export default function Home() {
  const [stage, setStage] = useState(STAGES.USERNAME);
  const [error, setError] = useState(null);

  const [username, setUsername] = useState("");
  const [user, setUser] = useState(null);
  const [leagues, setLeagues] = useState([]);
  const [league, setLeague] = useState(null);

  const [week, setWeek] = useState(null);
  const [gamePlan, setGamePlan] = useState([]);
  const [teamName, setTeamName] = useState("");

  async function handleFindLeagues(e) {
    e.preventDefault();
    setError(null);
    setStage(STAGES.LOADING);
    try {
      const u = await getUser(username.trim());
      if (!u || !u.user_id) throw new Error("Sleeper username not found.");
      const state = await getNflState();
      const lgs = await getUserLeagues(u.user_id, state.season);
      if (!lgs.length) throw new Error("No NFL leagues found for that user this season.");
      setUser(u);
      setLeagues(lgs);
      setWeek(state.week || 1);
      setStage(STAGES.LEAGUE);
    } catch (err) {
      setError(err.message || "Something went wrong looking up that username.");
      setStage(STAGES.USERNAME);
    }
  }
  async function handleBuildPlan(selectedLeague, selectedWeek) {
    setError(null);
    setStage(STAGES.LOADING);
    try {
      const [fullLeague, rosters, users, players, trendingAdds] = await Promise.all([
        getLeague(selectedLeague.league_id),
        getRosters(selectedLeague.league_id),
        getLeagueUsers(selectedLeague.league_id),
        getAllPlayers(),
        getTrending("add", 24, 100),
      ]);

      const myRoster = rosters.find((r) => r.owner_id === user.user_id);
      if (!myRoster) throw new Error("Couldn't find your roster in this league.");

      const myUserInfo = users.find((u) => u.user_id === user.user_id);
      setTeamName(myUserInfo?.metadata?.team_name || myUserInfo?.display_name || "Your Team");

      const positions = Array.from(
        new Set((fullLeague.roster_positions || []).filter((p) => p !== "BN" && p !== "IR" && p !== "TAXI"))
      );
      const realPositions = new Set();
      positions.forEach((p) => {
        if (p === "FLEX" || p === "WRRB_FLEX") ["RB", "WR", "TE"].forEach((x) => realPositions.add(x));
        else if (p === "SUPER_FLEX") ["QB", "RB", "WR", "TE"].forEach((x) => realPositions.add(x));
        else if (p === "REC_FLEX") ["WR", "TE"].forEach((x) => realPositions.add(x));
        else realPositions.add(p);
      });

      const projections = await getWeekProjections(
        fullLeague.season,
        selectedWeek,
        Array.from(realPositions)
      );
      const key = scoringKey(fullLeague);
      const projectionMap = buildProjectionMap(projections, key);
      const ownedSet = buildOwnedSet(rosters);
      const trendingAddIds = new Set(trendingAdds.map((t) => t.player_id));

      const pairings = pairStartersToSlots(fullLeague, myRoster, players);

      const plan = pairings.map(({ slot, playerId, player }) => {
        const currentPts = playerId ? projectionMap.get(playerId) ?? 0 : 0;
        const upgrades = findUpgrades({
          slot,
          currentPlayerId: playerId,
          currentPts,
          ownedSet,
          playersById: players,
          projectionMap,
          trendingAddIds,
        });
        const best = upgrades[0];
        const verdict = playerId ? verdictFor(currentPts, best) : {
          label: "ADD",
          reason: "This slot is empty — fill it before kickoff.",
        };
        return {
          slot,
          playerId,
          playerName: player ? `${player.first_name} ${player.last_name}` : "Empty slot",
          team: player?.team || "",
          currentPts,
          upgrades,
          verdict,
        };
      });

      setLeague(fullLeague);
      setGamePlan(plan);
      setStage(STAGES.PLAN);
    } catch (err) {
      setError(err.message || "Something went wrong building your game plan.");
      setStage(STAGES.LEAGUE);
    }
  }

  return (
    <main className="min-h-screen font-body">
      <header className="border-b hairline px-6 py-5 flex items-baseline justify-between">
        <h1 className="font-display text-4xl tracking-wide leading-none">
          GAMEPLAN
        </h1>
        <span className="text-xs uppercase tracking-[0.2em] text-chalk/60 stat">
          {stage === STAGES.PLAN && league ? `${league.name} · Week ${week}` : "Weekly Roster Coach"}
        </span>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10">
        {error && (
          <div className="mb-6 border border-alert/60 bg-alert/10 text-chalk px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {stage === STAGES.USERNAME && (
          <form onSubmit={handleFindLeagues} className="space-y-4 max-w-sm">
            <label className="block">
              <span className="text-sm uppercase tracking-wider text-chalk/70">
                Sleeper Username
              </span>
              <input
                autoFocus
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. jsmith22"
                className="mt-1 w-full bg-transparent border hairline px-3 py-2 text-chalk focus:outline-none focus:border-gold"
              />
            </label>
            <button
              type="submit"
              className="bg-gold text-turf-dark font-display text-xl tracking-wide px-5 py-2 hover:brightness-110"
            >
              FIND MY LEAGUES
            </button>
          </form>
        )}

        {stage === STAGES.LOADING && (
          <p className="stat text-chalk/70 animate-pulse">Pulling data from Sleeper…</p>
        )}

        {stage === STAGES.LEAGUE && leagues.length > 0 && (
          <div className="space-y-6">
            <div>
              <span className="text-sm uppercase tracking-wider text-chalk/70">
                Week to analyze
              </span>
              <div className="mt-1 flex gap-2 flex-wrap">
                {Array.from({ length: 18 }, (_, i) => i + 1).map((w) => (
                  <button
                    key={w}
                    onClick={() => setWeek(w)}
                    className={`stat text-sm w-9 h-9 border hairline ${
                      w === week ? "bg-gold text-turf-dark border-gold" : "hover:border-gold"
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="text-sm uppercase tracking-wider text-chalk/70">
                Choose a league
              </span>
              <div className="mt-2 grid gap-2">
                {leagues.map((lg) => (
                  <button
                    key={lg.league_id}
                    onClick={() => handleBuildPlan(lg, week)}
                    className="text-left border hairline px-4 py-3 hover:border-gold transition-colors"
                  >
                    <div className="font-display text-2xl leading-none">{lg.name}</div>
                    <div className="text-xs stat text-chalk/60 mt-1">
                      {lg.total_rosters} teams · {lg.season}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {stage === STAGES.PLAN && (
          <div className="space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-3xl">{teamName}</h2>
              <button
                onClick={() => setStage(STAGES.LEAGUE)}
                className="text-xs uppercase tracking-widest text-chalk/60 hover:text-gold"
              >
                ← change week/league
              </button>
            </div>

            {gamePlan.map((row) => (
              <div key={row.slot + (row.playerId || "")} className="border hairline">
                <div className="flex items-center justify-between px-4 py-3 border-b hairline">
                  <div className="flex items-center gap-3">
                    <span className="stat text-xs text-chalk/50 w-14">{row.slot}</span>
                    <div>
                      <div className="font-display text-2xl leading-none">
                        {row.playerName} {row.team && <span className="text-chalk/50">· {row.team}</span>}
                      </div>
                      <div className="stat text-xs text-chalk/60">
                        proj {row.currentPts.toFixed(1)} pts
                      </div>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 text-xs font-display text-lg tracking-wide ${
                      row.verdict.label === "ADD"
                        ? "verdict-add"
                        : row.verdict.label === "STREAM"
                        ? "bg-slate text-chalk"
                        : "verdict-hold"
                    }`}
                  >
                    {row.verdict.label}
                  </span>
                </div>
                <div className="px-4 py-2 text-sm text-chalk/80">{row.verdict.reason}</div>
                {row.upgrades.length > 0 && (
                  <div className="px-4 pb-3 flex gap-2 flex-wrap">
                    {row.upgrades.map((u) => (
                      <div
                        key={u.playerId}
                        className="stat text-xs border hairline px-2 py-1 flex items-center gap-2"
                      >
                        <span>{u.name}</span>
                        <span className="text-chalk/50">{u.team}</span>
                        <span className={u.delta > 0 ? "text-gold" : "text-chalk/50"}>
                          {u.projected.toFixed(1)} ({u.delta > 0 ? "+" : ""}
                          {u.delta})
                        </span>
                        {u.trending && <span className="text-alert">🔥 trending</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
