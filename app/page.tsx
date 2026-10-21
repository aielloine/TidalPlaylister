import { Alert, Card } from "@mui/material";
import { disconnectTidal, saveSettings, syncNow } from "@/app/actions";
import AutoRefresh from "@/components/AutoRefresh";
import LogViewer from "@/components/LogViewer";
import SettingsForm from "@/components/SettingsForm";
import SyncButton from "@/components/SyncButton";
import { CronChip, Icon, Logo, Mono, Overline, Pill, SectionTitle } from "@/components/ui";
import { getSettings, prisma } from "@/lib/db";
import { ago, dayTime, duration, hm, hms, int, until } from "@/lib/format";
import { nextRun } from "@/lib/scheduler";
import { isSyncRunning } from "@/lib/sync";

export const dynamic = "force-dynamic";

const H1 = "m-0 font-display text-[clamp(26px,2.6vw,34px)] font-bold leading-[1.1] tracking-[-0.02em]";

// Onde du hero : hauteurs fixes pseudo-aléatoires ; couleurs au prorata classés / ignorés / en échec.
const WAVE_N = 72;
const WAVE_H = Array.from({ length: WAVE_N }, (_, i) =>
  Math.round(8 + 30 * Math.abs(Math.sin(i * 0.55) * Math.cos(i * 0.17)) + 7 * Math.abs(Math.sin(i * 1.7))),
);
function waveColors(running: boolean, moved: number, skipped: number, failed: number) {
  const total = moved + skipped + failed;
  return WAVE_H.map((_, i) => {
    if (running) {
      const t = i / (WAVE_N - 1);
      return `rgb(${Math.round(46 + 120 * t)},${Math.round(230 - 75 * t)},${Math.round(214 + 41 * t)})`;
    }
    if (!total) return "#2a303a";
    const x = (i + 0.5) / WAVE_N;
    return x < moved / total ? "#2ee6d6" : x < (moved + skipped) / total ? "#f5b544" : "#ff6b6b";
  });
}

// Tuile du hero : dégradé de l'identité + arc Crescendo à l'encre, qui tourne lentement pendant une synchro.
function CoverTile({ running }: { running: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="box-border flex size-[136px] flex-none items-center justify-center rounded-[18px] max-sm:size-24"
      style={{ background: "linear-gradient(140deg, #2ee6d6 0%, #5f86ff 58%, #a69bff 100%)", boxShadow: "0 22px 44px -22px rgba(46,230,214,0.6)" }}
    >
      <Logo variant="ink" size={112} className={`max-sm:size-20 ${running ? "tp-spin" : ""}`} />
    </div>
  );
}

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
  const logs = (lastRun?.logs ?? []).map((l) => ({ id: l.id, time: hms(l.createdAt), level: l.level, message: l.message, trackId: l.trackId }));
  const wave = waveColors(running, lastRun?.moved ?? 0, lastRun?.skipped ?? 0, lastRun?.failed ?? 0);

  return (
    <main className="mx-auto flex max-w-[1280px] flex-col gap-4 px-[clamp(16px,3vw,32px)] pb-16 pt-7">
      <AutoRefresh active={running} />
      {tidal && <Alert severity={tidal === "ok" ? "success" : "error"}>{tidal === "ok" ? "Compte Tidal connecté." : tidal}</Alert>}
      {error && <Alert severity="error">{error}</Alert>}

      {token ? (
        <section
          aria-labelledby="sync-title"
          className="relative flex flex-wrap items-center gap-7 overflow-hidden rounded-3xl border border-[#232831] p-[clamp(20px,2.4vw,32px)]"
          style={{
            background:
              "radial-gradient(620px 280px at 0% 0%, rgba(46,230,214,0.10), transparent 70%), radial-gradient(520px 260px at 100% 100%, rgba(166,155,255,0.08), transparent 70%), #13161b",
          }}
        >
          <CoverTile running={running} />

          <div className="flex min-w-0 flex-[999_1_420px] flex-col gap-3.5">
            <Overline>Forcer la synchronisation</Overline>
            {running ? (
              <>
                <h1 id="sync-title" className={H1}>
                  Synchronisation en cours…
                </h1>
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone="aqua" dot="#2ee6d6" pulse>
                    En cours
                  </Pill>
                  {lastRun && <RunPills dryRun={lastRun.dryRun} trigger={lastRun.trigger} />}
                  {lastRun && <Mono className="text-[13px] text-muted">Lancée à {hm(lastRun.startedAt)}</Mono>}
                </div>
              </>
            ) : lastRun ? (
              <>
                <h1 id="sync-title" className={H1}>
                  {lastRun.dryRun ? "Dernière simulation" : "Dernière synchro"} {lastRun.status === "error" ? "en erreur" : "réussie"}{" "}
                  <span className="font-medium text-faint">· {ago(lastRun.finishedAt ?? lastRun.startedAt)}</span>
                </h1>
                <div className="flex flex-wrap items-center gap-2">
                  {lastRun.status === "error" ? (
                    <Pill tone="coral" dot="#ff6b6b">
                      Erreur
                    </Pill>
                  ) : (
                    <Pill tone="ok" dot="#4ade80">
                      Succès
                    </Pill>
                  )}
                  <RunPills dryRun={lastRun.dryRun} trigger={lastRun.trigger} />
                  <Mono className="text-[13px] text-muted">
                    {dayTime(lastRun.startedAt)}
                    {lastRun.finishedAt && ` → ${hm(lastRun.finishedAt)} · ${duration(lastRun.startedAt, lastRun.finishedAt)}`}
                  </Mono>
                </div>
              </>
            ) : (
              <>
                <h1 id="sync-title" className={H1}>
                  Prêt pour une première synchro
                </h1>
                <p className="m-0 text-[14.5px] text-dim">
                  Commencez par un dry run : rien n&apos;est écrit sur Tidal, et les genres de vos favoris remontent dans les suggestions de playlists.
                </p>
              </>
            )}

            <div aria-hidden="true" className="flex h-12 items-center gap-[3px] overflow-hidden">
              {WAVE_H.map((h, i) => (
                <span
                  key={i}
                  className={`block w-1 flex-[0_0_4px] rounded-[2px] ${running ? "tp-wave" : ""}`}
                  style={{ height: h, background: wave[i], animationDelay: running ? `${-(i % 12) * 0.1}s` : undefined }}
                />
              ))}
            </div>

            {running ? (
              <p className="m-0 text-[13.5px] text-dim">Les logs ci-dessous se mettent à jour en direct.</p>
            ) : (
              lastRun && (
                <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[13.5px] text-dim">
                  <Legend color="#2ee6d6" n={lastRun.moved} label="classés" />
                  <Legend color="#f5b544" n={lastRun.skipped} label="ignorés (genre non mappé)" />
                  <Legend color="#ff6b6b" n={lastRun.failed} label="en échec" />
                </div>
              )
            )}
          </div>

          <div className="flex max-w-[340px] flex-[1_1_260px] flex-col gap-2.5">
            <SyncButton action={syncNow.bind(null, false)} real disabled={running} />
            <SyncButton action={syncNow.bind(null, true)} disabled={running} />
            {running ? (
              <p role="status" className="mx-1.5 mt-0.5 flex items-center gap-2 text-[13px] font-medium text-aqua">
                <span className="tp-pulse size-2 rounded-full bg-aqua" />
                Synchronisation en cours…
              </p>
            ) : (
              <p className="mx-1.5 mt-0.5 flex items-start gap-2 text-[12.5px] leading-[1.45] text-muted">
                <Icon name="lock" size={14} strokeWidth={2} className="mt-0.5" />
                <span>La synchro réelle écrit dans vos playlists Tidal : une confirmation est demandée.</span>
              </p>
            )}
          </div>
        </section>
      ) : (
        <Onboarding />
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-4">
        <StatCard title="Compte Tidal" icon="note">
          {token ? (
            <>
              <div className="flex items-center gap-2.5">
                <span className="size-2.5 rounded-full bg-ok shadow-[0_0_0_4px_rgba(74,222,128,0.15)]" />
                <span className="font-display text-[26px] font-semibold tracking-tight">Connecté</span>
              </div>
              <span className="text-[13px] text-muted">
                Utilisateur <Mono className="text-soft">{token.tidalUserId}</Mono>
              </span>
              <form action={disconnectTidal} className="mt-auto">
                <button
                  type="submit"
                  className="-ml-3 inline-flex min-h-9 cursor-pointer items-center rounded-full border-0 bg-transparent px-3 text-[13.5px] font-medium text-soft underline decoration-[#3a414c] underline-offset-4 hover:text-ink"
                >
                  Déconnecter
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2.5">
                <span className="size-2.5 rounded-full bg-amber shadow-[0_0_0_4px_rgba(245,181,68,0.15)]" />
                <span className="font-display text-[26px] font-semibold tracking-tight">Non connecté</span>
              </div>
              <span className="text-[13px] text-muted">Aucun compte lié pour l&apos;instant.</span>
              <a href="/api/tidal/login" className="mt-auto text-[13.5px] font-semibold text-aqua no-underline hover:text-[#7ff3e8]">
                Se connecter à Tidal →
              </a>
            </>
          )}
        </StatCard>

        <StatCard title="Prochaine synchro (cron)" icon="clock">
          {next ? (
            <div className="flex flex-wrap items-baseline gap-2.5">
              <span className="font-display text-[26px] font-semibold tracking-tight">{dayTime(next)}</span>
              <span className="text-[13px] text-muted">{until(next)}</span>
            </div>
          ) : (
            <span className="font-display text-[26px] font-semibold tracking-tight">Désactivée</span>
          )}
          <div className="mt-auto flex flex-wrap gap-1.5">
            <CronChip>{settings.cronExpression}</CronChip>
            {settings.dryRun ? <Pill tone="lilac">Dry run</Pill> : <Pill tone="aqua">Réel</Pill>}
            <Pill>{settings.removeFromFavorites ? "Favoris retirés" : "Favoris conservés"}</Pill>
          </div>
        </StatCard>

        <StatCard title="Titres triés" icon="sort">
          <span className="font-display text-[44px] font-bold leading-none tracking-[-0.03em]">{int(totals._sum.moved ?? 0)}</span>
          <span className="mt-auto text-[13px] text-muted">
            {totals._count ? `${totals._count} synchro${totals._count > 1 ? "s" : ""} réelle${totals._count > 1 ? "s" : ""}` : "Aucune synchro réelle"} ·{" "}
            {mappingCount ? `${mappingCount} genre${mappingCount > 1 ? "s" : ""} mappé${mappingCount > 1 ? "s" : ""}` : "aucun genre mappé"}
          </span>
        </StatCard>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <Card component="section" aria-labelledby="logs-title" className="flex min-w-0 flex-[999_1_620px] flex-col gap-4 p-[22px]">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
            <SectionTitle id="logs-title">Logs de la dernière synchro</SectionTitle>
            {lastRun && (
              <span className="text-[13px] text-muted">
                Synchro <Mono className="text-soft">#{lastRun.id}</Mono> · {lastRun.dryRun ? "dry run" : "réelle"} · {lastRun.trigger === "cron" ? "cron" : "manuelle"}
              </span>
            )}
          </div>
          {logs.length ? (
            <LogViewer logs={logs} />
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-[14px] border border-dashed border-[#2f3540] px-4 py-12 text-center">
              <span className="text-[15px] font-semibold">Aucune synchronisation pour l&apos;instant.</span>
              <span className="max-w-md text-[13.5px] text-muted">
                Après un dry run, chaque titre apparaît ici avec son genre et la playlist choisie.
              </span>
            </div>
          )}
        </Card>

        <Card component="section" aria-labelledby="plan-title" className="flex min-w-0 flex-[1_1_360px] flex-col gap-[22px] p-[22px]">
          <SectionTitle id="plan-title">Planification et comportement</SectionTitle>
          <SettingsForm action={saveSettings} settings={settings} />
        </Card>
      </div>
    </main>
  );
}

function RunPills({ dryRun, trigger }: { dryRun: boolean; trigger: string }) {
  return (
    <>
      {dryRun ? <Pill tone="lilac">Dry run</Pill> : <Pill tone="aqua">Réel</Pill>}
      <Pill>{trigger === "cron" ? "Cron" : "Manuel"}</Pill>
    </>
  );
}

const Legend = ({ color, n, label }: { color: string; n: number; label: string }) => (
  <span className="inline-flex items-center gap-2">
    <span className="size-2 rounded-[2px]" style={{ background: color }} />
    <strong className="font-semibold text-ink">{int(n)}</strong> {label}
  </span>
);

function StatCard({ title, icon, children }: { title: string; icon: "note" | "clock" | "sort"; children: React.ReactNode }) {
  return (
    <Card component="article" className="box-border flex min-h-40 flex-col gap-2.5 p-[22px]">
      <div className="flex items-center justify-between gap-2">
        <Overline as="h2">{title}</Overline>
        <Icon name={icon} className="text-faint" />
      </div>
      {children}
    </Card>
  );
}

// Premier lancement : Tidal pas encore connecté.
function Onboarding() {
  const steps = [
    { title: "Connecter Tidal", text: "Autorisez l'accès à vos favoris et à vos playlists.", cta: "Se connecter à Tidal" },
    { title: "Lancer un dry run", text: "Rien n'est écrit sur Tidal : les genres de vos favoris remontent dans les suggestions de playlists.", cta: "Dry run (simulation)" },
    { title: "Créer et mapper des playlists", text: "Partez des suggestions, ajustez les genres, puis lancez la synchronisation réelle.", cta: "Synchronisation réelle" },
  ];
  return (
    <section
      aria-labelledby="welcome-title"
      className="flex flex-col gap-7 rounded-3xl border border-[#232831] p-[clamp(20px,2.4vw,32px)]"
      style={{ background: "radial-gradient(620px 280px at 0% 0%, rgba(46,230,214,0.10), transparent 70%), radial-gradient(520px 260px at 100% 100%, rgba(166,155,255,0.08), transparent 70%), #13161b" }}
    >
      <div className="flex flex-wrap items-center gap-6">
        <CoverTile running={false} />
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-2.5">
          <div className="flex">
            <Pill tone="lilac">Premier lancement</Pill>
          </div>
          <h1 id="welcome-title" className={H1}>
            Encore aucune synchro. Trois étapes et vos favoris se rangent tout seuls.
          </h1>
        </div>
      </div>
      <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-3 p-0">
        {steps.map((s, i) => (
          <li key={s.title} className={`flex flex-col gap-2.5 rounded-[18px] border p-[18px] ${i === 0 ? "border-aqua/40 bg-aqua/5" : "border-edge bg-raised"}`}>
            <div className="flex items-center gap-2.5">
              <span className={`inline-flex size-7 items-center justify-center rounded-full font-mono text-[13px] font-semibold ${i === 0 ? "bg-aqua text-aqua-ink" : "bg-tag text-muted"}`}>
                {i + 1}
              </span>
              <span className="text-[15px] font-semibold">{s.title}</span>
            </div>
            <p className="m-0 flex-1 text-[13.5px] text-muted">{s.text}</p>
            {i === 0 ? (
              <a
                href="/api/tidal/login"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-aqua px-5 text-[14.5px] font-semibold text-aqua-ink no-underline shadow-[0_10px_30px_-12px_rgba(46,230,214,0.7)] hover:bg-[#7ff3e8]"
              >
                <Icon name="note" size={16} strokeWidth={2} />
                {s.cta}
              </a>
            ) : (
              <button type="button" disabled className="h-11 cursor-not-allowed rounded-full border border-line bg-transparent text-[14.5px] font-semibold text-[#6b7280]">
                {s.cta}
              </button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
