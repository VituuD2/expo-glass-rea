---
title: "Liquid Glass: auditoria físico-matemática e computacional do expo-glass-rea"
subtitle: "Comparação com o material nativo da Apple e plano de evolução da implementação web"
author: "Análise técnica independente"
date: "4 de novembro de 2026"
lang: pt-BR
---

# Resumo executivo

**Conclusão:** o projeto [VituuD2/expo-glass-rea](https://github.com/VituuD2/expo-glass-rea) é uma adaptação de componentes do Expo GlassEffect para **React/Next.js na web**. Ele implementa uma API reconhecível, controles de estilos/cores/temas, material translúcido com CSS e fusão geométrica aproximada por SVG. **Não implementa refração espacial da imagem de fundo, modelo de iluminação física, normal de superfície, Fresnel espacialmente variável, dispersão cromática, nem adaptação automática do material à imagem atrás da superfície.** A proximidade com a Apple é, portanto, superior na camada de interface e inferior na camada óptica e de movimento.

Não existe base científica suficiente para atribuir uma nota absoluta de "porcentagem de fidelidade" sem capturas pareadas em hardware e metodologia perceptual. Qualquer percentual abaixo constitui apenas avaliação qualitativa por funcionalidade, não medição de pixels. **A principal lacuna é arquitetural, não um pequeno ajuste de blur.**

# 1. Escopo, evidência e limites

- Repositório público na branch `main`, consultado em 04/11/2026. Arquivos de implementação inspecionados: `src/GlassView.tsx`, `src/GlassContainer.tsx`, `src/styles.css`, `src/geometry.ts`, `src/options.ts`, `src/capabilities.ts`, `src/types.ts`, `package.json`, `README.md` e `docs/reconstruction.md`.
- A documentação do próprio repositório, `docs/reverse-engineering-report.md`, descreve separadamente o estudo do pacote oficial `expo-glass-effect@58.0.5`. **Esse estudo do pacote oficial não equivale a reproduzir seu renderizador UIKit.**
- A análise é **estática** do repositório público; não se compilou nem executou o clone local, pois o ambiente não permitiu obter o repositório por Git. Não se executou o pacote em Safari, Android, iPhone ou iOS 26, nem se fez captura comparativa do material proprietário.
- Foi examinado, separadamente, o arquivo `simulador_liquid_glass.html` criado na conversa anterior, disponível neste ambiente. Ele usa WebGL2 e shader GLSL para refração aproximada, ao contrário da biblioteca auditada. **Nenhum dos dois reproduz comprovadamente o compositor interno da Apple.**
- Apple descreve publicamente resultados visuais, mas não todos os kernels, passes, shaders, heurísticas e parâmetros internos. Observáveis e hipóteses são claramente distinguidos.

# 2. O que a Apple documenta sobre Liquid Glass

O [vídeo oficial WWDC25 — Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/) descreve material digital com **lensing** (distorção de lente), refração e concentração de luz, reflexos especulares dependentes de geometria, sombras adaptativas conforme o conteúdo atrás, alteração de aparência para legibilidade, variações Regular/Clear, reação iluminada ao toque e transformação fluida de formas. Vidros maiores aparentam ser mais espessos e refratar mais fortemente. A mesma apresentação explica acessibilidade: transparência reduzida, contraste elevado e movimento reduzido.

Esses são **comportamentos anunciados e demonstrados**; não está comprovado que o UIKit resolva fielmente equações de Maxwell ou transporte completo de luz por ray tracing físico. A expressão 'material óptico' descreve a aparência e o sistema de renderização, não necessariamente um simulador físico integral.

O [`expo-glass-effect` oficial](https://docs.expo.dev/versions/latest/sdk/glass-effect/) usa `UIVisualEffectView`/`UIGlassEffect` no iOS 26+ e `GlassContainer` com efeito de composição nativa. Fora das plataformas suportadas, seu `GlassView` pode recair para uma view convencional. A implementação auditada é **outra biblioteca para DOM** e seus helpers testam suporte CSS, não a API do UIKit.

# 3. Estudo de óptica geométrica: propriedades necessárias

## 3.1 Lei de Snell e inclinação do raio

Para índices $n_1,n_2$, ângulo de incidência $\theta_i$ e ângulo transmitido $\theta_t$:

$$n_1\sin(\theta_i)=n_2\sin(\theta_t).$$

Na interface computadorizada, o objetivo típico é simular uma *mudança de coordenadas de amostragem*: o pixel de saída $(u,v)$ lê o fundo em $(u+\Delta u,v+\Delta v)$, onde o deslocamento depende da normal $\mathbf N$, índice efetivo e espessura óptica. Se não há deslocamento espacial, há transparência/blur, **mas não refração de imagem no sentido geométrico**.

Para $n_1=1$, $n_2=1{,}5$, incidência de $45^\circ$, temos:

$$\theta_t=\arcsin(\sin 45^\circ/1{,}5)\approx28{,}13^\circ.$$

Em uma *lâmina plano-paralela física*, com espessura $t=2\,\mathrm{mm}$, o deslocamento lateral do feixe seria:

$$d=t\frac{\sin(\theta_i-\theta_t)}{\cos\theta_t}\approx0{,}658\,\mathrm{mm}.$$

**Cuidado:** isso demonstra o fenômeno em vidro real e não define o número de pixels que o iOS desloca. Uma lente de UI tem geometria aparente e câmeras/planos de amostragem virtuais. Transformar milímetros em pixels sem essas premissas seria inválido.

## 3.2 Normais de superfície e campo de refração

Defina a geometria da superfície por uma função de altura $h(x,y)$. Sua normal simplificada é:

$$\mathbf N(x,y)=\frac{(-\partial_x h,-\partial_y h,1)}{\sqrt{1+(\partial_xh)^2+(\partial_yh)^2}}.$$

Um shader pode obter a direção transmitida com `refract(I, N, n1/n2)` e projetar sua componente lateral em um mapa de deslocamento $\mathbf D(x,y)$. Então:

$$C_{\mathrm{refr}}(x,y)=B\big(x+D_x(x,y),\;y+D_y(x,y)\big).$$

A variação de $\mathbf D$ ao longo da borda curva produz o efeito de *lensing*. Uma aproximação bidimensional útil usa uma SDF (signed distance field) de retângulo arredondado, uma altura ou perfil óptico suave e derivadas espaciais. A SDF e a superfície devem ser recomputadas para a união de componentes quando há fusão.

## 3.3 Fresnel e reflexos

Para incidência normal, a refletância aproximada entre dielétricos não absorventes é:

$$F_0=\left(\frac{n_1-n_2}{n_1+n_2}\right)^2.$$

Com ar/vidro $1/1{,}5$, $F_0=0{,}04$ (4%). Uma aproximação visual barata é Schlick:

$$F(\theta)\approx F_0+(1-F_0)(1-\cos\theta)^5.$$

Ela não é exata. A refletância Fresnel média exata de luz não polarizada em $45^\circ$ é aproximadamente **5,02%**, enquanto Schlick estima **4,21%**. Em $60^\circ$, a exata é aproximadamente **8,92%**, e Schlick prevê **7,00%**. Para UI, o modelo de Schlick pode ser suficiente, mas o parâmetro visual deve ser calibrado.

O brilho especular exige também direção de iluminação, campo normal, rugosidade e função de distribuição angular (por exemplo, GGX em um modelo microfacetado); um `box-shadow` estático não satisfaz essa física. Um modelo mínimo pode usar `dot(N,L)`, termo Fresnel e iluminação especular com resposta ao ponteiro.

## 3.4 Dispersão, transmitância e absorção

Em um dielétrico real, o índice $n(\lambda)$ varia com o comprimento de onda $\lambda$. Uma versão de shader pode aproximar a dispersão amostrando R/G/B com deslocamentos levemente diferentes. **A dispersão cromática não é requisito demonstrado para toda variação do material da Apple** e deve ser muito sutil, para evitar franjas artificiais.

A transmitância de um vidro colorido pode ser aproximada pela lei de Beer-Lambert:

$$T(\lambda)=e^{-\sigma_a(\lambda)\ell}.$$

Na UI, cores/tints são funções perceptuais estilizadas, e a Apple descreve comportamento adaptativo ao brilho do fundo; uma aplicação literal de Beer-Lambert não bastaria para reproduzi-lo.

## 3.5 Desfoque não é deslocamento

Um Gaussian blur calcula uma convolução:

$$C_{\mathrm{blur}}(x,y)=\iint G_\sigma(\xi,\eta)B(x-\xi,y-\eta)\,d\xi d\eta.$$

Ele elimina frequências espaciais altas e suaviza contornos. **Não entorta a posição central de um traço reto.** Esse é o diagnóstico visual mais simples para separar glassmorphism de lente refrativa.

# 4. Auditoria do repositório: implementação observada

## 4.1 `src/GlassView.tsx`

A React view emite um `div`, um `span` decorativo e os filhos de DOM. Traduz propriedades `glassEffectStyle`, `colorScheme`, `tintColor`, `isInteractive` para atributos `data-*` e variáveis CSS. Isso conserva filhos/refs/handlers, usa `forwardRef<HTMLDivElement>` e implementa separação de efeitos e conteúdo. **Não cria canvas, textura, shader, pipeline WebGL/WebGPU ou geometria óptica.** Fonte: [GlassView.tsx](https://raw.githubusercontent.com/VituuD2/expo-glass-rea/main/src/GlassView.tsx).

## 4.2 `src/styles.css`

`regular`: `backdrop-filter: blur(18px) saturate(160%)`, superfície translúcida e sombras de borda. `clear`: `blur(5px) saturate(125%)`, superfície mais transparente. A coloração usa valores CSS e variantes de tema. `isInteractive` altera `box-shadow` em hover/focus e `background-color` em `:active`; não há reconstrução de normais, refração ou iluminação de fonte pontual dinâmica. `transition-property` cuida de opacidade/cor/filtro, mas não de deformação física. Fonte: [styles.css](https://raw.githubusercontent.com/VituuD2/expo-glass-rea/main/src/styles.css).

## 4.3 `src/GlassContainer.tsx` e `src/geometry.ts`

O container mede caixas via `getBoundingClientRect`, usa `ResizeObserver`/`MutationObserver`, gera caminhos de retângulos arredondados e máscara SVG com `feGaussianBlur` e `feColorMatrix` no alfa. A matriz tem última linha `0 0 0 18 -6`, equivalente a $\alpha'=18\alpha-6$ antes de limitar o resultado: limiar significativo em $\alpha\approx1/3$. Isso cria conexões *gooey/metaball* entre shapes próximos. É **fusão de silhueta/transparência**, não fusão física de lentes. As caixas estão alinhadas aos eixos; rotações, inclinações e bordas elípticas não são modeladas geometricamente. Fontes: [GlassContainer.tsx](https://raw.githubusercontent.com/VituuD2/expo-glass-rea/main/src/GlassContainer.tsx) e [geometry.ts](https://raw.githubusercontent.com/VituuD2/expo-glass-rea/main/src/geometry.ts).

## 4.4 API, cores e compatibilidade

A API oferece `GlassView`, `GlassContainer`, estilos `regular`/`clear`/`none`, duração de animação, tint dinâmico, esquema de cores, cantos lógicos/físicos, ref DOM e `spacing`. Há tratamento de redução de movimento, transparência, contraste e forced-colors via CSS. Em `capabilities.ts`, ambos `isLiquidGlassAvailable()` e `isGlassEffectAPIAvailable()` retornam a detecção de `CSS.supports('backdrop-filter', ...)`. **Isso sinaliza capacidade web de blur, não Liquid Glass nativo nem capacidade refrativa.** Fontes: [types.ts](https://raw.githubusercontent.com/VituuD2/expo-glass-rea/main/src/types.ts), [options.ts](https://raw.githubusercontent.com/VituuD2/expo-glass-rea/main/src/options.ts), [capabilities.ts](https://raw.githubusercontent.com/VituuD2/expo-glass-rea/main/src/capabilities.ts).

## 4.5 Matriz de efeitos

| Efeito | expo-glass-rea (implementado) | Apple (documentado) | Lacuna |
|---|---|---|---|
| Desfoque | CSS blur 18px/5px | Desfoque e scattering fazem parte do material | Ajuste de aparência, calibragem |
| Translucidez | RGBA/CSS | Material dinâmico, várias camadas | Médio |
| Refração geométrica | Não encontrada | Lensing/refraction | **Crítico** |
| Normal/curvatura óptica | Não encontrada | Destaques ligados à geometria aparente | **Crítico** |
| Reflexos | Box-shadow/borda estáticos | Especulares e luz dinâmica | Alto |
| Fresnel espacial | Não encontrado | Efeito de luz dependente de bordas/ângulos, sem modelo interno divulgado | Alto |
| Fusão | Máscara SVG com blur/limiar alfa | Fusão nativa de objetos GlassContainer | Médio/alto |
| Toque | Estados CSS hover/focus/active | Resposta iluminada, gel-like | Alto |
| Metamorfose de shape | CSS/DOM/transições básicas | Material flui e adapta propriedades | Alto |
| Adaptação local ao fundo | Tema de sistema e preferências CSS | Sombras/tint/contraste analisam fundo | Alto |
| Acessibilidade | Media queries e fallback | Integração nativa no sistema | Parcial |
| React/Next | Biblioteca e fixture | API nativa não diretamente web | **Ponto forte do projeto** |

Esta tabela registra presença de mecanismos no código, não scores quantitativos de semelhança visual.

# 5. Comparação com o simulador óptico produzido anteriormente

O arquivo `simulador_liquid_glass.html` contém shader GLSL ES 3.00: função SDF `sdRoundRect`, perfil `heightGlass`, derivadas de altura por diferenças centrais, normal `normalize(vec3(-sx*19,-sy*19,1))`, `refract(incident,normal,1/ior)`, deslocamento `displacement`, amostragem do fundo na nova posição, dispersão cromática de três canais e Schlick/Fresnel. Também oferece sliders de $n$, espessura, blur, reflexo e dispersão, além de mapa de distorção e alternativa por CPU.

Comparação: o **simulador ganha na presença de um campo refrativo**, e o **repositório ganha na API React, composição DOM, acessibilidade declarativa, testes de integração e extensibilidade de produto**. O shader do simulador **também é estilizado**: o fator `75.0` converte a direção em deslocamento de pixels sem calibração física de distâncias reais; amostras de textura e superfícies usam aproximação unilaminar; não há traçado rigoroso de entrada/saída de uma lente espessa. Portanto, não seria cientificamente correto afirmar que o simulador é simplesmente "fisicamente verdadeiro" ou "mais fiel à Apple" em todas as dimensões.

# 6. Desafio computacional: renderizar o que existe atrás do DOM

Um shader de refração precisa ler uma textura que represente o conteúdo atrás do vidro. Essa é a diferença arquitetural mais difícil em aplicativos React/Next:

1. **CSS `backdrop-filter`** consegue aplicar blur/saturação ao plano de fundo composto pelo navegador; porém não fornece um texture handle WebGL do DOM, nem cria deslocamento refrativo automaticamente.
2. **Filtros SVG de deslocamento** (`feDisplacementMap`) podem alterar pixels; podem ser avaliados em uma prova de conceito com `backdrop-filter: url(#...)`, mas o suporte interoperável de filtros SVG de backdrop exige testes por navegador. Não é seguro assumir paridade Chrome/Safari/Firefox.
3. **Compositor controlado via WebGL/WebGPU** produz o deslocamento correto sobre imagens/cenas que a aplicação também controla como texturas. Para conteúdo DOM arbitrário e dinâmico, é necessária captura/espelhamento de conteúdo, duplicação sincronizada de camadas ou integração especializada; não existe acesso universal, barato e contínuo à imagem já composta atrás de um elemento DOM.
4. **Estratégia híbrida** mantém HTML/React para acessibilidade/ações e usa superfícies óticas GPU sobre fundos conhecidos (imagens, mídia, canvas) com um modo CSS para todo o restante.

A API atual de `GlassView` pode ser mantida e receber um **backend de renderização** ou um componente `RefractiveGlassView` explícito. Evite expor `isLiquidGlassAvailable()` como se confirmasse capacidade óptica: crie checks distintos para blur CSS, filtro de deslocamento suportado, WebGL2/WebGPU e fonte de backdrop disponível.

# 7. Arquitetura-alvo proposta

```text
React/Next GlassView, GlassContainer (API existente)
  |
  +-- Seleção de backend e capacidades
        |
        +-- CSS standard       -> blur/tint/máscara, fallback acessível
        |
        +-- SVG displacement   -> refração leve, se teste de navegador passar
        |
        +-- GPU WebGL/WebGPU   -> lente com normais/SDF, Fresnel, distorção,
                                 composição óptica e interações dinâmicas
```

Para backend GPU, ordem de cálculo sugerida:

1. Rasterização ou obtenção **consistente e atualizada** da textura de fundo.
2. Construção do campo de distância assinado $d(x,y)$ para uma ou mais formas.
3. Perfil óptico $h(d,\mathrm{size},\mathrm{state})$ e normais $\mathbf N$.
4. Vetores refratados, amostragem deslocada e opcional blur.
5. Fresnel, highlights, shadow field, iluminação e tint adaptativo.
6. Composição com conteúdo DOM sem deformar texto/ícones do próprio botão.
7. Controle temporal: transição de forma, reação ao pointer/touch, redução de movimento.

Um modelo mínimo de cor (apenas proposta de engenharia) é:

$$C_{out} = M\left[(1-F)T\,C_{bg}(\mathbf x+\mathbf D) + F\,C_{env} + C_{spec}\right]+(1-M)C_{bg}(\mathbf x),$$

onde $M$ é a máscara de lente, $T$ transmitância, $F$ Fresnel, $C_{env}$ iluminação aproximada e $C_{spec}$ brilho especular. Essa equação **não foi extraída de código Apple**.

## Adaptação ao fundo

Uma estratégia robusta não consiste em alternar um componente inteiro de claro para escuro a cada pixel. Deve estimar luminância local por área, com histograma reduzido/texture mipmap, contrastes e **histerese temporal** para evitar piscadas. A luminância linear pode ser calculada por $Y=0.2126R+0.7152G+0.0722B$ após conversão sRGB para linear. A escolha do texto deve priorizar acessibilidade e estabilidade visual; material `clear` deve ter opção de dimming quando a legibilidade exigir.

## Fusão de materiais

Em vez de usar apenas a máscara gooey, calcular **SDF de união suave**, por exemplo smooth-min, e gerar normais pela geometria resultante. Isso permite que a zona de conexão também refrate o fundo e participe do brilho. O parâmetro de `spacing` deve atuar na influência geométrica e não apenas no raio do blur de alfa. SDF de união suave é um modelo aproximado, e sua parametrização deve ser calibrada por imagens de referência.

# 8. Desempenho e métricas

O orçamento total de quadro é **16,67 ms para 60 Hz** e **8,33 ms para 120 Hz**; isso não é orçamento exclusivamente do efeito, porque layout, pintura, composição e JS também consomem tempo. Um buffer RGBA8 de 1170 x 2532 pixels ocupa aproximadamente **11,85 MB** brutos; várias texturas, passes e buffers elevam o consumo.

Soluções de otimização: limitar cálculo às regiões de vidro, render targets de resolução adaptativa, pré-calcular campos SDF estáveis, reduzir taps de blur, shader variants por plataforma, evitar leituras GPU->CPU, aproveitar eventos `ResizeObserver` em vez de recomputar geometria continuamente, pausar quando offscreen, e medir performance em aparelhos medianos.

**Nenhum FPS, consumo de GPU, memória ou equivalência visual real do repositório foi medido nesta auditoria.** Os números anteriores são orçamentos/estimativas matemáticas, não benchmark da implementação.

# 9. Plano de evolução priorizado

| Prioridade | Trabalho | Aceite técnico objetivo |
|---|---|---|
| P0 | Baseline controlada | Capturas de Chrome/Safari/Firefox e iOS 26, mesmas imagens, dimensões, movimento, estados e acessibilidade |
| P0 | Prova de conceito de deslocamento refrativo | Grade reta apresenta curvatura espacial verificável sob lente sem deformar seus rótulos internos |
| P1 | Componente de backend + detecção explícita | React API preservada, fallback previsível por plataforma |
| P1 | SDF + normal + Fresnel | Padrão ótico contínuo em círculos/retângulos; variação coerente com borda e luz |
| P1 | Fusão geométrica refrativa | Sem seam na união; continuidade de máscara e normais |
| P2 | Iluminação e contato | Highlight segue fonte/pointer; movimento reduzido respeitado |
| P2 | Tint/contraste baseado no fundo | Texto legível em gradientes e trechos preto/branco, com histerese |
| P2 | Performance | p95 de frame-time, memória GPU e regressão em dispositivos-alvo, critérios definidos antes do lançamento |
| P3 | Paridade perceptual | Comparação por painel cego/SSIM/LPIPS quando imagens Apple pareadas e direitos de referência permitirem |

**Não comece copiando todos os reflexos da Apple.** Comece com a linha reta por trás do vidro: se não há deformação espacial controlável, a principal ausência permanece.

# 10. Protocolo de testes para medir distância da Apple

- **Cena A (grade):** fundo quadriculado de 1 px e linhas de 2 px, componente sobre bordas; comparar posição dos pontos de cruzamento, e não apenas saturação.
- **Cena B (texto):** letras de alto contraste passando por trás do botão em scrolling; medir deformação, halo, contraste e legibilidade.
- **Cena C (fotografia):** texturas finas e alto contraste para identificar aberração, clipping e diferença de cor.
- **Cena D (fusão):** dois círculos aproximando-se, unindo-se e separando-se, com fundo de grade; observar continuidade de normais e interação.
- **Cena E (toque):** gravação em câmera 60/120 fps da reação do material e comparação quadro a quadro; registrar hardware, OS e configurações de acessibilidade.
- **Cena F (acessibilidade):** aumentar contraste, reduzir transparência/movimento, forçar temas e verificar texto, foco e clique.

Métricas recomendadas: erro de deslocamento da grade por região, índice SSIM/LPIPS em capturas geometricamente registradas, MSE apenas como métrica auxiliar, timing de interação, tempos p50/p95/p99 de frames, dados de profiling e auditoria de acessibilidade. Controle cores/perfil HDR/SDR e escala de device pixel ratio. Percepção humana deve complementar métricas objetivas.

Sem cenas pareadas oficiais não se pode cientificamente declarar "80% fiel" ou "x% distante".

# 11. Veredito

**O repositório já é uma reconstrução utilizável da ergonomia de Expo GlassEffect para React/Next, com aparência glassmorphism. Não é ainda um renderizador web de Liquid Glass opticamente comparável ao nativo.** Sua maior deficiência é a ausência de um mapa de deslocamento espacial do fundo, seguida por iluminação e contraste adaptativos, resposta elástica e fusão de lente física.

A forma mais eficiente de evoluí-lo é **preservar a API, adicionar renderer/backend de refração onde o fundo for controlável, manter CSS como fallback, e construir uma suíte de validação visual/perceptual em dispositivos reais**. Integrar o shader do simulador anterior é um ponto de partida para pesquisa, não uma solução pronta para DOM arbitrário nem garantia de fidelidade à Apple.

# Referências primárias

1. [GitHub — VituuD2/expo-glass-rea](https://github.com/VituuD2/expo-glass-rea)
2. [Fonte GlassView.tsx](https://raw.githubusercontent.com/VituuD2/expo-glass-rea/main/src/GlassView.tsx)
3. [Fonte GlassContainer.tsx](https://raw.githubusercontent.com/VituuD2/expo-glass-rea/main/src/GlassContainer.tsx)
4. [Fonte styles.css](https://raw.githubusercontent.com/VituuD2/expo-glass-rea/main/src/styles.css)
5. [Fonte geometry.ts](https://raw.githubusercontent.com/VituuD2/expo-glass-rea/main/src/geometry.ts)
6. [Fonte capabilities.ts](https://raw.githubusercontent.com/VituuD2/expo-glass-rea/main/src/capabilities.ts)
7. [Reconstrução e limites documentados no repositório](https://github.com/VituuD2/expo-glass-rea/blob/main/docs/reconstruction.md)
8. [Engenharia reversa do pacote Expo](https://github.com/VituuD2/expo-glass-rea/blob/main/docs/reverse-engineering-report.md)
9. [Apple — Meet Liquid Glass (WWDC25)](https://developer.apple.com/videos/play/wwdc2025/219/)
10. [Apple — Platforms State of the Union WWDC25](https://developer.apple.com/videos/play/wwdc2025/102/)
11. [Documentação Expo GlassEffect](https://docs.expo.dev/versions/latest/sdk/glass-effect/)
12. [MDN — backdrop-filter](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter)
