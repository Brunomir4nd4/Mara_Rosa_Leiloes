import { redirect } from "next/navigation";

// A entrada do sistema é o login. O catálogo público fica em /catalogo.
// (Se já houver sessão, o middleware leva do /login direto para o painel.)
export default function Home() {
  redirect("/login");
}
