export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { prisma } = await import("./lib/db");
    const { startScheduler } = await import("./lib/scheduler");
    // Une synchro interrompue par un redémarrage du conteneur reste "running" sinon.
    await prisma.syncRun.updateMany({ where: { status: "running" }, data: { status: "error", finishedAt: new Date() } });
    await startScheduler();
  }
}
