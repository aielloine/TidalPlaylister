"use client";

import { Alert, Button } from "@mui/material";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import AuthField from "@/components/AuthField";

export default function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(f: FormData) {
    setPending(true);
    const res = await signIn("credentials", {
      username: f.get("username"),
      password: f.get("password"),
      redirect: false,
    });
    setPending(false);
    if (res?.ok) router.replace("/");
    else setError("Identifiants invalides");
  }

  return (
    <form action={submit} className="flex flex-col gap-5">
      {error && <Alert severity="error">{error}</Alert>}
      <AuthField id="username" label="Utilisateur" autoComplete="username" required autoFocus />
      <AuthField id="password" label="Mot de passe" type="password" autoComplete="current-password" required />
      <Button type="submit" variant="contained" size="large" disabled={pending} sx={{ mt: 0.5, minHeight: 52 }}>
        Se connecter
      </Button>
    </form>
  );
}
