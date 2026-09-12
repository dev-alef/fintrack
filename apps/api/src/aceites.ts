/**
 * Registro auditável de aceite dos documentos legais.
 *
 * # O que isto responde
 *
 * A tela de cadastro diz "ao criar sua conta, você concorda com os Termos de
 * Uso e a Política de Privacidade". Sem registro, isso é só uma frase na tela:
 * numa disputa ou numa fiscalização da ANPD, a pergunta é "quando essa pessoa
 * aceitou, e qual texto estava no ar naquele dia" - e a resposta seria um
 * encolher de ombros.
 *
 * Guardar a VERSÃO é o ponto todo. Sem ela dá para dizer que a pessoa aceitou
 * algo, mas não o quê - e documento legal muda com o tempo.
 *
 * # Por que no gancho de criação de usuário
 *
 * `databaseHooks.user.create.after` dispara tanto no cadastro por e-mail
 * quanto na primeira entrada pelo Google. Amarrar ao endpoint de sign-up
 * cobriria só metade: quem entra pelo Google nunca passa por lá, e ficaria
 * com conta criada e nenhum aceite registrado.
 *
 * # Falha não derruba o cadastro
 *
 * Se o INSERT falhar, o erro é registrado e o cadastro segue. A alternativa -
 * abortar - significaria recusar uma conta legítima por causa da tabela de
 * auditoria, trocando um problema de papelada por um de produto. O registro
 * ausente aparece no log e pode ser reconstruído; a conta perdida, não.
 */
import { query } from './db/client'

/**
 * Versões em vigor, no formato AAAA-MM-DD.
 *
 * Precisam ser iguais às constantes VIGENCIA de
 * `apps/web/src/pages/TermosDeUso.tsx` e
 * `apps/web/src/pages/PoliticaDePrivacidade.tsx`. Duplicação consciente: sem
 * o pacote de contratos compartilhado (dívida já registrada no roadmap), não
 * há onde os dois lados lerem o mesmo valor. Mudou o texto de forma relevante,
 * mude os dois lugares.
 */
export const VERSAO_TERMOS = '2026-09-12'
export const VERSAO_PRIVACIDADE = '2026-09-12'

const DOCUMENTOS = [
  { documento: 'termos', versao: VERSAO_TERMOS },
  { documento: 'privacidade', versao: VERSAO_PRIVACIDADE },
] as const

/** Cabeçalho onde o middleware de IP publica o endereço já resolvido. */
const CABECALHO_IP = 'x-provisao-client-ip'

function leCabecalho(cabecalhos: unknown, nome: string): string | null {
  if (!cabecalhos || typeof cabecalhos !== 'object') return null

  // Headers (web) tem .get(); um objeto simples do Node, nao.
  const comGet = cabecalhos as { get?: (k: string) => string | null }
  if (typeof comGet.get === 'function') return comGet.get(nome)

  const bruto = (cabecalhos as Record<string, unknown>)[nome]
  if (typeof bruto === 'string') return bruto
  if (Array.isArray(bruto) && typeof bruto[0] === 'string') return bruto[0]
  return null
}

/**
 * Grava o aceite dos documentos em vigor para um usuário recém-criado.
 * Nunca lança: o chamador é um gancho no caminho do cadastro.
 */
export async function registraAceite(
  userId: string,
  cabecalhos?: unknown,
): Promise<void> {
  try {
    const ip = leCabecalho(cabecalhos, CABECALHO_IP)
    const userAgent = leCabecalho(cabecalhos, 'user-agent')

    // Uma instrução só para todos os documentos: ou entram todos, ou nenhum.
    // Meio aceite registrado seria pior que nenhum - daria a impressão de
    // cobertura que não existe.
    //
    // As linhas são montadas a partir de DOCUMENTOS em vez de escritas à mão:
    // cada documento carrega a PRÓPRIA versão, e um documento novo na lista
    // passa a ser registrado sem ninguém precisar mexer no SQL.
    const valores: unknown[] = [userId, ip, userAgent]
    const linhas = DOCUMENTOS.map((doc) => {
      valores.push(doc.documento, doc.versao)
      return `($1, $${valores.length - 1}, $${valores.length}, $2, $3)`
    })

    await query(
      `INSERT INTO aceites (user_id, documento, versao, ip, user_agent)
       VALUES ${linhas.join(', ')}`,
      valores,
    )
  } catch (erro) {
    console.error('[aceites] nao foi possivel registrar o aceite', erro)
  }
}

export type Aceite = {
  documento: string
  versao: string
  aceito_em: Date
}

/**
 * Aceites de uma conta, do mais recente para o mais antigo. É o que responde a
 * um pedido de titular ("o que eu aceitei, e quando").
 */
export async function aceitesDe(userId: string): Promise<Aceite[]> {
  const resultado = await query(
    `SELECT documento, versao, aceito_em
       FROM aceites
      WHERE user_id = $1
      ORDER BY aceito_em DESC, documento ASC`,
    [userId],
  )
  return resultado.rows as Aceite[]
}
