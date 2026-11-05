# Reconstrução web de Expo GlassEffect 58.0.5

## Escopo e decisões

O destino continha somente a investigação, sem aplicativo, dependências, testes ou AGENTS.md. A implementação cria a biblioteca React `@expo-glass-rea/react` e um playground Vite na rota `/`; uma fixture Next.js valida SSR/hidratação. Fontes e evidências originais permanecem intactas.

Preservar nomes de componentes/helpers, props de material, filhos, mudanças de estado e ref. Adaptar ViewProps a atributos DOM/CSS e refs a HTMLDivElement. Recursos UIKit são substituídos por backdrop-filter e máscara SVG aproximada, sem promessa de paridade de pixels. Não copiar o bug hipotético de spacing omitido: default web 20px, zero desliga fusão. Não há IPA/runtime Apple novo para resolver F20; as fontes disponíveis já delimitam essa lacuna.

## Requisitos verificáveis

| ID / evidência | Entrada e pré-requisitos | Estados/saída esperada e falhas | Entrada no destino / verificação planejada |
|---|---|---|---|
| [F01](reverse-engineering-report.md#f01) | GlassView; DOM React + CSS | Filhos nítidos, decoração separada, mount/unmount sem perder handlers | Export e `/`; DOM/ref/filhos no navegador |
| [F02](reverse-engineering-report.md#f02) | regular/clear/none | Default regular; none mantém filhos; inválido recupera regular | GlassView; testes de estado e pixels |
| [F03](reverse-engineering-report.md#f03) | Config animate/duration em segundos | CSS transition; mesmo estilo não reinicia; duração inválida usa default seguro | Controle de animação; estilos computados/frames |
| [F04](reverse-engineering-report.md#f04) | Cor CSS, dinâmica ou semantic | Tint preservado em none; variantes light/dark; sem RN obrigatório | Swatches; navegador e SSR |
| [F05](reverse-engineering-report.md#f05) | isInteractive | Realce hover/focus/active; sem virar botão automaticamente | Checkbox e superfície com botão filho; pointer/teclado |
| [F06](reverse-engineering-report.md#f06) | auto/light/dark | Tema herdado/sistema ou override local, sem storage | Seletor; media e DOM |
| [F07](reverse-engineering-report.md#f07) | Raios físicos/lógicos/zero/dir/curva | Físico > lógico > uniforme; RTL local; CSS rounding | Raios/assimetria/RTL; computed style |
| [F08](reverse-engineering-report.md#f08) | Container; spacing distinto de gap | Material combinado aproximado; resize/move/remove atualizam máscara | Grupo de círculos; máscara e screenshots |
| [F09](reverse-engineering-report.md#f09) | Inserção/reentrada | Renderiza novamente sem refresh imperativo | Botão mount; browser |
| [F10](reverse-engineering-report.md#f10) | Opacity/hidden do ancestral | Reaparece após fade/hidden; CSS nativo dispensa loop 0.02 UIKit | Opacity e hidden; browser |
| [F11](reverse-engineering-report.md#f11) | Desmontar/recriar | Nenhum observer/RAF sobrevivente; material restaurado | Remount/StrictMode; browser |
| [F12](reverse-engineering-report.md#f12) | Helper síncrono | false no SSR; no browser indica capacidade web, independente de ajustes | API exportada/indicador; SSR/browser |
| [F13](reverse-engineering-report.md#f13) | CSS.supports | backdrop-filter ou prefixo; sem user-agent detection | API exportada; unsupported simulado |
| [F14](reverse-engineering-report.md#f14) | Browser sem filtro | Superfície opaca legível; filhos/ref/handlers preservados | CSS fallback; browser simulado |
| [F15](reverse-engineering-report.md#f15) | HTML attributes/ref/eventos/children | Sem props privadas vazando ao DOM; sem roubar semântica/foco | Teclado/ref/ARIA no browser |
| [F16](reverse-engineering-report.md#f16) | Entradas ESM/types/CSS | Quatro exports runtime e tipos; use client; SSR seguro | Pacote real e Next fixture |
| [F17](reverse-engineering-report.md#f17) | Instalação npm + import CSS | Build lib/app e empacotamento reproduzíveis; sem Pods/SPM web | npm build/pack/Next build |
| [F18](reverse-engineering-report.md#f18) | Playground padrão | Controles do demo acessíveis, drag, composição e lifecycle | Rota `/`; E2E desktop/mobile |
| [F19](reverse-engineering-report.md#f19) | Prefers reduced motion/transparency/forced colors | Menos animação, superfície opaca/alto contraste; flags ainda indicam API | CSS media; browser emulado |
| [F20](reverse-engineering-report.md#f20) | Internos UIKit não disponíveis | Material CSS/SVG aproximado, sem reprodução dos shaders Apple | Aparência web validada; pixels iOS pendentes |

Resultados, comandos e diferenças finais serão registrados após implementação e testes.

## Evolução óptica (2026-11-04)

A implementação preserva este caminho CSS/SVG e acrescenta um renderer WebGL2 opcional, carregado sob demanda, sobre uma fonte de fundo explícita. A matriz anterior registra a reconstrução inicial, não refração do DOM. O trabalho atual está na [matriz de baseline](optical-feature-matrix.md), [investigação UIKit](uikit-renderer-study.md), [derivação matemática](optical-rendering-model.md), [arquitetura](web-renderer-architecture.md) e [fidelidade e validação](liquid-glass-fidelity.md). O laboratório está em `/lab`; auditoria e simulador fornecidos pelo usuário foram preservados.
