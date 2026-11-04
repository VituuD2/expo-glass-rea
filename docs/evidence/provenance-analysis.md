# Proveniência de expo-glass-effect 58.0.5

Coleta em 2026-11-04. Análise somente leitura das fontes e artefatos; nenhum script do pacote foi executado nesta etapa.

## Identidade e vínculo com o repositório

- Tarball oficial: https://registry.npmjs.org/expo-glass-effect/-/expo-glass-effect-58.0.5.tgz
- Publicação informada pelo registro: `2026-10-23T23:23:40.402Z` (`provenance-npm-time.json`).
- SHA-256 do tarball: `c62fe880a26e761bc3fc6d259e6ab268e293f7344aaaa002389a804a5ec438ee`.
- SHA-512: `3e42f55ffaf4713b3a346e3b5e9dd3c51beda9279198f6213ce1e9dc60e6641da83b1a635e07baa8b8bf6d24afd1ab055aa7fe30b3a55d9fa1ab6226ba1d19d6`.
- O registro não forneceu `gitHead`. A [attestation npm](https://registry.npmjs.org/-/npm/v1/attestations/expo-glass-effect@58.0.5) contém um payload SLSA v1 que liga o sujeito `pkg:npm/expo-glass-effect@58.0.5` ao commit **`a6078233c87546c50d56c8bc85f75253a78daed7`**, repositório `https://github.com/expo/expo`, ref `refs/heads/main`.
- Workflow declarado: `.github/workflows/publish-packages.yml`; execução `https://github.com/expo/expo/actions/runs/40038148144/attempts/1`; builder `https://github.com/actions/runner/github-hosted`.
- O hash SHA-512 calculado do tarball coincide com o sujeito de ambos os payloads (publish e SLSA). **Não foi validada a cadeia criptográfica Sigstore/Rekor ou a assinatura npm.** A conclusão é sobre conteúdo do registro + equivalência dos bytes, não uma auditoria criptográfica da cadeia de suprimentos.
- A API GitHub identifica o commit como `Version packages (main) (#52162)`, committer em `2026-10-23T23:10:34Z`. O commit de publicação pode incluir alterações alheias ao pacote; a equivalência foi aferida nos arquivos do pacote, não inferida pelo título.

Evidências preservadas: `provenance-attestations.json` (bundle original serializado), `provenance-payloads.json` (DSSE decodificado), `provenance-commit.json`, `provenance-npm-time.json`.

## Comparação npm ↔ commit

Todas as fontes upstream foram baixadas por URLs fixadas nesse commit, sem clonar o monorepo. A árvore integral de `packages/expo-glass-effect` contém **28 arquivos** (`provenance-package-inventory.json`).

| Resultado | Contagem | Detalhes |
|---|---:|---|
| Arquivos presentes tanto no pacote quanto no repo | 21 | 20 idênticos byte a byte; 1 metadata transformada |
| `src` produtivo, `ios`, configs, README e changelog | 20 | Idênticos; ver hashes em `provenance-comparison.json` |
| `package.json` | 1 | Mesma versão; `@expo/internal-scripts` passa de `workspace:*` a `58.0.4`; `scripts.prepublishOnly` é removido; scripts são reordenados |
| Apenas no repo/package | 7 | `.npmignore`, `oxlint.config.mjs`, `tsconfig.json`, 2 testes, 2 snapshots |
| Apenas no tarball, frente à pasta package do repo | 34 | 33 arquivos `build/*` gerados + `LICENSE` herdado da raiz do monorepo |

O tarball tem **55 arquivos**. O `LICENSE` publicado coincide byte a byte com `LICENSE` da raiz do commit. O código distribuído corresponde às fontes do commit nos escopos acima; isso não prova a compilação nativa de um aplicativo iOS específico. O diretório `build/` não existe nessa árvore Git e não foi reproduzido por uma compilação local nesta etapa.

`.npmignore` linhas 10–13 exclui tsconfig/caches; 28–30 exclui testes; 35 exclui oxlint; 38 exclui testes iOS. A ausência dos testes no npm é esperada pelo empacotamento.

`provenance-source-manifest.json` guarda a árvore package com hashes Git blob e SHA-256. `provenance-acquired-files.json` indexa **42 arquivos upstream** desta etapa, URLs imutáveis e SHA-256, incluindo exemplos, docs e workflow. Não é inventário integral do monorepo.

## Testes upstream efetivamente encontrados e lidos

1. `upstream/packages/expo-glass-effect/src/__tests__/GlassView-test.ios.tsx`, linhas 6–11: dois casos parametrizados `regular`/`clear`; presença via `testID`, visibilidade do renderer de teste e snapshot.
2. Mesmo arquivo, linhas 13–24: três casos de cor (`rgba` string, `PlatformColor('systemBlue')`, `DynamicColorIOS` light/dark); visibilidade e snapshot.
3. `.../GlassContainer-test.ios.tsx`, linhas 5–17: um container `spacing={8}` com dois filhos; três consultas de presença/visibilidade e snapshot.

São **6 casos derivados de 3 declarações**, em **2 arquivos**; cinco snapshots de GlassView e um de GlassContainer. Os snapshots mostram `ViewManagerAdapter_ExpoGlassEffect`, preservando props e hierarquia. **Não são testes de pixels UIKit** nem comprovam Liquid Glass, interação, fusão, KVO, animação, bordas, tvOS, detecção de API, tratamento de erro ou reciclagem Fabric.

Os testes foram lidos, não executados: dependem de React Native/Jest e do preset de workspace `@expo/internal-scripts`; este checkout seletivo não fornece o monorepo instalado. Não foram encontrados testes Swift na árvore integral desse package. Esta conclusão não exclui testes em outras pastas do monorepo que não foram adquiridas.

## Exemplos e acesso à tela de demonstração

- `upstream/apps/native-component-list/src/navigation/componentScreens.ts`, linhas 68–73: registro `name: 'GlassView'`, `optionalRequire(() => require('../screens/GlassView/GlassViewScreen'))`. A existência e o registro são confirmados em código, sem confirmação de execução em um binário instalado.
- `navigation/routeBuilder.tsx`, linhas 12–17: captura erro síncrono de require e devolve tela `Error: {message}`. É recuperação do aplicativo de demonstração, não da biblioteca.
- `navigation/screenRegistry.ts`, linhas 7–20 e 38–40: registro de componentes usa `getScreenIdForLinking`, vindo de `test-suite`; o algoritmo externo do ID não foi adquirido. `RegistryScreenRoute.tsx`, linhas 19–38: resolve ID do catch-all, consulta registro, renderiza `<Unmatched/>` se ausente, ou componente carregado. Não afirmar o slug exato sem ler o helper externo.
- `screens/GlassView/GlassViewScreen.ios.tsx`, linhas 49–64: estado local com estilo regular, esquema auto, interação false, tint undefined, spacing 20, animação ligada, duração 0.5s.
- Linhas 70–84 e 103–111: arraste via gesture-handler, coordenadas em shared values e transform de Reanimated. Esse arraste pertence ao demo/dependências, **não é implementado por `isInteractive`**.
- Linhas 88–94: exibe ambos os resultados das funções de disponibilidade; os valores não impedem a montagem subsequente do GlassView nessa tela.
- Linhas 114–155: controles regular/clear; auto/light/dark; checkbox interação; tint None, RGBA vermelho/azul/verde, PlatformColor e DynamicColorIOS.
- Linhas 157–195: três círculos GlassView em GlassContainer, spacing 10/20/40/80 via controle segmentado.
- Linhas 196–245: materialize/dematerialize alterna objeto `glassEffectStyle`, mantendo conteúdo; duração 0.3/0.5/1/2s; toggle animação.
- Linhas 289–295: exemplo usa raio uniforme 12 e top-left 100. Isso demonstra entrada de raio não uniforme no código de exemplo; não confirma o resultado visual.
- `GlassOpacityAnimationExample.ios.tsx`, linhas 19–40 e 52–60: workaround para iOS 26.1+: wrapper com opacity animada por `withTiming` (500 ms), glass style configurado a `none` quando alpha <=0.01. Estado apenas em memória.
- `GlassViewScreen.tsx`, linhas 5–10: tela não iOS mostra mensagem `GlassView is not supported on {Platform.OS}`. É comportamento do demo, distinto do fallback genérico View do SDK.
- `screens/UI/GlassEffectScreen.ios.tsx` é demonstração do **outro produto `@expo/ui`/SwiftUI**. Foi adquirida para desambiguação; não contar suas features como expo-glass-effect.
- `apps/native-component-list/package.json`, linha 74: depende de `expo-glass-effect: workspace:*`, logo fonte local do monorepo nesse checkout, não prova execução do tarball npm.

## Documentação fixada na mesma revisão

Arquivos adquiridos:

- `upstream/docs/pages/versions/v58.0.0/sdk/glass-effect.mdx`.
- `upstream/docs/pages/versions/unversioned/sdk/glass-effect.mdx`.

Conteúdo praticamente igual; diferença de frontmatter `sourceCodeUrl` (branch sdk-58 vs main). Usar os arquivos/URLs do commit para fundamentar a versão, porque a URL pública `latest` é mutável.

Contrastes úteis:

- Docs linha 13: dizem fallback para View em plataformas sem suporte; a semântica nativa específica precisa ser confirmada no Swift, não pela frase.
- Docs linhas 238–315: recomendam evitar opacity <1 e apresentam workaround; **limiar 0.02 no snippet docs**, contra **0.01 no demo**. Ambos são decisões dos exemplos, não constantes públicas da biblioteca.
- Docs linhas 338–339: distinguem disponibilidade no app compilado; linhas 358–360 distinguem API runtime e risco de betas iOS 26. Não confundir as duas funções.

## Build e publicação observáveis

- `upstream/package.json`, linhas 7–12 e 54–56: pnpm 12.2.1; engines Node `^22.13.0 || ^24.3.0 || ^26.0.0 || >=27.0.0`, pnpm `^12.2.1`.
- Package upstream scripts: `build: expo-build src`, `test: jest`, `typecheck: tsc -p tsconfig.json`, `lint: oxlint --config oxlint.config.mjs .`, comandos `expo-module` para clean/format/prepublish/depscheck. Esses são comandos de desenvolvimento; não há CLI de produto.
- `.github/workflows/publish-packages.yml`: pipeline de Changesets decide entre versionamento/publicação e empacota/publica pacotes; a attestation identifica a execução concreta. Não se executou esse workflow nem se reconstruiu o pacote.
- `CHANGELOG.md`, linhas 3–7: 58.0.5 registra fix de glass ausente após fade-in quando React Native recicla o parent de um GlassView anterior em seu conteúdo. Esse registro corrobora a finalidade do código de recuperação, não comprova o fix em runtime.

## Reproduzir checagens sem executar o alvo

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath 'artifacts\expo-glass-effect-58.0.5.tgz'
$att = Invoke-RestMethod 'https://registry.npmjs.org/-/npm/v1/attestations/expo-glass-effect@58.0.5'
$att.attestations | ForEach-Object {
  [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($_.bundle.dsseEnvelope.payload))
}
```

As comparações usam SHA-256 e igualdade binária direta entre arquivos locais; `provenance-comparison.json` conserva todos os pares, inclusive ausências e metadata transformada.

Não verificado: assinatura completa da attestation, execução de testes Jest, build nativo iOS ou pipeline de publicação.
Risco residual: esta equivalência caracteriza o pacote oficial 58.0.5; nenhum IPA/app concreto foi fornecido para ligá-la a uma instalação no iOS.
