"use server";

import { prisma } from "@/lib/prisma";

// ===== PLAYER ACTIONS =====

// Get all players from database
export async function getPlayers() {
  try {
    console.log("Attempting to connect to database...");
    const players = await prisma.player.findMany({
      orderBy: { createdAt: "desc" },
    });
    console.log("Successfully fetched players:", players.length);
    return { success: true, players };
  } catch (error) {
    console.error("Database error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, players: [], error: errorMessage };
  }
}

// Add a new player
export async function addPlayer(formData: FormData) {
  const name = formData.get("name") as string;
  const duprId = formData.get("duprId") as string;
  const duprScore = formData.get("duprScore") as string;

  if (!name?.trim()) {
    return { success: false, error: "Name is required" };
  }

  try {
    const player = await prisma.player.create({
      data: {
        name: name.trim(),
        duprId: duprId?.trim() || null,
        duprScore: duprScore ? parseFloat(duprScore) : null,
        orderScore: duprScore ? parseFloat(duprScore) : 5, // Default to middle rating
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
