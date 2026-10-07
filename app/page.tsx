import { Alert, Button, Card, CardContent, Chip, FormControlLabel, Switch, TextField, Typography } from "@mui/material";
import { disconnectTidal, saveSettings, syncNow } from "@/app/actions";
import AutoRefresh from "@/components/AutoRefresh";
import { getSettings, prisma } from "@/lib/db";
import { nextRun } from "@/lib/scheduler";
import { isSyncRunning } from "@/lib/sync";

export const dynamic = "force-dynamic";

const fmt = (d?: Date | null) => (d ? d.toLocaleString("fr-FR") : "—");
const levelColor = { info: "#9aa4b2", moved: "#4ade80", skipped: "#facc15", error: "#f87171" } as Record<string, string>;
const CRON_PRESETS = [
  ["*/15 * * * *", "toutes les 15 min"],
  ["0 * * * *", "toutes les heures"],
  ["0 */6 * * *", "toutes les 6 h"],
  ["0 3 * * *", "tous les jours à 3 h"],
];

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ tidal?: string; error?: string }> }) {
  const { tidal, error } = await searchParams;
  const [token, settings, lastRun, totals, mappingCount] = await Promise.all([
    prisma.tidalToken.findUnique({ where: { id: 1 } }),
    getSettings(),
    prisma.syncRun.findFirst({ orderBy: { id: "desc" }, include: { logs: { orderBy: { id: "asc" } } } }),
    prisma.syncRun.aggregate({ where: { dryRun: false }, _sum: { moved: true }, _count: true }),
    prisma.mapping.count(),
  ]);
  const running = isSyncRunning();
  const next = settings.cronEnabled ? nextRun() : null;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
      <AutoRefresh active={running} />
      {tidal && (
        <Alert severity={tidal === "ok" ? "success" : "error"}>{tidal === "ok" ? "Compte Tidal connecté." : tidal}</Alert>
      )}
      {error && <Alert severity="error">{error}</Alert>}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex flex-col gap-2">
            <Typography variant="overline">Tidal</Typography>
            {token ? (
              <>
                <Chip color="success" label={`Connecté (utilisateur ${token.tidalUserId})`} />
                <form action={disconnectTidal}>
                  <Button type="submit" size="small" color="inherit">
                    Déconnecter
                  </Button>
                </form>
              </>
            ) : (
              <>
                <Chip color="warning" label="Non connecté" />
                <Button variant="contained" href="/api/tidal/login">
                  Se connecter à Tidal
                </Button>
              </>
            )}
          </CardContent>
        </Card>
        <Stat label="Dernière synchro" value={fmt(lastRun?.startedAt)}>
          {lastRun && (
            <Chip
              size="small"
              label={`${lastRun.status}${lastRun.dryRun ? " · dry run" : ""} · ${lastRun.trigger}`}
              color={lastRun.status === "success" ? "success" : lastRun.status === "error" ? "error" : "info"}
            />
          )}
        </Stat>
        <Stat label="Prochaine synchro (cron)" value={settings.cronEnabled ? fmt(next) : "Désactivée"}>
          <Typography variant="caption" color="text.secondary">
            {settings.cronExpression} · {settings.dryRun ? "dry run" : "réel"}
          </Typography>
        </Stat>
        <Stat label="Titres triés (total)" value={String(totals._sum.moved ?? 0)}>
          <Typography variant="caption" color="text.secondary">
            {totals._count} synchro(s) réelle(s) · {mappingCount} genre(s) mappé(s)
          </Typography>
        </Stat>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col gap-3">
            <Typography variant="overline">Forcer la synchronisation</Typography>
            <form action={syncNow.bind(null, true)}>
              <Button type="submit" variant="outlined" fullWidth disabled={running || !token}>
                Dry run (simulation)
              </Button>
            </form>
            <form action={syncNow.bind(null, false)}>
              <Button type="submit" variant="contained" color="warning" fullWidth disabled={running || !token}>
                Synchronisation réelle
              </Button>
            </form>
            {running && <Chip color="info" label="Synchronisation en cours…" />}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardContent>
            <Typography variant="overline">Planification</Typography>
            <form action={saveSettings} className="mt-2 flex flex-col gap-3">
              <TextField
                name="cronExpression"
                label="Expression cron"
                defaultValue={settings.cronExpression}
                size="small"
                slotProps={{ htmlInput: { list: "cron-presets" } }}
                helperText={CRON_PRESETS.map(([c, l]) => `${c} = ${l}`).join(" · ")}
              />
              <datalist id="cron-presets">
                {CRON_PRESETS.map(([c, l]) => (
                  <option key={c} value={c} label={l} />
                ))}
              </datalist>
              <div className="flex flex-wrap items-center gap-4">
                <FormControlLabel control={<Switch name="cronEnabled" defaultChecked={settings.cronEnabled} />} label="Cron actif" />
                <FormControlLabel
                  control={<Switch name="dryRun" defaultChecked={settings.dryRun} color="warning" />}
                  label="Mode Dry Run (cron)"
                />
                <Button type="submit" variant="contained" className="ml-auto">
                  Enregistrer
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent>
          <Typography variant="overline">
            Logs {lastRun && `— synchro #${lastRun.id} (${lastRun.moved} déplacé(s), ${lastRun.skipped} ignoré(s), ${lastRun.failed} en échec)`}
          </Typography>
          <pre className="mt-2 max-h-[32rem] overflow-auto rounded bg-black/60 p-3 text-xs leading-relaxed">
            {lastRun?.logs.length
              ? lastRun.logs.map((l) => (
                  <div key={l.id} style={{ color: levelColor[l.level] }}>
                    [{l.createdAt.toLocaleTimeString("fr-FR")}] {l.level.toUpperCase().padEnd(7)} {l.message}
                  </div>
                ))
              : "Aucune synchronisation pour l'instant."}
          </pre>
        </CardContent>
      </Card>
    </main>
  );
}

function Stat({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        <Typography variant="overline">{label}</Typography>
        <Typography variant="h6">{value}</Typography>
        {children}
      </CardContent>
    </Card>
  );
}
