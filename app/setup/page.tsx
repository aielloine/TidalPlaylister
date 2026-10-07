import { Alert, Button, TextField, Typography } from "@mui/material";
import { redirect } from "next/navigation";
import { createAdmin } from "@/app/actions";
import AuthCard from "@/components/AuthCard";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Setup({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await prisma.user.count()) redirect("/login");
  const { error } = await searchParams;
  return (
    <AuthCard title="Création du compte administrateur">
      <Typography variant="body2" color="text.secondary">
        Premier lancement : créez le compte qui protégera l&apos;interface.
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <form action={createAdmin} className="flex flex-col gap-4">
        <TextField name="username" label="Utilisateur" required autoFocus />
        <TextField name="password" label="Mot de passe" type="password" required slotProps={{ htmlInput: { minLength: 8 } }} />
        <TextField name="confirm" label="Confirmation" type="password" required />
        <Button type="submit" variant="contained">
          Créer le compte
        </Button>
      </form>
    </AuthCard>
  );
}
