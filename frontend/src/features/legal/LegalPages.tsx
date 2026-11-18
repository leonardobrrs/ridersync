import { Link } from 'react-router';

/** Versão vigente (deve coincidir com PRIVACY_POLICY_VERSION no backend). */
export const POLICY_VERSION = '2026-11-18';
export const PRIVACY_CONTACT = 'privacidade@ridersync.app';

function Doc({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="wrap page narrow legal">
      <article className="box prose">
        <h1 tabIndex={-1}>{title}</h1>
        <p className="muted">Versão de {new Date(`${POLICY_VERSION}T12:00:00Z`).toLocaleDateString('pt-BR')}.</p>
        {children}
      </article>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <Doc title="Política de Privacidade">
      <p>
        Esta política explica como o RiderSync trata dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
      </p>

      <h2>1. Controlador e encarregado</h2>
      <p>
        O RiderSync é o controlador dos dados tratados na plataforma. Dúvidas e solicitações sobre dados pessoais podem ser enviadas ao encarregado pelo
        e-mail <strong>{PRIVACY_CONTACT}</strong>.
      </p>

      <h2>2. Dados que tratamos, finalidades e bases legais</h2>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Dados</th>
              <th>Finalidade</th>
              <th>Base legal (LGPD)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Nome, e-mail, senha (somente o hash) e tipo de conta</td>
              <td>Criar e proteger a conta, autenticar e confirmar que o e-mail pertence a você</td>
              <td>Execução de contrato (art. 7º, V)</td>
            </tr>
            <tr>
              <td>Identificador do Google (quando você usa “Entrar com Google”)</td>
              <td>Login sem senha</td>
              <td>Execução de contrato (art. 7º, V)</td>
            </tr>
            <tr>
              <td>Perfil profissional: nome artístico, foto, biografia, cidade, estilos, portfólio, rider técnico, contatos públicos</td>
              <td>Divulgação do seu trabalho no marketplace, quando você publica o perfil</td>
              <td>Execução de contrato (art. 7º, V) — você escolhe o que tornar público</td>
            </tr>
            <tr>
              <td>Dados de casas de show e eventos</td>
              <td>Publicar oportunidades, receber candidaturas e contratar</td>
              <td>Execução de contrato (art. 7º, V)</td>
            </tr>
            <tr>
              <td>Candidaturas, propostas, mensagens e histórico de negociações</td>
              <td>Registrar as tratativas entre as partes</td>
              <td>Execução de contrato (art. 7º, V) e exercício regular de direitos (art. 7º, VI)</td>
            </tr>
            <tr>
              <td>Sessões (data de acesso e navegador) e tentativas de acesso</td>
              <td>Segurança da conta e prevenção de fraudes</td>
              <td>Legítimo interesse (art. 7º, IX)</td>
            </tr>
            <tr>
              <td>Notificações e e-mails</td>
              <td>Avisar sobre convites, candidaturas, propostas e eventos; avisos de segurança</td>
              <td>Execução de contrato (art. 7º, V); você pode desativar os e-mails não obrigatórios</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>Não vendemos dados, não usamos publicidade comportamental e não tratamos dados sensíveis.</p>

      <h2>3. Compartilhamento</h2>
      <p>Os dados são processados por operadores contratados exclusivamente para operar a plataforma:</p>
      <ul>
        <li>Hospedagem da aplicação e armazenamento de arquivos (Vercel);</li>
        <li>Banco de dados (Neon — PostgreSQL);</li>
        <li>Envio de e-mails transacionais (Resend), quando habilitado;</li>
        <li>Google, apenas se você escolher entrar com o Google.</li>
      </ul>
      <p>
        Informações do seu perfil público e de eventos públicos ficam visíveis a qualquer visitante. Dados de negociação ficam visíveis apenas para as
        partes envolvidas. O e-mail da conta nunca é exibido publicamente.
      </p>

      <h2>4. Cookies</h2>
      <p>
        Usamos apenas cookies estritamente necessários: o cookie de sessão (HttpOnly, seguro) e, durante o login com Google, um cookie temporário de
        segurança. Não usamos cookies de rastreamento ou de publicidade.
      </p>

      <h2>5. Retenção</h2>
      <ul>
        <li>Sessões expiram 7 dias após o login (ou ao sair) e são apagadas automaticamente;</li>
        <li>Links de confirmação de e-mail valem 24 horas e de redefinição de senha 1 hora; são apagados 7 dias após o vencimento;</li>
        <li>Notificações lidas são apagadas após 180 dias; as não lidas, após 1 ano;</li>
        <li>Registros de e-mails enviados são apagados após 30 dias (falhas, após 90 dias);</li>
        <li>Dados da conta e perfis permanecem enquanto a conta existir.</li>
      </ul>

      <h2>6. Seus direitos</h2>
      <p>Você pode, a qualquer momento e sem custo:</p>
      <ul>
        <li>
          <strong>Confirmar e acessar</strong> seus dados e <strong>levá-los</strong> a outro serviço: baixe uma cópia em “Conta e privacidade”;
        </li>
        <li>
          <strong>Corrigir</strong> dados: edite nome, perfil, banda e casa diretamente no painel;
        </li>
        <li>
          <strong>Excluir</strong> a conta em “Conta e privacidade”. Perfis sem histórico com terceiros são apagados. Quando houver negociações com
          outras pessoas, o registro é mantido para elas, mas os seus dados pessoais são removidos (anonimização), conforme art. 16 da LGPD;
        </li>
        <li>
          <strong>Revogar</strong> o consentimento de e-mails de notificação nas preferências ou pelo link presente em cada e-mail;
        </li>
        <li>Pedir informações sobre compartilhamento, opor-se a tratamentos e reclamar à ANPD.</li>
      </ul>
      <p>Para pedidos que não estejam disponíveis no painel, escreva para {PRIVACY_CONTACT}. Respondemos em até 15 dias.</p>

      <h2>7. Segurança</h2>
      <p>
        Senhas são armazenadas com Argon2id; a comunicação usa HTTPS; o acesso a dados privados é verificado no servidor a cada requisição; imagens
        enviadas têm metadados (como localização) removidos; tentativas abusivas de acesso bloqueiam a conta temporariamente.
      </p>

      <h2>8. Crianças e adolescentes</h2>
      <p>A plataforma é destinada a maiores de 18 anos ou a menores devidamente representados por seus responsáveis legais.</p>

      <h2>9. Alterações</h2>
      <p>Quando esta política mudar, pediremos um novo aceite no próximo acesso.</p>

      <p>
        Veja também os <Link to="/termos">Termos de Uso</Link>.
      </p>
    </Doc>
  );
}

export function TermsPage() {
  return (
    <Doc title="Termos de Uso">
      <h2>1. O serviço</h2>
      <p>
        O RiderSync conecta artistas (músicos e bandas) e contratantes (casas de show e pessoas que contratam música) em Alagoas: perfis profissionais,
        riders técnicos, oportunidades, candidaturas e negociações.
      </p>
      <h2>2. Contas</h2>
      <ul>
        <li>Cada pessoa escolhe, no cadastro, uma conta de artista ou de contratante. O tipo de conta é definitivo.</li>
        <li>Você é responsável pela veracidade das informações e pela guarda da sua senha.</li>
        <li>Perfis, bandas e casas devem representar pessoas e estabelecimentos reais, com autorização de quem aparece.</li>
      </ul>
      <h2>3. Negociações e pagamentos</h2>
      <p>
        A plataforma registra propostas e confirmações, mas <strong>não intermedeia pagamentos</strong> nem garante a realização das apresentações.
        Valores, horários e condições são combinados entre as partes.
      </p>
      <h2>4. Conteúdo</h2>
      <p>
        Você mantém os direitos sobre o conteúdo que publica e autoriza sua exibição na plataforma. É proibido publicar conteúdo ilegal, ofensivo,
        enganoso ou que viole direitos de terceiros.
      </p>
      <h2>5. Suspensão</h2>
      <p>Contas que violem estes termos podem ser suspensas.</p>
      <h2>6. Dados pessoais</h2>
      <p>
        O tratamento de dados segue a <Link to="/privacidade">Política de Privacidade</Link>.
      </p>
    </Doc>
  );
}

export function HelpPage() {
  return (
    <div className="wrap page narrow legal">
      <article className="box prose">
        <h1 tabIndex={-1}>Documentação e ajuda</h1>
        <p>Guia rápido de como usar o RiderSync.</p>

        <h2>Para artistas</h2>
        <ol>
          <li>Crie uma conta de artista e confirme o e-mail.</li>
          <li>Em “Meu perfil”, preencha os dados, a foto, o portfólio e o rider técnico (somente equipamentos que você precisa — palco e energia são do local).</li>
          <li>Publique o perfil para aparecer no marketplace e poder se candidatar.</li>
          <li>Crie ou entre em bandas pelos convites. Cada banda tem perfil, portfólio e rider próprios.</li>
          <li>Em “Oportunidades”, candidate-se a eventos. Eventos privados aparecem só para contas de artista.</li>
          <li>Responda propostas em “Negociações”: aceite, recuse ou envie contraproposta. Compare seu rider com o inventário da casa durante a negociação.</li>
        </ol>

        <h2>Para contratantes</h2>
        <ol>
          <li>Crie uma conta de contratante.</li>
          <li>Casas de show: cadastre a casa, a foto e o inventário de equipamentos.</li>
          <li>Pessoas físicas (ex.: aniversário): crie um evento particular sem casa de show em “Eventos particulares”.</li>
          <li>Publique o evento como público (aparece para todos) ou privado (somente artistas veem; não aparece na página inicial).</li>
          <li>Analise candidaturas, inicie a negociação e confirme a contratação. Quando todas as vagas forem ocupadas, o evento muda para “Vagas preenchidas” automaticamente.</li>
        </ol>

        <h2>Estados de um evento</h2>
        <ul>
          <li><strong>Rascunho</strong> — visível só para você.</li>
          <li><strong>Inscrições abertas</strong> — recebe candidaturas até o prazo.</li>
          <li><strong>Vagas preenchidas</strong> — automático quando todas as vagas são ocupadas; volta a abrir se uma vaga for cancelada.</li>
          <li><strong>Inscrições encerradas</strong> — automático no fim do prazo, ou manual.</li>
          <li><strong>Adiado</strong> — aguardando nova data; ao remarcar, volta ao estado coerente.</li>
          <li><strong>Realizado</strong> ou <strong>Cancelado</strong> — estados finais.</li>
        </ul>

        <h2>Notificações</h2>
        <p>O sino no topo mostra todas as notificações. Em “Preferências” você escolhe quais chegam por e-mail ou desativa todas com um clique.</p>

        <h2>Privacidade</h2>
        <p>
          Leia a <Link to="/privacidade">Política de Privacidade</Link> e os <Link to="/termos">Termos de Uso</Link>. Em “Conta e privacidade” você
          baixa seus dados ou exclui a conta.
        </p>
      </article>
    </div>
  );
}
