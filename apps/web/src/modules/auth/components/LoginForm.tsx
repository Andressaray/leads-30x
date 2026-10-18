import { useState, type FormEvent } from "react";
import { Notice } from "@/shared/ui";
import { errorMessage } from "@/shared/lib/http";
import { login } from "../services/auth.service";

export function LoginForm({ onReady }: { onReady: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      await login({ email, password });
      onReady();
    } catch (err) {
      setError(errorMessage(err));
      setSending(false);
    }
  }

  return (
    <form className="login-form" onSubmit={send}>
      <label>
        Correo
        <input
          type="email"
          required
          autoComplete="username"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label>
        Contraseña
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && <Notice type="error" title={error} className="notice-compact" />}
      <button className="btn-primary" disabled={sending}>
        {sending ? "Entrando…" : "Iniciar sesión"}
      </button>
    </form>
  );
}
