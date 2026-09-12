import { Link } from "react-router-dom"
import { DocumentoLegal } from "@/components/documento-legal"

const CONTROLADOR_NOME = "[SEU NOME COMPLETO]"
const CONTROLADOR_CPF = "[SEU CPF]"
const FORO_COMARCA_UF = "[SUA COMARCA, UF]"

const VIGENCIA = "12 de setembro de 2026"

export default function TermosDeUso() {
  return (
    <DocumentoLegal titulo="Termos de Uso" vigencia={VIGENCIA}>
      <h2>1. Aceitação</h2>
      <p>
        Ao criar uma conta na Provisão, você concorda com estes termos e com a{" "}
        <Link to="/privacidade">Política de Privacidade</Link>. Se não concordar, não crie uma
        conta nem continue usando o serviço.
      </p>

      <h2>2. O que é a Provisão</h2>
      <p>
        A Provisão é uma ferramenta para você registrar, organizar e visualizar suas próprias
        finanças pessoais — transações, contas fixas, cartões, metas e investimentos que{" "}
        <strong>você mesmo cadastra</strong>. Nenhum lançamento é criado, alterado ou lido de uma
        conta bancária real: o app não se conecta ao seu banco, e todo número que aparece aqui
        veio de você.
      </p>

      <h2>3. Não somos consultoria financeira, banco ou corretora</h2>
      <p>
        Este é o ponto mais importante destes termos, e por isso vem em destaque em vez de
        escondido no meio do texto:
      </p>
      <p>
        A Provisão <strong>não é</strong> instituição financeira, corretora de valores, banco,
        consultoria de investimentos, nem qualquer entidade regulada pela CVM ou pelo Banco
        Central. O recurso de <strong>Insights com IA</strong> lê os números que você cadastrou e
        descreve padrões neles — nunca recomenda comprar, vender ou manter qualquer ativo
        financeiro, e não deve ser tratado como recomendação de investimento.
      </p>
      <p>
        Decisões financeiras e de investimento são inteiramente suas. Para orientação
        profissional, procure um consultor de investimentos certificado ou instituição
        devidamente autorizada.
      </p>

      <h2>4. Sua conta</h2>
      <ul>
        <li>Os dados de cadastro precisam ser verdadeiros — a conta é pessoal e intransferível.</li>
        <li>
          Você é responsável por manter sua senha em sigilo. Recomendamos fortemente ativar a
          autenticação de dois fatores, disponível gratuitamente nas Configurações.
        </li>
        <li>
          Avise imediatamente pelo suporte se suspeitar de acesso não autorizado à sua conta. A
          tela de Configurações → Sessões ativas permite encerrar remotamente qualquer sessão que
          não seja sua.
        </li>
      </ul>

      <h2>5. Uso aceitável</h2>
      <p>Você concorda em não:</p>
      <ul>
        <li>Tentar acessar dados de outra conta, ou burlar qualquer mecanismo de segurança.</li>
        <li>Automatizar o uso do serviço de forma que sobrecarregue a infraestrutura.</li>
        <li>Usar o serviço para qualquer atividade ilegal.</li>
        <li>Revender, redistribuir ou explorar comercialmente o acesso ao serviço sem autorização.</li>
      </ul>

      <h2>6. Plano gratuito, e o que muda se isso mudar</h2>
      <p>
        Hoje a Provisão é gratuita para uso pessoal. Se um plano pago vier a existir no futuro, os
        recursos que você já usa gratuitamente não serão retroativamente cobrados sem aviso — você
        será notificado com antecedência razoável antes de qualquer mudança valer para sua conta.
      </p>

      <h2>7. Disponibilidade</h2>
      <p>
        Fazemos o possível para manter o serviço disponível, mas não garantimos operação
        ininterrupta. Interrupções para manutenção, correção de falha ou atualização de segurança
        podem acontecer, e não geram direito a indenização.
      </p>

      <h2>8. Encerramento</h2>
      <p>
        Você pode encerrar sua conta quando quiser, pelo suporte. Podemos suspender ou encerrar
        contas que violem estes termos, com aviso sempre que a situação permitir.
      </p>

      <h2>9. Limitação de responsabilidade</h2>
      <p>
        A Provisão é fornecida "como está". Não nos responsabilizamos por decisão financeira
        tomada com base nos dados ou nas leituras de IA do app, nem por perda decorrente de uso
        indevido da sua própria conta (por exemplo, compartilhar sua senha com terceiro).
      </p>

      <h2>10. Alterações nestes termos</h2>
      <p>
        Podemos atualizar estes termos para refletir mudança no serviço ou na lei aplicável.
        Mudança relevante é avisada por e-mail antes de valer. A data no topo desta página sempre
        reflete a versão vigente.
      </p>

      <h2>11. Lei aplicável</h2>
      <p>
        Estes termos são regidos pela lei brasileira. Fica eleito o foro da comarca de{" "}
        {FORO_COMARCA_UF} para dirimir qualquer controvérsia, com renúncia a qualquer outro, por
        mais privilegiado que seja.
      </p>

      <h2>12. Contato</h2>
      <p>
        Serviço operado por {CONTROLADOR_NOME}, CPF {CONTROLADOR_CPF}. Para qualquer dúvida sobre
        estes termos, use o formulário de suporte dentro do app.
      </p>
    </DocumentoLegal>
  )
}
