"use client";

import { Autocomplete, Button, TextField } from "@mui/material";
import { useEffect, useState } from "react";

export default function GenrePicker({ action, options }: { action: (f: FormData) => Promise<void>; options: string[] }) {
  const [value, setValue] = useState<string[]>([]);
  useEffect(() => setValue([]), [options]); // vidé quand la page est revalidée après l'ajout
  return (
    <form action={action} className="mt-auto flex items-start gap-2">
      <input type="hidden" name="genres" value={value.join(",")} />
      <Autocomplete
        multiple
        size="small"
        className="flex-1"
        options={options}
        value={value}
        onChange={(_, v) => setValue(v)}
        filterSelectedOptions
        noOptionsText="Aucun genre disponible"
        renderInput={(params) => <TextField {...params} label="Ajouter des genres" />}
      />
      <Button type="submit" variant="outlined" disabled={!value.length}>
        +
      </Button>
    </form>
  );
}
