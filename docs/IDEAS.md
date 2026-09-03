# Backlog de ideias e melhorias

Registro vivo de tudo que foi identificado como melhoria durante o desenvolvimento. Prioridade: **A** (alto impacto na fidelidade), **B** (experiência/robustez), **C** (exploratório). Detalhes técnicos das heurísticas em `IMPROVEMENTS.md`; proveniência em `SOURCES.md`.

## Dados e fidelidade

| # | Ideia | Prio |
|---|---|---|
| D1 | Obter o cadastro de redes da CASAN / Águas de Palhoça (shapefile de adutoras, zonas de pressão, DMCs) via LAI ou PMSB para substituir os traçados estimados | A |
| D2 | Usar setores censitários IBGE 2022 (população real por setor) no lugar do rateio por edificações OSM | A |
| D3 | MDT LiDAR 1 m de Santa Catarina (SDS/SIGSC) para relevo e altura de edificações; hoje o limite é SRTM/ALOS 30 m | A |
| D4 | Footprints de edificações de ML (Google Open Buildings v3 / Microsoft) para cobrir os vazios do OSM (24 mil edificações para > 1 M hab.) | A |
| D5 | Ponto exato da ruptura de 31/08/2026 (fotos/vídeos ND Mais, TVBV) e trecho de 1978 vs. trechos renovados da adutora 1.200 mm | B |
| D6 | Confirmar a existência e o traçado da "adutora secundária" (30 % da produção) e da interligação Costeira ↔ Rio Tavares | A |
| D7 | Volumes reais: níveis de reservatórios e macromedição (CASAN publica relatórios ARESC); calibrar o modelo com o evento de 31/08–03/09 | A |
| D8 | Sazonalidade de demanda (verão dobra Costa Norte) e perfil horário de consumo | B |
| D9 | Camada de esgoto completa: bacias, coletores-tronco, emissários (PEC SES Insular/Ingleses/Lagoa) e modelo simples de fluxo por gravidade/elevatórias | B |
| D10 | Novas camadas: coleta de lixo (rotas COMCAP/Prefeituras), drenagem, energia (Celesc; queda de energia → parada de elevatórias) | C |
| D11 | Atualização automática: raspar comunicados CASAN/Águas de Palhoça e o app CASAN → eventos geocodificados em tempo real | B |
| D12 | Imagens de satélite em níveis (tiles por zoom com LOD) em vez de uma textura única; imagens pós-evento (Planet/Sentinel-2) para ver a obra na BR-282 | C |

## Modelo e simulação

| # | Ideia | Prio |
|---|---|---|
| M1 | Substituir o modelo de grafo por hidráulica (EPANET via `epanet-js`), com curvas de bombas, válvulas e regras de operação | A |
| M2 | Transientes reais (golpe de aríete) no lugar do índice heurístico Δabertura × capacidade | B |
| M3 | Rodar a simulação em Web Worker; hoje `seek` reconstrói o estado do zero no thread principal | B |
| M4 | Modelo de reservatórios com curvas cota-volume e regras de nível mínimo por zona de pressão | B |
| M5 | Comparar cenários lado a lado (recarga gradual vs. abrupta) com gráfico de população sem água ao longo do tempo | B |
| M6 | Caminhões-pipa e prioridade a hospitais/escolas como recurso alocável no cenário | C |
| M7 | Otimização/RL da política de reabertura (ordem e ritmo das válvulas) minimizando transientes e tempo de retorno | C |
| M8 | GNN *surrogate* treinada em simulações EPANET para resposta em tempo real no celular | C |
| M9 | Inferência de topologia a partir de eventos observados (quais bairros dependem de quais trechos) | C |
| M10 | Modelo de custo de traçado aprendido com cadastros públicos de outras concessionárias (IRL/regressão por célula) | C |

## Visualização e interface

| # | Ideia | Prio |
|---|---|---|
| V1 | Partículas/animação de fluxo nos tubos proporcional à vazão simulada | B |
| V2 | Gráfico de série temporal (população sem água, níveis de reservatórios) integrado à barra de história | B |
| V3 | Modo "seguir evento": a câmera voa para o local de cada evento ao navegar na linha do tempo | B |
| V4 | Busca por bairro/unidade com voo da câmera | B |
| V5 | Rótulos com prioridade por zoom e agrupamento (hoje há colisão simples) | B |
| V6 | Tema claro/escuro e modo alto-contraste; acessibilidade (foco de teclado, ARIA nos controles) | B |
| V7 | Compartilhar estado por URL (cenário, tempo, câmera, camadas) | B |
| V8 | Tour guiado do sistema (captação → ETA → adutoras → reservatórios) como cenário narrativo | C |
| V9 | LOD de edificações e instancing para suportar 300 mil+ footprints; oclusão por distância | B |
| V10 | Legenda contextual: mostrar só o que está visível na tela | C |

## Engenharia

| # | Ideia | Prio |
|---|---|---|
| E1 | Testes automatizados do modelo (cenários de referência com resultados esperados) e do parser dos PECs | B |
| E2 | Pipeline de dados reproduzível em um único comando (`make data`) com cache dos tiles | B |
| E3 | Publicação estática (GitHub Pages/Cloudflare) com CI que roda `npm run build` e `npm run routes` | B |
| E4 | Empacotar cada camada como módulo carregável sob demanda (code-splitting) | C |
| E5 | Internacionalização (pt-BR/en) | C |
