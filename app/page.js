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

const STEP_NUMBER = {
  [STAGES.USERNAME]: 1,
  [STAGES.LEAGUE]: 2,
  [STAGES.LOADING]: 2,
  [STAGES.PLAN]: 3,
};

function StepDots({ stage }) {
  const current = STEP_NUMBER[stage] || 1;
  return (
    <div className="flex items-center gap-2">
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={`step-dot ${n <= current ? "step-dot-active" : ""}`}
        />
      ))}
    </div>
  );
}

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
      if (!u || !u.user_id) throw new Error("That Sleeper username wasn't found. Double check the spelling — it's case-sensitive.");
      const state = await getNflState();
      const lgs = await getUserLeagues(u.user_id, state.season);
      if (!lgs.length) throw new Error("No NFL leagues found for that username this season.");
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
      <header className="border-b hairline px-6 py-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <h1 className="font-display text-4xl tracking-wide leading-none text-bone">
              GAMEPLAN
            </h1>
            <span className="hidden sm:inline text-[11px] uppercase tracking-[0.25em] text-steel">
              Weekly Roster Coach
            </span>
          </div>
          <StepDots stage={stage} />
        </div>
        <div className="h-[2px] w-16 bg-crimson mt-4 max-w-4xl mx-auto" />
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10">
        {error && (
          <div className="mb-6 border border-crimson/50 bg-crimson/10 text-bone px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {stage === STAGES.USERNAME && (
          <div className="max-w-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-crimson mb-1">Step 1 of 3</p>
            <h2 className="font-display text-2xl mb-1">Find your leagues</h2>
            <p className="text-sm text-steel mb-6">
              Enter the username you use to log into Sleeper. This only reads public league data — no password needed.
            </p>
            <form onSubmit={handleFindLeagues} className="space-y-4">
              <label className="block">
                <span className="text-xs uppercase tracking-wider text-steel">
                  Sleeper Username
                </span>
                <input
                  autoFocus
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. jsmith22"
                  className="mt-1 w-full bg-coal-light border hairline px-3 py-2.5 text-bone focus:outline-none focus:border-crimson rounded-sm"
                />
              </label>
              <button
                type="submit"
                className="w-full bg-crimson text-bone font-display text-xl tracking-wide px-5 py-2.5 hover:bg-crimson-bright transition-colors rounded-sm"
              >
                FIND MY LEAGUES
              </button>
            </form>
          </div>
        )}

        {stage === STAGES.LOADING && (
          <div className="flex items-center gap-3 text-steel">
            <span className="w-2 h-2 rounded-full bg-crimson animate-ping" />
            <p className="stat text-sm">Pulling data from Sleeper…</p>
          </div>
        )}

        {stage === STAGES.LEAGUE && leagues.length > 0 && (
          <div className="space-y-8">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-crimson mb-1">Step 2 of 3</p>
              <h2 className="font-display text-2xl mb-1">Pick a league and week</h2>
              <p className="text-sm text-steel">
                Choose which week you're planning for, then tap a league to build your game plan.
              </p>
            </div>

            <div>
              <span className="text-xs uppercase tracking-wider text-steel">
                Week
              </span>
              <div className="mt-2 flex gap-2 flex-wrap">
                {Array.from({ length: 18 }, (_, i) => i + 1).map((w) => (
                  <button
                    key={w}
                    onClick={() => setWeek(w)}
                    className={`stat text-sm w-9 h-9 border hairline rounded-sm transition-colors ${
                      w === week ? "bg-crimson text-bone border-crimson" : "hover:border-crimson text-steel"
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="text-xs uppercase tracking-wider text-steel">
                League
              </span>
              <div className="mt-2 grid gap-2">
                {leagues.map((lg) => (
                  <button
                    key={lg.league_id}
                    onClick={() => handleBuildPlan(lg, week)}
                    className="card text-left border hairline px-4 py-3 hover:border-crimson transition-colors rounded-sm"
                  >
                    <div className="font-display text-2xl leading-none text-bone">{lg.name}</div>
                    <div className="text-xs stat text-steel mt-1">
                      {lg.total_rosters} teams · {lg.season}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {stage === STAGES.PLAN && (
          <div className="space-y-6">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-crimson mb-1">Step 3 of 3</p>
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-3xl text-bone">{teamName}</h2>
                <button
                  onClick={() => setStage(STAGES.LEAGUE)}
                  className="text-xs uppercase tracking-widest text-steel hover:text-crimson transition-colors"
                >
                  ← change week/league
                </button>
              </div>
              <p className="text-sm text-steel mt-1">
                {league?.name} · Week {week}. Every starting slot below is checked against the best unowned player available.
              </p>
            </div>

            <div className="flex flex-wrap gap-4 text-xs text-steel pb-2 border-b hairline">
              <span><span className="verdict-add px-2 py-0.5 rounded-sm mr-1">ADD</span>clear upgrade available</span>
              <span><span className="verdict-stream px-2 py-0.5 rounded-sm mr-1">STREAM</span>modest upgrade, optional</span>
              <span><span className="verdict-hold px-2 py-0.5 rounded-sm mr-1">HOLD</span>keep your starter</span>
            </div>

            {gamePlan.map((row) => (
              <div key={row.slot + (row.playerId || "")} className="card border hairline rounded-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b hairline">
                  <div className="flex items-center gap-3">
                    <span className="stat text-xs text-steel w-14">{row.slot}</span>
                    <div>
                      <div className="font-display text-2xl leading-none text-bone">
                        {row.playerName} {row.team && <span className="text-steel">· {row.team}</span>}
                      </div>
                      <div className="stat text-xs text-steel">
                        proj {row.currentPts.toFixed(1)} pts
                      </div>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 text-xs font-display text-lg tracking-wide rounded-sm ${
                      row.verdict.label === "ADD"
                        ? "verdict-add"
                        : row.verdict.label === "STREAM"
                        ? "verdict-stream"
                        : "verdict-hold"
                    }`}
                  >
                    {row.verdict.label}
                  </span>
                </div>
                <div className="px-4 py-2 text-sm text-bone/80">{row.verdict.reason}</div>
                {row.upgrades.length > 0 && (
                  <div className="px-4 pb-3 flex gap-2 flex-wrap">
                    {row.upgrades.map((u) => (
                      <div
                        key={u.playerId}
                        className="stat text-xs border hairline px-2 py-1 flex items-center gap-2 rounded-sm"
                      >
                        <span className="text-bone">{u.name}</span>
                        <span className="text-steel">{u.team}</span>
                        <span className={u.delta > 0 ? "text-crimson-bright" : "text-steel"}>
                          {u.projected.toFixed(1)} ({u.delta > 0 ? "+" : ""}
                          {u.delta})
                        </span>
                        {u.trending && <span className="text-crimson-bright">🔥 trending</span>}
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