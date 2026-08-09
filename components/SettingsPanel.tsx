"use client";

import React from "react";
import { TournamentConfig, PoolFinalsConfig, PoolFinalsFormat, AdvancementCriteria } from "./Types";

type MatchFormat = "PICK_PARTNER" | "FIXED_14V23" | "POOL_PLAY";

interface Props {
  config: TournamentConfig;
  updateConfig: <K extends keyof TournamentConfig>(key: K, value: TournamentConfig[K]) => void;
  onSettingsChange?: (keys: (keyof TournamentConfig)[]) => void;
  onFormatSelect?: (format: MatchFormat) => void;
  onRestartEvent?: () => void;
}

export default function SettingsPanel({ config, updateConfig, onSettingsChange, onFormatSelect, onRestartEvent }: Props) {
  const handleChange = <K extends keyof TournamentConfig>(key: K, value: TournamentConfig[K]) => {
    updateConfig(key, value);
    if (onSettingsChange) onSettingsChange([key]);
  };

  const handlePoolConfigChange = <K extends keyof PoolFinalsConfig>(key: K, value: PoolFinalsConfig[K]) => {
    const currentPool = config.poolFinals || {
      poolsCount: 2,
      finalistsPerPool: 2,
      finalsFormat: "top2_to_semis",
      advancementCriteria: "wins",
      groupStageWinsFor: 1,
      finalsWinsFor: 1,
    };
    const updated = { ...currentPool, [key]: value };
    handleChange("poolFinals", updated);
  };

  const formatLabel = (f: MatchFormat) => {
    switch (f) {
      case "PICK_PARTNER": return "Standard";
      case "FIXED_14V23": return "Teams";
      case "POOL_PLAY": return "Pool / Finals";
    }
  };

  const isPoolFormat = config.format === "POOL_PLAY";

  return (
    <section className="bg-white rounded-2xl shadow-xl p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">⚙️ Tournament Settings</h2>

      {/* Format Dropdown + Start Button */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">Format:</label>
          <select
            value={config.format}
            onChange={(e) => handleChange("format", e.target.value as TournamentConfig["format"])}
            className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
          >
            <option value="STANDARD">Standard</option>
            <option value="FIXED_PARTNER">Teams</option>
            <option value="POOL_PLAY">Pool / Finals</option>
          </select>
        </div>

        <button
          onClick={() => {
            if (confirm("Restart event? This will clear all rounds but keep players in the database.")) {
              onRestartEvent && onRestartEvent();
            }
          }}
          className="px-4 py-2 rounded-lg bg-red-100 text-red-600 font-medium text-sm hover:bg-red-200 border border-red-300 transition-colors"
        >
          🔄 Restart Event
        </button>
      </div>

      {/* Standard / Teams Settings */}
      {!isPoolFormat && (
        <>
          <h3 className="font-medium text-gray-700 mb-2">Match Settings</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
              <label className="block text-sm font-medium text-gray-600 mb-1">Wtop / Lbottom</label>
              <input
                type="number"
                step="0.25"
                min={0}
                value={config.courtBonus}
                onChange={(e) => handleChange("courtBonus", parseFloat(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <p className="text-xs text-gray-400 mt-1">Top win / Bottom loss</p>
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
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
              <label className="block text-sm font-medium text-gray-600 mb-1">Top Bye Protection</label>
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
        </>
      )}

      {/* Pool / Finals Settings */}
      {isPoolFormat && (
        <>
          <h3 className="font-medium text-gray-700 mb-2">Pool / Finals Settings</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Number of Pools</label>
              <input
                type="number"
                min={1}
                max={10}
                value={config.poolFinals?.poolsCount ?? 2}
                onChange={(e) => handlePoolConfigChange("poolsCount", parseInt(e.target.value) || 2)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Finalists per Pool</label>
              <input
                type="number"
                min={1}
                max={10}
                value={config.poolFinals?.finalistsPerPool ?? 2}
                onChange={(e) => handlePoolConfigChange("finalistsPerPool", parseInt(e.target.value) || 2)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Group Stage (Best of)</label>
              <input
                type="number"
                min={1}
                max={5}
                value={config.poolFinals?.groupStageWinsFor ?? 1}
                onChange={(e) => handlePoolConfigChange("groupStageWinsFor", parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Finals (Best of)</label>
              <input
                type="number"
                min={1}
                max={5}
                value={config.poolFinals?.finalsWinsFor ?? 1}
                onChange={(e) => handlePoolConfigChange("finalsWinsFor", parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Advancement Criteria</label>
              <select
                value={config.poolFinals?.advancementCriteria ?? "wins"}
                onChange={(e) => handlePoolConfigChange("advancementCriteria", e.target.value as AdvancementCriteria)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="wins">Wins</option>
                <option value="sets">Sets</option>
                <option value="points">Points</option>
                <option value="points_ratio">Points Ratio</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Finals Format</label>
              <select
                value={config.poolFinals?.finalsFormat ?? "top2_to_semis"}
                onChange={(e) => handlePoolConfigChange("finalsFormat", e.target.value as PoolFinalsFormat)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="top2_to_semis">a) Top 2 → Semis</option>
                <option value="2nd_3rd_to_quarters">b) Top 2 → Semis, 2nd/3rd → Quarters</option>
                <option value="quarters_to_8">c) Top 3 + others to make 8 → Quarters</option>
                <option value="semis_only">d) Semis only (Top 4)</option>
                <option value="finals_only">e) Finals only (Top 2)</option>
                <option value="serial_play">f) Serial play (1v2, 3v4, 5v6 to rank)</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                {config.poolFinals?.finalsFormat === "serial_play" 
                  ? "Everyone plays a final round to determine final rank"
                  : config.poolFinals?.finalsFormat === "top2_to_semis"
                  ? "Top 2 from each pool advance directly to semis"
                  : "Select how advancement and finals work"}
              </p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
            <p className="font-medium mb-1">📋 Pool Play Mode</p>
            <p>Players will be distributed into pools based on DUPR rating. After pool play completes, advancement follows the selected finals format.</p>
          </div>
        </>
      )}
    </section>
  );
}

// Re-export for page.tsx to use
export { };