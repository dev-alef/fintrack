import { DocumentoLegal } from "@/components/documento-legal"

// O unico dado pessoal que precisa aparecer aqui.
//
// A LGPD (art. 9º) exige identificar o controlador e dar um canal de contato -
// nao exige publicar CPF nem endereco residencial. Uma versao anterior deste
// arquivo pedia os dois; estava errado e foi corrigido. CPF publico junto do
// nome completo e material pronto para fraude de identidade, e nao compra
// conformidade nenhuma em troca.
//
// Se um dia existir CNPJ, troque por razao social + CNPJ: ai sim o numero e
// publico por natureza, e passa a ser o identificador correto.
const CONTROLADOR_NOME = "[SEU NOME COMPLETO]"

/**
 * Versao do documento. Precisa ser igual a VERSAO_PRIVACIDADE em
 * apps/api/src/aceites.ts, que e o que fica gravado no registro de aceite -
 * mudou o texto de forma relevante, muda os dois.
 */
const VIGENCIA = "12 de setembro de 2026"

export default function PoliticaDePrivacidade() {
  return (
    <DocumentoLegal titulo="Política de Privacidade" vigencia={VIGENCIA}>
      <h2>1. Quem trata os seus dados</h2>
      <p>
        A Provisão é operada por <strong>{CONTROLADOR_NOME}</strong>, pessoa física, na qualidade
        de controlador dos dados pessoais tratados nesta plataforma, nos termos da Lei nº
        13.709/2018 (LGPD).
      </p>
      <p>
        Para qualquer assunto sobre esta política ou sobre os seus dados, use o formulário de
        suporte dentro do app (Configurações → Suporte). É o mesmo canal usado para qualquer outro
        contato, e a mensagem chega identificada pela sua conta — sem precisar provar quem você é
        de novo.
      </p>

      <h2>2. Quais dados coletamos</h2>
      <p>Só o necessário para o serviço funcionar. Especificamente:</p>
      <ul>
        <li>
          <strong>Cadastro:</strong> nome e e-mail. Se você entrar com Google, recebemos também o
          nome e e-mail que sua conta Google autoriza a compartilhar.
        </li>
        <li>
          <strong>Senha:</strong> nunca é armazenada em texto — só um hash (bcrypt) que não permite
          recuperar a senha original, nem para nós.
        </li>
        <li>
          <strong>Dados financeiros que você cadastra:</strong> transações, contas fixas, cartões
          e faturas, metas, investimentos. São o motivo de o app existir — tratados só para
          exibir de volta para você, nunca vendidos ou usados para outro fim.
        </li>
        <li>
          <strong>Dados técnicos de segurança:</strong> endereço IP, tipo de navegador e sistema
          operacional (user-agent) de cada sessão. Usados exclusivamente para detectar acesso de
          dispositivo novo, limitar tentativas de login e investigar incidente de segurança —
          nunca para publicidade ou perfilamento comercial.
        </li>
      </ul>

      <h2>3. Para que usamos, e com que base legal</h2>
      <ul>
        <li>
          <strong>Prestar o serviço</strong> (autenticação, dashboard, transações, metas,
          investimentos) — execução de contrato (LGPD art. 7º, V).
        </li>
        <li>
          <strong>Segurança da conta</strong> (2FA, alerta de acesso novo, limite de tentativas de
          login, sessões que você pode encerrar remotamente) — legítimo interesse do titular em
          não ter a própria conta invadida (art. 7º, IX).
        </li>
        <li>
          <strong>Comunicação transacional</strong> (confirmação de e-mail, recuperação de senha,
          aviso de login novo, resposta de suporte) — execução de contrato. Nenhum desses e-mails é
          promocional, e não existe lista de e-mail marketing.
        </li>
        <li>
          <strong>Leitura de IA sobre suas finanças</strong> (Insights) — seus números do mês são
          enviados ao provedor de IA só quando você pede a análise, nunca automaticamente.
          Consentimento (art. 7º, I), renovado a cada vez que você aciona o recurso.
        </li>
      </ul>

      <h2>4. Com quem seus dados podem ser compartilhados</h2>
      <p>
        Não vendemos nem alugamos dado nenhum. Compartilhamos o mínimo necessário com prestadores
        de infraestrutura que operam a plataforma, todos processando em nome do controlador, nunca
        por conta própria:
      </p>
      <ul>
        <li>
          <strong>Neon</strong> — hospeda o banco de dados PostgreSQL onde os dados residem.
        </li>
        <li>
          <strong>Render</strong> — hospeda o backend da aplicação.
        </li>
        <li>
          <strong>Vercel</strong> — hospeda o frontend.
        </li>
        <li>
          <strong>Google</strong> — provedor de login opcional (OAuth) e do modelo de IA (Gemini)
          usado nos Insights, quando você aciona esse recurso.
        </li>
        <li>
          <strong>Resend</strong> — envio dos e-mails transacionais descritos acima.
        </li>
        <li>
          <strong>Sentry</strong> — monitoramento de erro técnico. Configurado para nunca receber
          cookie, cabeçalho de autorização ou corpo da requisição — um erro em produção não expõe
          sessão nem dado financeiro no painel de monitoramento.
        </li>
      </ul>
      <p>
        Alguns desses provedores processam dados fora do Brasil. Cada um mantém suas próprias
        certificações de segurança e conformidade internacional; se um dia isso mudar de forma
        relevante, esta política será atualizada antes da mudança valer.
      </p>

      <h2>5. Cookies</h2>
      <p>
        Usamos exatamente um cookie: o de sessão, que mantém você conectado. Ele é{" "}
        <strong>httpOnly</strong> (JavaScript não consegue lê-lo, o que barra um tipo comum de
        roubo de sessão) e expira sozinho em poucos dias de inatividade.
      </p>
      <p>
        Não usamos cookie de rastreamento, publicidade ou analytics de terceiro. Não existe pixel
        do Facebook, Google Analytics ou ferramenta parecida neste app.
      </p>

      <h2>6. Por quanto tempo guardamos</h2>
      <p>
        Enquanto sua conta estiver ativa. Se você excluir a conta, os dados são removidos em até 30
        dias — exceto o que a lei eventualmente exigir manter por mais tempo (por exemplo,
        obrigação fiscal, caso o serviço venha a ser pago).
      </p>

      <h2>7. Como protegemos seus dados</h2>
      <p>Não é uma promessa genérica — é o que está implementado e pode ser conferido no código-fonte, que é público:</p>
      <ul>
        <li>Sessão em cookie httpOnly, nunca em local storage acessível por script.</li>
        <li>Autenticação de dois fatores (TOTP) disponível para qualquer conta.</li>
        <li>Alerta por e-mail quando sua conta é acessada de um dispositivo novo.</li>
        <li>Tela de sessões ativas, com opção de encerrar qualquer uma remotamente.</li>
        <li>Limite de tentativas de login por conta, que não é contornável trocando de IP.</li>
        <li>
          Varredura automática de vulnerabilidade e de segredo exposto a cada mudança no código
          (CodeQL, gitleaks, auditoria de dependências).
        </li>
      </ul>

      <h2>8. Seus direitos</h2>
      <p>Como titular dos dados, você pode a qualquer momento pedir, pelo canal de suporte:</p>
      <ul>
        <li>Confirmação de que tratamos seus dados, e acesso a eles.</li>
        <li>Correção de dado incompleto, inexato ou desatualizado.</li>
        <li>Exportação dos seus dados financeiros num formato legível.</li>
        <li>Exclusão da sua conta e dos dados associados a ela.</li>
        <li>Revogação de consentimento (por exemplo, deixar de usar os Insights de IA).</li>
        <li>Informação sobre com quem compartilhamos seus dados — a lista da seção 4 é exaustiva.</li>
      </ul>
      <p>
        Hoje a exportação e a exclusão são feitas mediante pedido pelo suporte; a versão
        self-service, direto nas Configurações, está no roadmap do produto.
      </p>

      <h2>9. Menores de idade</h2>
      <p>
        Este serviço não é destinado a menores de 18 anos. Se você tem menos de 18 anos, não crie
        uma conta.
      </p>

      <h2>10. Mudanças nesta política</h2>
      <p>
        Se esta política mudar de forma relevante, você será avisado por e-mail antes da mudança
        valer. A data no topo desta página sempre reflete a versão vigente.
      </p>
    </DocumentoLegal>
  )
}
