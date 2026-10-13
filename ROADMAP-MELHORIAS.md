# Evolução do ArtFact por etapas

## Etapa 1 — nesta branch
- Exibir cobertura de artigos recuperados/analisados e contagens de evidências.
- Exibir triagem metodológica por alegação, quando disponível.
- Não inventar percentual de verdade: `credibilityScore` permanece nulo.
- Resultados incompletos recebem `N/D`, com testes para entradas ausentes e incoerentes.

## Etapa 2 — autenticação
Adicionar entrada/cadastro com email e senha, recuperação de senha, e manter login Google.
Habilitar Email/Senha no console Firebase Authentication. Senhas não devem passar pelo Flask.

## Etapa 3 — histórico persistente seguro
Armazenar análises por `uid` no Firestore, com regras que negam leitura e escrita a outros usuários.
Não gravar chaves de API, tokens ou PDFs brutos em histórico. A API Flask ainda não autentica requisições científicas: integrar Firebase Admin no servidor e verificar propriedade de cada recurso antes de oferecer histórico privado via API.

## Etapa 4 — UX e qualidade
Detalhar trechos rastreáveis por DOI/PMID, limites metodológicos, downloads de relatório e melhor acessibilidade.
Executar testes de unidade e cenário real de análise com Gemini/PubMed antes do merge.

## Validar etapa 1
```powershell
npm ci
npm test
npm run typecheck
npm run build
```
Os testes de frontend não validam a acurácia científica do pipeline.
