"use client";

// « Ajouter à… » : met les genres d'une idée (ou d'une ambiance) dans une playlist existante au lieu d'en créer une.
// Le choix dans la liste envoie directement le formulaire.
export default function AddToPlaylist({
  action,
  playlists,
  label,
  className = "",
  selectClassName = "max-w-[180px]",
}: {
  action: (f: FormData) => Promise<void>;
  playlists: { id: string; name: string }[];
  label: string;
  className?: string;
  selectClassName?: string;
}) {
  if (!playlists.length) return null;
  return (
    <form action={action} aria-label={label} className={`flex ${className}`}>
      <select
        name="playlistId"
        required
        defaultValue=""
        aria-label={label}
        onChange={(e) => e.currentTarget.value && e.currentTarget.form?.requestSubmit()}
        className={`h-[30px] ${selectClassName} cursor-pointer appearance-none truncate rounded-full border border-[#2a303a] bg-transparent bg-[length:10px] bg-[right_10px_center] bg-no-repeat pl-3 pr-7 text-[12.5px] font-medium text-soft outline-none hover:border-[#3a414c] focus:border-aqua [&>option]:bg-stage [&>option]:text-ink`}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%238b93a1' stroke-width='1.6' stroke-linecap='round'/%3E%3C/svg%3E\")",
        }}
      >
        <option value="" disabled>
          Ajouter à…
        </option>
        {playlists.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </form>
  );
}
