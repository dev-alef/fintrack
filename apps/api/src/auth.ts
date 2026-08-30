import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { betterAuth } from 'better-auth'
import { twoFactor } from 'better-auth/plugins'
import pool from './db/client'
import { enviarEmail } from './email'
import { emailDeVerificacao, emailDeRecuperacao } from './emails/templates'

const googleClientId = process.env.GOOGLE_CLIENT_ID
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET

// O provedor so e registrado quando as duas credenciais existem. Registrar com
// valor vazio faria o botao aparecer funcional e quebrar no meio do fluxo, ja
// no dominio do Google - erro que o usuario nao consegue interpretar. Sem as
// credenciais o servidor responde que o provedor nao existe, e a tela mostra
// uma mensagem em portugues.
export const googleEnabled = Boolean(googleClientId && googleClientSecret)

// Le uma variavel de ambiente com valores separados por virgula. Devolve
// undefined quando nao ha nada util, para o chamador decidir o padrao - uma
// lista vazia significaria "configurado como vazio", que e outra coisa.
function lista(valor: string | undefined): string[] | undefined {
  const itens = (valor ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  return itens.length > 0 ? itens : undefined
}

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
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
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

    // Sem isto o rate limiting nao funciona em producao. O Better Auth so aceita
    // o x-forwarded-for quando consegue confiar na cadeia:
    //
    //   if (forwardedIps.length !== 1) return null   // multi-hop irresolvivel
    //
    // Como o navegador fala com a Vercel, que encaminha para o Render, o
    // cabecalho chega com dois saltos e a resolucao falha. O limite entao cai
    // num balde unico compartilhado - e uma pessoa tentando senhas em massa
    // consome a cota de todo mundo, trancando os demais para fora.
    //
    // Com trustedProxies a cadeia e percorrida da direita para a esquerda,
    // pulando os saltos confiaveis, ate o primeiro nao confiavel: o cliente
    // real. Os valores ficam em variavel de ambiente porque os IPs de saida da
    // Vercel e do Render mudam sem aviso, e trocar CIDR nao deveria exigir
    // deploy. Vazio mantem o comportamento atual, sem regressao.
    //
    // So que pelo proxy isso nao basta: a Vercel sai por IPs variados e nao
    // publicados, entao a cadeia para no salto dela - que muda a cada
    // requisicao. A resolucao "tem sucesso" devolvendo um IP diferente toda
    // vez, cada uma vira um balde novo, e o limite nunca acumula. Medido em
    // producao: 6 logins seguidos pelo proxy passaram sem 429; direto no
    // Render, a quarta foi barrada.
    //
    // Por isso a lista de cabecalhos comeca por x-vercel-forwarded-for, que a
    // Vercel preenche com o IP real do cliente num valor unico. Quem bate
    // direto no Render nao tem esse cabecalho e cai no x-forwarded-for, onde
    // trustedProxies resolve a cadeia.
    ipAddress: {
      ipAddressHeaders: lista(process.env.IP_ADDRESS_HEADERS) ?? ['x-forwarded-for'],
      trustedProxies: lista(process.env.TRUSTED_PROXIES) ?? [],
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
