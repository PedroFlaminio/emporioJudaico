# Business Intelligence — escopo independente

## 1. Objetivo

Construir uma camada de Business Intelligence para apoiar a tomada de decisão do Empório Judaico a partir dos dados gerados pelo sistema operacional. Esta frente será desenvolvida separadamente e não faz parte da entrega da aplicação web de gestão de pedidos.

O relatório parcial exige, no mínimo, indicadores de:

- faturamento;
- pedidos atrasados;
- produtos mais vendidos;
- tempo médio de produção.

## 2. Integração e segurança

- Conectar a ferramenta de BI ao PostgreSQL por meio de um usuário exclusivo com permissão somente de leitura.
- Consumir preferencialmente visões analíticas, sem acesso de escrita às tabelas operacionais.
- Não compartilhar as credenciais utilizadas pela API.
- Documentar ferramenta, fonte, periodicidade de atualização, filtros e regras de cálculo.
- Não expor documento, telefone, e-mail ou endereço de clientes em painéis que não precisem desses dados.

Ferramentas possíveis: Metabase, Power BI ou Looker Studio. A escolha cabe à equipe responsável por esta frente.

## 3. Fontes disponíveis

| Tema | Tabelas principais | Uso esperado |
| --- | --- | --- |
| Pedidos e faturamento | `orders`, `order_items` | quantidade de pedidos, valor total, descontos e vendas por período |
| Produtos e categorias | `products`, `categories`, `order_items` | produtos mais vendidos e faturamento por produto ou categoria |
| Etapas e atrasos | `orders`, `order_history` | etapa atual, pedidos atrasados e tempo em cada etapa |
| Produção | `production_jobs`, `orders`, `products` | duração real, previsão e gargalos de produção |
| Financeiro | `payments`, `collection_contacts` | recebido, a receber, vencido, inadimplência e cobrança |
| Clientes | `customers`, `orders` | recorrência, frequência e faturamento por cliente |
| Logística | `shipments`, `orders` | prazo de entrega, tempo de expedição, modalidade e tentativas frustradas |
| Ocorrências | `occurrences`, `orders` | pendências, retrabalho, tipos e tempo de resolução |

## 4. Painel mínimo exigido pelo relatório

### Faturamento

- Total de pedidos não cancelados por período, usando `orders.total`.
- Permitir filtros por data do pedido, cliente, produto e categoria.
- Exibir separadamente valor vendido, valor recebido e valor a receber para evitar tratar venda como recebimento.

### Pedidos atrasados

- Considerar atrasado o pedido cuja `promised_date` seja anterior à data de referência e cujo status não seja `entregue` nem `cancelado`.
- Exibir quantidade, valor, cliente, etapa atual e dias de atraso.

### Produtos mais vendidos

- Somar `order_items.quantity` por produto, excluindo pedidos cancelados.
- Exibir também receita por produto, sem confundir quantidade vendida com faturamento.
- Permitir agrupamento por categoria e período.

### Tempo médio de produção

- Calcular a diferença entre `production_jobs.started_at` e `production_jobs.completed_at` apenas para produções concluídas com ambas as datas preenchidas.
- Apresentar média geral e recortes por produto, categoria e período quando houver volume suficiente.

## 5. Painéis complementares

### Visão executiva

- número de pedidos e ticket médio;
- pedidos entregues no prazo e pedidos cancelados;
- valores recebidos e a receber;
- comparação com períodos anteriores.

### Operação

- pedidos por etapa e tempo médio em cada etapa;
- produção prevista para os próximos dias;
- gargalos por produto ou categoria;
- ocorrências e retrabalho.

### Financeiro

- inadimplência total e percentual;
- valores vencidos por faixa de atraso;
- prazo médio de recebimento;
- receita por forma de pagamento;
- descontos, estornos e clientes com maior valor em aberto.

### Comercial e clientes

- clientes recorrentes e frequência de compra;
- faturamento por cliente e categoria;
- novos clientes por período;
- sazonalidade das vendas.

### Logística

- entregas no prazo;
- tempo entre pedido pronto e expedição;
- tentativas de entrega frustradas;
- volume por modalidade e região;
- desempenho por transportadora ou entregador.

## 6. Regras de qualidade dos dados

- Definir claramente quais status entram em cada indicador.
- Tratar datas e horários com o fuso `America/Sao_Paulo` na apresentação.
- Excluir ou destacar registros incompletos em métricas de duração.
- Validar totais do painel contra consultas diretas ao banco.
- Informar a data e a hora da última atualização.
- Manter as regras de cálculo versionadas junto ao projeto do BI.

## 7. Entregáveis e critérios de aceite

- Painel com os quatro indicadores mínimos do relatório.
- Filtros por período e dimensões relevantes.
- Visões ou consultas SQL versionadas.
- Dicionário de métricas com fórmula, fonte, filtros e exceções.
- Instruções de configuração e atualização da fonte de dados.
- Evidência de acesso somente leitura ao PostgreSQL.
- Validação amostral dos resultados com dados do sistema operacional.

O BI será considerado integrado quando conseguir atualizar os painéis a partir da base operacional sem alterar dados da aplicação e quando os quatro indicadores mínimos estiverem validados.
