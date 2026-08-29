import { useState } from "react"
import { signIn } from "../lib/auth-client"
import { Button } from "@/components/ui/button"

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09A6.97 6.97 0 0 1 5.5 12c0-.73.12-1.43.34-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.78.42 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

type Props = {
  label: string
  disabled?: boolean
  onError: (message: string) => void
}

/**
 * Botao de login com Google, compartilhado pelas telas de Login e Cadastro.
 * As duas fazem exatamente a mesma coisa: quem entra pelo Google com um e-mail
 * que ja tem conta cai no mesmo usuario, entao nao existe "cadastrar" separado
 * de "entrar" - so o texto do botao muda.
 */
export function GoogleButton({ label, disabled, onError }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    onError("")
    setLoading(true)
    try {
      // Em caso de sucesso o navegador sai desta pagina rumo ao Google, entao
      // este await normalmente nao retorna. So voltamos aqui quando algo falha
      // antes do redirecionamento - tipicamente provedor nao configurado.
      const { error } = await signIn.social({
        provider: "google",
        callbackURL: `${window.location.origin}/dashboard`,
        // O Better Auth acrescenta ?error=<codigo> a esta URL quando o fluxo
        // falha do lado dele. A tela de login traduz o codigo.
        errorCallbackURL: `${window.location.origin}/login`,
      })
      if (error) {
        onError("Login com Google indisponível no momento. Entre com e-mail e senha.")
        setLoading(false)
      }
    } catch {
      // Erro de rede: a requisicao nem chegou a uma resposta. Em
      // desenvolvimento a causa quase sempre e o front apontando para outra API
      // (VITE_API_URL) ou a origem fora de CORS_ORIGINS, entao vale dizer isso
      // em vez de um "tente novamente" que manda repetir o que nao funciona.
      onError(
        "Não foi possível falar com o servidor. Verifique se a API está no ar e se esta origem está em CORS_ORIGINS.",
      )
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleClick}
      disabled={disabled || loading}
      className="w-full gap-2"
    >
      <GoogleIcon />
      {loading ? "Redirecionando..." : label}
    </Button>
  )
}
