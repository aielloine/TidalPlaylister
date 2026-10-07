import { Alert } from "@mui/material";
import { redirect } from "next/navigation";
import AuthCard from "@/components/AuthCard";
import LoginForm from "@/components/LoginForm";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  if (!(await prisma.user.count())) redirect("/setup");
  const { created } = await searchParams;
  return (
    <AuthCard title="Connexion">
      {created && <Alert severity="success">Compte créé, connectez-vous.</Alert>}
      <LoginForm />
    </AuthCard>
  );
}
