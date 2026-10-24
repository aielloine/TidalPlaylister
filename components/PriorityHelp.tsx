// Explication repliable du choix de playlist par priorité (composant serveur, <details> natif).
const EXAMPLE: { genre: string; prio: number; playlist: string; win?: boolean }[] = [
  { genre: "rap français", prio: 30, playlist: "Rap FR", win: true },
  { genre: "hip hop", prio: 20, playlist: "Hip-hop US" },
  { genre: "rap", prio: 0, playlist: "Rap" },
];

export default function PriorityHelp() {
  return (
    <details className="group rounded-[18px] border border-lilac/25 bg-lilac/[0.06]">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2.5 px-4 py-2 text-[14px] font-semibold text-lilac-soft [&::-webkit-details-marker]:hidden">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="flex-none">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" />
        </svg>
        Comment la priorité choisit la playlist d&apos;un titre
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true" className="ml-auto flex-none transition-transform group-open:rotate-180">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <div className="flex flex-col gap-4 border-t border-lilac/20 px-4 pb-4 pt-3.5 text-[13.5px] leading-relaxed text-soft">
        <p className="m-0 max-w-[68ch]">
          Un titre porte souvent plusieurs genres. Chaque genre mappé a une priorité, le nombre affiché devant lui. Le titre va dans la playlist du
          genre qui a <strong className="text-ink">la priorité la plus haute</strong> ; ses autres genres sont ignorés.
        </p>
        <div className="flex flex-col gap-1.5 self-start rounded-xl bg-night/60 p-3">
          <span className="text-[12.5px] text-muted">Exemple : un titre tagué « rap français », « hip hop » et « rap »</span>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {EXAMPLE.map((e) => (
              <li key={e.genre} className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 ${e.win ? "text-ink" : "text-faint line-through decoration-[#4a515c]"}`}>
                <span className={`inline-flex h-[22px] min-w-[30px] items-center justify-center rounded-full font-mono text-[11.5px] font-semibold ${e.win ? "bg-aqua text-aqua-ink" : "bg-tag text-muted"}`}>
                  {e.prio}
                </span>
                {e.genre}
                <span className="text-[12.5px] no-underline">vers « {e.playlist} »</span>
                {e.win && <span className="text-[12.5px] font-semibold text-aqua">choisie</span>}
              </li>
            ))}
          </ul>
        </div>
        <ul className="m-0 flex max-w-[68ch] list-disc flex-col gap-1.5 pl-5 marker:text-lilac">
          <li>
            <strong className="text-ink">À égalité</strong>, le genre le plus représentatif du titre l&apos;emporte (le tag Last.fm le mieux noté).
          </li>
          <li>
            <strong className="text-ink">Par défaut</strong>, un genre large (pop, rap, rock, electro…) vaut 0 et un genre précis vaut 10. Les
            ambiances mettent 10 à 30 sur leurs tags précis et 1 sur leurs tags larges.
          </li>
          <li>
            <strong className="text-ink">Pour la changer</strong>, touchez le nombre devant un genre, tapez la nouvelle valeur puis Entrée. À
            l&apos;ajout de genres, le champ « Prio. » laissé vide applique la valeur par défaut.
          </li>
          <li>
            Avec <strong className="text-ink">« Ranger à nouveau »</strong> activé sur le dashboard, les titres déjà classés suivent la nouvelle
            priorité à la prochaine synchro.
          </li>
        </ul>
      </div>
    </details>
  );
}
