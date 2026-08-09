"use client";

import React from "react";
import { TournamentConfig } from "./Types";

type MatchFormat = "PICK_PARTNER" | "FIXED_14V23" | "POOL_FINALS";

interface Props {
  config: TournamentConfig;
  updateConfig: <K extends keyof TournamentConfig>(key: K, value: TournamentConfig[K]) => void;
  onSettingsChange?: (keys: (keyof TournamentConfig)[]) => void;
  onFormatSelect?: (format: MatchFormat) => void;
}

export default function SettingsPanel({ config, updateConfig, onSettingsChange, onFormatSelect }: Props) {
  const handleChange = <K extends keyof TournamentConfig>(key: K, value: TournamentConfig[K]) => {
    updateConfig(key, value);
    if (onSettingsChange) onSettingsChange([key]);
  };

  return (
    <section className="bg-white rounded-2xl shadow-xl p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">⚙️ Tournament Settings</h2>

      {/* Format Selection */}
      <div className="flex gap-2 mb-6">
        <span className="text-sm font-medium text-gray-600 pt-2">Format:</span>
        <button
          onClick={() => onFormatSelect && onFormatSelect("PICK_PARTNER")}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
        >
          Standard
        </button>
        <button
          onClick={() => onFormatSelect && onFormatSelect("FIXED_14V23")}
          className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700"
        >
          Teams
        </button>
        <button
          onClick={() => onFormatSelect && onFormatSelect("POOL_FINALS")}
          className="px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-medium hover:bg-orange-700"
        >
          Pool / Finals
        </button>
      </div>

      <h3 className="font-medium text-gray-700 mb-2">Match Settings</h3>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">W/L Magnitude</label>
          <input
            type="number"
            step="0.25"
            min={0.25}
            value={config.winLossMagnitude}
            onChange={(e) => handleChange("winLossMagnitude", parseFloat(e.target.value) || 1)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Order Gap</label>
          <input
            type="number"
            step="0.25"
            min={0.25}
            value={config.orderGap}
            onChange={(e) => handleChange("orderGap", parseFloat(e.target.value) || 0.25)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Wtop Lbottom Magnitude</label>
          <input
            type="number"
            step="0.25"
            min={0}
            value={config.courtBonus}
            onChange={(e) => handleChange("courtBonus", parseFloat(e.target.value) || 1)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
          <p className="text-xs text-gray-400 mt-1">Top win / Bottom loss modifier</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Band</label>
          <input
            type="number"
            step="0.25"
            min={0}
            value={config.band}
            onChange={(e) => handleChange("band", parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
          <p className="text-xs text-gray-400 mt-1">Seed cap buffer</p>
        </div>
      </div>

      <h3 className="font-medium text-gray-700 mb-2">Bye Settings</h3>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Courts</label>
          <input
            type="number"
            min={1}
            max={16}
            value={config.courts}
            onChange={(e) => handleChange("courts", parseInt(e.target.value) || 2)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Top Players Bonus</label>
          <input
            type="number"
            min={0}
            max={20}
            value={config.byeTopProtection}
            onChange={(e) => handleChange("byeTopProtection", parseInt(e.target.value) || 8)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Top Bye Bonus</label>
          <input
            type="number"
            step="0.25"
            min={0}
            max={2}
            value={config.byeBonusTop}
            onChange={(e) => handleChange("byeBonusTop", parseFloat(e.target.value) || 0.5)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Sit Bonus</label>
          <input
            type="number"
            step="0.25"
            min={0}
            value={config.sitProtection}
            onChange={(e) => handleChange("sitProtection", parseFloat(e.target.value) || 0.5)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Late Join Bonus</label>
          <input
            type="number"
            step="0.25"
            min={0}
            value={config.lateJoinBonus}
            onChange={(e) => handleChange("lateJoinBonus", parseFloat(e.target.value) || 1)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
      </div>
    </section>
  );
}