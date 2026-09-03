# Onde as heurísticas podem melhorar (e onde modelos de ML fariam diferença)

A versão atual privilegia transparência e reprodutibilidade: cada suposição está num arquivo JSON ou numa função pequena. Abaixo, os pontos fracos por ordem de impacto.

## 1. Traçado de adutoras (`src/core/routing.js`)
**Hoje:** A* sobre relevo + faixa de vias com pesos fixos. Não conhece faixas de domínio, cadastro, travessias existentes, nem a época de construção (a 1.200 mm de 1978 seguiu a BR‑282 porque a BR‑282 já existia).

**Melhorias sem ML:** pesos por classe de via e por uso do solo (OSM `landuse`), custo de travessia de rios/pontes por estrutura real, restrição a redes de 1978 vs 2020, usar "pistas" (fotos de obras, comunicados de manutenção com endereços) como pontos de passagem obrigatórios.

**Com ML:** aprender a superfície de custo a partir de cadastros públicos de outras concessionárias (SABESP, COPASA e SNIS publicam traçados) — um modelo de *inverse reinforcement learning* / regressão de custo por célula que reproduza traçados reais dado relevo, vias e uso do solo; depois aplicar aqui. Também: detecção de válvulas/registros e tampas em imagens de rua (Mapillary) para confirmar traçados.

## 2. Zonas de atendimento e demanda (`WaterModel._buildZones`)
**Hoje:** bairro OSM → ponto de distribuição mais próximo; população rateada por √(edificações OSM). A cobertura OSM de edificações é muito desigual (24 mil edificações para > 1 M de habitantes).

**Melhorias:** setores censitários do IBGE (população real por setor), cadastro de imóveis das prefeituras, mapas de zonas de pressão da CASAN (existem nos PMSB), consumo por bairro do SNIS/SINISA; demanda com sazonalidade (verão dobra a Costa Norte) e perfil horário.

**Com ML:** estimar população/consumo por edifício a partir de imagens de satélite (footprints + altura via modelos como Google Open Buildings / Microsoft Building Footprints, altura por estéreo ou aprendizado); prever demanda horária por zona com séries temporais (clima, feriados, temporada).

## 3. Modelo de escoamento (`WaterModel.step`)
**Hoje:** grafo com capacidades, alocação gulosa por prioridade (distância + cota), reservatórios como buffers, "pressão" apenas por gate de nível vs cota. Sem hidráulica (perda de carga, bombas, válvulas, golpe de aríete real).

**Melhorias:** trocar por EPANET (via `epanet-js` no navegador) com curvas de bombas e regras de operação; calibrar rugosidades com os eventos reais (tempo até faltar água em cada bairro em 31/08–03/09/2026).

**Com ML:** *surrogate models* (GNN sobre o grafo da rede) treinados em milhares de simulações EPANET para responder em tempo real no celular; aprendizado da política de reabertura (ordem e ritmo das válvulas) que minimize transientes e tempo de retorno — hoje o "índice de transiente" é apenas Δabertura × capacidade.

## 4. Reconstituição de eventos
**Hoje:** cronologia de notícias; pontos de ruptura geocodificados por bairro.

**Melhorias:** raspagem contínua dos comunicados CASAN/Águas de Palhoça, do app CASAN e de reclamações (Reclame Aqui, redes sociais) com geocodificação → mapa de "onde faltou água quando", que serve para calibrar zonas, prioridades e capacidades.

**Com ML:** NLP para extrair (bairro, horário, estado) de textos em português; modelo de propagação de falha que aprenda, a partir desses eventos, quais bairros dependem de quais trechos (inferência de topologia).

## 5. Dados 3D
**Hoje:** relevo 34 m no núcleo urbano (z14) e 70 m na região, ambos derivados de SRTM/ALOS 30 m; satélite Esri z13; cobertura ESA WorldCover 10 m; edificações OSM extrudadas por altura/andares (ou padrão por tipo).

**Melhorias:** LiDAR/MDT do Estado de SC (SDS, 1 m) para relevo e alturas reais; footprints de ML (Google Open Buildings) para preencher lacunas; nível de detalhe por distância da câmera.

## 6. Arquitetura (`src/layers/registry.js`)
Camadas expõem `init/setVisible/pick/renderPanel/scenarios/model`. Para lixo, energia ou drenagem: copie `src/layers/_template`, forneça dados em `public/data/`, e — se houver simulação — implemente `model.reset/step` e `scenarios`. O motor (`src/core/sim.js`) é agnóstico. Próximos passos naturais: worker para a simulação, streaming de dados por tiles, e um *store* compartilhado para cenários multi‑camada (ex.: falta de energia → paradas de elevatórias de água e esgoto).
