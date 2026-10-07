"use client";

import React from "react";
import { TournamentConfig } from "./Types";

interface Props {
  config: TournamentConfig;
  updateConfig: <K extends keyof TournamentConfig>(key: K, value: TournamentConfig[K]) => void;
  onRestartEvent?: () => void;
  sessionId?: string | null;
  sessionName?: string;
  onRenameSession?: (name: string) => Promise<{ success: boolean }>;
}

export default function SettingsPanel({ config, updateConfig, onRestartEvent, sessionId, sessionName, onRenameSession }: Props) {
  const handleChange = <K extends keyof TournamentConfig>(key: K, value: TournamentConfig[K]) => {
    updateConfig(key, value);
  };
  const [renameValue, setRenameValue] = React.useState("");
  const [renameStatus, setRenameStatus] = React.useState<"idle" | "ok" | "err">("idle");
  const [renaming, setRenaming] = React.useState(false);

  return (
    <section className="bg-panel rounded-2xl shadow-xl p-3">
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-base font-bold text-text">⚙️ Event Settings</h2>
        <button
          onClick={() => {
            if (confirm("Restart event? This will clear all rounds but keep all the players in the event pool (not the database).")) {
              onRestartEvent && onRestartEvent();
            }
          }}
          className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded-lg hover:bg-red-200 border border-red-300 transition-colors"
        >
          🔄 Restart
        </button>
      </div>

      {/* Event Name - for CSV export */}
      {/* CSV Export Settings Row */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-2">
        {/* Event Name - 50% */}
        <div className="col-span-1 md:col-span-3">
          <label className="text-xs font-medium text-subtext mb-0.5 block">Event Name (for CSV)</label>
          <input
            type="text"
            value={config.eventName || ""}
            onChange={(e) => handleChange("eventName" as any, e.target.value)}
            placeholder="e.g. Fun Pickleball Tournament"
            className="w-full px-2 py-1 bg-muted-bg border border-line rounded text-xs text-text placeholder-text/50"
          />
        </div>

        {/* Match Type - ~16.6% */}
        <div className="col-span-1">
          <label className="text-xs font-medium text-subtext mb-0.5 block">Match Type</label>
          <select
            value={config.matchType || "D"}
            onChange={(e) => handleChange("matchType" as any, e.target.value as "D" | "S")}
            className="w-full px-2 py-1 border border-line rounded text-xs bg-muted-bg"
          >
            <option value="D">Doubles (D)</option>
            <option value="S">Singles (S)</option>
          </select>
        </div>

        {/* Score Type - ~16.6% */}
        <div className="col-span-1">
          <label className="text-xs font-medium text-subtext mb-0.5 block">Score Type</label>
          <select
            value={config.scoreType || "SIDEOUT"}
            onChange={(e) => handleChange("scoreType" as any, e.target.value as "SIDEOUT" | "RALLY")}
            className="w-full px-2 py-1 border border-line rounded text-xs bg-muted-bg"
          >
            <option value="SIDEOUT">Sideout</option>
            <option value="RALLY">Rally</option>
          </select>
        </div>

        {/* Best Of - ~16.6% */}
        <div className="col-span-1">
          <label className="text-xs font-medium text-subtext mb-0.5 block">Best Of</label>
          <select
            value={config.bestOf || 1}
            onChange={(e) => handleChange("bestOf" as any, parseInt(e.target.value) as 1 | 3 | 5)}
            className="w-full px-2 py-1 border border-line rounded text-xs bg-muted-bg"
          >
            <option value="1">1</option>
            <option value="3">3</option>
            <option value="5">5</option>
          </select>
        </div>
      </div>

      

      {/* Format Row */}
      <div className="flex flex-wrap gap-2 mb-2">
        <div className="flex items-center gap-1">
          <label className="text-xs font-medium text-subtext">Event:</label>
          <select
            value={config.format}
            onChange={(e) => handleChange("format", e.target.value as TournamentConfig["format"])}
            className="px-2 py-0.5 border border-line rounded text-xs bg-muted-bg"
          >
            <option value="STANDARD">Standard</option>
            <option value="FIXED_PARTNER">Teams</option>
            <option value="POOL_PLAY">Pool / Finals</option>
          </select>
        </div>

        {config.format !== "POOL_PLAY" && (
          <div className="flex items-center gap-1">
            <label className="text-xs font-medium text-subtext">Round:</label>
            <select
              value={config.roundFormat || "FIXED_14V23"}
              onChange={(e) => handleChange("roundFormat" as any, e.target.value as any)}
              className="px-2 py-0.5 border border-line rounded text-xs bg-muted-bg"
            >
              <option value="FIXED_14V23">Standard (by seed)</option>
              <option value="PICK_PARTNER">New Partners</option>
            </select>
          </div>
        )}
      </div>

      {/* Saved session rename */}
      {sessionId && (
        <div className="flex flex-wrap items-end gap-2 mb-2">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs font-medium text-subtext mb-0.5 block">Saved Session Name</label>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder={sessionName || "Rename this session…"}
              className="w-full px-2 py-1 bg-muted-bg border border-line rounded text-xs text-text placeholder-text/50"
            />
          </div>
          <button
            onClick={async () => {
              if (!renameValue.trim() || !onRenameSession) return;
              setRenaming(true);
              const r = await onRenameSession(renameValue.trim());
              setRenaming(false);
              if (r && r.success) { setRenameStatus("ok"); setRenameValue(""); setTimeout(() => setRenameStatus("idle"), 2500); }
              else setRenameStatus("err");
            }}
            disabled={renaming || !renameValue.trim()}
            className="px-3 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {renaming ? "…" : "Rename"}
          </button>
          {renameStatus === "ok" && <span className="text-xs text-green-600">✓ Renamed</span>}
          {renameStatus === "err" && <span className="text-xs text-red-600">✗ Failed</span>}
        </div>
      )}

      {/* Standard / Teams Settings */}
      {config.format !== "POOL_PLAY" && (
        <>
          <div className="grid grid-cols-4 gap-1.5 mb-2 text-xs">
            <div>
              <label className="block text-subtext mb-0.5">W/L Mag</label>
              <input
                type="number"
                step="0.25"
                min={0.25}
                value={config.winLossMagnitude}
                onChange={(e) => handleChange("winLossMagnitude", parseFloat(e.target.value) || 1)}
                className="w-full px-1.5 py-0.5 bg-muted-bg border border-line rounded text-xs text-text"
              />
            </div>
            <div>
              <label className="block text-subtext mb-0.5">Order Gap</label>
              <input
                type="number"
                step="0.25"
                min={0.25}
                value={config.orderGap}
                onChange={(e) => handleChange("orderGap", parseFloat(e.target.value) || 0.25)}
                className="w-full px-1.5 py-0.5 bg-muted-bg border border-line rounded text-xs text-text"
              />
            </div>
            <div>
              <label className="block text-subtext mb-0.5">Wtop/Lbot</label>
              <input
                type="number"
                step="0.25"
                min={0}
                value={config.courtBonus}
                onChange={(e) => handleChange("courtBonus", parseFloat(e.target.value) || 1)}
                className="w-full px-1.5 py-0.5 bg-muted-bg border border-line rounded text-xs text-text"
              />
            </div>
            <div>
              <label className="block text-subtext mb-0.5">Band</label>
              <input
                type="number"
                step="0.25"
                min={0}
                value={config.band}
                onChange={(e) => handleChange("band", parseFloat(e.target.value) || 0)}
                className="w-full px-1.5 py-0.5 bg-muted-bg border border-line rounded text-xs text-text"
              />
            </div>
          </div>

          <div className="grid grid-cols-5 gap-1.5 mb-1 text-xs">
            <div>
              <label className="block text-subtext mb-0.5">Courts</label>
              <input
                type="number"
                min={1}
                max={16}
                value={config.courts}
                onChange={(e) => handleChange("courts", parseInt(e.target.value) || 2)}
                className="w-full px-1.5 py-0.5 bg-muted-bg border border-line rounded text-xs text-text"
              />
            </div>
            <div>
              <label className="block text-subtext mb-0.5">Top Bye</label>
              <input
                type="number"
                min={0}
                max={20}
                value={config.byeTopProtection}
                onChange={(e) => handleChange("byeTopProtection", parseInt(e.target.value) || 8)}
                className="w-full px-1.5 py-0.5 bg-muted-bg border border-line rounded text-xs text-text"
              />
            </div>
            <div>
              <label className="block text-subtext mb-0.5">Bye Bonus</label>
              <input
                type="number"
                step="0.25"
                min={0}
                max={2}
                value={config.byeBonusTop}
                onChange={(e) => handleChange("byeBonusTop", parseFloat(e.target.value) || 0.5)}
                className="w-full px-1.5 py-0.5 bg-muted-bg border border-line rounded text-xs text-text"
              />
            </div>
            <div>
              <label className="block text-subtext mb-0.5">Sit Bonus</label>
              <input
                type="number"
                step="0.25"
                min={0}
                value={config.sitProtection}
                onChange={(e) => handleChange("sitProtection", parseFloat(e.target.value) || 0.5)}
                className="w-full px-1.5 py-0.5 bg-muted-bg border border-line rounded text-xs text-text"
              />
            </div>
            <div>
              <label className="block text-subtext mb-0.5">Late Join</label>
              <input
                type="number"
                step="0.25"
                min={0}
                value={config.lateJoinBonus}
                onChange={(e) => handleChange("lateJoinBonus", parseFloat(e.target.value) || 1)}
                className="w-full px-1.5 py-0.5 bg-muted-bg border border-line rounded text-xs text-text"
              />
            </div>
          </div>
        </>
      )}

      {/* Pool / Finals Settings */}
      {config.format === "POOL_PLAY" && (
        <div className="space-y-2 text-xs">
          <div className="grid grid-cols-4 gap-1.5">
            <div>
              <label className="block text-subtext mb-0.5">Pools</label>
              <input
                type="number"
                min={1}
                max={10}
                value={config.poolFinals?.poolsCount ?? 2}
                onChange={(e) => handleChange("poolFinals" as any, { 
                  ...config.poolFinals, 
                  poolsCount: parseInt(e.target.value) || 2 
                } as any)}
                className="w-full px-1.5 py-0.5 bg-muted-bg border border-line rounded text-xs text-text"
              />
            </div>
            <div>
              <label className="block text-subtext mb-0.5">Finalists</label>
              <input
                type="number"
                min={1}
                max={10}
                value={config.poolFinals?.finalistsPerPool ?? 2}
                onChange={(e) => handleChange("poolFinals" as any, { 
                  ...config.poolFinals, 
                  finalistsPerPool: parseInt(e.target.value) || 2 
                } as any)}
                className="w-full px-1.5 py-0.5 bg-muted-bg border border-line rounded text-xs text-text"
              />
            </div>
            <div>
              <label className="block text-subtext mb-0.5">Grp Best-of</label>
              <input
                type="number"
                min={1}
                max={5}
                value={config.poolFinals?.groupStageWinsFor ?? 1}
                onChange={(e) => handleChange("poolFinals" as any, { 
                  ...config.poolFinals, 
                  groupStageWinsFor: parseInt(e.target.value) || 1 
                } as any)}
                className="w-full px-1.5 py-0.5 bg-muted-bg border border-line rounded text-xs text-text"
              />
            </div>
            <div>
              <label className="block text-subtext mb-0.5">Finals Best-of</label>
              <input
                type="number"
                min={1}
                max={5}
                value={config.poolFinals?.finalsWinsFor ?? 1}
                onChange={(e) => handleChange("poolFinals" as any, { 
                  ...config.poolFinals, 
                  finalsWinsFor: parseInt(e.target.value) || 1 
                } as any)}
                className="w-full px-1.5 py-0.5 bg-muted-bg border border-line rounded text-xs text-text"
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