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

// ===== PLAYER ACTIONS =====

// Get all players from database
export async function getPlayers() {
  try {
    const players = await prisma.player.findMany({
      orderBy: { createdAt: "desc" },
    });
    return { success: true, players };
  } catch (error) {
    console.error("Error fetching players:", error);
    return { success: false, players: [], error: "Failed to fetch players" };
  }
}

// Add a new player
export async function addPlayer(formData: FormData) {
  const name = formData.get("name") as string;
  const duprId = formData.get("duprId") as string; // Letter ID (e.g., "5E64ZL")
  const duprNumericId = formData.get("duprNumericId") as string; // Numeric ID (e.g., "7438750465")
  const manualDuprScore = formData.get("manualDuprScore") as string; // Manually entered score

  if (!name?.trim()) {
    return { success: false, error: "Name is required" };
  }

  try {
    const player = await prisma.player.create({
      data: {
        name: name.trim(),
        duprId: duprId?.trim() || null, // Letter ID
        duprNumericId: duprNumericId?.trim() || null, // Numeric ID
        manualDuprScore: manualDuprScore ? parseFloat(manualDuprScore) : null, // Manual entry
        orderScore: manualDuprScore ? parseFloat(manualDuprScore) : 5,
      },
    });
    return { success: true, player };
  } catch (error) {
    console.error("Error adding player:", error);
    return { success: false, error: "Failed to add player" };
  }
}

// Delete a player
export async function deletePlayer(id: string) {
  try {
    await prisma.player.delete({
      where: { id },
    });
    return { success: true };
  } catch (error) {
    console.error("Error deleting player:", error);
    return { success: false, error: "Failed to delete player" };
  }
}

// Update a player
export async function updatePlayer(playerId: string, formData: FormData) {
  const name = formData.get("name") as string;
  const duprId = formData.get("duprId") as string;
  const duprNumericId = formData.get("duprNumericId") as string;
  const manualDuprScore = formData.get("manualDuprScore") as string;

  if (!name?.trim()) {
    return { success: false, error: "Name is required" };
  }

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

    // Fetch by numeric ID
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

      // Get imageUrl from response
      const imageUrl = data.result?.imageUrl || null;

      // Update with all available data (name, letter ID, rating, imageUrl, lastRefreshed)
      const updatedPlayer = await prisma.player.update({
        where: { id: playerId },
        data: {
          name: data.result?.fullName || player.name,
          duprId: data.result?.duprId || player.duprId, // Letter ID
          duprNumericId: data.result?.id?.toString() || player.duprNumericId, // Numeric ID
          duprScore: rating,
          imageUrl: imageUrl, // Save avatar URL
          lastRefreshed: new Date().toISOString(), // Track when DUPR was last fetched
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