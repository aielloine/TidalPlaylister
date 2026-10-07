import { Card, CardContent, Typography } from "@mui/material";

export default function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col gap-4">
          <Typography variant="h5">{title}</Typography>
          {children}
        </CardContent>
      </Card>
    </main>
  );
}
