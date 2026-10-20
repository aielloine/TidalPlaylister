"use client";

import { Button, InputAdornment, Switch, TextField } from "@mui/material";
import { useState } from "react";

const PRESETS = [
  ["*/15 * * * *", "Toutes les 15 min"],
  ["0 * * * *", "Toutes les heures"],
  ["0 */6 * * *", "Toutes les 6 h"],
  ["0 3 * * *", "Tous les jours à 3 h"],
];

type Settings = { cronExpression: string; cronEnabled: boolean; dryRun: boolean; removeFromFavorites: boolean; scanLimit: number };

function Toggle({ name, label, help, defaultChecked, color }: { name: string; label: string; help: string; defaultChecked: boolean; color?: "secondary" }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-[14.5px] font-semibold">{label}</span>
        <span className="mt-0.5 block text-[12.5px] text-muted">{help}</span>
      </span>
      <Switch name={name} defaultChecked={defaultChecked} color={color} />
    </label>
  );
}

export default function SettingsForm({ action, settings }: { action: (f: FormData) => Promise<void>; settings: Settings }) {
  const [cron, setCron] = useState(settings.cronExpression);
  const human = PRESETS.find(([c]) => c === cron.trim())?.[1].toLowerCase() ?? "expression personnalisée";
  return (
    <form action={action} className="flex flex-col gap-[22px]">
      <div className="flex flex-col gap-2">
        <label htmlFor="cronExpression" className="text-[13px] font-semibold text-soft">
          Expression cron
        </label>
        <TextField
          id="cronExpression"
          name="cronExpression"
          value={cron}
          onChange={(e) => setCron(e.target.value)}
          slotProps={{
            htmlInput: { className: "font-mono", spellCheck: false },
            input: { endAdornment: <InputAdornment position="end"><span className="whitespace-nowrap text-[12.5px] text-aqua">{human}</span></InputAdornment> },
          }}
        />
        <div role="group" aria-label="Préréglages cron" className="flex flex-wrap gap-1.5">
          {PRESETS.map(([c, label]) => {
            const on = c === cron.trim();
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                onClick={() => setCron(c)}
                className={`inline-flex h-[34px] cursor-pointer items-center rounded-full border px-3 text-[12.5px] font-medium ${
                  on ? "border-aqua/50 bg-aqua/12 text-aqua" : "border-[#2a303a] bg-transparent text-soft hover:border-[#3a414c]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="scanLimit" className="text-[13px] font-semibold text-soft">
          Favoris analysés par passage
        </label>
        <div className="flex items-center gap-2.5">
          <TextField
            id="scanLimit"
            name="scanLimit"
            type="number"
            defaultValue={settings.scanLimit}
            sx={{ width: 120 }}
            slotProps={{ htmlInput: { min: 0, step: 1, className: "font-mono" } }}
          />
          <span className="text-[13px] text-muted">0 = tous</span>
        </div>
        <p className="m-0 text-[12.5px] leading-normal text-muted">
          Les N favoris les plus récents, en dry run comme en réel. Les titres déjà classés ne sont pas ré-analysés.
        </p>
      </div>

      <div className="h-px bg-edge" />

      <div className="flex flex-col gap-[18px]">
        <Toggle name="cronEnabled" label="Cron actif" help="Lance la synchro selon l'expression ci-dessus." defaultChecked={settings.cronEnabled} />
        <Toggle name="dryRun" label="Mode Dry Run (cron)" help="Le cron simule sans rien écrire sur Tidal." defaultChecked={settings.dryRun} color="secondary" />
        <Toggle
          name="removeFromFavorites"
          label="Retirer des favoris après classement"
          help="Sinon, le titre reste aussi dans vos favoris."
          defaultChecked={settings.removeFromFavorites}
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" variant="contained" color="inherit" sx={{ bgcolor: "#eef1f5", color: "#0b0d10", "&:hover": { bgcolor: "#ffffff" } }}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}
