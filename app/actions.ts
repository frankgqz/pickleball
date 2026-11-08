"use server";
import { prisma } from "@/prisma/client";

// ===== DUPR API Configuration =====
const DUPR_API_BASE = "https://api.dupr.gg";

interface DuprTokenResponse {
  status: string;
  result: {
    accessToken: string;
    refreshToken: string;
    user: {
      id: number;
      fullName: string;
      referralCode: string;
      stats: {
        singles: string;
        doubles: string;
        defaultRating: string;
      };
    };
  };
}

// ===== DUPR Authentication =====
// Cache the login token and back off after a failed login: every login ATTEMPT
// against a 2FA-challenged account makes DUPR email a fresh code (one search =
// one email flood). Cooldown = at most one attempt per 10 minutes.
let cachedDuprToken: string | null = null;
let lastDuprLoginFailAt = 0;
const DUPR_LOGIN_COOLDOWN_MS = 10 * 60 * 1000;
let duprTokenSource: string | null = null;
let duprTokenReadAt = 0;

let cachedTokenIsCookie = false;
async function getDuprToken(): Promise<string | null> {
  if (cachedDuprToken) return cachedDuprToken;
  // Database token FIRST (kept fresh by the dupr-renew cron). The static env
  // token used to shadow it and silently go stale — Frank's post-renewal
  // "Session expired" was exactly that (2026-11-09).
  try {
    const row = await prisma.authState.findUnique({ where: { key: "dupr_at" } });
    if (row && row.value) {
      cachedDuprToken = row.value;
      cachedTokenIsCookie = true;
      duprTokenSource = "db";
      duprTokenReadAt = Date.now();
      return row.value;
    }
  } catch (e) { console.warn("authState read failed:", String((e as Error).message).slice(0, 200)); }
  // Static token from the dupr-auth ritual (tools/dupr-auth.ts) — skips login
  if (process.env.DUPR_TOKEN) {
    cachedDuprToken = process.env.DUPR_TOKEN;
    cachedTokenIsCookie = true;
    duprTokenSource = "env";
    duprTokenReadAt = Date.now();
    return cachedDuprToken;
  }
  if (Date.now() - lastDuprLoginFailAt < DUPR_LOGIN_COOLDOWN_MS) return null;
  const email = process.env.DUPR_EMAIL;
  const password = process.env.DUPR_PASSWORD;
  if (!email || !password) {
    console.error("DUPR credentials not configured");
    return null;
  }
  try {
    const response = await fetch(`${DUPR_API_BASE}/auth/v1.0/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data: DuprTokenResponse = await response.json();
    if (data.status === "SUCCESS" && data.result?.accessToken) {
      cachedDuprToken = data.result.accessToken;
      duprTokenSource = "login";
      duprTokenReadAt = Date.now();
      return cachedDuprToken;
    }
    lastDuprLoginFailAt = Date.now();
    return null;
  } catch (error) {
    console.error("DUPR login failed:", error);
    lastDuprLoginFailAt = Date.now();
    return null;
  }
}

// Frank pastes URLs ("dashboard.dupr.com/dashboard/player/6356550895") into
// the ID field — accept both shapes (Frank 2026-11-09: the raw URL defeated
// the duplicate check and made a second Peter).
function normalizeDuprNumericId(raw: string | null | undefined): string {
  const s = (raw || "").trim();
  const m = s.match(/(\d{5,})/);
  return m ? m[1] : s;
}
// Frank's URL landed in the duprId (star) field — normalize both shapes there
function normalizeDuprId(raw: string | null | undefined): string {
  const s = (raw || "").trim();
  if (/dashboard\.dupr\.com|https?:|\//.test(s)) {
    const m = s.match(/(\d{5,})/);
    return m ? m[1] : s;
  }
  return s;
}

// ===== PLAYER ACTIONS (Global lookup) =====

// Get all players from database (for autocomplete)
export async function getPlayers() {
  try {
    const players = await prisma.player.findMany({
      orderBy: { name: "asc" },
    });
    return { success: true, players };
  } catch (error) {
    console.error("Error fetching players:", error);
    return { success: false, players: [], error: "Failed to fetch players" };
  }
}

// Find a player by duprId or duprNumericId (for prefill)
export async function findPlayerByDupr(duprId?: string, duprNumericId?: string) {
  try {
    if (!duprId?.trim() && !duprNumericId?.trim()) {
      return { success: true, player: null };
    }
    
    let player = null;
    if (duprId?.trim()) {
      player = await prisma.player.findFirst({
        where: { duprId: duprId.trim() },
      });
    }
    if (!player && duprNumericId?.trim()) {
      player = await prisma.player.findFirst({
        where: { duprNumericId: duprNumericId.trim() },
      });
    }
    return { success: true, player };
  } catch (error) {
    console.error("Error finding player:", error);
    return { success: false, player: null, error: "Failed to find player" };
  }
}

// Migrate players created while logged OUT into the DB on first login.
// Keeps their LOCAL ids (Prisma accepts client-supplied ids) so event pool /
// standings / rounds references never break. Idempotent.
export async function importLocalPlayers(
  players: Array<{ id: string; name: string; duprId?: string | null; duprNumericId?: string | null; duprScore?: number | null; manualDuprScore?: number | null }>,
  userId: string
) {
  try {
    for (const p of players) {
      await prisma.player.upsert({
        where: { id: p.id },
        update: {},
        create: {
          id: p.id,
          name: p.name,
          duprId: p.duprId ?? null,
          duprNumericId: p.duprNumericId ?? null,
          duprScore: p.duprScore ?? null,
          manualDuprScore: p.manualDuprScore ?? null,
        },
      });
      try {
        await prisma.clubPlayer.upsert({
          where: { userId_playerId: { userId, playerId: p.id } },
          update: {},
          create: { userId, playerId: p.id },
        });
      } catch { /* roster link may already exist under another shape */ }
    }
    return { success: true, migrated: players.length };
  } catch (error) {
    console.error("Error importing local players:", error);
    return { success: false, error: "Failed to import local players" };
  }
}

// Add a new player to global database (with upsert/merge logic)
export async function addPlayer(formData: FormData, userId?: string) {
  const name = formData.get("name") as string;
  const duprId = normalizeDuprId(formData.get("duprId") as string);
  const duprNumericId = normalizeDuprNumericId(formData.get("duprNumericId") as string);
  const manualDuprScore = formData.get("manualDuprScore") as string;

  if (!name?.trim()) {
    return { success: false, error: "Name is required" };
  }

  try {
    // First, try to find existing player by duprId or duprNumericId
    let existingPlayer = null;

    if (duprId?.trim()) {
      existingPlayer = await prisma.player.findFirst({
        where: { duprId: duprId.trim() },
      });
    }

    if (!existingPlayer && duprNumericId?.trim()) {
      existingPlayer = await prisma.player.findFirst({
        where: { duprNumericId: duprNumericId.trim() },
      });
    }

    let player;
    let merged = false;

    if (existingPlayer) {
      // Update existing player - merge information, don't overwrite unless new info provided
      player = await prisma.player.update({
        where: { id: existingPlayer.id },
        data: {
          name: name.trim(),
          // Only update duprId if provided and existing is null
          duprId: existingPlayer.duprId ?? (duprId?.trim() || null),
          // Only update duprNumericId if provided and existing is null
          duprNumericId: existingPlayer.duprNumericId ?? (duprNumericId?.trim() || null),
          // Only update manualDuprScore if provided and existing is null
          manualDuprScore: manualDuprScore ? parseFloat(manualDuprScore) : existingPlayer.manualDuprScore ?? null,
        },
      });
      merged = true;

      // Sync playerName to all ClubPlayer entries
      await prisma.clubPlayer.updateMany({
        where: { playerId: player.id },
        data: { playerName: name.trim() },
      });
    } else {
      // Create new player
      player = await prisma.player.create({
        data: {
          name: name.trim(),
          duprId: duprId?.trim() || null,
          duprNumericId: duprNumericId?.trim() || null,
          manualDuprScore: manualDuprScore ? parseFloat(manualDuprScore) : null,
        },
      });
    }

    // If userId provided, also add to their club roster
    if (userId) {
      // Check if already in their roster
      const existingClubPlayer = await prisma.clubPlayer.findFirst({
        where: { userId, playerId: player.id },
      });
      if (!existingClubPlayer) {
        await prisma.clubPlayer.create({
          data: {
            userId,
            playerId: player.id,
            playerName: player.name,
          },
        });
      }
    }

    return { success: true, player, merged };
  } catch (error) {
    console.error("Error adding player:", error);
    return { success: false, error: "Failed to add player" };
  }
}

// Delete a player from global database (and all club associations)
export async function deletePlayer(id: string) {
  try {
    // First delete all club associations
    await prisma.clubPlayer.deleteMany({
      where: { playerId: id },
    });
    // Then delete the player
    await prisma.player.delete({
      where: { id },
    });
    return { success: true };
  } catch (error) {
    console.error("Error deleting player:", error);
    return { success: false, error: "Failed to delete player" };
  }
}

// Update a player in global database
export async function updatePlayer(playerId: string, formData: FormData) {
  const name = formData.get("name") as string;
  const duprId = normalizeDuprId(formData.get("duprId") as string);
  const duprNumericId = normalizeDuprNumericId(formData.get("duprNumericId") as string);
  const manualDuprScore = formData.get("manualDuprScore") as string;

  try {
    const player = await prisma.player.update({
      where: { id: playerId },
      data: {
        name: name.trim(),
        duprId: duprId?.trim() || null,
        duprNumericId: duprNumericId?.trim() || null,
        manualDuprScore: manualDuprScore ? parseFloat(manualDuprScore) : null,
      },
    });

    // Sync playerName to all ClubPlayer entries
    await prisma.clubPlayer.updateMany({
      where: { playerId },
      data: { playerName: name.trim() },
    });

    return { success: true, player };
  } catch (error) {
    console.error("Error updating player:", error);
    return { success: false, error: "Failed to update player" };
  }
}

// Fetch and update player rating and avatar from DUPR
// DUPR now allows only ~3 lookups at a time for OTHER people's ratings
// (Frank, 2026-11-05). Keep at most ONE lookup in flight: rapid clicks queue
// up instead of tripping the limit together.
let duprChain: Promise<unknown> = Promise.resolve();
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = duprChain.then(fn, fn);
  duprChain = run.then(() => undefined, () => undefined);
  return run;
}

export async function fetchDuprRating(playerId: string) {
  return enqueue(() => fetchDuprRatingInner(playerId));
}

async function fetchDuprRatingInner(playerId: string) {
  try {
    const player = await prisma.player.findUnique({
      where: { id: playerId },
    });
    if (!player || !player.duprNumericId) {
      return { success: false, error: "Player or Numeric DUPR ID not found" };
    }

    const token = await getDuprToken();
    if (!token) {
      return { success: false, error: "Failed to login to DUPR" };
    }

    const callPlayer = (tok: string) =>
      fetch(`${DUPR_API_BASE}/player/v1.0/${normalizeDuprNumericId(player.duprNumericId)}`, {
        method: "GET",
        headers: {
          // DUPR_TOKEN (from the dupr-auth ritual) is a COOKIE-session token —
          // send it as the __Host-dupr_at cookie; login-flow tokens use Bearer.
          // Cookie __Host-dupr_at is the ONLY accepted shape for the ritual's
          // session token (Frank 2026-11-09 matrix: dupr_at= says "valid API
          // key", Bearer says "Invalid token" — sending both POISONS the call).
          "Cookie": `__Host-dupr_at=${tok}`,
          "Content-Type": "application/json",
        },
      });

    let response = await callPlayer(token);
    // DUPR ROTATES the session on use (Frank 2026-11-09: a fetch worked, the
    // next one said "Invalid token") — follow the rotation and persist it.
    const persistToken = async (tok: string) => {
      cachedDuprToken = tok;
      cachedTokenIsCookie = true;
      duprTokenSource = "rotation";
      duprTokenReadAt = Date.now();
      try {
        await prisma.authState.upsert({ where: { key: "dupr_at" }, update: { value: tok }, create: { key: "dupr_at", value: tok } });
      } catch { /* persistence is best-effort */ }
    };
    const sc = response.headers.get("set-cookie") || "";
    const rotated = sc.match(/(?:__Host-)?dupr_at=([^;\s,]+)/);
    if (rotated && rotated[1] !== token) await persistToken(rotated[1]);
    if (response.status === 401) {
      // dead token (rotation lost or expired) — bust the cache, re-read, and
      // if that is the same dead token, MINT a fresh session via login
      cachedDuprToken = null;
      let fresh = await getDuprToken();
      if (fresh === token) {
        lastDuprLoginFailAt = 0;
        fresh = await getDuprToken();
      }
      if (fresh && fresh !== token) {
        response = await callPlayer(fresh);
        const sc2 = response.headers.get("set-cookie") || "";
        const rotated2 = sc2.match(/(?:__Host-)?dupr_at=([^;\s,]+)/);
        if (rotated2) await persistToken(rotated2[1]);
      }
    }

    if (response.ok) {
      const data = await response.json().catch(() => null);
      // A 200 with no player identity is NOT an answer (Frank 2026-11-05:
      // "when used up -- no rating") — the quota/empty shape. It must never
      // wipe a stored rating.
      const r = data?.result;
      const hasIdentity = !!(r && (r.id || r.duprId || r.fullName));
      if (!hasIdentity) {
        return { success: false, error: "DUPR returned no player - the daily lookups are likely used up (or the payload shape changed)" };
      }
      let rating = r.ratings?.doubles;
      if (rating === "NR" || !rating) {
        rating = null;
      } else {
        rating = parseFloat(rating);
      }
      const imageUrl = r.imageUrl || null;

      const updatedPlayer = await prisma.player.update({
        where: { id: playerId },
        data: {
          name: data.result?.fullName
            || [data.result?.firstName, data.result?.lastName].filter(Boolean).join(" ")
            || player.name,
          duprId: data.result?.duprId || player.duprId,
          duprNumericId: data.result?.id?.toString() || player.duprNumericId,
          duprScore: rating,
          imageUrl: imageUrl,
          lastRefreshed: new Date(),
        },
      });

      // Sync playerName if name changed from API
      if (data.result?.fullName) {
        await prisma.clubPlayer.updateMany({
          where: { playerId },
          data: { playerName: data.result.fullName },
        });
      }

      return {
        success: true,
        player: updatedPlayer,
        message: rating ? `Fetched: ${data.result.fullName} - ${rating}${imageUrl ? " ✓" : ""}` : "Player found but no rating (NR)"
      };
    }
    if (response.status === 429 || response.status === 403) {
      const body = await response.text().catch(() => "");
      return {
        success: false,
        error: `DUPR limit reached (${response.status}) — their few-lookups rule. Wait a moment and try again.${body ? " (" + body.slice(0, 140) + ")" : ""}`,
      };
    }
    const bodyText = await response.text().catch(() => "");
    const hint = response.status === 401
      ? " - session expired (renew) or API key now required"
      : "";
    const src = ` [token: ${duprTokenSource ?? "?"}${duprTokenReadAt ? " " + Math.round((Date.now() - duprTokenReadAt) / 60000) + "m old" : ""}]`;
    return { success: false, error: `Could not fetch player from DUPR (HTTP ${response.status})${src}${bodyText ? " " + bodyText.slice(0, 110) : ""}${hint}` };
  } catch (error) {
    console.error("Error fetching DUPR rating:", error);
    return { success: false, error: "Failed to fetch rating" };
  }
}

// DUPR's daily budget (Frank 2026-11-05: ~2-3 other-profile lookups PER DAY,
// and every app lookup spends from the app's single DUPR session = Frank's
// account). Count = successful fetches in the last 24h — lastRefreshed is
// stamped only by fetchDuprRating.
export async function getDuprLookupsToday() {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const count = await prisma.player.count({ where: { lastRefreshed: { gte: since } } });
    return { success: true, count };
  } catch (error) {
    return { success: false, count: 0 };
  }
}

// ===== CLUB PLAYER ACTIONS (User's roster) =====

// Get user's roster (ClubPlayers for a specific user)
export async function getClubPlayers(userId: string) {
  try {
    const clubPlayers = await prisma.clubPlayer.findMany({
      where: { userId },
      include: {
        player: true,
      },
      orderBy: [
        { eventCount: "desc" },
        { lastAttended: "desc" },
      ],
    });
    return { success: true, clubPlayers };
  } catch (error) {
    console.error("Error fetching club players:", error);
    return { success: false, clubPlayers: [], error: "Failed to fetch roster" };
  }
}

// Add a player to user's roster (creates ClubPlayer link)
export async function addClubPlayer(userId: string, playerId: string, note?: string) {
  try {
    // Get player name first
    const player = await prisma.player.findUnique({ where: { id: playerId } });
    const clubPlayer = await prisma.clubPlayer.upsert({
      where: { userId_playerId: { userId, playerId } },
      update: {},
      create: {
        userId,
        playerId,
        playerName: player?.name || "Unknown",
        note: note || null,
      },
    });
    return { success: true, clubPlayer };
  } catch (error) {
    console.error("Error adding club player:", error);
    return { success: false, error: "Failed to add to roster" };
  }
}

// Remove a player from user's roster (safe delete - keep in global if has API duprScore)
export async function removeClubPlayer(userId: string, playerId: string) {
  try {
    const player = await prisma.player.findUnique({ where: { id: playerId } });
    if (!player) return { success: true, message: "removed (was already gone)" };

    // Remove from this user's roster — tolerate a missing link (Frank 2026-11-09:
    // the strict delete threw P2025 and the catch turned the button into nothing)
    await prisma.clubPlayer.deleteMany({ where: { userId, playerId } });

    // Only delete from global if: no API duprScore AND no other club links
    if (player.duprScore == null) {
      const otherLinks = await prisma.clubPlayer.count({ where: { playerId } });
      if (otherLinks === 0) {
        await prisma.player.delete({ where: { id: playerId } });
        return { success: true, message: "removed" };
      }
      return { success: true, message: "removed from your roster (other rosters still use them)" };
    }
    return { success: true, message: "removed from your roster (kept in the database - has a DUPR rating)" };
  } catch (error) {
    console.error("Error removing from club roster:", error);
    return { success: false, error: `Failed to remove: ${String((error as Error).message).slice(0, 100)}` };
  }
}

// Update club player (note, eventCount, lastAttended)
export async function updateClubPlayer(clubPlayerId: string, data: { note?: string; eventCount?: number; lastAttended?: Date }) {
  try {
    const clubPlayer = await prisma.clubPlayer.update({
      where: { id: clubPlayerId },
      data,
      include: {
        player: true,
      },
    });
    return { success: true, clubPlayer };
  } catch (error) {
    console.error("Error updating club player:", error);
    return { success: false, error: "Failed to update" };
  }
}


// ============================================================
// SESSION ACTIONS
// ============================================================

// Get Players by IDs (for repopulating event pool on session load)
export async function getPlayersByIds(ids: string[]) {
  if (!ids || ids.length === 0) return { success: true, players: [] };
  try {
    const players = await prisma.player.findMany({
      where: { id: { in: ids } },
    });
    return { success: true, players };
  } catch (error) {
    console.error("Error fetching players by IDs:", error);
    return { success: false, players: [], error: "Failed to fetch players" };
  }
}

// Create a new session (called on "Start Round 1")
export async function createSession(
  userId: string,
  name: string,
  config: object,
  playerIds: string[]
) {
  try {
    const session = await prisma.session.create({
      data: { userId, name, config, playerIds },
    });
    return { success: true, session };
  } catch (error) {
    console.error("Error creating session:", error);
    return { success: false, error: "Failed to create session" };
  }
}

// List all past sessions for a user (for past rounds panel)
export async function getSessionList(userId: string) {
  try {
    const sessions = await prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      // Light payload — metadata + round count, no round bodies
      include: { _count: { select: { rounds: true } } },
    });
    return { success: true, sessions };
  } catch (error) {
    console.error("Error fetching sessions:", error);
    return { success: false, sessions: [], error: "Failed to fetch sessions" };
  }
}

// Load a full session with all rounds (when user clicks to load)
export async function loadSession(sessionId: string) {
  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { rounds: { orderBy: { roundNumber: "asc" } } },
    });
    if (!session) return { success: false, error: "Session not found" };
    return { success: true, session };
  } catch (error) {
    console.error("Error loading session:", error);
    return { success: false, error: "Failed to load session" };
  }
}

// Save a new round (first time only — roundNumber not yet in DB)
export async function saveRound(
  sessionId: string,
  roundData: {
    roundNumber: number;
    date: string;
    format: object;
    matches: object;
    sittingOut: string[];
  }
) {
  try {
    const round = await prisma.sessionRound.create({
      data: { sessionId, ...roundData },
    });
    return { success: true, round };
  } catch (error) {
    console.error("Error saving round:", error);
    return { success: false, error: "Failed to save round" };
  }
}

// Update/edit an existing round (upsert-style update)
export async function updateRound(
  sessionId: string,
  roundNumber: number,
  roundData: {
    format?: object;
    matches?: object;
    sittingOut?: string[];
  }
) {
  try {
    const round = await prisma.sessionRound.update({
      where: { sessionId_roundNumber: { sessionId, roundNumber } },
      data: roundData,
    });
    return { success: true, round };
  } catch (error) {
    console.error("Error updating round:", error);
    return { success: false, error: "Failed to update round" };
  }
}

// Delete a single round row (idempotent — the round may never have saved)
export async function deleteRound(sessionId: string, roundNumber: number) {
  try {
    const result = await prisma.sessionRound.deleteMany({
      where: { sessionId, roundNumber },
    });
    return { success: true, deleted: result.count };
  } catch (error) {
    console.error("Error deleting round:", error);
    return { success: false, error: "Failed to delete round" };
  }
}

// Lightweight fetch — session row only, no rounds
export async function getSession(sessionId: string) {
  try {
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) return { success: false, error: "Session not found" };
    return { success: true, session };
  } catch (error) {
    console.error("Error getting session:", error);
    return { success: false, error: "Failed to get session" };
  }
}

// Update session metadata (e.g. session rename from the settings panel)
export async function updateSession(
  sessionId: string,
  data: { name?: string; config?: object; isEnded?: boolean }
) {
  try {
    const session = await prisma.session.update({
      where: { id: sessionId },
      data,
    });
    return { success: true, session };
  } catch (error) {
    console.error("Error updating session:", error);
    return { success: false, error: "Failed to update session" };
  }
}

// Mark session as ended (prevents further edits)
export async function endSession(sessionId: string) {
  try {
    const session = await prisma.session.update({
      where: { id: sessionId },
      data: { isEnded: true },
    });
    return { success: true, session };
  } catch (error) {
    console.error("Error ending session:", error);
    return { success: false, error: "Failed to end session" };
  }
}

// Delete a session and all its rounds (cascades automatically)
export async function deleteSession(sessionId: string) {
  try {
    await prisma.session.delete({ where: { id: sessionId } });
    return { success: true };
  } catch (error) {
    console.error("Error deleting session:", error);
    return { success: false, error: "Failed to delete session" };
  }
}
