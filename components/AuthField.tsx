// Champ des écrans de connexion : label au-dessus, aide optionnelle.
export default function AuthField({ id, label, help, ...input }: { id: string; label: string; help?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[13px] font-semibold text-soft">
        {label}
      </label>
      <input
        id={id}
        name={id}
        aria-describedby={help ? `${id}-help` : undefined}
        {...input}
        className="box-border h-[50px] rounded-xl border border-[#2a303a] bg-hollow px-4 text-[15px] text-ink outline-none focus:border-aqua focus:shadow-[0_0_0_3px_rgba(46,230,214,0.15)]"
      />
      {help && (
        <span id={`${id}-help`} className="text-[12.5px] text-muted">
          {help}
        </span>
      )}
    </div>
  );
}
