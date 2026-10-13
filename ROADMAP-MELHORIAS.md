# Evolução do ArtFact por etapas

## Etapa 1 — nesta branch
- Exibir cobertura de artigos recuperados/analisados e contagens de evidências.
- Exibir triagem metodológica por alegação, quando disponível.
- Não inventar percentual de verdade: `credibilityScore` permanece nulo.
- Resultados incompletos recebem `N/D`, com testes para entradas ausentes e incoerentes.

## Etapa 2 — autenticação (implementada no frontend)
- Cadastro com nome, e-mail e senha; entrada e redefinição de senha via Firebase Authentication.
- Google continua disponível; senhas não são enviadas ao Flask.
- **Configuração manual obrigatória:** no Firebase Console > Authentication > Sign-in method, habilitar **Email/Password** e Google e autorizar o domínio utilizado.

## Etapa 3 — histórico (implementada no frontend, exige Firebase)
- Salvar somente metadados de cada análise em `users/{uid}/analyses/{analysisId}`.
- Ler as últimas 50 análises da conta. Nunca persistir PDF bruto, alegações completas, token ou chave.
- Criar o banco Firestore no Firebase Console, inicialmente em **modo de produção**.
- Em Firestore Database > Rules, **mesclar e publicar** as regras em `firestore.rules` antes de ativar o histórico. Este arquivo no GitHub não publica regras automaticamente.
- Testar com duas contas: cada uma pode ler somente seu próprio histórico.
- A API Flask **continua sem autenticação** de análises: integrar Firebase Admin no servidor e verificar propriedade de cada recurso ANTES de oferecer dados privados por ela. O controle Firestore não protege endpoints Flask.

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
