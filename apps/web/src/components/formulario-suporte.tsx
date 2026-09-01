import { useState } from "react"
import { useLocation } from "react-router-dom"
import { LifeBuoy, CheckCircle2 } from "lucide-react"
import api from "../services/api"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

const MINIMO = 10

/**
 * Canal de suporte. A mensagem vira e-mail para a equipe, com o contexto
 * técnico anexado no servidor — quem é, em que tela estava, qual navegador.
 *
 * A pessoa não precisa descrever nada disso, e é justamente essa parte que
 * costuma faltar quando o relato chega como "deu erro".
 */
export function FormularioSuporte() {
  const location = useLocation()
  const [mensagem, setMensagem] = useState("")
  const [estado, setEstado] = useState<"parado" | "enviando" | "enviado">("parado")
  const [erro, setErro] = useState("")

  const curta = mensagem.trim().length < MINIMO

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro("")

    if (curta) {
      setErro(`Escreva pelo menos ${MINIMO} caracteres — quanto mais detalhe, mais rápido resolvemos.`)
      return
    }

    setEstado("enviando")
    try {
      await api.post("/suporte", { mensagem: mensagem.trim(), tela: location.pathname })
      setEstado("enviado")
      setMensagem("")
    } catch (err: unknown) {
      const resposta = (err as { response?: { status?: number; data?: { error?: string } } })?.response
      setErro(
        resposta?.data?.error ??
          (resposta?.status === 429
            ? "Muitas mensagens seguidas. Tente novamente em alguns minutos."
            : "Não foi possível enviar agora. Tente novamente em instantes."),
      )
      setEstado("parado")
    }
  }

  if (estado === "enviado") {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-success/20 bg-success/10 p-4">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
        <div className="text-sm">
          <p className="font-medium text-text">Mensagem enviada.</p>
          <p className="mt-1 text-muted">
            Respondemos no e-mail da sua conta. Se for urgente e não tiver retorno, escreva de novo.
          </p>
          <button
            type="button"
            onClick={() => setEstado("parado")}
            className="mt-2 font-medium text-primary hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
          >
            Enviar outra
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={enviar} className="space-y-3">
      <div>
        <Label htmlFor="mensagem-suporte">O que aconteceu?</Label>
        <textarea
          id="mensagem-suporte"
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          rows={5}
          maxLength={4000}
          placeholder="Descreva o problema. Se puder, diga o que você estava fazendo quando ele apareceu."
          className="mt-1.5 w-full resize-y rounded-lg border border-border bg-field p-3 text-sm text-text placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
        <p className="mt-1.5 text-xs text-muted">
          Enviamos junto a tela em que você está e o navegador, para não precisarmos perguntar depois.
          Seus lançamentos e valores não são enviados.
        </p>
      </div>

      {erro && (
        <div role="alert" className="rounded-md border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">
          {erro}
        </div>
      )}

      <Button type="submit" disabled={estado === "enviando"} className="gap-2">
        <LifeBuoy className="h-4 w-4" aria-hidden="true" />
        {estado === "enviando" ? "Enviando..." : "Enviar mensagem"}
      </Button>
    </form>
  )
}
