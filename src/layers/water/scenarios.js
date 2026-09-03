/** Scenarios for the water layer. Times are hours from `start`. Dates/local times from public reporting (see docs/SOURCES.md). */
const TRUNK = 'trunk1200_a';
const h = (d, hh, mm = 0) => d * 24 + hh + mm / 60; // day offset from start day 00:00

export function buildScenarios(model) {
  const p = model.params;
  return [
    {
      id: 'normal', name: 'Operação normal', description: 'Regime permanente com produção nominal. Use para explorar a rede.', start: '2026-09-04T00:00:00-03:00', duration_h: 48, events: []
    },
    {
      id: 'rompimento_2026', name: 'Rompimento da adutora – 31/08/2026 (reconstituição)',
      description: 'Adutora de 1.200 mm (≈70 % da água da ETA Cubatão) desloca-se e rompe na margem da BR-282, bairro Bela Vista, Palhoça, após chuvas intensas. Reconstituição por horários publicados (CASAN, ND Mais, TVBV, NSC).',
      start: '2026-08-31T00:00:00-03:00', duration_h: h(3, 23, 59),
      events: [
        { t_h: h(0, 10, 51), label: 'Seg 31/08 10h51 – Deslocamento e rompimento da adutora 1.200 mm na BR-282 (Bela Vista, Palhoça). Palhoça, São José, Biguaçu e Florianópolis (Continente e Centro) com baixa pressão/falta d\'água.', apply: m => { const e = m.edge(TRUNK); e.broken = true; e.open = 0; } },
        { t_h: h(0, 23, 0), label: 'Seg 23h – Previsão inicial de conclusão não cumprida: solo instável e encharcado.' },
        { t_h: h(1, 8, 0), label: 'Ter 01/09 manhã – Novo deslocamento da adutora; sem previsão de normalização. Escolas de Florianópolis pedem caminhões-pipa.' },
        { t_h: h(1, 20, 0), label: 'Ter ~20h – Reparo estrutural concluído; início do enchimento e teste de carga.', apply: (m, eng) => { const e = m.edge(TRUNK); e.broken = false; e.open = 0; m.setRamp(e, eng.t, 5, 0, 0.6, 3); } },
        { t_h: h(2, 2, 30), label: 'Qua 02/09 02h30 – Vazamento parcial detectado durante o teste de carga; nova frente de reparo.', apply: m => { const e = m.edge(TRUNK); e.broken = true; e.open = 0; e.ramp = null; } },
        { t_h: h(2, 16, 30), label: 'Qua 16h30 – Conserto concluído (antes das 18h previstas). Aterramento e fechamento da vala; início da limpeza da tubulação.', apply: m => { const e = m.edge(TRUNK); e.broken = false; e.open = 0; } },
        { t_h: h(2, 18, 30), label: 'Qua ~18h30 – Limpeza concluída. Início da carga e pressurização gradual da rede, com acompanhamento da engenharia.', apply: (m, eng) => { const e = m.edge(TRUNK); m.setRamp(e, eng.t, p.rampHours ?? 8, 0, 1, p.rampStages ?? 4); } },
        { t_h: h(3, 3, 0), label: 'Qui 03/09 madrugada – Adutora em carga; reservatórios enchendo; abastecimento retorna gradualmente.' },
        { t_h: h(3, 12, 0), label: 'Qui ao longo do dia – Normalização; áreas mais altas e distantes demoram mais.' }
      ]
    },
    {
      id: 'recarga', name: 'Recarga gradual da rede (processo pós-reparo)',
      description: 'Começa no fim do conserto (qua 02/09 16h30) com reservatórios baixos. Simula limpeza → carga/pressurização por estágios de válvula → enchimento de reservatórios → retorno por cota. Ajuste horas e estágios no painel.',
      start: '2026-09-02T16:30:00-03:00', duration_h: 36,
      setup: m => { const e = m.edge(TRUNK); e.broken = false; e.open = 0; for (const r of m.reservoirs) if (r.system === 'sia' && r.id !== 'res_pulmao') r.level = 0.05; for (const z of m.zones) z.hoursOut = 0; },
      events: [
        { t_h: 0, label: '16h30 – Reparo concluído; aterramento/fechamento; limpeza da tubulação (adutora fechada).' },
        { t_h: 2, label: '18h30 – Carga e pressurização gradual (abertura por estágios).', apply: (m, eng) => m.setRamp(m.edge(TRUNK), eng.t, p.rampHours ?? 8, 0, 1, p.rampStages ?? 4) },
        { t_h: 10, label: 'madrugada – Adutora em plena carga; reservatórios enchendo.' }
      ]
    },
    {
      id: 'recarga_abrupta', name: 'Contraste: reabertura abrupta (não recomendado)',
      description: 'Mesmo ponto de partida, mas a adutora é aberta de uma vez. Compare o índice heurístico de transiente (golpe de aríete) e a velocidade de retorno.',
      start: '2026-09-02T16:30:00-03:00', duration_h: 36,
      setup: m => { const e = m.edge(TRUNK); e.broken = false; e.open = 0; for (const r of m.reservoirs) if (r.system === 'sia' && r.id !== 'res_pulmao') r.level = 0.05; },
      events: [
        { t_h: 0, label: '16h30 – Reparo concluído.' },
        { t_h: 2, label: '18h30 – Abertura total imediata da adutora.', apply: m => { const e = m.edge(TRUNK); m.setRamp(e, 2, 0.1, 0, 1, 1); } }
      ]
    },
    {
      id: 'manual', name: 'Cenário manual (clique em uma adutora para romper/reparar)',
      description: 'Estado permanente. Clique em qualquer tubo e use "Romper"/"Reparar" para testar outras falhas (ex.: adutoras de Pilões, ponte, Costa Norte).', start: '2026-09-04T00:00:00-03:00', duration_h: 72, events: []
    }
  ];
}
