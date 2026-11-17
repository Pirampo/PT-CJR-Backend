# Demonstração opcional: Sabor da Vila

O seed recria a demonstração sem depender dos IDs ou de dados pessoais do banco de outro integrante. Não roda na inicialização do backend, não cria schema, não executa migrações e não apaga registros.

## Preparação

Use PostgreSQL local com o schema atual do projeto **já preparado** e um banco dedicado à demonstração, diferente do banco definido em `DATABASE_URL`. Combine com a equipe a preparação desse schema; o seed não aplica migrações automaticamente.

Depois de instalar as dependências e gerar o Prisma Client conforme o setup do projeto:

```sh
npm exec -- prisma generate --config prisma7.config.ts
```

Configure as variáveis apenas na sessão do terminal. Não altere ou envie `.env` reais ao Git. Exemplo para **zsh**, com leitura silenciosa para não registrar senhas no histórico:

```zsh
# Informe a URL do banco dedicado, por exemplo:
# postgresql://USUARIO:SENHA@localhost:5432/stockio_demo?schema=public
read -rs 'DEMO_DATABASE_URL?URL PostgreSQL local do banco de demonstração: '
export DEMO_DATABASE_URL

read -rs 'DEMO_ADMIN_PASSWORD?Senha do administrador fictício: '
export DEMO_ADMIN_PASSWORD

export DEMO_DATABASE_CONFIRM=stockio_demo
export BACKEND_PUBLIC_URL=http://localhost:3001
NODE_ENV=development npm run seed:demo
```

Troque `stockio_demo` pelo nome exato do banco informado na URL. A senha deve ter ao menos oito caracteres e até 72 bytes UTF-8, respeitando o limite do bcrypt. `npm run seed:demo` compila o backend e executa o script; não instala dependências nem gera migrações.

O comando recusa produção, hosts externos, bancos de sistema, parâmetros de conexão alternativos e destinos não confirmados. Também recusa o mesmo banco de `DATABASE_URL`, mesmo usando outro usuário, senha ou alias local. Para visualizar a demonstração sem editar seu `.env`, inicie o backend apontando explicitamente para a base de demonstração:

```zsh
DATABASE_URL="$DEMO_DATABASE_URL" npm run start:dev
```

O frontend continua usando seu `BACKEND_URL` local, normalmente `http://localhost:3001`. Execute apenas a instância de backend desejada nessa porta. As imagens usam a origem de `BACKEND_PUBLIC_URL`; configure-a antes da primeira execução para coincidir com o servidor que publicará `/uploads`.

## Dados criados e acesso

- Administrador: **Administrador Sabor da Vila**.
- Username: `admin_sabor_vila`.
- E-mail de login: `admin.sabor.vila@example.com`.
- Senha: o valor local de `DEMO_ADMIN_PASSWORD`, nunca exibido pelo seed.
- Loja Sabor da Vila e categoria Alimentos, criada somente se não houver uma categoria raiz com esse nome. Uma categoria existente pode ser consultada e reutilizada, mas não é alterada.
- Oito produtos com os nomes, descrições, preços e estoques preservados no manifesto versionado, uma imagem própria por produto e cinco avaliações marcadas como demonstração, média **4,60**.
- Cinco avaliadores fictícios, distintos do administrador. Suas senhas são geradas aleatoriamente, transformadas em hash pelo mesmo `UserService` da aplicação e descartadas; não são contas de acesso compartilhado.

Todos os IDs vêm do PostgreSQL. O resultado do comando informa o ID real da loja e o caminho `/loja/ID`; use esse caminho no frontend. As rotas `/loja/ID/avaliacoes` e `/perfil/ID` também usam os IDs retornados, sem depender de 6 ou 12.

## Imagens e versionamento

O manifesto fica em `prisma/demo/manifesto.json`. As oito fotos e suas atribuições ficam em `prisma/demo/imagens/ORIGENS.md`. Esses arquivos devem entrar no Git. A execução é offline: não depende de downloads, do frontend nem de arquivos de outro computador.

O seed usa o processamento existente com Sharp para criar WebPs em `uploads/produtos/ID/`. Esses arquivos de execução continuam ignorados pelo Git. As URLs são registradas no relacionamento `Imagens_Produtos` e usadas pelas páginas existentes. Não há caminhos absolutos no manifesto.

## Reexecução e conflitos

Uma marca e um pequeno registro de origem são salvos em `Lojas.descricao`, usando o campo existente. Esse registro contém apenas versão, assinatura dos dados/imagens e IDs públicos gerados; não contém senhas, hashes de senha ou caminhos internos.

Na segunda execução, o seed confere a origem, os relacionamentos, os seis usuários, os produtos, imagens, avaliações e a senha informada. Não faz `upsert` nem redefine campos. Mantém os IDs e os registros intactos. Se um arquivo do próprio seed estiver ausente, pode restaurá-lo a partir das fotos versionadas, sem regravar registros.

Se já existir uma loja Sabor da Vila criada manualmente, um username/e-mail reservado sem origem comprovada, dados editados ou imagens alteradas, o seed interrompe com uma mensagem de conflito. Não sobrescreve, exclui ou adota esses dados. Uma loja cadastrada manualmente também é preservada, independentemente de seu ID. Use uma base dedicada limpa para reproduzir a demonstração.

As inserções são transacionais. Se houver uma falha durante a criação, o banco faz rollback dos novos registros e o script remove somente arquivos criados por aquela tentativa. Execuções simultâneas são serializadas por um lock transacional; um conflito de serialização exige repetir o comando. IDs podem apresentar intervalos por causa das sequences do PostgreSQL.

Mudar o manifesto, a versão do processador de imagens, a URL pública ou os dados de demonstração após a criação pode produzir um conflito deliberado. O seed não é uma ferramenta de atualização ou restauração de registros editados.

## Testes

Proteções sem banco:

```sh
npm run build
npm test -- scripts/seed-demo.spec.ts
```

Integração real opcional, somente com banco isolado **com schema e sem dados**, separado de `DATABASE_URL`:

```sh
DEMO_TEST_DATABASE_URL="$DEMO_DATABASE_URL" npm run test:e2e -- test/seed-demo.e2e-spec.ts
```

Sem essa variável, a suíte real do seed é explicitamente ignorada. O teste não cria, esvazia ou remove bancos nem executa migrações. Cria apenas fixtures na base isolada, testa login real, relações, imagens, média, segunda execução, conflitos, recuperação de arquivo e rollback. As fixtures ficam nesse banco de testes; não execute essa suíte em uma base com dados seus.

## O que permanece local

Não versionar `.env`, `.temp`, credenciais da demonstração antiga, uploads gerados, `dist`, `node_modules`, dumps/schema de teste ou diretórios do PostgreSQL isolado. O seed novo não cria arquivos de senha em texto puro.
