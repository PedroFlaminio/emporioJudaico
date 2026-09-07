 A proposta mais simples e eficaz é um sistema web centralizado, no qual cada pedido percorre um fluxo operacional padronizado. O frontend registra e gerencia as atividades do dia a dia em uma única base de dados.

  O escopo de Business Intelligence é uma frente independente e está documentado em [BI.md](BI.md).

  ## 1. Fluxo principal do pedido

  Pedido recebido
        ↓
  Pagamento pendente → Cobrança → Pagamento confirmado
        ↓
  Em produção
        ↓
  Preparação e conferência
        ↓
  Pronto para entrega
        ↓
  Expedição / retirada
        ↓
  Entregue e finalizado

  O sistema deve guardar o histórico das mudanças, incluindo responsável, data, observações e eventuais ocorrências.

  ## 2. Módulos do sistema

  ### Pedidos

  - Cadastro manual ou importação de pedidos.
  - Cliente, produtos, quantidades, valores e descontos.
  - Data do pedido e data prometida.
  - Tipo: entrega, retirada ou transportadora.
  - Prioridade e observações especiais.
  - Situação atual com identificação visual por cores.

  ### Produção

  - Fila dos pedidos a produzir.
  - Produtos e quantidades necessárias.
  - Data limite.
  - Responsável pela produção.
  - Início, conclusão e ocorrências.
  - Registro de falta de insumo ou necessidade de reposição.

  ### Preparação e conferência

  - Separação dos itens.
  - Checklist do pedido.
  - Registro de embalagem.
  - Conferência por responsável diferente, quando necessário.
  - Marcação de itens faltantes, substituídos ou avariados.

  ### Financeiro e cobrança

  - Valor total e forma de pagamento.
  - Situação: pendente, parcial, pago, vencido ou cancelado.
  - Datas de vencimento e pagamento.
  - Histórico de contatos de cobrança.
  - Anexo ou identificação do comprovante.
  - Registro de estorno ou diferença de valor.

  ### Expedição

  - Entrega, retirada ou envio.
  - Endereço e janela de entrega.
  - Transportadora ou entregador.
  - Código de rastreamento.
  - Data e hora da saída.
  - Confirmação da entrega.
  - Registro do motivo de tentativa frustrada.

  ### Clientes e produtos

  - Cadastro básico de clientes.
  - Histórico de compras.
  - Catálogo de produtos, categorias e preços.
  - Produtos ativos e inativos.
  - Tempo médio estimado de produção.

  ## 3. Telas do frontend

  A operação pode começar com seis telas principais:

  1. Painel operacional
     Pedidos agrupados por etapa, atrasos, cobranças pendentes e entregas do dia.

  2. Quadro de pedidos
     Modelo Kanban com colunas como “Recebido”, “Em produção”, “Preparação”, “Pronto” e “Expedição”.

  3. Detalhes do pedido
     Dados do cliente, itens, pagamento, entrega, histórico, documentos e observações.

  4. Produção e separação
     Lista de trabalho filtrada por data, prioridade e responsável.

  5. Financeiro
     Pagamentos pendentes, vencidos, parciais e confirmados.

  6. Cadastros
     Clientes, produtos, usuários, entregadores, formas de pagamento e motivos de ocorrência.

  Cada perfil deve enxergar apenas as funções necessárias: atendimento, produção, expedição, financeiro, gestor e administrador.

  ## 4. Estrutura de dados

  Uma modelagem inicial pode conter:

   Entidade          Dados principais
  ━━━━━━━━━━━━━━━━  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Cliente           Nome, documento, telefone, e-mail e endereço
  ────────────────  ──────────────────────────────────────────────────────
   Pedido            Número, cliente, datas, valor, prioridade e status
  ────────────────  ──────────────────────────────────────────────────────
   Item do pedido    Produto, quantidade, preço e observação
  ────────────────  ──────────────────────────────────────────────────────
   Produto           Nome, categoria, preço e tempo de produção
  ────────────────  ──────────────────────────────────────────────────────
   Pagamento         Valor, vencimento, forma, status e data de pagamento
  ────────────────  ──────────────────────────────────────────────────────
   Produção          Pedido, responsável, início, conclusão e status
  ────────────────  ──────────────────────────────────────────────────────
   Expedição         Modalidade, endereço, transportador, saída e entrega
  ────────────────  ──────────────────────────────────────────────────────
   Ocorrência        Tipo, descrição, responsável, data e solução
  ────────────────  ──────────────────────────────────────────────────────
   Histórico         Pedido, etapa anterior, nova etapa, usuário e data
  ────────────────  ──────────────────────────────────────────────────────
   Usuário           Nome, perfil, área e situação de acesso

  É importante não armazenar apenas o status atual. O histórico de transições preserva a rastreabilidade operacional e fornece os dados necessários para a frente independente de BI.

  ## 5. Arquitetura sugerida

  Frontend web responsivo
          │
          ▼
  API de negócio e autenticação
          │
          ▼
  Banco de dados PostgreSQL
          │
          ├── Rotinas operacionais
          └── Histórico e auditoria

  Uma combinação simples seria:

  - Frontend: React/Next.js.
  - Backend: Node.js com NestJS ou uma solução low-code.
  - Banco: PostgreSQL.
  - Autenticação por usuário e perfil.
  - Hospedagem em ambiente cloud com backup automatizado.

  ## 6. Alertas operacionais

  O sistema pode destacar automaticamente:

  - Pedido próximo da data prometida e ainda não produzido.
  - Pagamento vencido.
  - Pedido pronto aguardando expedição.
  - Falta de confirmação de entrega.
  - Pedido parado na mesma etapa por tempo excessivo.
  - Item faltante ou ocorrência ainda não solucionada.

  Os alertas podem aparecer no painel e, posteriormente, ser enviados por e-mail ou WhatsApp.

  ## 7. Implantação recomendada

  A primeira versão deve priorizar:

  - Cadastro e acompanhamento de pedidos.
  - Quadro de etapas.
  - Controle de pagamento.
  - Produção e expedição.
  - Histórico de alterações.
  - Painel operacional.

  Em uma segunda etapa, podem ser incluídas integrações com e-commerce, WhatsApp, emissão fiscal, gateways de pagamento, transportadoras, estoque e previsão de demanda.

  Essa estrutura entrega uma única fonte confiável de informação: a equipe atualiza o pedido durante a operação e a gestão acompanha os resultados sem depender de planilhas paralelas.

  ## 8. Plano de fechamento das ressalvas

  Os seguintes itens complementam o MVP operacional e devem ser concluídos antes de considerar o sistema integralmente aderente ao relatório:

  - [x] Capturar endereço completo do cliente e dados de entrega no frontend, incluindo janela, responsável, transportadora, rastreio e motivo de tentativa frustrada.
  - [x] Distinguir valor total do pagamento e valor efetivamente recebido, permitindo registrar pagamentos parciais, comprovante e observações.
  - [x] Restringir cada transição do pedido aos perfis responsáveis pela respectiva etapa e refletir essas permissões na interface.
  - [x] Ampliar os testes de integração para pagamentos parciais, expedição e autorização por perfil.
  - [x] Atualizar o relatório parcial com a descrição e os resultados da solução operacional implementada.
