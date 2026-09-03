# Fontes e proveniência dos dados

Todos os dados são públicos. Cada unidade em `src/layers/water/network.json` carrega `confidence` (`documented` | `estimated`) e `src`.

## Infraestrutura de água (CASAN)

| Fonte | Uso | Confiança |
|---|---|---|
| CASAN – Plano de Emergência e Contingência Operacional **SIA Grande Florianópolis** (processo 00084155/2023) – `data/raw/pec_sia_grande_fpolis.pdf` | Captações Pilões/Cubatão, ETA Morro dos Quadros, todas as ERATs, boosters e reservatórios (com coordenadas e capacidades) de Florianópolis (SIA), São José, Biguaçu e Santo Amaro | documentado (coordenadas oficiais; 2 entradas com lat/lon trocadas, corrigidas) |
| CASAN – PEC **SAA Florianópolis – Costa Norte** (00032085/2024) – `data/raw/pec_costa_norte.pdf` | 39 poços do Aquífero Ingleses, ETA Ingleses (460 L/s), ERATs, boosters, reservatórios (Ingleses I–III, Canasvieiras, Jurerê, Praia do Forte, Daniela, Praia Brava) | documentado |
| CASAN – PEC **SAA Florianópolis – Costa Sul/Leste** (00032085/2024) – `data/raw/pec_costa_sul_leste.pdf` | ETA Lagoa do Peri (200 L/s), UT Campeche (poços, 100 L/s), poços complementares, boosters, ERATs, reservatórios (Morro das Pedras, Ribeirão, Canto da Lagoa, Barra da Lagoa) | documentado |
| CASAN – PEC **SES Continental (São José–Florianópolis)** | Elevatórias de esgoto (52) com coordenadas decimais; ETE Potecas | documentado (camada secundária) |
| CASAN notícias: *Implantação de novas adutoras reforça o SIA*; *CASAN inicia instalação da nova adutora na Ponte Pedro Ivo Campos*; *Novas bombas e adutora no Rio Cubatão*; *Desvio da adutora de Pilões*; *Sistema Integrado é recuperado* (2014); *Planejamento Hídrico: nova adutora São José/Biguaçu* (2022); *Novos reservatórios de São José* (2023); *CASAN investe mais R$ 5 milhões em reservatório* (Serrinha, 2025); *Governo e CASAN inauguram ETA e reservatório em Biguaçu* (07/2026); *Companhia destaca projetos estruturais*; *Mananciais superficiais da Ilha* | Diâmetros, extensões, vazões e descrições de traçado das adutoras (1.200 mm Continental/Forquilhinhas 3,7 km; Itacorubi 9,5 km 400–800 mm; Ponte Pedro Ivo 700 mm 950 m; Cubatão 1.200 mm 469 m; Pilões 800/600/500 mm 6,7 km; São José/Biguaçu 5,4 km; ETA Biguaçu 700 L/s + adutora 7,8 km) | documentado (traçado apenas descrito por vias/bairros → traçado geométrico é estimado) |
| ND Mais, NSC Total, TVBV, CBN, Agora Floripa (31/08–02/09/2026) e CASAN *Comunicado – Florianópolis, São José, Biguaçu e Palhoça* (31/08/2026) | Cronologia do rompimento da adutora 1.200 mm na BR-282 (Bela Vista, Palhoça): 31/08 10h51 deslocamento/rompimento; 01/09 novo deslocamento; 02/09 02h30 vazamento parcial no teste de carga; 02/09 16h30 conserto concluído; limpeza → carga e pressurização gradual → normalização ao longo de 03/09, áreas altas/distantes por último | documentado (ponto exato do rompimento não publicado → estimado) |
| Aegea / Águas de Palhoça | Distribuição de Palhoça operada pela Águas de Palhoça (Aegea) desde 01/12/2024; água tratada continua vindo da ETA Cubatão (CASAN) | documentado |
| IBGE Censo 2022; CASAN (SIA = 46 % de Florianópolis; Costa Norte 80–130 mil; Costa Sul/Leste 102–113 mil; demanda RM ≈ 2.800 L/s) | População atendida por sistema, consumo per capita (0,0028 L/s·hab incl. perdas) | referência |

## Base cartográfica

| Fonte | Uso | Licença |
|---|---|---|
| AWS Terrain Tiles (Mapzen *terrarium*; SRTM/ALOS 30 m) | Relevo em dois níveis: região inteira em z12 reamostrado para ~70 m (`dem.bin`) e núcleo urbano (lat −27,76…−27,37, lon −48,85…−48,34) em z14 reamostrado para ~34 m (`dem_core.bin`), com suavização 3×3 e mar nivelado. A fonte subjacente é SRTM/ALOS 30 m, logo 34 m já captura toda a informação disponível publicamente; um MDT LiDAR de 1 m (SDS/SC) seria o próximo passo | público |
| Esri World Imagery (z13, ≈ 17 m/px) | Mapa base satélite (`satellite.jpg` 4096 px, `satellite_lo.jpg` 2048 px para celular) | Esri, Maxar, Earthstar Geographics; uso de visualização |
| ESA WorldCover 2021 v200 (10 m, COG no AWS S3) | Cobertura do solo: textura (`landcover.png`) e grade de classes alinhada ao DEM (`landcover.bin`) usada no custo de traçado (água 12×, mangue 5×, áreas úmidas 4×, floresta 1,6×, urbano 0,9×). Região: 49 % floresta, 35 % água, 10 % campo, 4 % urbano | CC BY 4.0 |
| OpenStreetMap via Overpass (2026‑09‑02) | 24.364 edificações (altura/andares quando existentes), 6.617 vias principais, bairros/localidades (379), ETEs e captações mapeadas | ODbL |
| Nominatim | Geocodificação de bairros citados nas notícias (Bela Vista, Alto Biguaçu, Kobrasol…) | ODbL |

## O que é estimado (heurística) e como

* **Traçado de adutoras** sem alinhamento publicado: caminho de menor custo (A*) sobre grade de 120 m com custo = comprimento × (1 + 6·declividade) × 0,35 se em faixa de via × 12 se mar/lagoa fora de ponte × 20 se desnível > 60 m por célula (`src/core/routing.js`). Recalcule com `npm run routes`.
* **Topologia**: quais reservatórios/elevatórias pendem de qual adutora foi inferida da geografia e dos bairros citados nas notícias/PEC. Ex.: a "adutora secundária" ETA → Aririú → Palhoça Centro → Ponte do Imaruim → Kobrasol representa os ~30 % da produção que não passam pela 1.200 mm (as fontes só dizem "70 % passa pela 1.200 mm").
* **Zonas de atendimento**: cada bairro/localidade do OSM vira uma zona ligada ao ponto de distribuição mais próximo (≤ 6 km); edificações OSM a ≤ 2,5 km são atribuídas à zona; população atendida por (município, sistema) rateada por √(edificações). **Área da zona**: partição de uma grade de 60 m — célula "ocupada" = classe urbana do WorldCover ou edificação OSM a ≤ 1 célula — pelo centro de zona mais próximo (≤ 2,5 km), desenhada como união de células com contorno na fronteira; zonas não se sobrepõem.
* **Capacidades** de trechos de distribuição sem dado público: ordem de grandeza compatível com o diâmetro suposto.
