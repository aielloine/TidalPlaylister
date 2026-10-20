"use client";

import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from "@mui/material";
import { useRef, useState } from "react";
import { Icon, PlayIcon } from "@/components/ui";

// Bouton de synchro. La synchro réelle demande une confirmation (sans JS, le formulaire part directement).
export default function SyncButton({ action, real, disabled }: { action: () => Promise<void>; real?: boolean; disabled?: boolean }) {
  const form = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <form action={action} ref={form}>
      {real ? (
        <Button
          type="submit"
          variant="contained"
          size="large"
          fullWidth
          disabled={disabled}
          startIcon={<PlayIcon />}
          onClick={(e) => {
            e.preventDefault();
            setOpen(true);
          }}
        >
          Synchronisation réelle
        </Button>
      ) : (
        <Button type="submit" variant="outlined" color="secondary" fullWidth disabled={disabled} startIcon={<Icon name="headphones" />} sx={{ minHeight: 48 }}>
          Dry run (simulation)
        </Button>
      )}
      {real && (
        <Dialog open={open} onClose={() => setOpen(false)} aria-labelledby="sync-confirm">
          <DialogTitle id="sync-confirm">Lancer la synchronisation réelle ?</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Les titres classés seront ajoutés à vos playlists Tidal (et retirés des favoris si l&apos;option est active).
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ p: 2.5, pt: 0 }}>
            <Button color="inherit" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="contained"
              onClick={() => {
                setOpen(false);
                form.current?.requestSubmit();
              }}
            >
              Synchroniser
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </form>
  );
}
