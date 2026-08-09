"use client";

import React from "react";
import { TournamentConfig, PoolFinalsConfig, PoolFinalsFormat, AdvancementCriteria } from "./Types";

type RoundFormat = "FIXED_14V23" | "PICK_PARTNER"; // Standard uses FIXED_14V23, New Partners uses PICK_PARTNER

interface Props {
  config: TournamentConfig;
  updateConfig: <K extends keyof TournamentConfig>(key: K, value: TournamentConfig[K]) => void;
  onRestartEvent?: () => void;
}

export default function SettingsPanel({ config, updateConfig, onRestartEvent }: Props) {
  const handleChange = <K extends keyof TournamentConfig>(key: K, value: TournamentConfig[K]) => {
    updateConfig(key, value);

    // Auto-set order gap based on format
    if (key === "format") {
      const fmt = value as TournamentConfig["format"];
      if (fmt === "STANDARD") {
        updateConfig("orderGap", 0.25);
      } else if (fmt === "FIXED_PARTNER") {
        updateConfig("orderGap", 0.5);
      }
    }
  };

  const isPoolFormat = config.format === "POOL_PLAY";

  return (
    <section className="bg-white rounded-2xl shadow-xl p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-bold text-gray-800">⚙️ Event Settings</h2>
        <button
          onClick={() => {
            if (confirm("Restart event? This will clear all rounds but keep players in the database.")) {
              onRestartEvent && onRestartEvent();
            }
          }}
          className="px-3 py-1 text-xs bg-red-100 text-red-600 rounded-lg hover:bg-red-200 border border-red-300 transition-colors"
        >
          🔄 Restart
        </button>
      </div>

      {/* Format Row - compact */}
      <div className="flex flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-gray-600">Event:</label>
          <select
            value={config.format}
            onChange={(e) => handleChange("format", e.target.value as TournamentConfig["format"])}
            className="px-2 py-1 border border-gray-300 rounded text-sm bg-white"
          >
            <option value="STANDARD">Standard</option>
            <option value="FIXED_PARTNER">Teams</option>
            <option value="POOL_PLAY">Pool / Finals</option>
          </select>
        </div>
        
        {!isPoolFormat && (
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-medium text-gray-600">Round:</label>
            <select
              value={config.roundFormat || "FIXED_14V23"}
              onChange={(e) => handleChange("roundFormat" as any, e.target.value as any)}
              className="px-2 py-1 border border-gray-300 rounded text-sm bg-white"
            >
              <option value="FIXED_14V23">Standard (by seed)</option>
              <option value="PICK_PARTNER">New Partners</option>
            </select>
          </div>
        )}
      </div>

      {/* Standard / Teams Settings - compact single row */}
      {!isPoolFormat && (
        <>
          <div className="grid grid-cols-4 gap-2 mb-3 text-xs">
            <div>
              <label className="block text-gray-500 mb-0.5">W/L Mag</label>
              <input
                type="number"
                step="0.25"
                min={0.25}
                value={config.winLossMagnitude}
                onChange={(e) => handleChange("winLossMagnitude", parseFloat(e.target.value) || 1)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-gray-500 mb-0.5">Order Gap</label>
              <input
                type="number"
                step="0.25"
                min={0.25}
                value={config.orderGap}
                onChange={(e) => handleChange("orderGap", parseFloat(e.target.value) || 0.25)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-gray-500 mb-0.5">Wtop/Lbottom</label>
              <input
                type="number"
                step="0.25"
                min={0}
                value={config.courtBonus}
                onChange={(e) => handleChange("courtBonus", parseFloat(e.target.value) || 1)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-gray-500 mb-0.5">Band</label>
              <input
                type="number"
                step="0.25"
                min={0}
                value={config.band}
                onChange={(e) => handleChange("band", parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-5 gap-2 mb-2 text-xs">
            <div>
              <label className="block text-gray-500 mb-0.5">Courts</label>
              <input
                type="number"
                min={1}
                max={16}
                value={config.courts}
                onChange={(e) => handleChange("courts", parseInt(e.target.value) || 2)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-gray-500 mb-0.5">Top Bye</label>
              <input
                type="number"
                min={0}
                max={20}
                value={config.byeTopProtection}
                onChange={(e) => handleChange("byeTopProtection", parseInt(e.target.value) || 8)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-gray-500 mb-0.5">Bye Bonus</label>
              <input
                type="number"
                step="0.25"
                min={0}
                max={2}
                value={config.byeBonusTop}
                onChange={(e) => handleChange("byeBonusTop", parseFloat(e.target.value) || 0.5)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-gray-500 mb-0.5">Sit Bonus</label>
              <input
                type="number"
                step="0.25"
                min={0}
                value={config.sitProtection}
                onChange={(e) => handleChange("sitProtection", parseFloat(e.target.value) || 0.5)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-gray-500 mb-0.5">Late Join</label>
              <input
                type="number"
                step="0.25"
                min={0}
                value={config.lateJoinBonus}
                onChange={(e) => handleChange("lateJoinBonus", parseFloat(e.target.value) || 1)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
          </div>
        </>
      )}

      {/* Pool / Finals Settings - compact */}
      {isPoolFormat && (
        <div className="space-y-2 text-xs">
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="block text-gray-500 mb-0.5">Pools</label>
              <input
                type="number"
                min={1}
                max={10}
                value={config.poolFinals?.poolsCount ?? 2}
                onChange={(e) => handleChange("poolFinals", { ...config.poolFinals, poolsCount: parseInt(e.target.value) || 2 } as any)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-gray-500 mb-0.5">Finalists</label>
              <input
                type="number"
                min={1}
                max={10}
                value={config.poolFinals?.finalistsPerPool ?? 2}
                onChange={(e) => handleChange("poolFinals", { ...config.poolFinals, finalistsPerPool: parseInt(e.target.value) || 2 } as any)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-gray-500 mb-0.5">Grp Best-of</label>
              <input
                type="number"
                min={1}
                max={5}
                value={config.poolFinals?.groupStageWinsFor ?? 1}
                onChange={(e) => handleChange("poolFinals", { ...config.poolFinals, groupStageWinsFor: parseInt(e.target.value) || 1 } as any)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-gray-500 mb-0.5">Finals Best-of</label>
              <input
                type="number"
                min={1}
                max={5}
                value={config.poolFinals?.finalsWinsFor ?? 1}
                onChange={(e) => handleChange("poolFinals", { ...config.poolFinals, finalsWinsFor: parseInt(e.target.value) || 1 } as any)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded p-2 text-blue-700">
            Pool Play Mode — players distributed by DUPR rating
          </div>
        </div>
      )}
    </section>
  );
}

export { };