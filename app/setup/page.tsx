import { Alert, Button } from "@mui/material";
import { redirect } from "next/navigation";
import { createAdmin } from "@/app/actions";
import AuthCard from "@/components/AuthCard";
import AuthField from "@/components/AuthField";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Setup({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await prisma.user.count()) redirect("/login");
  const { error } = await searchParams;
  return (
    <AuthCard title="Création du compte administrateur" badge="Premier lancement" intro="Créez le compte qui protégera l'interface." lilac>
      {error && <Alert severity="error">{error}</Alert>}
      <form action={createAdmin} className="flex flex-col gap-5">
        <AuthField id="username" label="Utilisateur" autoComplete="username" required autoFocus />
        <AuthField id="password" label="Mot de passe" type="password" autoComplete="new-password" required minLength={8} help="8 caractères minimum." />
        <AuthField id="confirm" label="Confirmation" type="password" autoComplete="new-password" required />
        <Button type="submit" variant="contained" size="large" sx={{ mt: 0.5, minHeight: 52 }}>
          Créer le compte
        </Button>
      </form>
    </AuthCard>
  );
}
