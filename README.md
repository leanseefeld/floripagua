# Água da Grande Florianópolis – visualização 3D e simulação

Visualização 3D (Three.js, imagens de satélite Esri, relevo AWS Terrain Tiles a 34 m no núcleo urbano, cobertura do solo ESA WorldCover) do sistema de abastecimento de água da Grande Florianópolis (Florianópolis, São José, Palhoça, Biguaçu e Santo Amaro da Imperatriz): captações, ETAs, adutoras, reservatórios, elevatórias, zonas de atendimento (partição do tecido urbano por bairro) e ligações prediais imaginárias ("estilo Cities Skylines"), com relevo real e edificações do OpenStreetMap. Inclui um simulador de falhas com a reconstituição do rompimento da adutora de 1.200 mm na BR‑282 (Palhoça) em 31/08/2026 e do processo de recarga gradual da rede após o conserto (02–03/09/2026). Funciona em desktop e celular.

## Rodar

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # gera dist/ (site estático, hospedável em qualquer CDN)
npm run routes     # recalcula traçados estimados (A*) após editar network.json
```

Requer Node ≥ 18. Os dados já processados estão em `public/data/`; os scripts em `scripts/` refazem tudo a partir das fontes brutas (`data/raw/`).

## Uso

* **Camadas** (botão no topo): mapa base **Satélite / Relevo / Cobertura do solo**, camadas de água e esgoto, edificações, vias, bairros. Em *Opções: Água* ative **ligações prediais** (linha de cada edifício até a rua), ruas coloridas por estado, trechos estimados, adutoras em projeto. Tubos, unidades e ligações são desenhados por cima do relevo (raio-X), mesmo onde estariam enterrados.
* **Clique** em qualquer tubo/unidade/zona para ver dados, fonte e confiança. Em tubos: **Romper / Reparar** e **Fechar registro** (cenário manual).
* **Design**: superfícies claras e sólidas são controles; pílulas escuras translúcidas são rótulos do mapa. Um só acento (azul-água), vermelho/laranja/verde apenas para estado de abastecimento. No celular: um dedo move o mapa, dois dedos inclinam/aproximam.
* **Barra de história** (embaixo): cenário, ▶ rodar/pausar, velocidade, linha do tempo com marcadores de eventos (vermelhos = mudam o estado da rede) e o cartão do evento atual com ‹ › para navegar. Atalhos: espaço, ← →, [ ]. Os chips mostram população sem água / baixa pressão / normal e o índice heurístico de transiente. ⚙️ ajusta horas e estágios da recarga.
* Cenários: *Operação normal*; *Rompimento 31/08/2026 (reconstituição)*; *Recarga gradual*; *Reabertura abrupta (contraste)*; *Manual*.

## Estrutura

```
src/core/      app (cena, câmera, rótulos, picking), dem, terrain, roads, buildings, routing (A*), sim (motor de cenários)
src/layers/    registry.js (contrato de camada) · water/ (network.json, model.js, scenarios.js, index.js) · sewage/ · _template/
src/ui/        painel/bottom-sheet, popup
scripts/       fetch_dem.py, build_dem.py, build_roads.py, build_buildings.py, parse_pec.py, route_network.mjs
public/data/   dem.bin/json, roads.bin, buildings.bin, places.json, water_routes.json, sewage_pec.json, wells_pec.json
docs/          SOURCES.md (proveniência) · IMPROVEMENTS.md (heurísticas e ML)
```

## Como o modelo funciona (resumo)

Grafo de nós (captações, ETAs, reservatórios, elevatórias, junções, pontos de entrega) e arestas (adutoras/redes com diâmetro e capacidade). A cada passo (5 min simulados): capacidade efetiva por trecho (rompido = 0, "em carga" = fração aberta), alocação gulosa de produção às zonas por ordem de distância + cota (áreas altas e distantes são as últimas a receber), reservatórios cobrem déficits e reenchem com sobra (≤ 12 %/h), e zonas acima da cota do reservatório só recebem quando ele passa de 35 %. Não é um modelo hidráulico — veja `docs/IMPROVEMENTS.md`.

## Confiança dos dados

Coordenadas e capacidades das unidades vêm dos Planos de Emergência e Contingência da CASAN (2023–2024). Diâmetros/extensões das principais adutoras vêm de notícias da CASAN. **Traçados** raramente são públicos: são estimados por caminho de menor custo (relevo + vias) e desenhados mais transparentes. Ponto exato da ruptura de 31/08/2026: apenas "margem da BR‑282, bairro Bela Vista" — posição aproximada. Detalhes em `docs/SOURCES.md`.

Licenças: OpenStreetMap © colaboradores (ODbL); relevo AWS Terrain Tiles; documentos CASAN públicos.
