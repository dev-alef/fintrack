import { Link } from "react-router-dom"
import {
  ArrowRight,
  ArrowLeft,
  CalendarDays,
  CreditCard,
  Gem,
  LineChart,
  ListChecks,
  Lock,
  PieChart,
  Receipt,
  ShieldCheck,
  Sparkles,
  Target,
  Wallet,
} from "lucide-react"
import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"

/**
 * Página pública de apresentação — o que a Provisão faz, para quem chegou pelo
 * botão "Conhecer a Provisão" na tela de entrada e ainda não tem conta.
 *
 * Pública de propósito: quem está decidindo se cria conta precisa conseguir ler
 * tudo antes, e um explicativo atrás de login não explica nada a ninguém.
 *
 * O texto é escrito em primeira pessoa porque o app nasceu de uma dor real de
 * quem o construiu. Página de produto que começa com "a melhor plataforma de
 * gestão financeira" não diz nada; a origem, dita com honestidade, diz.
 */

type Recurso = {
  icone: typeof Wallet
  titulo: string
  texto: string
}

const DIA_A_DIA: Recurso[] = [
  {
    icone: Receipt,
    titulo: "Entradas e saídas",
    texto:
      "Cada gasto e cada recebimento, com categoria e data. É a base de tudo — sem isso os outros números não têm de onde sair.",
  },
  {
    icone: ListChecks,
    titulo: "Contas fixas",
    texto:
      "Aluguel, internet, academia. Você cadastra uma vez e, todo mês, marca o que já pagou. O que falta aparece no painel.",
  },
  {
    icone: CreditCard,
    titulo: "Cartões e faturas",
    texto:
      "Seus cartões, com o valor da fatura de cada mês. Entra na conta do mês junto com o resto, em vez de ser aquela surpresa no vencimento.",
  },
  {
    icone: PieChart,
    titulo: "Para onde foi",
    texto:
      "Contas fixas, faturas e lançamentos avulsos num gráfico só, divididos pelo nome que você deu. Responde de olhada a pergunta que dói: em que exatamente foi o mês.",
  },
]

const PLANEJAMENTO: Recurso[] = [
  {
    icone: CalendarDays,
    titulo: "O mês inteiro numa tela",
    texto:
      "Receita estimada, contas fixas, faturas, quanto já saiu e quanto deve sobrar. A pergunta “dá pra gastar isso?” tem resposta.",
  },
  {
    icone: LineChart,
    titulo: "O ano inteiro",
    texto:
      "Entradas e saídas mês a mês, lado a lado. É onde aparece o padrão que não dá pra ver olhando um mês só.",
  },
  {
    icone: Target,
    titulo: "Metas",
    texto:
      "Uma reserva, uma viagem, um objetivo com valor e prazo. A barra de progresso aparece assim que você registra o primeiro valor guardado.",
  },
  {
    icone: Gem,
    titulo: "Investimentos",
    texto:
      "Quanto está aplicado, em quê, e quanto rendeu. Tem também uma calculadora de juros compostos, para simular aporte antes de decidir.",
  },
]

const SEGURANCA: Recurso[] = [
  {
    icone: Lock,
    titulo: "Verificação em duas etapas",
    texto:
      "Código do aplicativo autenticador além da senha, com códigos de recuperação caso você perca o celular.",
  },
  {
    icone: ShieldCheck,
    titulo: "Aviso de acesso novo",
    texto:
      "Entrou de um aparelho que nunca foi usado? Você recebe um e-mail na hora. E pode encerrar qualquer sessão de longe.",
  },
]

const PASSOS = [
  {
    titulo: "Diga quanto você recebe",
    texto:
      "Na tela de Controle, preencha a receita estimada do mês. É o número que todo o resto usa como ponto de partida.",
  },
  {
    titulo: "Cadastre o que é fixo",
    texto:
      "Contas que se repetem todo mês e seus cartões. Você faz isso uma vez; nos meses seguintes é só marcar o que pagou.",
  },
  {
    titulo: "Lance o que acontecer",
    texto:
      "Mercado, farmácia, um freela que entrou. Quanto mais fiel o registro, mais o painel vale.",
  },
  {
    titulo: "Defina uma meta",
    texto:
      "Mesmo pequena. É ela que transforma “sobrou dinheiro” em “faltam três meses para a reserva”.",
  },
  {
    titulo: "Olhe o painel",
    texto:
      "Agora ele responde: quanto já saiu, quanto ainda falta pagar e quanto deve sobrar no fim do mês.",
  },
]

function Secao({
  titulo,
  descricao,
  itens,
  colunas = 3,
}: {
  titulo: string
  descricao?: string
  itens: Recurso[]
  colunas?: 2 | 3
}) {
  return (
    <section className="mt-20">
      <h2 className="text-xl font-semibold tracking-tight text-text sm:text-2xl">{titulo}</h2>
      {descricao && <p className="mt-2 max-w-[65ch] text-[15px] leading-relaxed text-muted">{descricao}</p>}

      <div className={`mt-8 grid gap-4 sm:grid-cols-2 ${colunas === 3 ? "lg:grid-cols-3" : ""}`}>
        {itens.map(({ icone: Icone, titulo: t, texto }) => (
          <div key={t} className="rounded-2xl border border-border bg-surface p-6">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: "var(--surface-2)" }}
            >
              <Icone className="h-5 w-5" style={{ color: "var(--primary)" }} aria-hidden="true" />
            </span>
            <h3 className="mt-4 font-semibold text-text">{t}</h3>
            <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{texto}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function Conhecer() {
  return (
    <div className="min-h-screen bg-bg">
      <header className="flex items-center justify-between p-4">
        <Link to="/login" className="flex items-center gap-3">
          <Logo size={32} />
          <span className="text-lg font-semibold tracking-tight text-text">Provisão</span>
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link to="/register">
            <Button size="sm">Criar conta</Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[880px] px-6 pb-28">
        <Link
          to="/login"
          className="mb-10 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Voltar para a entrada
        </Link>

        {/* Abertura: a dor que originou o app, em primeira pessoa. */}
        <p className="text-xs uppercase tracking-[0.14em] text-muted">Por que a Provisão existe</p>
        <h1
          className="mt-4 text-3xl leading-[1.15] text-text sm:text-[2.6rem]"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Eu queria saber quanto ia sobrar.
        </h1>

        <div className="mt-6 max-w-[62ch] space-y-4 text-[16px] leading-relaxed text-text">
          <p>
            Não era sobre planilha bonita. Era sobre três perguntas que eu não sabia responder no
            meio do mês: <strong>quanto eu já gastei</strong>, <strong>quanto ainda vai sair</strong>{" "}
            e <strong>o que sobra no fim</strong>.
          </p>
          <p className="text-muted">
            Anotar tudo num caderno respondia a primeira. Nenhuma das outras duas. E a pergunta que
            mais me incomodava — <em>se eu seguir assim, quanto eu tenho em dezembro?</em> — não
            cabia em anotação nenhuma.
          </p>
          <p>
            A Provisão nasceu disso. Não para categorizar o passado, mas para{" "}
            <strong>mostrar o que vem pela frente</strong>.
          </p>
        </div>

        {/* As três perguntas viram as três respostas do painel. */}
        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {[
            { rotulo: "Quanto já saiu", texto: "Somando gastos, contas fixas pagas e faturas." },
            { rotulo: "Quanto ainda vai sair", texto: "O que está cadastrado e ainda não foi pago." },
            { rotulo: "Quanto deve sobrar", texto: "A conta que ninguém quer fazer de cabeça." },
          ].map((c) => (
            <div
              key={c.rotulo}
              className="rounded-2xl border border-border p-5"
              style={{ background: "var(--ai-card)" }}
            >
              <p className="text-sm font-semibold text-text">{c.rotulo}</p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{c.texto}</p>
            </div>
          ))}
        </div>

        <Secao
          titulo="O dinheiro do dia a dia"
          descricao="O que entra, o que sai, e o que se repete todo mês."
          itens={DIA_A_DIA}
        />

        <Secao
          titulo="Para onde isso está indo"
          descricao="O painel responde o mês. Estas telas respondem o ano."
          itens={PLANEJAMENTO}
          colunas={2}
        />

        {/* A leitura da IA ganha destaque proprio: e o que diferencia de planilha. */}
        <section className="mt-20 rounded-2xl border border-border p-8" style={{ background: "var(--ai-card)" }}>
          <p className="flex items-center gap-2 text-xs uppercase tracking-[0.1em] text-muted">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Leitura da IA
          </p>
          <h2
            className="mt-3 text-xl leading-snug text-text sm:text-2xl"
            style={{ fontFamily: "var(--font-heading)", color: "var(--link)" }}
          >
            Seus números, ditos em português.
          </h2>
          <p className="mt-4 max-w-[62ch] text-[15px] leading-relaxed text-text">
            No painel, uma leitura curta do seu mês: quanto sobrou, quantas contas faltam, como sua
            meta está indo. Na tela de Insights, uma análise mais longa, quando você pedir.
          </p>
          <p className="mt-3 max-w-[62ch] text-[14.5px] leading-relaxed text-muted">
            A conta é feita pelo sistema, sempre em cima dos seus lançamentos — a IA só escreve o
            resultado. Ela descreve o que está acontecendo com o seu dinheiro; não recomenda
            investimento, e não substitui orientação profissional.
          </p>
        </section>

        {/* Passo a passo. */}
        <section className="mt-20">
          <h2 className="text-xl font-semibold tracking-tight text-text sm:text-2xl">Como começar</h2>
          <p className="mt-2 max-w-[65ch] text-[15px] leading-relaxed text-muted">
            A ordem importa: cada passo destrava um pedaço do painel. Em vinte minutos o mês está
            montado, e os próximos levam dois.
          </p>

          <ol className="mt-8 space-y-4">
            {PASSOS.map((p, i) => (
              <li key={p.titulo} className="flex gap-4 rounded-2xl border border-border bg-surface p-5">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                  style={{ background: "var(--surface-2)", color: "var(--primary)" }}
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-semibold text-text">{p.titulo}</h3>
                  <p className="mt-1 text-[14.5px] leading-relaxed text-muted">{p.texto}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <Secao
          titulo="Seu dinheiro, sua conta"
          descricao="Dado financeiro pede mais cuidado que login de rede social. O que está no ar hoje:"
          itens={SEGURANCA}
          colunas={2}
        />

        <p className="mt-6 max-w-[65ch] text-[14.5px] leading-relaxed text-muted">
          A Provisão <strong>não se conecta ao seu banco</strong> e não pede sua senha bancária.
          Tudo que aparece aqui foi você quem cadastrou. Os{" "}
          <Link to="/termos">Termos de Uso</Link> e a{" "}
          <Link to="/privacidade">Política de Privacidade</Link> explicam o resto, sem letra miúda.
        </p>

        {/* Fechamento. */}
        <section className="mt-20 rounded-2xl border border-border bg-surface p-8 text-center sm:p-10">
          <h2
            className="text-2xl leading-snug text-text"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Comece pelo mês que você está vivendo.
          </h2>
          <p className="mx-auto mt-3 max-w-[48ch] text-[15px] leading-relaxed text-muted">
            Não precisa cadastrar o ano inteiro para valer a pena. Um mês honesto já responde as
            três perguntas lá de cima — e os meses seguintes vão desenhando o ano.
          </p>
          <Link to="/register" className="mt-7 inline-block">
            <Button size="lg" className="gap-2 rounded-full">
              Criar minha conta
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </Link>
          <p className="mt-4 text-[13px] text-muted">É gratuito.</p>
        </section>
      </main>
    </div>
  )
}
