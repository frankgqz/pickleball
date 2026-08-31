"use server";
import { prisma } from "@/lib/prisma";

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
async function getDuprToken(): Promise<string | null> {
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
      return data.result.accessToken;
    }
    return null;
  } catch (error) {
    console.error("DUPR login failed:", error);
    return null;
  }
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

// Add a new player to global database (with upsert/merge logic)
export async function addPlayer(formData: FormData, userId?: string) {
  const name = formData.get("name") as string;
  const duprId = formData.get("duprId") as string;
  const duprNumericId = formData.get("duprNumericId") as string;
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
  const duprId = formData.get("duprId") as string;
  const duprNumericId = formData.get("duprNumericId") as string;
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
export async function fetchDuprRating(playerId: string) {
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

    const response = await fetch(`${DUPR_API_BASE}/player/v1.0/${player.duprNumericId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      const data = await response.json();
      let rating = data.result?.ratings?.doubles;
      if (rating === "NR" || !rating) {
        rating = null;
      } else {
        rating = parseFloat(rating);
      }
      const imageUrl = data.result?.imageUrl || null;

      const updatedPlayer = await prisma.player.update({
        where: { id: playerId },
        data: {
          name: data.result?.fullName || player.name,
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
    return { success: false, error: "Could not fetch player from DUPR" };
  } catch (error) {
    console.error("Error fetching DUPR rating:", error);
    return { success: false, error: "Failed to fetch rating" };
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
    // Get the player to check if they have API dupr
    const player = await prisma.player.findUnique({ where: { id: playerId } });
    
    // Remove from this user's roster
    await prisma.clubPlayer.delete({
      where: { userId_playerId: { userId, playerId } },
    });
    
    // Only delete from global if: no API duprScore AND no other club links
    if (player && (player.duprScore == null || player.duprScore == undefined)) {
      const otherLinks = await prisma.clubPlayer.count({ where: { playerId } });
      if (otherLinks === 0) {
        await prisma.player.delete({ where: { id: playerId } });
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error("Error removing from club roster:", error);
    return { success: false, error: "Failed to remove" };
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
      orderBy: { createdAt: "desc" },
      // Light payload — just metadata, no rounds in list view
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
