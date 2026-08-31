import { createAuthClient } from 'better-auth/react'
import { twoFactorClient } from 'better-auth/client/plugins'

// O cliente fala com o handler do Better Auth montado em /api/auth na API.
// A sessao viaja em cookie httpOnly, entao nao ha token para guardar nem para
// anexar em header - o navegador cuida disso sozinho, desde que as
// requisicoes sejam feitas com credenciais.
// Por que existe o proxy em vercel.json (que e JSON e nao aceita comentario):
//
// A API roda no Render, em outro site. Enquanto o navegador falava direto com
// ela, todo cookie era de terceira-parte - gravado na particao de vercel.app e
// invisivel quando o Google devolvia a pessoa em navegacao de primeiro nivel
// para onrender.com. O cookie de state do OAuth sumia nessa fronteira e o login
// com Google falhava com state_security_mismatch, so em producao: local os dois
// sao localhost, mesmo site, e o problema nao existe.
//
// Encaminhando /api pela Vercel, o navegador ve um site so e os cookies passam
// a ser de primeira-parte. Isso conserta o Google e tira o resto da aplicacao
// da dependencia de cookies de terceiros, que o Safari bloqueia por padrao.
//
// A ordem das regras la importa: a primeira que casar vence, e a rota de auth
// precisa vir antes porque a regra seguinte remove o prefixo /api - o handler
// do Better Auth espera justamente /api/auth no destino.
//
// Esta base e a ORIGEM, nao o prefixo: o cliente acrescenta /api/auth sozinho.
// Por isso ela nao pode ser a mesma variavel do axios, que em producao vale
// '/api' - dali sairia /api/api/auth.
//
// Em producao fica vazia de proposito, e a origem atual e usada: a Vercel
// encaminha /api para o Render (ver vercel.json), entao o navegador ve um site
// so e os cookies de sessao e de state do OAuth sao de primeira-parte. Em
// desenvolvimento aponta direto para a API local, que ja e mesmo site que o
// front por serem ambos localhost.
const authBaseURL = import.meta.env.VITE_AUTH_URL ?? window.location.origin

export const authClient = createAuthClient({
  baseURL: authBaseURL,
  fetchOptions: {
    credentials: 'include',
  },
  plugins: [
    twoFactorClient({
      // Quando a senha esta certa mas falta o segundo fator, o servidor responde
      // com twoFactorRedirect em vez de criar a sessao. Sem tratar isso, o
      // login "daria certo" e a pessoa cairia num painel sem sessao.
      onTwoFactorRedirect() {
        window.location.href = '/dois-fatores'
      },
    }),
  ],
})

export const { signIn, signUp, signOut, useSession, twoFactor } = authClient
