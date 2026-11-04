# Notas de inspeção Swift — expo-glass-effect 58.0.5

Fonte: arquivos do pacote publicado em `artifacts/package`, lidos integralmente. Esta nota contém evidência estática, sem compilação Swift, execução UIKit, simulador ou dispositivo iOS. Os números de linha referem-se aos arquivos distribuídos, não a `main` do repositório.

## Superfície e responsabilidades

`ios/GlassEffectModule.swift:5-108` registra um módulo Expo de nome `ExpoGlassEffect`, duas constantes (`isLiquidGlassAvailable`, `isGlassEffectAPIAvailable`), duas classes de view (`GlassView`, `GlassContainer`) e seus setters. Não registra métodos assíncronos, eventos próprios, rotas, permissões ou serviços remotos. O JavaScript acessa as views por `requireNativeView('ExpoGlassEffect', 'GlassView'|'GlassContainer')`, em `src/GlassView.ios.tsx:9` e `src/GlassContainer.ios.tsx:9-12`.

ExpoModulesCore fornece `Module`, `ExpoView`, conversão de props, `Either`, `Record`, `Enumerable`, tipos `UIColor`/`CGFloat` e a montagem de componentes nativos. React fornece `RCTI18nUtil` para direção RTL. UIKit possui todo o algoritmo visual, incluindo refração, mistura das superfícies, resposta interativa, animação e renderização: o pacote cria/configura `UIGlassEffect`, `UIGlassContainerEffect` e `UIVisualEffectView`. Não há shader, kernel de blur, metal, textura ou simulação física próprios nos arquivos examinados.

## Disponibilidade e compatibilidade

### Constante de design: `isLiquidGlassAvailable`

`ios/GlassEffectModule.swift:9-25`:

1. Compilador Swift anterior a 6.2: `false`, pois o bloco que conhece as novas APIs é excluído da compilação.
2. Compilador >=6.2, sistema anterior a iOS/tvOS/macOS 26: `false`.
3. Sistema >=27 e SDK de build major >=27: `true`, antes de ler `UIDesignRequiresCompatibility`.
4. Demais sistemas >=26: se `Bundle.main.infoDictionary['UIDesignRequiresCompatibility']` converte para `Bool`, retorna a negação desse valor; se ausente ou não conversível, retorna `true`.

`buildSDKMajorVersion()` (`:120-126`) lê `DTPlatformVersion` de `Bundle.main`, exige `String`, coleta o prefixo numérico e converte para `Int`; falha/ausência gera `0`. Isso permite distinguir versão de SDK da versão Swift, que não evoluem juntas. A condição >=27 exige também SO >=27: um app compilado com SDK 27 em SO 26 ainda percorre a leitura da chave de compatibilidade.

Essa constante NÃO verifica `NSClassFromString`, selector, transparência reduzida, GPU, opacidade ou visibilidade. `src/isLiquidGlassAvailable.ios.ts:5-12` diz expressamente que acessibilidade pode limitar o efeito mesmo com retorno `true`, e orienta o chamador a consultar `AccessibilityInfo.isReduceTransparencyEnabled()`. Não há assinatura de mudanças de acessibilidade no código Swift. A constante também NÃO é consultada por `GlassView` nem `GlassContainer`: é um sinal para o aplicativo, e não um gate de criação interno.

### Constante de API: `isGlassEffectAPIAvailable`

`ios/GlassEffectModule.swift:27-38` exige compilador >=6.2, SO >=26, classe Objective-C `UIGlassEffect` como `NSObject.Type` e método de classe `effectWithStyle:`. O comentário vincula a proteção a betas iOS 26 que tinham disponibilidade nominal, mas API ausente. A função privada homônima de propósito em `ios/GlassView.swift:41-52` repete exatamente essa proteção para cada uso nativo, em vez de depender de chamada prévia do app.

`GlassContainer.isGlassContainerEffectAvailable()` (`ios/GlassContainer.swift:21-28`) exige compilador >=6.2, SO >=26 e existência de `UIGlassContainerEffect`; não verifica selector de inicializador. A constante pública de API só testa `UIGlassEffect`, portanto não prova separadamente disponibilidade do container.

As funções JavaScript usam cache modular (`boolean | undefined`): o primeiro acesso lê a constante de `requireNativeModule`, subsequentes retornam coerção booleana do cache (`src/isGlassEffectAPIAvailable.ios.ts:13-19`, `src/isLiquidGlassAvailable.ios.ts:16-21`). Falha de carregamento do módulo não é capturada. Nas implementações genéricas, ambas sempre retornam `false`.

## GlassView: árvore nativa e montagem

`ios/GlassView.swift:6-37` guarda um efeito como `Any?`, uma única `UIVisualEffectView`, estado de montagem/visibilidade e caches das props. O armazenamento `Any?` evita exigir um tipo novo no layout da classe para compiladores antigos. A view interna recebe `.flexibleWidth` e `.flexibleHeight` e é adicionada ao `ExpoView`. Não há cálculo manual de tamanho/posição além do autoresizing; geometria vem da view hospedeira e do layout React Native.

Filhos React são inseridos, na ordem recebida, em `glassEffectView.contentView` (`:341-343`), não diretamente na raiz do `ExpoView`. A remoção chama `removeFromSuperview()` (`:345-347`). Isso preserva o caminho UIKit recomendado para conteúdo da superfície e deixa o conteúdo participar da hierarquia visual do efeito. Não há persistência dos filhos fora da árvore UIKit.

### Estilo e remoção do efeito

O contrato TS é `'clear' | 'regular' | 'none'` (`src/GlassView.types.ts:4`), ou `{ style, animate?, animationDuration? }` (`:6-20`). O módulo aceita `Either<GlassStyle, GlassEffectStyleConfig>?`; tenta extrair primeiro o objeto de configuração, depois enum, e usa `.regular` caso não obtenha nenhum (`ios/GlassEffectModule.swift:41-48`). O tipo TS exige `style`, mas o `Record` Swift define defaults `.regular`, `false` e duração ausente (`ios/GlassStyle.swift:24-33`). A aceitação de dados inválidos depende do decoder ExpoModulesCore; não é implementada aqui uma rotina própria de validação/reparo.

`setGlassStyle` tem overload para objeto e enum e converte ambos em `applyGlassStyle` (`ios/GlassView.swift:162-168`). `applyGlassStyle` só executa se o enum mudou (`:170-202`). Atualizar apenas `animate` ou duração, mantendo o mesmo enum, é ignorado. O cache `glassStyle` é atualizado antes dos gates de API.

Para `clear`/`regular`, `GlassStyle.toUIGlassEffectStyle()` retorna o enum UIKit correspondente (`ios/GlassStyle.swift:9-20`); a closure cria novo `UIGlassEffect` e chama `updateEffect()` (`ios/GlassView.swift:178-181`). Para `none`, o pacote cria `UIVisualEffect()` e o atribui à view e ao cache (`:182-186`); o comentário diz que `nil` não desativa o efeito corretamente. Isso remove a decoração, não remove os filhos nem a `GlassView`.

Se `animate=true`, chama `UIView.animate(withDuration:..., animations:...)` quando há duração, ou `UIView.animate(animations:...)` quando ausente (`:190-198`). Duração é em segundos, não milissegundos. Não há callback de término, token de cancelamento, fila de animação, curva customizada ou interpolação JS por frame. Não há checagem própria de duração negativa/NaN ou limites; eventual rejeição/normalização seria da ponte ou UIKit. Uma primeira configuração com animação pode ocorrer antes de a view montar; a atribuição de `updateEffect` é bloqueada até montar, logo não foi provada uma animação inicial visível.

### Tint e interação

`tintColor?: ColorValue` (`src/GlassView.types.ts:35`) converte via ponte para `UIColor?`; `setTintColor` compara/cacheia e atualiza o efeito (`ios/GlassView.swift:271-276`). `nil` restaura ausência de tint customizado. UIKit resolve cores dinâmicas: o pacote não serializa RGB nem interpreta `PlatformColor`/`DynamicColorIOS` por conta própria.

`isInteractive?: boolean`, default público false (`src/GlassView.types.ts:36-40`). `setInteractive` compara/cacheia, limpa imediatamente o efeito anterior com `UIVisualEffect()` e chama `updateEffect()` (`ios/GlassView.swift:278-285`). A limpeza é necessária segundo comentário do código para mudar a interação depois da montagem. `updateEffect` atribui `effect.isInteractive = glassIsInteractive ?? false` (`:329`). A resposta a toque e ponteiro é interna ao UIKit; não há `onPress`, hit-test customizado ou recognizer no pacote. Para ações de aplicação, use `Pressable`/outros componentes React Native dentro/ao redor da superfície, respeitando o layout.

### Aparência

`colorScheme` aceita `auto`, `light`, `dark`; default registrado `.auto` no módulo (`ios/GlassEffectModule.swift:59-61`). `GlassColorScheme.toUIUserInterfaceStyle()` mapeia para `.unspecified`, `.light`, `.dark` (`ios/GlassStyle.swift:35-49`). `setColorScheme` compara/cacheia e chama `updateEffect()` (`ios/GlassView.swift:287-292`). Apenas a view interna recebe `overrideUserInterfaceStyle`, e somente quando existe `UIGlassEffect` ativo (`:327-334`). Mudar esquema enquanto estilo `none` mantém o cache para a próxima ativação; não há alteração própria da view externa ou do tema global.

### Fluxo central de atualização

`updateEffect()` (`ios/GlassView.swift:318-340`):

```text
se !isMounted: retornar
se API indisponível: retornar
se SO/compilador suportam e glassEffect é UIGlassEffect:
    definir tintColor e isInteractive (default false)
    se colorScheme definido: aplicar overrideUserInterfaceStyle
    reatribuir effect à UIVisualEffectView
    recalcular cantos
    sincronizar cornerCurve
```

A reatribuição é explícita mesmo que o objeto já seja o mesmo; comentário em `:333` diz que só modificar o objeto não aplica a mudança. Não se deve substituir isso por mutação simples numa reprodução.

## Cantos, curva e RTL

O módulo registra `borderRadius`, quatro raios físicos (TopLeft, TopRight, BottomLeft, BottomRight), quatro lógicos (TopStart, TopEnd, BottomStart, BottomEnd), e `borderCurve` (`ios/GlassEffectModule.swift:63-101`). São props nativas que acompanham estilos de View; o TS as herda por `ViewProps`, não cria interface de estilo paralela.

Cada setter de raio guarda opcional `CGFloat`, compara antes de atualizar e chama `updateBorderRadius()` (`ios/GlassView.swift:205-269`). O cálculo exige API disponível e SO/compilador suportados (`:122-127`), consulta `RCTI18nUtil.sharedInstance()?.isRTL() ?? false` (`:128`) e aplica precedência:

| Canto final | LTR | RTL |
|---|---|---|
| superior esquerdo | topLeft ?? topStart ?? global ?? 0 | topLeft ?? topEnd ?? global ?? 0 |
| superior direito | topRight ?? topEnd ?? global ?? 0 | topRight ?? topStart ?? global ?? 0 |
| inferior esquerdo | bottomLeft ?? bottomStart ?? global ?? 0 | bottomLeft ?? bottomEnd ?? global ?? 0 |
| inferior direito | bottomRight ?? bottomEnd ?? global ?? 0 | bottomRight ?? bottomStart ?? global ?? 0 |

Fonte: `ios/GlassView.swift:135-145`. Valor físico sempre vence lógico; o código não lê `doLeftAndRightSwapInRTL` nem `layoutDirection` específico da view. Os valores viram `UICornerRadius(floatLiteral:)` e `cornerConfiguration = .corners(...)` na view interna (`:147-157`). Não há clamp próprio nem suporte explícito a raios percentuais nesse setter: a ponte está tipada `CGFloat?`; comportamento de strings percentuais deve ser testado e não presumido pela herança de `ViewProps`.

`setBorderCurve(_: String?)` ignora seu argumento e copia `self.layer.cornerCurve` para `glassEffectView.layer.cornerCurve` (`:211-213`). Portanto depende de o estilo já ter sido aplicado à camada externa pelo framework; não converte diretamente a string. `updateEffect()` também chama esse setter após aplicar raios (`:336`). O código não adiciona `clipsToBounds`, máscaras CAShapeLayer ou desenho de borda manual.

Possível limite: uma mudança RTL global sem alterações nas props e sem outra chamada a `updateEffect()` não força o recálculo no código local. Não é bug confirmado; o framework pode recriar/recarregar a árvore durante a mudança de idioma.

## Visibilidade, reciclagem e recuperação

`layoutSubviews()` chama primeiro `super`, retorna se montado ou API ausente, e escolhe instalação ou espera pela visibilidade (`ios/GlassView.swift:54-64`). `isEffectRenderable` (`:68-85`) exige `window != nil`; percorre a view e todos os ancestrais, rejeita qualquer `isHidden`, multiplica todos os `alpha` e exige produto estritamente maior que `0.02`. O comentário diz que esse limiar veio de teste empírico e deve ser calibrado em vários dispositivos reais. Não é uma fórmula de blur nem garantia documentada do SO. Alpha `0.02` exato continua na espera.

Se não renderizável, `waitForVisibility()` cria no máximo um `CADisplayLink`, ligado ao run loop principal `.common` (`:97-104`). `WeakDisplayLinkProxy` segura a view de modo `weak` (`:350-361`), evitando um ciclo retain entre view/link/target. A cada tick renderizável, chama `setNeedsLayout()` (`:106-111`) para que a instalação ocorra na próxima passagem de layout; não instala diretamente no callback.

`installEffect()` marca `isMounted=true`, invalida o display link, limpa estado UIKit anterior com `UIVisualEffect()` e chama `updateEffect()` (`:87-95`). A limpeza documenta workaround para reatribuição insuficiente após reciclagem do pai (`#43732`). O comentário sobre “criar em layout” deve ser interpretado com precisão: a atribuição definitiva à view é feita no layout, mas o objeto `UIGlassEffect` também pode ter sido criado antes, na closure de `applyGlassStyle`. O código é a evidência mais precisa que o texto do comentário.

Ao remover da janela, `willMove(toWindow: nil)` limpa o efeito antes da remoção para que o pai reciclado não retenha estado que impediria um novo vidro (`:294-301`). `didMoveToWindow()` sem janela reseta `isMounted=false` e para a espera; com janela chama `setNeedsLayout()` mesmo se geometria não mudou (`:303-316`). Isso permite reaplicar os caches em reentrada. `deinit` invalida o link (`:118-120`).

Limites observáveis estaticamente:

- Se ficar anexada à janela porém permanentemente oculta/alpha baixo antes de montar, continuará recebendo ticks até visibilidade, saída da janela ou deinit. Não existe timeout/backoff, nem medição de custo no pacote.
- Depois da montagem, `layoutSubviews` retorna por `isMounted`, e o display link foi encerrado. O detector não monitora continuamente sumiços e reaparições sem sair da janela; a efetividade nesses casos depende de UIKit e de futuras mudanças de props. Isso exige teste real.
- Mudanças de tint/style/interactive/colorScheme chamam `updateEffect()` quando montada sem repetir `isEffectRenderable`. O limiar protege instalação inicial/remontagem, não toda mutação posterior.
- Não há teste explícito de tamanho zero em `isEffectRenderable`; estar na janela, visível e com alpha suficiente basta para o gate local.

## GlassContainer e fusão de superfícies

`ios/GlassContainer.swift:5-17` contém uma `UIVisualEffectView` com autoresizing e um cache de `containerSpacing: CGFloat?`. Filhos são inseridos em `contentView` e removidos por `removeFromSuperview` (`:49-55`). Não mede distância entre filhos nem altera seus frames. A fusão é do `UIGlassContainerEffect`, que recebe `spacing` do app.

`setSpacing(_:)` (`:30-47`) compara o opcional com o cache, atualiza o cache, aplica gate de API, cria novo `UIGlassContainerEffect`, define `effect.spacing` somente se valor não nil, e atribui à view/cache. Cada mudança cria um efeito novo. Não há animação própria, limitação a positivos ou normalização no pacote. `spacing` não é o mesmo que `gap`/margem: é um parâmetro do efeito, e não layout.

**Possível defeito de inicialização, inferido do código:** `containerSpacing` inicia nil, a view interna inicia sem efeito, e o construtor não cria `UIGlassContainerEffect`. Se `spacing` for omitido (default TS `undefined`) ou convertido inicialmente para nil, `containerSpacing != spacing` é falso e nenhum efeito é criado. Fornecer número explícito, por exemplo `spacing={10}`, força a instalação. Depois de número para nil, há mudança e o novo efeito usa default do UIKit. Nenhum caminho alternativo de inicialização está presente nos arquivos do pacote. A ocorrência visual no build iOS depende do comportamento da ponte e precisa de runtime; não deve ser apresentada como bug reproduzido.

O container não possui monitor de alpha, workarounds de remoção/reentrada, `isMounted`, ou limpeza específica equivalentes aos de GlassView. Isso é uma diferença de implementação confirmada, não prova de falha do container.

## Build, integração e plataformas

`expo-module.config.json:2-6`: plataformas `['apple']`, módulo Apple `GlassEffectModule`, objeto Android vazio. Não há classe Android distribuída. `ios/ExpoGlassEffect.podspec` lê versão/descrição/licença de package.json (`:3-12`); exige iOS/tvOS >=16.4 (`:13-16`), depende de `ExpoModulesCore` (`:19`), é static framework (`:21`) e compila fontes `**/*.{h,m,swift}` (`:22`). O mínimo de instalação 16.4 não implica Liquid Glass antes de 26.

`spm.config.json` declara produto `ExpoGlassEffect`, pod homônimo, iOS 16.4 (`:5-7`), target Swift de `ios/*.swift` (`:16-19`), dependências React/ReactNativeDependencies/Hermes/ExpoModulesCore (`:8-12`, `:20-24`) e frameworks Foundation/UIKit/SwiftUI (`:26`). A implementação lida aqui usa UIKit; linkar SwiftUI não comprova UI declarativa SwiftUI no target. Não há `Package.swift` distribuído; esse JSON é insumo do tooling Expo, não um pacote SwiftPM autônomo pronto para `swift build`.

Há `#available(...macOS...)` nos fontes, mas isso não basta para declarar suporte desktop macOS: código importa UIKit/React e podspec só declara iOS/tvOS; SPM declara apenas iOS. tvOS está declarado no podspec e gates nativos, mas a resolução JS específica de plataforma e comportamento visual precisam de teste separado. iOS antigo continua usando a classe Expo nativa com `UIVisualEffectView` vazia; o fallback genérico `<View {...props}/>` vale onde o resolvedor escolhe arquivos sem sufixo `.ios`, não é um `if OS<26` no wrapper iOS.

## Contratos, erros e lacunas

- As props de biblioteca dependem da conversão de ExpoModulesCore para enum/record/boolean/cor/escalar. Não há `try/catch`, diagnóstico de props inválidas ou política de recuperação própria.
- API ausente falha silenciosamente no caminho visual, retornando antes de construir os novos tipos; conteúdo continua no `contentView`. Módulo nativo ausente no bundle iOS pode lançar ao resolver a view ou constante; os wrappers não fazem fallback de carregamento.
- As props/eventos genéricos de View, refs e acessibilidade são herdados/passados pelo framework. Não há ações ou roles de acessibilidade customizados no código do pacote.
- Nada é escrito em banco, arquivo, preferências ou rede; o estado descrito é de instância e cache em memória. Info.plist é entrada somente leitura do bundle anfitrião. Não há migrações, credenciais, permissões, jobs ou updates próprios.
- Sem runtime Apple não foi comprovada aparência exata de clear/regular, valor default UIKit de spacing/duração, toque/hover, custo GPU/frame, clipping, bordas percentuais, ordem de callbacks da ponte, propagação de estilos e retorno visual em versões iOS específicas.

Escopo encerrado: somente análise estática do pacote publicado, sem alteração de fontes.
