import { useState, type FormEvent } from "react";
import { Aviso } from "@/shared/ui";
import { mensajeDeError } from "@/shared/lib/http";
import { iniciarSesion } from "../services/auth.service";

export function LoginForm({ onListo }: { onListo: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await iniciarSesion({ email, password });
      onListo();
    } catch (err) {
      setError(mensajeDeError(err));
      setEnviando(false);
    }
  }

  return (
    <form className="login-form" onSubmit={enviar}>
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
      {error && <Aviso tipo="error" titulo={error} className="aviso-compacto" />}
      <button className="btn-primario" disabled={enviando}>
        {enviando ? "Entrando…" : "Iniciar sesión"}
      </button>
    </form>
  );
}
