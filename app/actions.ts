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

interface DuprUserResponse {
  status: string;
  result: {
    id: number;
    fullName: string;
    referralCode: string;
    imageUrl: string;
    stats: {
      singles: string;
      doubles: string;
      defaultRating: string;
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
          manualDuprScore: existingPlayer.manualDuprScore ?? (manualDuprScore ? parseFloat(manualDuprScore) : null),
        },
      });
      merged = true;
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
          data: { userId, playerId: player.id },
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
        playerName: player?.name || "Unknown",  // ← ADD THIS
        note: note || null,
      },
    });
    return { success: true, clubPlayer };
  } catch (error) {
    console.error("Error adding club player:", error);
    return { success: false, error: "Failed to add to roster" };
  }
}

// Remove a player from user's roster
export async function removeClubPlayer(clubPlayerId: string) {
  try {
    await prisma.clubPlayer.delete({
      where: { id: clubPlayerId },
    });
    return { success: true };
  } catch (error) {
    console.error("Error removing club player:", error);
    return { success: false, error: "Failed to remove from roster" };
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