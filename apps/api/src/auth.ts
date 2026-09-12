import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { betterAuth } from 'better-auth'
import { createAuthMiddleware } from 'better-auth/api'
import { twoFactor } from 'better-auth/plugins'
import pool from './db/client'
import { enviarEmail } from './email'
import { emailDeVerificacao, emailDeRecuperacao } from './emails/templates'
import { avisaSeAcessoNovo } from './acesso-novo'
import { CABECALHO_IP } from './ip-cliente'
import { anotaTentativa, barraSeExcedeu } from './limite-por-conta'
import { registraAceite } from './aceites'

const googleClientId = process.env.GOOGLE_CLIENT_ID
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET

// O provedor so e registrado quando as duas credenciais existem. Registrar com
// valor vazio faria o botao aparecer funcional e quebrar no meio do fluxo, ja
// no dominio do Google - erro que o usuario nao consegue interpretar. Sem as
// credenciais o servidor responde que o provedor nao existe, e a tela mostra
// uma mensagem em portugues.
export const googleEnabled = Boolean(googleClientId && googleClientSecret)

// Better Auth reaproveita a tabela `users` que ja existe, em vez de criar a
// tabela `user` dele. Isso e deliberado: dez tabelas apontam para users.id com
// ON DELETE CASCADE, entao trocar essa tabela apagaria dado financeiro em
// silencio. Mantendo os mesmos UUIDs, todas as chaves estrangeiras continuam
// validas e nenhum dado precisa ser movido.
export const auth = betterAuth({
  database: pool,

  user: {
    modelName: 'users',
    // A tabela existente ja tem created_at e updated_at em snake_case. Sem este
    // mapeamento o Better Auth criaria createdAt e updatedAt em paralelo, e a
    // tabela passaria a ter duas colunas de data significando a mesma coisa,
    // com uma delas sempre desatualizada.
    fields: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },

  emailAndPassword: {
    enabled: true,
    // As senhas existentes estao em bcrypt. O padrao do Better Auth e scrypt,
    // entao a verificacao e sobrescrita para que quem ja tem conta continue
    // entrando com a mesma senha, sem precisar redefinir nada.
    password: {
      hash: (password) => bcrypt.hash(password, 12),
      verify: ({ hash, password }) => bcrypt.compare(password, hash),
    },

    // Ate aqui, esquecer a senha significava perder a conta: nao havia
    // caminho de volta nenhum. Para quem entrou pelo Google isso e invisivel,
    // mas quem se cadastrou por senha ficava sem saida.
    resetPasswordTokenExpiresIn: 60 * 60,
    sendResetPassword: async ({ user, url }) => {
      const { assunto, html, texto } = emailDeRecuperacao(user.name || 'tudo bem', url)
      await enviarEmail({ para: user.email, assunto, html, texto })
    },
    // Derrubar as outras sessoes e o ponto da recuperacao quando a conta foi
    // invadida: trocar a senha sem isso deixaria o invasor logado, com a
    // sessao dele valendo mais 7 dias.
    revokeSessionsOnPasswordReset: true,
  },

  socialProviders: googleEnabled
    ? {
        google: {
          clientId: googleClientId!,
          clientSecret: googleClientSecret!,
          mapProfileToUser: (profile) => ({
            // users.name e varchar(100) e NOT NULL. Um nome de perfil maior que
            // isso faria o Postgres recusar o INSERT e o cadastro morreria com
            // 500 depois que a pessoa ja tinha autorizado no Google.
            name: (profile.name || profile.email).slice(0, 100),
          }),
        },
      }
    : undefined,

  account: {
    accountLinking: {
      // Quem ja tem conta com e-mail e senha e entra com Google usando o mesmo
      // e-mail cai no MESMO usuario, em vez de ganhar uma conta paralela com os
      // dados financeiros presos na outra. So e seguro porque o provedor confia
      // no e-mail: o Google exige verificacao antes de expor o endereco. Um
      // provedor que nao verificasse permitiria assumir a conta alheia apenas
      // declarando o e-mail dela.
      enabled: true,
      trustedProviders: ['google'],
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    // Confirmar o e-mail ja deixa a pessoa logada. Sem isso ela clicaria no
    // link, veria "verificado" e teria de digitar a senha de novo, sem motivo -
    // acabou de provar que controla o endereco.
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60,
    sendVerificationEmail: async ({ user, url }) => {
      const { assunto, html, texto } = emailDeVerificacao(user.name || 'tudo bem', url)
      await enviarEmail({ para: user.email, assunto, html, texto })
    },
  },

  session: {
    // Dois dias, nao sete. Ultima peca do pacote contra roubo de sessao.
    //
    // Encurtar nao expulsa um invasor ATIVO - ele usa o cookie e a validade se
    // renova junto. O que isso mata e o cenario mais comum do infostealer: o
    // log e exfiltrado, vendido em lote e usado dias ou semanas depois. Com
    // dois dias, a maioria dos cookies roubados chega morta ao comprador.
    expiresIn: 60 * 60 * 24 * 2,

    // A renovacao a cada 24h e o que torna o encurtamento indolor: quem abre o
    // app ao menos uma vez a cada dois dias nunca e deslogado, porque a
    // validade se estende no uso. Sem isso, dois dias significaria digitar a
    // senha duas vezes por semana - e o custo recairia sobre quem usa, nao
    // sobre quem rouba.
    updateAge: 60 * 60 * 24,
  },

  // Limite por conta no login, em cima do limite por IP que o Better Auth ja
  // faz. Por que so login, e nao cadastro tambem: limite-por-conta.ts.
  //
  // O `before` barra antes de a senha ser sequer verificada; o `after` anota o
  // desfecho, porque so ali se sabe se deu certo. Os dois rodam para todos os
  // endpoints - quem filtra pelo caminho e o proprio limite-por-conta.ts, para
  // a lista de caminhos protegidos morar num lugar so.
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      barraSeExcedeu(ctx.path, ctx.body)
    }),
    after: createAuthMiddleware(async (ctx) => {
      // Quando o endpoint recusa, ele lanca um APIError que o dispatch captura
      // e deixa aqui em `returned`. Resposta de sucesso e um objeto comum.
      const retorno = ctx.context.returned as { statusCode?: number } | undefined
      const falhou =
        retorno instanceof Error || (typeof retorno?.statusCode === 'number' && retorno.statusCode >= 400)

      anotaTentativa(ctx.path, ctx.body, falhou)
    }),
  },

  // O limite por IP fica generoso de proposito.
  //
  // O padrao do Better Auth e 3 tentativas por 10s por IP, e isso pressupoe que
  // cada pessoa tenha o proprio IP. Aqui nao tem: pelo proxy da Vercel, todo
  // mundo resolve para o IP de saida dela, e umas poucas pessoas usando o app ao
  // mesmo tempo se barrariam entre si. Com o limite por conta segurando o que
  // importa, este vira rede de fundo contra volume, e a folga e o que impede que
  // ele derrube gente legitima.
  rateLimit: {
    customRules: {
      '/sign-in/email': { window: 60, max: 60 },
      '/sign-up/email': { window: 60, max: 30 },
    },
  },

  databaseHooks: {
    user: {
      create: {
        // Aqui, e nao no endpoint de cadastro: este gancho dispara tanto no
        // cadastro por e-mail quanto na primeira entrada pelo Google. Amarrar
        // ao /sign-up/email cobriria so metade das contas.
        //
        // Com await, diferente do aviso de acesso novo: gravar o aceite e uma
        // linha no mesmo banco, nao uma chamada de rede, e o registro precisa
        // existir antes de a conta ser considerada criada. A funcao trata os
        // proprios erros e nunca lanca - cadastro nao morre por causa da
        // tabela de auditoria.
        after: async (usuario, contexto) => {
          await registraAceite(usuario.id, contexto?.headers)
        },
      },
    },

    session: {
      create: {
        // Depois, nao antes: o aviso compara com as sessoes ja existentes, e o
        // gancho `before` rodaria com a sessao nova ainda fora da tabela.
        //
        // Sem await de proposito. O e-mail leva centenas de milissegundos, e
        // segurar o login por causa dele faria a tela parecer travada em toda
        // entrada de dispositivo novo. A funcao trata os proprios erros.
        after: async (sessao) => {
          void avisaSeAcessoNovo(sessao)
        },
      },
    },
  },

  // A sessao viaja em cookie httpOnly entre dominios diferentes (Vercel no
  // front, Render na API), o que exige SameSite=None com Secure.
  advanced: {
    database: {
      // users.id e UUID, e o Better Auth gera ids em formato proprio por
      // padrao - o Postgres rejeita com "invalid input syntax for type uuid".
      // Gerar UUID cobre todos os modelos: nas tabelas do proprio Better Auth
      // o id e text, e um UUID em texto cabe sem problema.
      generateId: () => randomUUID(),
    },
    defaultCookieAttributes: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    },

    // Quem descobre o IP e ip-cliente.ts, e o motivo esta documentado la: a
    // cadeia do x-forwarded-for lida da direita para a esquerda e a unica fonte
    // que o cliente nao consegue escolher.
    //
    // Aqui fica so o consumo. Um cabecalho unico, escrito pelo nosso middleware
    // a cada requisicao, e trustedProxies vazio de proposito: a cadeia ja foi
    // percorrida, e mandar o Better Auth percorrer de novo um valor que ele nao
    // sabe que e final so criaria um segundo lugar onde errar.
    ipAddress: {
      ipAddressHeaders: [CABECALHO_IP],
      trustedProxies: [],
    },
  },

  plugins: [
    twoFactor({
      // Aparece como "Provisão: email" no aplicativo autenticador. Sem isto,
      // quem tem varias contas ve entradas indistinguiveis na lista.
      issuer: 'Provisão',
      totpOptions: {
        // Uma janela para tras e uma para frente: relogio de celular
        // adiantado ou atrasado em ate 30s continua entrando. Sem folga, a
        // pessoa digita o codigo certo e e recusada, sem ter como descobrir
        // que o problema e o relogio.
        period: 30,
        digits: 6,
      },
    }),
  ],

  trustedOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  secret: process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3001',
})
