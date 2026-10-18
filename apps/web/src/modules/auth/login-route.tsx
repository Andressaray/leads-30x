import { Navigate, useNavigate, useSearchParams } from "react-router";
import { useSesion } from "@/shared/hooks/use-session";
import { Container } from "@/shared/layout";
import { buildMeta, SITE_NAME } from "@/shared/seo/meta";
import { LoginForm } from "./components/LoginForm";
import { rutaSegura } from "./services/auth.service";

export const meta = () => buildMeta({ title: "Iniciar sesión" });

export default function LoginPage() {
  const sesion = useSesion();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const volver = rutaSegura(params.get("volver"));

  if (sesion) return <Navigate to={volver} replace />;

  return (
    <Container>
      <section className="login">
        <h1>{SITE_NAME}</h1>
        <p className="sub">Inicia sesión para buscar y contactar leads.</p>
        <LoginForm onListo={() => navigate(volver, { replace: true })} />
      </section>
    </Container>
  );
}
