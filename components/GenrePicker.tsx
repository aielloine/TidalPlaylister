"use client";

import { Autocomplete, Button, TextField } from "@mui/material";
import { useEffect, useState } from "react";

export default function GenrePicker({ action, options }: { action: (f: FormData) => Promise<void>; options: string[] }) {
  const [value, setValue] = useState<string[]>([]);
  useEffect(() => setValue([]), [options]); // vidé quand la page est revalidée après l'ajout
  return (
    <form action={action} className="mt-auto flex items-start gap-2">
      <input type="hidden" name="genres" value={value.join(",")} />
      {/* freeSolo : un tag Last.fm pas encore rencontré peut être saisi puis validé par Entrée */}
      <Autocomplete
        multiple
        size="small"
        className="flex-1"
        options={options}
        value={value}
        onChange={(_, v) => setValue(v.map((x) => x.trim().toLowerCase()).filter(Boolean))}
        filterSelectedOptions
        freeSolo
        noOptionsText="Aucun genre disponible"
        renderInput={(params) => <TextField {...params} label="Ajouter des genres / tags" />}
      />
      <TextField
        name="priority"
        type="number"
        size="small"
        label="Prio."
        placeholder="auto"
        className="w-20"
        slotProps={{ inputLabel: { shrink: true } }}
      />
      <Button type="submit" variant="outlined" disabled={!value.length}>
        +
      </Button>
    </form>
  );
}
