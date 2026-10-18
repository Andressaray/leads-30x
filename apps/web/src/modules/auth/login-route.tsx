import { Navigate, useNavigate, useSearchParams } from "react-router";
import { useSession } from "@/shared/hooks/use-session";
import { Container } from "@/shared/layout";
import { buildMeta, SITE_NAME } from "@/shared/seo/meta";
import { LoginForm } from "./components/LoginForm";
import { safePath } from "./services/auth.service";

export const meta = () => buildMeta({ title: "Iniciar sesión" });

export default function LoginPage() {
  const session = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = safePath(params.get("returnTo"));

  if (session) return <Navigate to={returnTo} replace />;

  return (
    <Container>
      <section className="login">
        <h1>{SITE_NAME}</h1>
        <p className="sub">Inicia sesión para buscar y contactar leads.</p>
        <LoginForm onReady={() => navigate(returnTo, { replace: true })} />
      </section>
    </Container>
  );
}
