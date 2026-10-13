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
- Ler as últimas 50 análises da conta, filtrar por área e pesquisar por título/fonte.
- Reabrir o resultado completo pelo ID salvo, quando o mesmo backend Flask ainda retém a análise.
- Excluir entradas individualmente, removendo só os metadados do Firestore (não os jobs originais no Flask).
- Mostrar estados de carregamento e erros de permissão, salvamento ou análise não localizada.
- Nunca persistir PDF bruto, alegações completas, token ou chave.
- Criar o banco Firestore no Firebase Console, inicialmente em **modo de produção**.
- Em Firestore Database > Rules, **mesclar e publicar** as regras em `firestore.rules` antes de ativar o histórico. Este arquivo no GitHub não publica regras automaticamente.
- Testar com duas contas: cada uma pode ler somente seu próprio histórico.
- **Limitação:** o Firestore mantém o registro, mas os resultados completos continuam no backend científico original (SQLite local). Se esse backend for substituído, reinicializado sem dados ou estiver inacessível, o registro aparecerá no histórico sem conseguir abrir o relatório.
- A API Flask **continua sem autenticação** de análises: integrar Firebase Admin no servidor e verificar propriedade de cada recurso ANTES de oferecer dados privados por ela. O controle Firestore não protege endpoints Flask.

## Etapa 4 — UX e qualidade (parcialmente implementada)
- Exibir até três trechos extraídos por alegação, com DOI, PMID e link seguro para consultar a fonte.
- Aviso explícito de que trechos extraídos automaticamente devem ser conferidos no contexto original.
- Fluxo já existente de relatórios Markdown preservado.
- Pipeline CI para teste, tipagem e build do frontend por GitHub Actions.
- **Pendente**: testes com APIs reais Gemini/PubMed e validação manual de acessibilidade/layout antes do merge.

## Validar todas as etapas
```powershell
npm ci
npm test
npm run typecheck
npm run build
```
Os testes de frontend não validam a acurácia científica do pipeline.
