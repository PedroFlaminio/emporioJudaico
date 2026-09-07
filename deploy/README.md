# Publicação em pedroflaminio

- Frontend: https://pedro.flaminio.com.br/emporioJudaico/
- API: https://pedro.flaminio.com.br/emporioJudaico/api
- Aplicação no servidor: `/docker/emporioJudaico/app`
- Frontend ativo: `/docker/emporioJudaico/current/emporioJudaico`
- Nginx: `/docker/nginx/emporioJudaico.conf`, incluído por `/docker/nginx/apps.conf`

O Nginx existente termina o HTTPS e serve o frontend. A API usa a porta
`127.0.0.1:3020`; o PostgreSQL fica somente na rede do Compose e persiste no
volume `emporio-judaico_postgres_data`. Os dois serviços reiniciam automaticamente.
O build é feito localmente para reduzir o uso de memória do servidor.

Esta instalação é uma demonstração com dados fictícios. O login mantém
`admin@emporio.local` e `admin123` preenchidos e visíveis.

## Build e transferência

Na raiz do projeto:

```bash
bun install --frozen-lockfile
VITE_BASE_PATH=/emporioJudaico/ VITE_API_URL=/emporioJudaico/api bun run build
bun run typecheck
tar --exclude=node_modules --exclude=.env --exclude=.env.local --exclude='*.tsbuildinfo' \
  -czf - package.json bun.lock .dockerignore docker-compose.production.yml deploy \
  apps/api apps/web/package.json apps/web/dist |
  ssh -F /home/pedro/.ssh/config pedroflaminio \
  'mkdir -p /docker/emporioJudaico/app && tar -xzf - -C /docker/emporioJudaico/app'
```

## Ativação no servidor

```bash
cd /docker/emporioJudaico/app
python3 deploy/prepare-server.py
docker compose --env-file .env.production -f docker-compose.production.yml build api
docker compose --env-file .env.production -f docker-compose.production.yml up -d --wait postgres
docker compose --env-file .env.production -f docker-compose.production.yml run --rm -T api bun run db:migrate
docker compose --env-file .env.production -f docker-compose.production.yml run --rm -T -e RESET_DEMO_PASSWORDS=true api bun run db:seed
docker compose --env-file .env.production -f docker-compose.production.yml up -d --wait api
python3 deploy/publish-web.py
```

O preparo gera a senha do banco uma única vez, com permissão `0600`. O seed cria
equipe, catálogo, clientes e pedidos de demonstração. `RESET_DEMO_PASSWORDS=true`
restaura a senha `admin123` nas contas de demonstração já existentes. Os registros
operacionais existentes são preservados pelo seed. A credencial aleatória do
bootstrap inicial foi substituída pelo acesso de demonstração.

O publicador mantém versões anteriores do frontend em `releases/` e faz backup
dos arquivos Nginx em `backups/` antes de alterar a configuração. Se a validação ou
o reload falhar, restaura a configuração anterior e o link do frontend.

## Verificação e operação

Na máquina local, para verificar HTTPS, assets, rotas SPA, autenticação, consultas
e encerramento da sessão sem inserir pedidos:

```bash
bun deploy/smoke.ts
```

No servidor:

```bash
cd /docker/emporioJudaico/app
docker compose --env-file .env.production -f docker-compose.production.yml ps
docker compose --env-file .env.production -f docker-compose.production.yml logs --tail=100 api
```

Antes de futuras migrações, salve um backup do banco:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml exec -T postgres \
  pg_dump -U emporio -d emporio -Fc > /caminho/privado/emporio.dump
```

Reverter somente o frontend consiste em apontar `current` para uma versão anterior
de `releases/`. Rollback de API e banco exige o artefato e o backup compatíveis com
a migração aplicada; o publicador web não reverte migrações.
