# Empório Judaico · Gestão operacional

MVP web para acompanhar pedidos desde o atendimento até a entrega. A aplicação reúne operação, produção, conferência, financeiro, expedição e cadastros em uma única base com histórico auditável.

O BI pertence a uma frente independente, descrita em [BI.md](BI.md). A modelagem operacional já preserva o histórico de mudanças necessário para os indicadores futuros.

## Tecnologias

- Runtime e gerenciador: Bun
- API: Elysia
- Banco e ORM: PostgreSQL + Drizzle
- Frontend: React + Vite + TypeScript
- Autenticação: sessões opacas, senhas com hash nativo do Bun e permissões por perfil

## Executar localmente

Requisitos: Bun 1.3+ e Docker com Compose.

```bash
bun install
docker compose up -d postgres
bun run db:migrate
bun run db:seed
bun run dev
```

Abra a URL exibida pelo Vite no terminal (normalmente `http://localhost:5173`). Se essa porta já estiver ocupada, o Vite selecionará automaticamente a próxima. A API estará em `http://localhost:3000/api`.

Credenciais de demonstração:

```text
E-mail: admin@emporio.local
Senha: admin123
```

O seed também cria usuários de atendimento, produção, financeiro e expedição. Todos usam a senha `admin123` e seus e-mails aparecem em [seed.ts](apps/api/src/db/seed.ts).

## Comandos

```bash
bun run dev             # API e frontend em modo de desenvolvimento
bun run dev:api         # somente a API
bun run dev:web         # somente o frontend
bun run typecheck       # valida TypeScript em todos os workspaces
bun run build           # gera os builds de produção
bun run test            # testes de integração da API (requer PostgreSQL iniciado e seed)
bun run db:generate     # gera migração após mudar o schema
bun run db:migrate      # aplica migrações
bun run db:seed         # carrega equipe, catálogo e pedidos de demonstração
```

## Funcionalidades entregues

- Painel operacional com pedidos por etapa, prazos, ocorrências e valores vencidos.
- Quadro Kanban com busca, prioridades e movimentação entre etapas.
- Cadastro de pedidos com itens, desconto, pagamento, prazo e modalidade de entrega.
- Detalhes do pedido com checklist, ocorrências, produção, expedição e linha do tempo.
- Fila de produção com início, pausa, conclusão, responsável e data limite.
- Preparação e conferência item a item, incluindo falta, substituição e avaria.
- Financeiro com valor total, valor recebido, saldo, pagamentos parciais, comprovante e histórico de cobrança.
- Expedição com endereço, janela de entrega, responsável, transportadora, rastreio, saída, tentativa frustrada e confirmação de entrega.
- Cadastros de clientes, produtos, categorias e usuários.
- Perfis de atendimento, produção, expedição, financeiro, gestor e administrador, com transições autorizadas por etapa.
- Histórico imutável das transições de cada pedido.

## Estrutura

```text
apps/
  api/                  API Elysia, schema Drizzle, migrações e seed
  web/                  aplicação React responsiva
docker-compose.yml      PostgreSQL local
PLANO.MD                escopo funcional original
BI.md                   escopo separado de Business Intelligence
```

O schema principal está em [schema.ts](apps/api/src/db/schema.ts), as rotas em [routes.ts](apps/api/src/routes.ts) e a aplicação React começa em [App.tsx](apps/web/src/App.tsx).

## Configuração

A publicação em `pedro.flaminio.com.br/emporioJudaico/` está documentada em
[deploy/README.md](deploy/README.md), incluindo atualização, acesso inicial e verificação.

Os valores padrão funcionam com o Docker Compose incluído. Para alterar portas, origem web ou conexão, defina:

```env
DATABASE_URL=postgres://emporio:emporio@localhost:5432/emporio
API_PORT=3000
WEB_ORIGIN=http://localhost:5173
VITE_API_URL=http://localhost:3000/api
```

Em produção, use uma senha forte para o banco, HTTPS e variáveis de ambiente secretas. A senha e os usuários do seed são apenas para desenvolvimento.

No desenvolvimento, a API aceita origens locais em qualquer porta para acompanhar o fallback automático do Vite. Em produção, somente as origens declaradas em `WEB_ORIGIN` são aceitas; use vírgulas para informar mais de uma.

## Frente independente: BI

Os requisitos, indicadores, fontes de dados e critérios de entrega dessa frente estão em [BI.md](BI.md). Ela deve consumir visões específicas do PostgreSQL usando um usuário somente leitura, sem interferir nas rotinas da aplicação operacional.
