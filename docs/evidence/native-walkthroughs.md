<a id="components"></a>
### Componentes, material e composição

Os recursos F01–F11 estão **parcialmente verificados**: os caminhos abaixo existem no Swift distribuído em 58.0.5 e foram lidos diretamente, mas nenhum efeito UIKit foi observado em execução. A disponibilidade nativa combina `#if compiler(>=6.2)`, sistema >=26 e consultas dinâmicas de classe; o detalhe dos helpers públicos está em F12–F13. Não se deve interpretar uma instância criada, uma atribuição de propriedade ou `isMounted=true` como evidência de pixels renderizados.

<a id="f01"></a>
#### F01 — GlassView, conteúdo e hierarquia nativa

**Uso.** Importe `GlassView` e forneça dimensões/estilos de `View`; coloque conteúdo React como `children`. Um fundo visual atrás da superfície permite perceber o material. O componente não fornece botão, texto ou imagem próprios.

```tsx
<GlassView style={{ width: 180, height: 80, borderRadius: 20 }}>
  <Text>Conteúdo da superfície</Text>
</GlassView>
```

**Caminho.** O export aponta para `GlassView`; no caminho iOS, `requireNativeView('ExpoGlassEffect', 'GlassView')` resolve a view Expo e o wrapper encaminha todas as props. `View(GlassView.self)` registra a classe Swift. Seu construtor cria uma `UIVisualEffectView`, configura autoresizing flexível nas duas dimensões e a adiciona ao `ExpoView`. Os callbacks de montagem inserem filhos na `contentView` dessa view interna, preservando o índice recebido; desmontagem chama `removeFromSuperview()`.

```text
GlassView React → view Expo → GlassView: ExpoView
                              └─ UIVisualEffectView
                                  └─ contentView → filhos React Native
```

**Limites e ownership.** O pacote decide a hierarquia e as props. Layout, conversão e refs dependem de React Native/ExpoModulesCore; o material e sua composição pertencem ao UIKit. Não há framebuffer, shader ou blur próprio. No caminho iOS, um SO antigo ainda usa essa classe nativa, cujo efeito fica sem a API nova; não existe troca por `<View>` baseada na versão do SO dentro do wrapper iOS. Sem runtime, clipping e geometria final dos filhos permanecem pendentes.

As alterações de propriedades convergem no mesmo método de reaplicação, que não lança um evento de sucesso:

```text
updateEffect():
  se !isMounted: retornar
  se API ausente: retornar
  se glassEffect é UIGlassEffect:
    aplicar glassTintColor
    aplicar glassIsInteractive ou false
    aplicar esquema, quando guardado
    glassEffectView.effect = glassEffect
    atualizar cantos
    copiar curva da camada externa
```

A reatribuição final do mesmo objeto é intencional: o comentário em `updateEffect` registra que apenas modificar suas propriedades não aplica a mudança.

**Evidências.** [`src/GlassView.ios.tsx`, L9–15](../artifacts/package/src/GlassView.ios.tsx#L9), [`GlassEffectModule.definition`, L40](../artifacts/package/ios/GlassEffectModule.swift#L40), [`GlassView.init`, L31–37](../artifacts/package/ios/GlassView.swift#L31), [`mountChildComponentView`/`unmountChildComponentView`, L341–347](../artifacts/package/ios/GlassView.swift#L341).

<a id="f02"></a>
#### F02 — Estilos regular, clear e none

**Uso.** Defina `glassEffectStyle="regular"`, `"clear"` ou `"none"`. O contrato público declara `regular` como default. `none` desativa a decoração de vidro e mantém a view e os filhos; não equivale a ocultar ou desmontar o componente.

**Caminho.** A prop chega como `Either<GlassStyle, GlassEffectStyleConfig>?`. O módulo tenta obter uma configuração, depois um enum; na ausência de ambos chama `setGlassStyle(.regular)`. Os dois overloads de setter convergem em `applyGlassStyle`. Quando o enum muda, o método atualiza o cache `glassStyle`, verifica disponibilidade e executa uma closure de aplicação.

Para `clear`/`regular`, `toUIGlassEffectStyle()` produz o estilo UIKit e a closure cria um novo `UIGlassEffect`, armazena-o em `glassEffect` e chama `updateEffect()`. Para `none`, a conversão retorna `nil`, mas o código atribui `UIVisualEffect()` à view e ao cache. O comentário explica que atribuir `nil` não removia o efeito como esperado.

**Estado e erros.** `updateEffect()` só atribui `UIGlassEffect` quando a view está montada. Configurações recebidas antes disso ficam em memória até a instalação. O cache do enum muda antes do gate de API: em ambiente incompatível, a intenção fica guardada, mas o código retorna sem construir o material novo. Valores fora dos enums dependem do decoder Expo; não há normalização de strings ou tratamento próprio de exceções no wrapper.

**Ownership e limite.** O pacote escolhe objetos e os reatribui à view; o UIKit determina aparência, refração e adaptação ao fundo. Não foi confirmada a diferença visual entre `clear` e `regular`, nem a equivalência visual de `none` entre versões do SO.

**Evidências.** [`GlassViewProps`, L24–31](../artifacts/package/src/GlassView.types.ts#L24), [`Prop("glassEffectStyle")`, L41–48](../artifacts/package/ios/GlassEffectModule.swift#L41), [`GlassStyle.toUIGlassEffectStyle`, L4–21](../artifacts/package/ios/GlassStyle.swift#L4), [`applyGlassStyle`, L170–202](../artifacts/package/ios/GlassView.swift#L170), [`updateEffect`, L318–340](../artifacts/package/ios/GlassView.swift#L318).

<a id="f03"></a>
#### F03 — Transições animadas de estilo

**Uso.** Troque o estilo por estado React e passe a configuração abaixo. A duração está em **segundos**; omitindo-a, o pacote usa o overload de animação sem duração explícita.

```tsx
glassEffectStyle={{
  style: visible ? 'regular' : 'none',
  animate: true,
  animationDuration: 0.5,
}}
```

**Caminho.** `GlassEffectStyleConfig` tem `style`, `animate` e duração opcional. O `Record` Swift define defaults `.regular`, `false` e ausência de duração; o TypeScript exige `style`. `setGlassStyle(config)` envia esses campos a `applyGlassStyle`. Para `animate=true`, a mesma closure de F02 roda em `UIView.animate(withDuration:animations:)` se há duração, ou em `UIView.animate(animations:)` caso contrário. Sem animação, a closure roda diretamente.

**Estado e limites.** A condição de mudança compara somente o enum do estilo. Alterar apenas `animate` ou duração, mantendo `regular`, por exemplo, não dispara nova aplicação. Não há callback de término, cancelamento, curva própria ou atualização JavaScript por frame. Não há clamp explícito de duração negativa, infinita ou NaN; a conversão Expo e o UIKit são fronteiras externas a esse código. Animações sobrepostas seguem o comportamento desses overloads UIKit.

**Ownership.** React inicia a troca; o pacote seleciona o caminho animado; UIKit interpola a transição. Uma configuração animada recebida antes da montagem pode criar o objeto antes de `updateEffect()` poder atribuí-lo; uma primeira animação visível não foi demonstrada. Duração real e comportamento ao interromper transições exigem iOS em execução.

**Evidências.** [`GlassEffectStyleConfig` TS, L6–20](../artifacts/package/src/GlassView.types.ts#L6), [`GlassEffectStyleConfig` Swift, L24–33](../artifacts/package/ios/GlassStyle.swift#L24), [`setGlassStyle` e `applyGlassStyle`, L162–201](../artifacts/package/ios/GlassView.swift#L162).

<a id="f04"></a>
#### F04 — Tint e cores dinâmicas

**Uso.** Passe `tintColor` como um `ColorValue` React Native. A interface aceita as formas de cor suportadas por esse tipo, incluindo cores de plataforma e dinâmicas; a prop é opcional.

```tsx
<GlassView tintColor="rgba(40, 100, 220, 0.25)" style={surfaceStyle} />
```

**Caminho.** `Prop("tintColor")` recebe `UIColor?` da ponte Expo e chama `setTintColor`. O setter compara com `glassTintColor`, atualiza esse cache e chama `updateEffect()`. Havendo montagem e um `UIGlassEffect` válido, o método atribui `effect.tintColor = glassTintColor`, reaplica o objeto na `UIVisualEffectView` e atualiza cantos/curva.

**Estado e limites.** Antes de montar, o valor fica no cache. Em `none`, o cache ainda pode mudar, mas `updateEffect()` não aplica tint porque o efeito guardado é um `UIVisualEffect` vazio. Ao voltar para um estilo de vidro, o valor guardado é aplicado. `nil` retira o tint customizado. Não há parser RGB próprio, persistência ou observador de mudança de tema no pacote.

**Ownership.** A ponte Expo/React Native converte `ColorValue` em `UIColor`; UIKit resolve a cor e sua interação com o material. A aceitação efetiva de cada variante dinâmica e os pixels finais não foram exercitados. A mudança do tipo público para `ColorValue` em 58.0.0 não significa que o pacote tenha implementado um resolvedor de cores novo.

**Evidências.** [`tintColor?: ColorValue`, L32–35](../artifacts/package/src/GlassView.types.ts#L32), [`Prop("tintColor")`, L51–53](../artifacts/package/ios/GlassEffectModule.swift#L51), [`setTintColor`, L271–276](../artifacts/package/ios/GlassView.swift#L271), [`updateEffect`, L327–336](../artifacts/package/ios/GlassView.swift#L327), [`CHANGELOG`, L31–39](../artifacts/package/CHANGELOG.md#L31).

<a id="f05"></a>
#### F05 — Interatividade do material

**Uso.** Defina `isInteractive` para habilitar a resposta interativa do material UIKit. O default público é `false`. Para executar ações do aplicativo, associe componentes/eventos React Native, como `Pressable`; essa prop não fornece `onPress` próprio.

**Caminho.** A prop é convertida para `Bool` e entregue a `setInteractive`. Se mudou em relação a `glassIsInteractive`, o setter guarda o valor, substitui imediatamente o efeito anterior por `UIVisualEffect()` e chama `updateEffect()`. Na reaplicação, o pacote atribui `effect.isInteractive = glassIsInteractive ?? false` e reassocia o efeito à view.

**Por que limpar.** O comentário local exige limpar o efeito anterior para mudar interatividade depois da montagem. Esse passo é parte do contrato de implementação observado no código e deve ser preservado numa reprodução; apenas alterar a propriedade do objeto não reproduz a sequência completa.

**Limites e ownership.** Não há recognizer, física, hover, foco, haptic ou hit-test customizado no pacote. A resposta visual/tátil que o SO eventualmente produz pertence ao UIKit. O caminho também pode limpar o efeito antes da montagem, mas `updateEffect()` aguarda `isMounted`. Com estilo `none`, a limpeza mantém a decoração vazia. Nenhum toque, foco tvOS ou transição de interatividade foi observado neste host.

**Evidências.** [`isInteractive`, L36–40](../artifacts/package/src/GlassView.types.ts#L36), [`Prop("isInteractive")`, L55–57](../artifacts/package/ios/GlassEffectModule.swift#L55), [`setInteractive`, L278–285](../artifacts/package/ios/GlassView.swift#L278), [`updateEffect`, L327–334](../artifacts/package/ios/GlassView.swift#L327).

<a id="f06"></a>
#### F06 — Aparência auto, light e dark

**Uso.** Passe `colorScheme="auto"`, `"light"` ou `"dark"`, por exemplo para acompanhar o seletor de tema do aplicativo. O default registrado no módulo é `auto`.

**Caminho.** O decoder fornece `GlassColorScheme`; `setColorScheme` compara/cacheia e chama `updateEffect()`. O enum mapeia `auto` para `.unspecified`, `light` para `.light` e `dark` para `.dark`. Havendo `UIGlassEffect` montado, o resultado vai para `glassEffectView.overrideUserInterfaceStyle`, antes da reatribuição do efeito.

**Estado e limites.** `auto` deixa a aparência ser resolvida pela hierarquia/sistema. O pacote não muda o tema global do app nem o `overrideUserInterfaceStyle` do `ExpoView` externo. Como os filhos são montados no `contentView` interno, a herança de traits pode alcançá-los; o resultado por componente depende de UIKit/React Native e não foi observado. Mudar tema em `none` guarda o valor, mas sua aplicação explícita espera a próxima atualização com um `UIGlassEffect`.

**Ownership.** O pacote faz o mapeamento de três valores; o sistema resolve traits e a aparência do material. Não há storage de tema, escuta própria de preferências ou transformação de cores dos filhos. Props inválidas passam pelo tratamento padrão do decoder Expo, sem recuperação específica neste módulo.

**Evidências.** [`GlassColorScheme` e prop, L22–46](../artifacts/package/src/GlassView.types.ts#L22), [`Prop("colorScheme", .auto)`, L59–61](../artifacts/package/ios/GlassEffectModule.swift#L59), [`toUIUserInterfaceStyle`, L35–49](../artifacts/package/ios/GlassStyle.swift#L35), [`setColorScheme`, L287–292](../artifacts/package/ios/GlassView.swift#L287), [`updateEffect`, L330–334](../artifacts/package/ios/GlassView.swift#L330).

<a id="f07"></a>
#### F07 — Cantos individuais, RTL e borderCurve

**Uso.** Use `style` de `View` com `borderRadius`, raios físicos por canto ou raios lógicos `Start`/`End`. `borderCurve` acompanha a curva da camada externa. O pacote registra as props de raios nativas para sincronizar a superfície interna, além da geometria externa controlada pelo framework.

```tsx
style={{
  borderRadius: 12,
  borderTopStartRadius: 24,
  borderTopLeftRadius: 8,
}}
```

Nesse exemplo, o canto superior esquerdo resolve para `8` tanto em LTR quanto em RTL; o físico prevalece sobre o lógico e sobre o global.

**Caminho.** O módulo registra o raio global, quatro físicos e quatro lógicos. Cada setter armazena um `CGFloat?`, compara o valor anterior e chama `updateBorderRadius()`. Esse método verifica a API, consulta `RCTI18nUtil.sharedInstance()?.isRTL() ?? false` e resolve cada canto pela tabela abaixo. Valores físicos têm precedência sobre lógicos; `0` explícito também vence os fallbacks.

| Canto final | LTR | RTL |
|---|---|---|
| Superior esquerdo | `topLeft ?? topStart ?? global ?? 0` | `topLeft ?? topEnd ?? global ?? 0` |
| Superior direito | `topRight ?? topEnd ?? global ?? 0` | `topRight ?? topStart ?? global ?? 0` |
| Inferior esquerdo | `bottomLeft ?? bottomStart ?? global ?? 0` | `bottomLeft ?? bottomEnd ?? global ?? 0` |
| Inferior direito | `bottomRight ?? bottomEnd ?? global ?? 0` | `bottomRight ?? bottomStart ?? global ?? 0` |

Os quatro valores viram `UICornerRadius(floatLiteral:)`, usados em `glassEffectView.cornerConfiguration = .corners(...)`. O pacote não desenha uma máscara ou arredondamento por shader. `setBorderCurve(_: String?)` **ignora o argumento recebido** e copia `self.layer.cornerCurve` para a camada interna; depende de o framework aplicar o estilo à camada externa. `updateEffect()` repete a sincronização de raios e curva ao reaplicar material.

**Limites e ownership.** O cálculo local usa direção RTL global do React e não consulta `layoutDirection` por view nem política separada de troca esquerda/direita. Não há clamp próprio dos raios. A assinatura `CGFloat?` não estabelece suporte a strings percentuais, mesmo que outros estilos React Native possam aceitá-las. Uma mudança global de RTL sem nova prop/atualização não provoca recálculo por observador local; recriação da árvore pelo framework pode resolver isso, mas não foi testada.

**Evidências.** [`props de bordas`, L63–101](../artifacts/package/ios/GlassEffectModule.swift#L63), [`updateBorderRadius`, L122–160](../artifacts/package/ios/GlassView.swift#L122), [`setters de raios e curva`, L205–269](../artifacts/package/ios/GlassView.swift#L205), [`reaplicação`, L334–336](../artifacts/package/ios/GlassView.swift#L334).

<a id="f08"></a>
#### F08 — GlassContainer, fusão e spacing

**Uso.** Agrupe superfícies dentro de `GlassContainer`. `spacing` controla a distância de influência entre materiais; `gap`, margem e posições continuam sendo decisões de layout React Native. Não há fusão calculada pelo JavaScript.

```tsx
<GlassContainer spacing={12} style={{ flexDirection: 'row', gap: 8 }}>
  <GlassView style={{ width: 56, height: 56, borderRadius: 28 }} />
  <GlassView style={{ width: 56, height: 56, borderRadius: 28 }} />
</GlassContainer>
```

**Caminho.** `requireNativeView('ExpoGlassEffect', 'GlassContainer')` fornece a classe registrada no módulo. O construtor Swift instala uma `UIVisualEffectView` com autoresizing, inicialmente sem efeito. Filhos são montados em `containerEffectView.contentView`. A prop chama `setSpacing(CGFloat?)`; se o valor difere do cache, o método atualiza o cache, exige compilador/SO compatíveis e existência de `UIGlassContainerEffect`, cria novo efeito, define `effect.spacing` quando o argumento não é `nil` e atribui o efeito à view e ao cache `containerEffect`.

**Caso importante de inicialização.** O default público é `undefined`. O campo `containerSpacing` inicia `nil`, e não há construção do efeito no `init`. Se o primeiro argumento de `setSpacing` também for `nil`, a comparação `containerSpacing != spacing` é falsa e **esse caminho não constrói `UIGlassContainerEffect`**. Isso é confirmado pelo fluxo estático; a conclusão de que a fusão ficará visualmente ausente ainda é uma hipótese, pois a ponte e os pixels não foram observados. Um número explícito, como no exemplo, toma o ramo que constrói o efeito. Depois de um número para `nil`, o valor muda e o efeito novo usa o default UIKit.

**Limites e ownership.** Cada mudança aceita cria novo objeto; não há animação própria, normalização, clamp ou medição de distâncias. O gate do container testa a classe, sem o selector `effectWithStyle:` usado para `UIGlassEffect`. O helper público de API verifica apenas esta última classe e não prova a disponibilidade independente do container. O UIKit executa fusão/composição; o pacote fornece a hierarquia e `spacing`. O container não possui o monitor de alpha e os callbacks de recuperação específicos da `GlassView`; essa diferença de código não prova falha.

**Evidências.** [`GlassContainerProps`, L4–12](../artifacts/package/src/GlassContainer.types.ts#L4), [`wrapper`, L9–14](../artifacts/package/src/GlassContainer.ios.tsx#L9), [`registro`, L104–108](../artifacts/package/ios/GlassEffectModule.swift#L104), [`GlassContainer` completo, L5–55](../artifacts/package/ios/GlassContainer.swift#L5).

<a id="lifecycle"></a>
### Ciclo de vida e recuperação

O estado de montagem controla **quando atribuir** o efeito UIKit e quando tentar novamente. Não há banco, evento de sucesso visual, verificação de framebuffer ou contador de frames renderizados. Props permanecem nos campos da instância durante saídas e reentradas na janela.

<a id="f09"></a>
#### F09 — Layout, janela e remontagem

**Uso.** É automático ao inserir, navegar, remover ou reapresentar a view; não há método público `mount()`/`refresh()`. O app fornece layout e props normalmente. Reentrada com a mesma geometria é tratada explicitamente.

**Caminho.** `didMoveToWindow()` chama `setNeedsLayout()` quando há janela. `layoutSubviews()` chama `super`, retorna se `isMounted` ou se a API está ausente, e decide entre instalar e aguardar visibilidade. `installEffect()` marca `isMounted=true`, invalida a espera, atribui um `UIVisualEffect()` vazio para limpar estado anterior e chama `updateEffect()`.

```text
didMoveToWindow:
  se saiu da janela: isMounted = false; parar espera
  senão: solicitar layout
layoutSubviews:
  super.layoutSubviews()
  se isMounted ou API ausente: retornar
  se renderizável: isMounted = true; parar espera; limpar; updateEffect()
  senão: iniciar espera, se ainda não existir
```

**Precisão importante.** Os comentários dizem que o efeito precisa ser criado no layout. O código efetivamente concentra a **instalação/reaplicação** no layout, mas `UIGlassEffect(style:)` também pode ser construído antes, dentro do setter de estilo. Não se deve descrever esse código como se todo construtor só pudesse rodar em `layoutSubviews`. `isMounted` apenas registra que `installEffect()` foi executado: sem um `UIGlassEffect` guardado, `updateEffect()` não atribui material novo.

**Ownership e limites.** Expo/React Native e UIKit disparam os callbacks; o pacote agenda layout e preserva caches para reentrada. Não há retry temporizado para API ausente, mensagem de erro ou fallback de carregamento do módulo. Navegação real, ordem de entrega inicial das props e efeito após reentrada dependem do runtime e não foram observados.

**Evidências.** [`layoutSubviews`, L54–64](../artifacts/package/ios/GlassView.swift#L54), [`installEffect`, L87–95](../artifacts/package/ios/GlassView.swift#L87), [`construção no setter`, L178–181](../artifacts/package/ios/GlassView.swift#L178), [`didMoveToWindow`, L303–316](../artifacts/package/ios/GlassView.swift#L303), [`updateEffect`, L318–340](../artifacts/package/ios/GlassView.swift#L318).

<a id="f10"></a>
#### F10 — Instalação após fade, alpha baixo e hidden

**Uso.** O mecanismo é automático quando a view entra na janela oculta ou com opacidade baixa e depois aparece. O aplicativo não configura o limiar. Para transições de material, F03 evita depender de animação de opacidade do vidro.

**Caminho.** `isEffectRenderable` exige `window != nil`. Percorre `self` e todos os ancestrais; qualquer `isHidden` retorna `false`. Multiplica os `alpha` da cadeia e exige produto **estritamente maior que `0.02`**. Logo `0.02` exato continua sem instalação. O código não exige dimensões maiores que zero nem examina oclusão por outra view.

Se a condição falha no layout, `waitForVisibility()` cria no máximo um `CADisplayLink`, adicionado ao run loop principal em modo `.common`. A cada tick, se renderizável, `onVisibilityTick()` chama `setNeedsLayout()`. A aplicação ocorre no layout subsequente, não diretamente no callback do display link. `WeakDisplayLinkProxy` guarda a view com referência fraca, evitando ciclo de retenção. Instalação, saída da janela e `deinit` invalidam o link.

**Calibração e custo.** O comentário diz que `0.02` foi escolhido por tentativa em hardware e deve ser retestado em vários dispositivos se mudar. É heurística do pacote, não garantia da API Apple. A checagem custa uma caminhada pelos ancestrais a cada tick enquanto espera; views anexadas e permanentemente ocultas podem continuar aguardando sem timeout ou backoff. Não há medição de FPS, GPU, consumo ou limite próprio de taxa.

**Limites e ownership.** Após a primeira instalação, o link para e `layoutSubviews()` retorna por `isMounted`; o pacote não monitora continuamente fades posteriores sem sair da janela. Setters podem chamar `updateEffect()` enquanto a view montada tem alpha baixo, pois esse método não repete o teste de visibilidade. A recuperação nesses cenários depende de UIKit e requer teste real. O pacote controla a espera; o SO controla quando o material se torna renderizável e seus pixels.

**Evidências.** [`isEffectRenderable`, L66–85](../artifacts/package/ios/GlassView.swift#L66), [`display link e invalidação`, L97–120](../artifacts/package/ios/GlassView.swift#L97), [`WeakDisplayLinkProxy`, L350–361](../artifacts/package/ios/GlassView.swift#L350), [`CHANGELOG 58.0.2`, L21–25](../artifacts/package/CHANGELOG.md#L21).

<a id="f11"></a>
#### F11 — Limpeza antes da reciclagem do pai, correção 58.0.5

**Uso.** Recuperação automática em navegação/reciclagem de views. A release 58.0.5 descreve o caso de um vidro anterior cujo pai é reaproveitado como conteúdo de um novo vidro, que depois aparece por fade. Não há configuração para habilitar a correção.

**Caminho.** Antes de sair da janela, `willMove(toWindow: nil)` chama `super` e atribui `UIVisualEffect()` à view interna. O comentário informa que remover vidro com efeito vivo deixava estado no superview capaz de impedir um vidro posterior. Após sair, `didMoveToWindow()` reseta `isMounted` e invalida o display link. Na reentrada, solicita layout; quando visível, `installEffect()` limpa novamente a atribuição anterior e reaplica o material a partir dos caches.

**Separação de responsabilidades.** O pacote executa a limpeza antes da remoção e a reinstalação. A reciclagem da árvore é de React Native/Expo, e o estado interno que o UIKit mantém sobre composição não foi inspecionado. A descrição do problema vem do changelog e dos comentários da release, corroborada pela presença desses callbacks; não é um diagnóstico reproduzido neste ambiente.

**Limites e preservação.** A limpeza não apaga o conteúdo React, o estilo escolhido, tint, interação, esquema ou raios da instância. Não há chamada a cache global, flush gráfico ou API privada. A atribuição vazia é deliberada; substituí-la por `nil`, omiti-la ou movê-la para depois da remoção altera a sequência documentada. O container não implementa o mesmo callback específico.

**Evidências.** [`willMove(toWindow:)`, L294–301](../artifacts/package/ios/GlassView.swift#L294), [`didMoveToWindow`, L303–316](../artifacts/package/ios/GlassView.swift#L303), [`installEffect`, L87–95](../artifacts/package/ios/GlassView.swift#L87), [`CHANGELOG 58.0.5`, L3–7](../artifacts/package/CHANGELOG.md#L3).

**Lacuna de confirmação.** É necessário um app iOS compilado com esta release, navegação/reciclagem sintética e captura antes/depois para confirmar o efeito visível dessa correção e diferenciá-lo do gate de opacidade de F10. Nenhuma execução UIKit foi realizada.
