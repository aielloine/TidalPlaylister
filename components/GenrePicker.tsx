"use client";

import { Autocomplete, TextField } from "@mui/material";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui";

export default function GenrePicker({ action, options, label }: { action: (f: FormData) => Promise<void>; options: string[]; label: string }) {
  const [value, setValue] = useState<string[]>([]);
  useEffect(() => setValue([]), [options]); // vidé quand la page est revalidée après l'ajout
  return (
    <form action={action} className="mt-auto flex items-start gap-2">
      <input type="hidden" name="genres" value={value.join(",")} />
      {/* freeSolo : un tag Last.fm pas encore rencontré peut être saisi puis validé par Entrée */}
      <Autocomplete
        multiple
        size="small"
        className="min-w-0 flex-1"
        options={options}
        value={value}
        onChange={(_, v) => setValue(v.map((x) => x.trim().toLowerCase()).filter(Boolean))}
        filterSelectedOptions
        freeSolo
        noOptionsText="Aucun genre disponible"
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder={value.length ? "" : "Ajouter des genres / tags"}
            sx={{ "& .MuiOutlinedInput-root": { minHeight: 44, fontSize: 13.5 } }}
          />
        )}
      />
      <input
        name="priority"
        inputMode="numeric"
        placeholder="Prio."
        aria-label="Priorité"
        className="h-11 w-16 flex-none rounded-xl border border-[#2a303a] bg-hollow px-2.5 text-center font-mono text-[13px] text-ink outline-none placeholder:text-faint focus:border-aqua"
      />
      <button
        type="submit"
        aria-label={label}
        disabled={!value.length}
        className={`inline-flex size-11 flex-none items-center justify-center rounded-xl border-0 ${
          value.length ? "cursor-pointer bg-aqua text-aqua-ink" : "cursor-not-allowed bg-[#1b1f26] text-[#6b7280]"
        }`}
      >
        <Icon name="plus" size={18} strokeWidth={2.2} />
      </button>
    </form>
  );
}
