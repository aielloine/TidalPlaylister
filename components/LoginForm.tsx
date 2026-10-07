"use client";

import { Alert, Button, TextField } from "@mui/material";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
    <form action={submit} className="flex flex-col gap-4">
      {error && <Alert severity="error">{error}</Alert>}
      <TextField name="username" label="Utilisateur" autoComplete="username" required autoFocus />
      <TextField name="password" label="Mot de passe" type="password" autoComplete="current-password" required />
      <Button type="submit" variant="contained" disabled={pending}>
        Se connecter
      </Button>
    </form>
  );
}
