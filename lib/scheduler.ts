import cron, { type ScheduledTask } from "node-cron";
import { getSettings } from "./db";
import { runSync } from "./sync";

// globalThis : instrumentation.ts et les route handlers sont bundlés séparément mais partagent le process.
const g = globalThis as unknown as { syncTask?: ScheduledTask };

// Appelé au démarrage et après chaque modification des Settings depuis l'UI.
export async function startScheduler() {
  await g.syncTask?.destroy();
  g.syncTask = undefined;

  const { cronEnabled, cronExpression } = await getSettings();
  if (!cronEnabled) return;
  if (!cron.validate(cronExpression)) {
    console.error(`[cron] expression invalide: ${cronExpression}`);
    return;
  }
  g.syncTask = cron.schedule(cronExpression, async () => {
    const { dryRun } = await getSettings(); // relu à chaque tick : le toggle UI s'applique sans redémarrage
    await runSync({ dryRun, trigger: "cron" }).catch((e) => console.error("[cron]", e));
  });
  console.log(`[cron] planifié: ${cronExpression}`);
}

export const nextRun = () => g.syncTask?.getNextRun() ?? null;
