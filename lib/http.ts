// fetch avec reprises sur coupure réseau (NAS derrière une box, CDN capricieux…).
// - Échec avant connexion (timeout, refus, DNS) : la requête n'est jamais partie, on peut toujours réessayer.
// - Coupure en cours d'échange, ou 502/503/504 : réessayé seulement pour les GET (idempotents).
const CONNECT_CODES = new Set(["UND_ERR_CONNECT_TIMEOUT", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "EHOSTUNREACH", "ENETUNREACH"]);
const RETRY_STATUS = new Set([502, 503, 504]);
const DELAYS = (process.env.HTTP_RETRY_DELAYS_MS ?? "2000,5000,15000,30000").split(",").map(Number); // surchargeable pour les tests

type NetErr = { code?: string; cause?: NetErr; errors?: NetErr[] };
// fetch failed → cause.code, ou cause.errors[].code (AggregateError quand IPv4 et IPv6 échouent tous les deux).
const errCode = (e: unknown): string => {
  const err = e as NetErr | undefined;
  return err?.cause ? errCode(err.cause) : (err?.code ?? err?.errors?.map((x) => x.code).find(Boolean) ?? "");
};

export async function fetchRetry(url: string | URL, init: RequestInit = {}, label = "HTTP"): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const where = `${label} ${method} ${new URL(url).pathname}`;
  for (let attempt = 0; ; attempt++) {
    const last = attempt >= DELAYS.length;
    try {
      const res = await fetch(url, init);
      if (method === "GET" && RETRY_STATUS.has(res.status) && !last) {
        console.warn(`[http] ${where} → ${res.status}, nouvel essai dans ${DELAYS[attempt] / 1000} s`);
      } else return res;
    } catch (e) {
      const code = errCode(e);
      if (last || !(method === "GET" || CONNECT_CODES.has(code)))
        throw new Error(`${where} : connexion impossible (${code || (e as Error).message}) après ${attempt + 1} tentative(s)`);
      console.warn(`[http] ${where} : ${code || (e as Error).message}, nouvel essai dans ${DELAYS[attempt] / 1000} s`);
    }
    await new Promise((r) => setTimeout(r, DELAYS[attempt]));
  }
}
