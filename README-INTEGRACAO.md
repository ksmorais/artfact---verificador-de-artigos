# ArtFact — frontend integrado ao backend

Frontend React/Vite exportado do Figma, conectado à branch `refactor/pubmed-only-mvp` do repositório `joaocarvv/r.ia-FakeNews`.
Contrato conferido no commit `95ca3f2443a353ff5a49066b72175c236b530e82` em 13/10/2026. O endereço SSH fornecido identifica o repositório, não uma branch; foi usada a branch mencionada anteriormente. Se o backend estiver em outra branch, confira o contrato antes de trocar.

## Rodar no Windows (PowerShell)

Pré-requisitos: Git, Python 3.11 e Node.js 24 LTS instalados. Abra um terminal novo depois da instalação. `python --version`, `node --version` e `npm --version` devem funcionar.

1. Baixe o backend (se já o tem, use a cópia existente na branch correta):

```powershell
git clone --branch refactor/pubmed-only-mvp --single-branch https://github.com/joaocarvv/r.ia-FakeNews.git
cd r.ia-FakeNews
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Não copie o exemplo por cima de um `.env` já configurado. Edite o `.env` do backend e preencha `GEMINI_API_KEY` com sua própria chave. Consulte também os pré-requisitos do README do backend para extração de PDF e dependências de modelos.

2. Inicie o backend no primeiro terminal:

```powershell
.\.venv\Scripts\python.exe run_acceptance_app.py
```

Mantenha esse terminal aberto. A API ficará em `http://127.0.0.1:5000/api/v1`. Para conferir, abra `http://127.0.0.1:5000/api/v1/health`.

3. Extraia este ZIP em uma pasta chamada `frontend` dentro do repositório. No segundo terminal, entre na pasta que contém o `package.json`:

```powershell
cd caminho\para\r.ia-FakeNews\frontend
npm ci
npm run dev
```

Abra **http://localhost:8443**. A configuração padrão já encaminha `/api` para o backend na porta 5000.

Se o PowerShell bloquear `npm.ps1`, use `npm.cmd ci` e `npm.cmd run dev`.

## Rodar no macOS/Linux

```bash
git clone --branch refactor/pubmed-only-mvp --single-branch https://github.com/joaocarvv/r.ia-FakeNews.git
cd r.ia-FakeNews
python3.11 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
cp .env.example .env
```

Preencha `GEMINI_API_KEY` no `.env`, sem sobrescrever configurações existentes. Inicie:

```bash
.venv/bin/python run_acceptance_app.py
```

Em outro terminal, na pasta do frontend extraído:

```bash
npm ci
npm run dev
```

## Uso

1. Informe link/DOI ou selecione PDF, PNG, JPEG ou WebP de até 25 MB.
2. Clique em **Verificar Agora** e aguarde a extração.
3. Escolha de 1 a 10 alegações e clique em **Pesquisar**.
4. A interface consulta o progresso e mostra cada alegação, limitações e fontes retornadas.
5. **Relatório completo** abre o relatório Markdown fornecido pelo backend.

Interromper consulta para apenas a espera no navegador; o backend pode continuar processando. **Retomar** consulta o mesmo identificador sem reenviar o artigo. O identificador fica disponível enquanto a página permanece aberta. Recarregar a página perde esse estado local.

## Configuração e publicação

Opcionalmente copie `.env.example` para `.env.local` no frontend:

```dotenv
VITE_API_BASE_URL=/api/v1
API_PROXY_TARGET=http://127.0.0.1:5000
```

`API_PROXY_TARGET` é utilizado pelo servidor Vite. Reinicie o Vite após alterar o ambiente. `VITE_API_BASE_URL` é incluído no JavaScript durante a compilação: nunca coloque chaves Gemini, Google, NCBI ou senhas em variáveis `VITE_*`.

O proxy evita problemas de CORS durante desenvolvimento e `vite preview`. Na publicação do `dist`, configure o servidor de produção para encaminhar `/api/*` ao backend, preservando o caminho; o proxy do Vite não é incluído no build estático. Um backend em outro domínio exige CORS e HTTPS adequados. O backend desta branch não fornece autenticação de usuários; sua API não deve ser exposta publicamente como se houvesse controle de acesso.

## Contrato implementado

| Ação | Método e rota |
| --- | --- |
| Enviar link/DOI ou arquivo base64 | `POST /api/v1/article-analyses` |
| Consultar progresso sem baixar resultado completo | `GET /api/v1/analyses/{id}?view=status` |
| Buscar alegações/resultado completo | `GET /api/v1/analyses/{id}` |
| Selecionar alegações (profundidade QUICK) | `POST /api/v1/article-analyses/{id}/claims` |
| Abrir relatório | `GET /api/v1/analyses/{id}/report.md` |

São tratados QUEUED, RUNNING, AWAITING_CLAIM_SELECTION, RESEARCHING, SUCCEEDED e FAILED. Erros HTTP, formato inválido, falhas por alegação e problemas de conexão são exibidos sem resultados simulados. Consulta a cada 2 segundos; espera máxima de 30 minutos por etapa, com retomada disponível.

## O que mudou e limites

- Removidos o resultado fixo e o temporizador que simulava uma análise.
- Adicionado `src/api.ts` com cliente HTTP, upload, consulta de progresso e adaptação dos resultados.
- Preservado o desenho do frontend, com nova seleção de alegações e estados de erro.
- Removido o score fictício: o backend distingue compatibilidade, divergência e inconclusão, não uma porcentagem de verdade. O status geral só repete uma direção quando todas as alegações têm essa direção; resultados mistos ficam inconclusivos.
- Login com Google integrado ao Firebase Authentication do projeto ria-fakenews, com restauração da sessão, exibição do nome, saída e mensagens de erro. A primeira entrada cria o usuário Firebase. As análises listadas em “Nesta sessão” ficam apenas em memória e são limpas ao sair/trocar de conta; não há histórico sincronizado. Verificação e relatório continuam disponíveis sem conta. A API Flask ainda não recebe/valida tokens Firebase nem separa dados por usuário.
- Não foram alterados os arquivos do backend nem enviados commits ao GitHub.
- Uma análise científica real depende das chaves, dos serviços externos e das dependências do backend. Os testes de integração usam processamento controlado; não validam a qualidade científica nem disponibilidade de Gemini/PubMed.

## Verificações

```bash
npm test
npm run typecheck
npm run build
```

Testes cobrem contrato HTTP, base64/tamanho/tipos de arquivo, erros de API, resultados mistos, falhas parciais e bloqueio de links com protocolos inseguros. `package-lock.json` permite instalar as versões verificadas com `npm ci`.

Verificação adicional realizada: cliente TypeScript → proxy Vite → rotas Flask reais da branch, com pipeline controlado para envio de DOI/imagem, seleção e resultado. A validação visual no navegador não foi concluída neste ambiente porque o Chromium não ficou disponível.

## Habilitar o login Google no Firebase

1. Abra https://console.firebase.google.com/project/ria-fakenews/authentication/providers .
2. Se necessário, clique em Começar. Em Método de login, ative **Google**, selecione o e-mail de suporte e salve.
3. Em Authentication → Configurações → Domínios autorizados, adicione **localhost** (sem protocolo/porta). Adicione **127.0.0.1** se utilizar esse endereço e o domínio real quando publicar.
4. Execute `npm ci` e `npm run dev`, abra http://localhost:8443 e clique em Entrar → Entrar com Google.
5. Confira se seu nome aparece, recarregue a página para verificar a restauração da sessão e teste Sair. Confira o usuário em Authentication → Users.

A configuração web enviada está em `src/firebase.ts`. Ela identifica o projeto Firebase e não é uma credencial de administrador. Nenhuma senha Google é coletada pela aplicação. Não foi ativado Analytics: ele não é necessário para autenticar.

A API científica ainda não está protegida por esse login. Para contas com dados privados no servidor, é necessário enviar um ID token e validá-lo no Flask com Firebase Admin, além de verificar propriedade de cada análise/arquivo. Esta alteração implementa autenticação no frontend, sem criar essa autorização no backend.

Validação desta atualização: TypeScript, testes do cliente científico e build de produção. O fluxo OAuth real precisa ser validado após habilitar o provedor e os domínios no console; não foi realizado login na sua conta.
