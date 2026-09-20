/* ============================================================
   Minhas Corridas — controle de ganhos para motorista de app
   Tudo roda offline, os dados ficam salvos no próprio celular.
   ============================================================ */

/* ---------------- 1. Armazenamento ---------------- */

const CHAVE = 'minhas-corridas-v1';

const PADRAO = {
  versao: 1,
  config: { nome: '', carro: '', metaDia: 0, metaSemana: 0 },
  jornadas: [],
  abastecimentos: [],
  despesas: [],
  manutencoes: [
    { id: 'm1', nome: 'Troca de óleo',     intervaloKm: 10000, kmUltima: 0 },
    { id: 'm2', nome: 'Rodízio de pneus',  intervaloKm: 10000, kmUltima: 0 },
    { id: 'm3', nome: 'Filtro de ar',      intervaloKm: 20000, kmUltima: 0 }
  ]
};

let db = carregar();

function carregar() {
  try {
    const cru = localStorage.getItem(CHAVE);
    if (!cru) return structuredClone(PADRAO);
    const d = JSON.parse(cru);
    // completa campos que possam faltar em backups antigos
    return Object.assign(structuredClone(PADRAO), d, {
      config: Object.assign({}, PADRAO.config, d.config || {})
    });
  } catch (e) {
    console.error('Falha ao ler os dados salvos', e);
    return structuredClone(PADRAO);
  }
}

function salvar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(db));
  } catch (e) {
    aviso('Não consegui salvar. A memória do celular pode estar cheia.');
  }
}

const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------------- 2. Utilidades ---------------- */

const $  = (s, raiz = document) => raiz.querySelector(s);
const $$ = (s, raiz = document) => Array.from(raiz.querySelectorAll(s));

const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Data de hoje como 'AAAA-MM-DD' no fuso do celular. */
function hojeStr(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 'AAAA-MM-DD' -> Date local (evita o pulo de fuso do new Date(string)). */
function paraData(s) {
  const [a, m, d] = String(s).split('-').map(Number);
  return new Date(a, m - 1, d);
}

function dataCurta(s) {
  const d = paraData(s);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function dataLonga(s) {
  const d = paraData(s);
  const hoje = hojeStr();
  if (s === hoje) return 'Hoje';
  const ontem = new Date(); ontem.setDate(ontem.getDate() - 1);
  if (s === hojeStr(ontem)) return 'Ontem';
  return `${DIAS_CURTOS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

/** Aceita "1.234,56", "1234,56" e "1234.56". */
function num(v) {
  if (typeof v === 'number') return v;
  if (!v) return 0;
  let s = String(v).trim().replace(/\s/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
}

const brl = v => (v < 0 ? '-' : '') + 'R$ ' + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const brlCurto = v => (v < 0 ? '-' : '') + 'R$ ' + Math.abs(Math.round(v)).toLocaleString('pt-BR');
const dec = (v, c = 1) => v.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c });
const inteiro = v => Math.round(v).toLocaleString('pt-BR');

function aviso(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(aviso._t);
  aviso._t = setTimeout(() => { t.hidden = true; }, 2600);
}

/* ---------------- 3. Períodos e cálculos ---------------- */

/** Devolve [inicio, fim] inclusivos no formato 'AAAA-MM-DD'. */
function intervalo(periodo) {
  const hoje = new Date();
  const p = n => String(n).padStart(2, '0');

  if (periodo === 'hoje') {
    const t = hojeStr(hoje);
    return [t, t];
  }
  if (periodo === 'semana') {
    // semana começa na segunda-feira
    const ini = new Date(hoje);
    const diaSem = (hoje.getDay() + 6) % 7;
    ini.setDate(hoje.getDate() - diaSem);
    const fim = new Date(ini);
    fim.setDate(ini.getDate() + 6);
    return [hojeStr(ini), hojeStr(fim)];
  }
  if (periodo === 'mes') {
    const a = hoje.getFullYear(), m = hoje.getMonth() + 1;
    const ultimo = new Date(a, m, 0).getDate();
    return [`${a}-${p(m)}-01`, `${a}-${p(m)}-${p(ultimo)}`];
  }
  return ['0000-01-01', '9999-12-31'];
}

const dentro = (data, [ini, fim]) => data >= ini && data <= fim;

/** Todos os números do painel para um intervalo de datas. */
function resumo(faixa) {
  const js = db.jornadas.filter(j => dentro(j.data, faixa));
  const as = db.abastecimentos.filter(a => dentro(a.data, faixa));
  const ds = db.despesas.filter(d => dentro(d.data, faixa));

  const soma = (arr, campo) => arr.reduce((t, x) => t + (Number(x[campo]) || 0), 0);

  const ganho       = soma(js, 'ganho');
  const km          = soma(js, 'km');
  const horas       = soma(js, 'horas');
  const corridas    = soma(js, 'corridas');
  const combustivel = soma(as, 'valor');
  const despesas    = soma(ds, 'valor');
  const lucro       = ganho - combustivel - despesas;
  const custos      = combustivel + despesas;

  return {
    ganho, km, horas, corridas, combustivel, despesas, lucro, custos,
    dias: js.length,
    porHora:  horas > 0 ? lucro / horas : null,
    porKm:    km    > 0 ? ganho / km    : null,
    custoKm:  km    > 0 ? custos / km   : null,
    porCorrida: corridas > 0 ? ganho / corridas : null
  };
}

/**
 * Consumo real em km/l, medido entre abastecimentos de tanque cheio.
 * Usa as medições mais recentes, que refletem o estado atual do carro.
 */
function consumoReal(maxMedicoes = 6) {
  const cheios = db.abastecimentos
    .filter(a => a.tanqueCheio && num(a.odometro) > 0 && num(a.litros) > 0)
    .sort((x, y) => num(x.odometro) - num(y.odometro));

  const medicoes = [];
  for (let i = 1; i < cheios.length; i++) {
    const dist = num(cheios[i].odometro) - num(cheios[i - 1].odometro);
    const lit  = num(cheios[i].litros);
    // descarta valores impossíveis (odômetro digitado errado)
    if (dist > 0 && dist < 3000 && lit > 0) medicoes.push(dist / lit);
  }
  if (!medicoes.length) return { kml: null, n: 0 };

  const ult = medicoes.slice(-maxMedicoes);
  return { kml: ult.reduce((a, b) => a + b, 0) / ult.length, n: ult.length };
}

/** Maior odômetro já registrado — serve de "km atual" do carro. */
function odometroAtual() {
  return db.abastecimentos.reduce((max, a) => Math.max(max, num(a.odometro)), 0);
}

/** Preço médio do litro nos últimos abastecimentos. */
function precoMedioLitro() {
  const comPreco = db.abastecimentos.filter(a => num(a.precoLitro) > 0).slice(-5);
  if (!comPreco.length) return null;
  return comPreco.reduce((t, a) => t + num(a.precoLitro), 0) / comPreco.length;
}

/* ---------------- 4. Painel ---------------- */

let periodo = 'mes';
const NOME_PERIODO = { hoje: 'hoje', semana: 'na semana', mes: 'no mês', tudo: 'no total' };
const ROTULO_PERIODO = { hoje: 'Hoje', semana: 'Semana', mes: 'Mês', tudo: 'Tudo' };

function desenharPainel() {
  const r = resumo(intervalo(periodo));

  // primeira vez: em vez de uma tela cheia de traços, explica o que fazer
  const semNada = !db.jornadas.length && !db.abastecimentos.length && !db.despesas.length;
  $('#card-inicio').hidden = !semNada;
  ['#segmented', '#hero', '#grid-kpis', '#card-grafico', '#card-dow', '#card-manut']
    .forEach(sel => { $(sel).hidden = semNada; });
  if (semNada) {
    const nomeVazio = db.config.nome.trim();
    const hv = new Date().getHours();
    $('#saudacao').textContent = (hv < 12 ? 'Bom dia' : hv < 18 ? 'Boa tarde' : 'Boa noite') +
      (nomeVazio ? ', ' + primeiroNome(nomeVazio) : '');
    $('#card-metas').hidden = true;
    return;
  }

  // saudação
  const nome = db.config.nome.trim();
  const h = new Date().getHours();
  const parte = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  $('#saudacao').textContent = nome ? `${parte}, ${primeiroNome(nome)}` : parte;

  $('#hero-periodo').textContent = NOME_PERIODO[periodo];

  // destaque
  const heroEl = $('#hero-lucro');
  heroEl.textContent = brl(r.lucro);
  heroEl.classList.toggle('neg', r.lucro < 0);
  $('#bd-ganhos').textContent      = brlCurto(r.ganho);
  $('#bd-combustivel').textContent = brlCurto(r.combustivel);
  $('#bd-despesas').textContent    = brlCurto(r.despesas);

  // indicadores
  const cons = consumoReal();
  const precoL = precoMedioLitro();

  texto('#kpi-hora', r.porHora === null ? '—' : brl(r.porHora),
        r.horas > 0 ? `${dec(r.horas)} h trabalhadas` : 'informe as horas do dia');

  texto('#kpi-rskm', r.porKm === null ? '—' : brl(r.porKm),
        r.corridas > 0 ? `${brl(r.porCorrida)} por corrida` : 'ganho bruto por km');

  texto('#kpi-custokm', r.custoKm === null ? '—' : brl(r.custoKm),
        r.porKm !== null && r.custoKm !== null
          ? `sobram ${brl(r.porKm - r.custoKm)} por km`
          : 'combustível + despesas');

  texto('#kpi-consumo', cons.kml === null ? '—' : dec(cons.kml) + ' km/l',
        cons.kml === null
          ? 'abasteça 2× de tanque cheio'
          : precoL
            ? `${brl(precoL / cons.kml)} por km rodado`
            : `média de ${cons.n} ${cons.n === 1 ? 'medição' : 'medições'}`);

  texto('#kpi-km', r.km > 0 ? inteiro(r.km) + ' km' : '—',
        r.dias > 0 ? `${inteiro(r.km / r.dias)} km por dia` : '');

  texto('#kpi-dias', r.dias > 0 ? String(r.dias) : '—',
        r.dias > 0 ? `${brl(r.lucro / r.dias)} por dia` : 'nenhum dia lançado');

  desenharMetas();
  desenharGrafico();
  desenharDiasSemana();
  desenharManutencao();
}

/** "Seu José" -> "Seu José"; "José da Silva" -> "José". */
function primeiroNome(nome) {
  const partes = nome.split(/\s+/);
  const titulos = ['seu', 'sr', 'sr.', 'senhor', 'dona', 'dna', 'sra', 'sra.', 'dr', 'dr.'];
  if (partes.length > 1 && titulos.includes(partes[0].toLowerCase())) return partes[0] + ' ' + partes[1];
  return partes[0];
}

function texto(sel, valor, rodape) {
  const el = $(sel);
  el.textContent = valor;
  el.classList.toggle('is-empty', valor === '—');
  const f = $(sel + '-foot');
  if (f) f.textContent = rodape || '';
}

function desenharMetas() {
  const cfg = db.config;
  const temMeta = cfg.metaDia > 0 || cfg.metaSemana > 0;
  $('#card-metas').hidden = !temMeta;
  if (!temMeta) return;

  const dia = resumo(intervalo('hoje'));
  const sem = resumo(intervalo('semana'));

  barraMeta('dia', dia.ganho, cfg.metaDia, 'hoje');
  barraMeta('sem', sem.ganho, cfg.metaSemana, 'nesta semana');

  $$('#card-metas .meta-row').forEach((row, i) => {
    row.hidden = i === 0 ? !(cfg.metaDia > 0) : !(cfg.metaSemana > 0);
  });
}

function barraMeta(chave, feito, meta, quando) {
  if (!(meta > 0)) return;
  const pct = Math.min(100, (feito / meta) * 100);
  const barra = $(`#meta-${chave}-bar`);
  barra.style.width = pct + '%';
  barra.classList.toggle('done', feito >= meta);
  $(`#meta-${chave}-val`).textContent = `${brlCurto(feito)} de ${brlCurto(meta)}`;
  $(`#meta-${chave}-sub`).textContent = feito >= meta
    ? `🎉 Meta batida! ${brl(feito - meta)} acima.`
    : `Faltam ${brl(meta - feito)} ${quando}.`;
}

function desenharGrafico() {
  const el = $('#chart');
  const dias = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const s = hojeStr(d);
    const ganho = db.jornadas.filter(j => j.data === s).reduce((t, j) => t + num(j.ganho), 0);
    dias.push({ data: s, ganho, dow: d.getDay(), num: d.getDate() });
  }

  const maior = Math.max(...dias.map(d => d.ganho), 1);
  el.innerHTML = dias.map(d => {
    const alt = d.ganho > 0 ? Math.max(4, (d.ganho / maior) * 100) : 3;
    const cls = d.ganho > 0 ? '' : ' zero';
    const titulo = d.ganho > 0 ? `${dataCurta(d.data)}: ${brl(d.ganho)}` : `${dataCurta(d.data)}: sem lançamento`;
    return `<div class="chart-col" title="${titulo}">
      <div class="chart-bar${cls}" style="height:${alt}%"></div>
      <span class="chart-lbl">${d.num}</span>
    </div>`;
  }).join('');
}

function desenharDiasSemana() {
  const el = $('#dias-semana');
  if (!db.jornadas.length) {
    el.innerHTML = `<p class="hint">Lance alguns dias de trabalho e aqui vai aparecer em quais dias da semana ele ganha mais.</p>`;
    return;
  }

  const porDia = Array.from({ length: 7 }, () => ({ total: 0, n: 0 }));
  db.jornadas.forEach(j => {
    const d = paraData(j.data).getDay();
    porDia[d].total += num(j.ganho);
    porDia[d].n++;
  });

  const medias = porDia.map((x, i) => ({ dia: i, media: x.n ? x.total / x.n : 0, n: x.n }));
  const maior = Math.max(...medias.map(m => m.media), 1);
  const ordem = [1, 2, 3, 4, 5, 6, 0]; // segunda → domingo

  el.innerHTML = ordem.map(i => {
    const m = medias[i];
    const pct = (m.media / maior) * 100;
    return `<div class="dow-row">
      <span class="dow-name">${DIAS_CURTOS[i]}</span>
      <div class="dow-bar"><div class="dow-fill" style="width:${pct}%"></div></div>
      <span class="dow-val">${m.n ? brlCurto(m.media) : '—'}</span>
    </div>`;
  }).join('');
}

function desenharManutencao() {
  const el = $('#manut-lista');
  const odo = odometroAtual();
  $('#odometro-atual').textContent = odo > 0 ? `${inteiro(odo)} km no carro` : '';

  if (!db.manutencoes.length) {
    el.innerHTML = `<p class="hint">Nenhum item cadastrado. Adicione em Ajustes.</p>`;
    return;
  }
  if (odo === 0) {
    el.innerHTML = `<p class="hint">Registre o km do odômetro ao abastecer e o app começa a avisar quando a revisão estiver chegando.</p>`;
    return;
  }

  el.innerHTML = db.manutencoes.map(m => {
    const proxima = num(m.kmUltima) + num(m.intervaloKm);
    const faltam = proxima - odo;
    const limiteAviso = Math.max(500, num(m.intervaloKm) * 0.1);

    let classe = '', txt, sub;
    if (faltam <= 0) {
      classe = 'late';
      txt = `${inteiro(-faltam)} km atrasado`;
      sub = `era pra ter feito em ${inteiro(proxima)} km`;
    } else if (faltam <= limiteAviso) {
      classe = 'warn';
      txt = `faltam ${inteiro(faltam)} km`;
      sub = `fazer em ${inteiro(proxima)} km`;
    } else {
      txt = `faltam ${inteiro(faltam)} km`;
      sub = `próxima em ${inteiro(proxima)} km`;
    }

    return `<div class="manut-item">
      <span class="manut-dot ${classe}"></span>
      <div class="manut-info">
        <p class="manut-nome">${escapar(m.nome)}</p>
        <p class="manut-sub">${sub}</p>
      </div>
      <span class="manut-km ${classe}">${txt}</span>
    </div>`;
  }).join('');
}

const escapar = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------- 5. Histórico ---------------- */

let filtroHist = 'todos';

function desenharHistorico() {
  const el = $('#hist-lista');
  let itens = [];

  if (filtroHist === 'todos' || filtroHist === 'jornada') {
    itens = itens.concat(db.jornadas.map(j => ({ tipo: 'jornada', reg: j })));
  }
  if (filtroHist === 'todos' || filtroHist === 'abastecimento') {
    itens = itens.concat(db.abastecimentos.map(a => ({ tipo: 'abastecimento', reg: a })));
  }
  if (filtroHist === 'todos' || filtroHist === 'despesa') {
    itens = itens.concat(db.despesas.map(d => ({ tipo: 'despesa', reg: d })));
  }

  if (!itens.length) {
    el.innerHTML = `<div class="empty">
      <span class="empty-ico">📭</span>
      <p class="empty-t">Nada lançado ainda</p>
      <p class="empty-s">Use os botões grandes do Painel para<br>lançar o dia de trabalho ou um abastecimento.</p>
    </div>`;
    return;
  }

  itens.sort((a, b) => b.reg.data.localeCompare(a.reg.data) || String(b.reg.id).localeCompare(String(a.reg.id)));

  let html = '', diaAtual = null;
  for (const it of itens) {
    if (it.reg.data !== diaAtual) {
      diaAtual = it.reg.data;
      html += `<p class="hist-dia">${dataLonga(diaAtual)}</p>`;
    }
    html += linhaHistorico(it);
  }
  el.innerHTML = html;
}

function linhaHistorico({ tipo, reg }) {
  let ico, titulo, sub, valor, classe;

  if (tipo === 'jornada') {
    ico = '🚗'; classe = 'pos';
    titulo = 'Dia de trabalho';
    // o mais útil primeiro, porque a linha corta se for comprida
    const partes = [];
    if (num(reg.horas) > 0)    partes.push(`${brl(num(reg.ganho) / num(reg.horas))}/h`);
    if (num(reg.km) > 0)       partes.push(`${inteiro(reg.km)} km`);
    if (num(reg.horas) > 0)    partes.push(`${dec(reg.horas)} h`);
    if (num(reg.corridas) > 0) partes.push(`${reg.corridas} corridas`);
    sub = partes.join(' · ') || 'só o ganho lançado';
    valor = '+' + brlCurto(num(reg.ganho));
  } else if (tipo === 'abastecimento') {
    ico = '⛽'; classe = 'neg';
    titulo = 'Abastecimento';
    const partes = [];
    if (num(reg.litros) > 0)     partes.push(`${dec(reg.litros, 2)} L`);
    if (num(reg.precoLitro) > 0) partes.push(`${brl(reg.precoLitro)}/L`);
    if (num(reg.odometro) > 0)   partes.push(`${inteiro(reg.odometro)} km`);
    if (reg.posto)               partes.push(escapar(reg.posto));
    sub = partes.join(' · ') || 'sem detalhes';
    valor = '−' + brlCurto(num(reg.valor));
  } else {
    ico = '🧾'; classe = 'neg';
    titulo = escapar(reg.categoria || 'Despesa');
    sub = escapar(reg.descricao) || 'sem descrição';
    valor = '−' + brlCurto(num(reg.valor));
  }

  return `<button class="hist-item" data-editar="${tipo}" data-id="${reg.id}">
    <span class="hist-ico">${ico}</span>
    <span class="hist-info">
      <span class="hist-t">${titulo}</span>
      <span class="hist-s">${sub}</span>
    </span>
    <span class="hist-v ${classe}">${valor}</span>
  </button>`;
}

/* ---------------- 6. Ajustes ---------------- */

function desenharAjustes() {
  $('#cfg-nome').value        = db.config.nome || '';
  $('#cfg-carro').value       = db.config.carro || '';
  $('#cfg-meta-dia').value    = db.config.metaDia    ? dec(db.config.metaDia, 2)    : '';
  $('#cfg-meta-semana').value = db.config.metaSemana ? dec(db.config.metaSemana, 2) : '';

  $('#cfg-manut').innerHTML = db.manutencoes.length
    ? db.manutencoes.map(m => `<div class="cfg-manut-item">
        <div class="cfg-manut-info">
          <p class="manut-nome">${escapar(m.nome)}</p>
          <p class="manut-sub">a cada ${inteiro(m.intervaloKm)} km · última em ${inteiro(m.kmUltima)} km</p>
        </div>
        <button class="mini-btn" data-editar-manut="${m.id}">Editar</button>
        <button class="cfg-manut-x" data-remover-manut="${m.id}" aria-label="Remover">×</button>
      </div>`).join('')
    : `<p class="hint">Nenhum item. Toque em “+ Item” para cadastrar uma revisão.</p>`;
}

function guardarConfig() {
  db.config.nome       = $('#cfg-nome').value.trim();
  db.config.carro      = $('#cfg-carro').value.trim();
  db.config.metaDia    = num($('#cfg-meta-dia').value);
  db.config.metaSemana = num($('#cfg-meta-semana').value);
  salvar();
  desenharPainel();
}

/* ---------------- 7. Formulários ---------------- */

const CATEGORIAS = ['Manutenção', 'Lavagem', 'Pedágio', 'Estacionamento', 'Seguro', 'IPVA / Licenciamento', 'Celular / Internet', 'Alimentação', 'Outros'];

let edicao = null; // { tipo, id } ou null

function abrirFicha(tipo, id = null) {
  edicao = { tipo, id };
  const form = $('#sheet-form');
  const hoje = hojeStr();

  let reg = null;
  if (id) {
    const lista = { jornada: db.jornadas, abastecimento: db.abastecimentos, despesa: db.despesas, manutencao: db.manutencoes }[tipo];
    reg = lista.find(x => x.id === id);
    if (!reg) return;
  }

  const v = (campo, padrao = '') => {
    if (!reg) return padrao;
    const x = reg[campo];
    return x === 0 || x === undefined || x === null || x === '' ? '' : x;
  };
  const dinheiro = campo => (reg && num(reg[campo]) > 0 ? dec(num(reg[campo]), 2) : '');

  if (tipo === 'jornada') {
    $('#sheet-title').textContent = id ? 'Editar dia' : 'Lançar dia de trabalho';
    form.innerHTML = `
      <label class="field">
        <span class="field-label">Dia</span>
        <input type="date" name="data" value="${v('data', hoje)}" max="${hoje}">
      </label>
      <label class="field">
        <span class="field-label">Quanto ganhou no dia (bruto) *</span>
        <input type="text" inputmode="decimal" name="ganho" value="${dinheiro('ganho')}" placeholder="0,00" autofocus>
        <span class="field-hint">O valor que aparece no app da Uber, antes dos descontos.</span>
      </label>
      <div class="field-row">
        <label class="field">
          <span class="field-label">Km rodados</span>
          <input type="text" inputmode="decimal" name="km" value="${v('km')}" placeholder="0">
        </label>
        <label class="field">
          <span class="field-label">Horas rodando</span>
          <input type="text" inputmode="decimal" name="horas" value="${v('horas')}" placeholder="8">
        </label>
      </div>
      <label class="field">
        <span class="field-label">Número de corridas (opcional)</span>
        <input type="text" inputmode="numeric" name="corridas" value="${v('corridas')}" placeholder="0">
      </label>
      ${id ? `<button type="button" class="del-btn" data-apagar>Apagar este lançamento</button>` : ''}
    `;
  }

  if (tipo === 'abastecimento') {
    $('#sheet-title').textContent = id ? 'Editar abastecimento' : 'Novo abastecimento';
    const cheio = reg ? reg.tanqueCheio !== false : true;
    form.innerHTML = `
      <label class="field">
        <span class="field-label">Dia</span>
        <input type="date" name="data" value="${v('data', hoje)}" max="${hoje}">
      </label>
      <label class="field">
        <span class="field-label">Quanto pagou *</span>
        <input type="text" inputmode="decimal" name="valor" value="${dinheiro('valor')}" placeholder="0,00" autofocus>
      </label>
      <div class="field-row">
        <label class="field">
          <span class="field-label">Preço do litro</span>
          <input type="text" inputmode="decimal" name="precoLitro" value="${dinheiro('precoLitro')}" placeholder="5,89">
        </label>
        <label class="field">
          <span class="field-label">Litros</span>
          <input type="text" inputmode="decimal" name="litros" value="${reg && num(reg.litros) > 0 ? dec(num(reg.litros), 2) : ''}" placeholder="0,00">
        </label>
      </div>
      <p class="field-hint" style="margin:-8px 0 14px">Preencha um dos dois — o app calcula o outro sozinho.</p>
      <label class="field">
        <span class="field-label">Km do painel (odômetro)</span>
        <input type="text" inputmode="numeric" name="odometro" value="${v('odometro')}" placeholder="${odometroAtual() || 85000}">
        <span class="field-hint">É com isso que o app calcula o consumo e avisa da revisão.</span>
      </label>
      <label class="field">
        <span class="field-label">Posto (opcional)</span>
        <input type="text" name="posto" value="${escapar(v('posto'))}" placeholder="Ex: Ipiranga da esquina">
      </label>
      <div class="toggle-row">
        <div class="toggle-txt">
          <p class="toggle-t">Enchi o tanque</p>
          <p class="toggle-s">Só com tanque cheio dá pra medir o consumo certo.</p>
        </div>
        <button type="button" class="switch ${cheio ? 'is-on' : ''}" data-switch="tanqueCheio" aria-pressed="${cheio}"></button>
      </div>
      ${id ? `<button type="button" class="del-btn" data-apagar>Apagar este abastecimento</button>` : ''}
    `;
  }

  if (tipo === 'despesa') {
    $('#sheet-title').textContent = id ? 'Editar despesa' : 'Nova despesa';
    const catAtual = reg ? reg.categoria : 'Manutenção';
    form.innerHTML = `
      <label class="field">
        <span class="field-label">Dia</span>
        <input type="date" name="data" value="${v('data', hoje)}" max="${hoje}">
      </label>
      <label class="field">
        <span class="field-label">Valor *</span>
        <input type="text" inputmode="decimal" name="valor" value="${dinheiro('valor')}" placeholder="0,00" autofocus>
      </label>
      <div class="field">
        <span class="field-label">Categoria</span>
        <div class="chips" data-chips="categoria">
          ${CATEGORIAS.map(c => `<button type="button" class="chip ${c === catAtual ? 'is-on' : ''}" data-valor="${escapar(c)}">${escapar(c)}</button>`).join('')}
        </div>
        <input type="hidden" name="categoria" value="${escapar(catAtual)}">
      </div>
      <label class="field">
        <span class="field-label">Descrição (opcional)</span>
        <input type="text" name="descricao" value="${escapar(v('descricao'))}" placeholder="Ex: pastilha de freio">
      </label>
      ${id ? `<button type="button" class="del-btn" data-apagar>Apagar esta despesa</button>` : ''}
    `;
  }

  if (tipo === 'manutencao') {
    $('#sheet-title').textContent = id ? 'Editar item' : 'Novo item de manutenção';
    form.innerHTML = `
      <label class="field">
        <span class="field-label">O que é *</span>
        <input type="text" name="nome" value="${escapar(v('nome'))}" placeholder="Ex: Troca de óleo" autofocus>
      </label>
      <label class="field">
        <span class="field-label">Fazer a cada quantos km *</span>
        <input type="text" inputmode="numeric" name="intervaloKm" value="${v('intervaloKm')}" placeholder="10000">
      </label>
      <label class="field">
        <span class="field-label">Km do carro na última vez</span>
        <input type="text" inputmode="numeric" name="kmUltima" value="${v('kmUltima')}" placeholder="${odometroAtual() || 80000}">
        <span class="field-hint">Se não lembrar, coloque o km de hoje — daí conta a partir de agora.</span>
      </label>
      ${id ? `<button type="button" class="del-btn" data-apagar>Remover este item</button>` : ''}
    `;
  }

  $('#backdrop').hidden = false;
  $('#sheet').hidden = false;
  setTimeout(() => { const a = form.querySelector('[autofocus]'); if (a) a.focus(); }, 320);
}

function fecharFicha() {
  $('#sheet').hidden = true;
  $('#backdrop').hidden = true;
  edicao = null;
}

function salvarFicha() {
  if (!edicao) return;
  const form = $('#sheet-form');
  const d = Object.fromEntries(new FormData(form).entries());
  const { tipo, id } = edicao;

  if (tipo === 'jornada') {
    if (num(d.ganho) <= 0) return aviso('Informe quanto ele ganhou no dia.');
    gravar(db.jornadas, id, {
      data: d.data || hojeStr(),
      ganho: num(d.ganho), km: num(d.km), horas: num(d.horas), corridas: num(d.corridas)
    });
  }

  if (tipo === 'abastecimento') {
    if (num(d.valor) <= 0) return aviso('Informe quanto ele pagou.');
    let valor = num(d.valor), preco = num(d.precoLitro), litros = num(d.litros);
    if (preco > 0 && litros <= 0) litros = valor / preco;
    else if (litros > 0 && preco <= 0) preco = valor / litros;
    gravar(db.abastecimentos, id, {
      data: d.data || hojeStr(),
      valor, precoLitro: preco, litros,
      odometro: num(d.odometro),
      posto: (d.posto || '').trim(),
      tanqueCheio: form.querySelector('[data-switch]').classList.contains('is-on')
    });
  }

  if (tipo === 'despesa') {
    if (num(d.valor) <= 0) return aviso('Informe o valor da despesa.');
    gravar(db.despesas, id, {
      data: d.data || hojeStr(),
      valor: num(d.valor),
      categoria: d.categoria || 'Outros',
      descricao: (d.descricao || '').trim()
    });
  }

  if (tipo === 'manutencao') {
    if (!d.nome.trim())          return aviso('Dê um nome pro item.');
    if (num(d.intervaloKm) <= 0) return aviso('Informe de quantos em quantos km.');
    gravar(db.manutencoes, id, {
      nome: d.nome.trim(),
      intervaloKm: num(d.intervaloKm),
      kmUltima: num(d.kmUltima)
    });
  }

  salvar();
  fecharFicha();
  redesenhar();
  aviso(id ? 'Alterado ✓' : 'Salvo ✓');
}

function gravar(lista, id, dados) {
  if (id) {
    const i = lista.findIndex(x => x.id === id);
    if (i >= 0) lista[i] = Object.assign(lista[i], dados);
  } else {
    lista.push(Object.assign({ id: novoId() }, dados));
  }
}

function apagarAtual() {
  if (!edicao || !edicao.id) return;
  const { tipo, id } = edicao;
  const lista = { jornada: db.jornadas, abastecimento: db.abastecimentos, despesa: db.despesas, manutencao: db.manutencoes }[tipo];
  const i = lista.findIndex(x => x.id === id);
  if (i >= 0) lista.splice(i, 1);
  salvar();
  fecharFicha();
  redesenhar();
  aviso('Apagado');
}

/* ---------------- 8. Backup e exportação ---------------- */

function baixar(nomeArquivo, conteudo, tipoMime) {
  const blob = new Blob([conteudo], { type: tipoMime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportarCSV() {
  const campo = v => {
    const s = String(v == null ? '' : v);
    return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const n = v => (num(v) ? String(num(v).toFixed(2)).replace('.', ',') : '');
  const data = s => { const [a, m, d] = s.split('-'); return `${d}/${m}/${a}`; };  // Excel brasileiro

  const linhas = [['Tipo', 'Data', 'Descrição', 'Valor (R$)', 'Km', 'Litros', 'Horas', 'Corridas', 'Odômetro'].join(';')];

  db.jornadas.forEach(j => linhas.push([
    'Dia de trabalho', data(j.data), '', n(j.ganho), n(j.km), '', n(j.horas), j.corridas || '', ''
  ].map(campo).join(';')));

  db.abastecimentos.forEach(a => linhas.push([
    'Abastecimento', data(a.data), a.posto || '', '-' + n(a.valor), '', n(a.litros), '', '', a.odometro || ''
  ].map(campo).join(';')));

  db.despesas.forEach(d => linhas.push([
    'Despesa: ' + (d.categoria || ''), data(d.data), d.descricao || '', '-' + n(d.valor), '', '', '', '', ''
  ].map(campo).join(';')));

  // ﻿ = marca que faz o Excel abrir os acentos certos
  baixar(`minhas-corridas-${hojeStr()}.csv`, '﻿' + linhas.join('\r\n'), 'text/csv;charset=utf-8');
  aviso('Planilha gerada ✓');
}

function fazerBackup() {
  baixar(`backup-minhas-corridas-${hojeStr()}.json`, JSON.stringify(db, null, 2), 'application/json');
  aviso('Backup salvo ✓');
}

function restaurarBackup(arquivo) {
  const leitor = new FileReader();
  leitor.onload = () => {
    try {
      const novo = JSON.parse(leitor.result);
      if (!novo || !Array.isArray(novo.jornadas)) throw new Error('formato inválido');
      const qtd = novo.jornadas.length + (novo.abastecimentos || []).length + (novo.despesas || []).length;
      if (!confirm(`Restaurar ${qtd} lançamentos deste backup?\n\nTudo que está no app agora será substituído.`)) return;
      db = Object.assign(structuredClone(PADRAO), novo, {
        config: Object.assign({}, PADRAO.config, novo.config || {})
      });
      salvar();
      redesenhar();
      aviso('Backup restaurado ✓');
    } catch (e) {
      aviso('Esse arquivo não parece um backup válido.');
    }
  };
  leitor.readAsText(arquivo);
}

function apagarTudo() {
  if (!confirm('Apagar TODOS os lançamentos?\n\nIsso não tem como desfazer. Faça um backup antes se tiver dúvida.')) return;
  if (!confirm('Tem certeza mesmo? Todos os dados serão perdidos.')) return;
  db = structuredClone(PADRAO);
  salvar();
  redesenhar();
  aviso('Tudo apagado');
}

/* ---------------- 9. Navegação e eventos ---------------- */

let telaAtual = 'painel';

function mostrar(view) {
  telaAtual = view;
  ['painel', 'historico', 'ajustes'].forEach(v => { $('#view-' + v).hidden = v !== view; });
  $$('.tab').forEach(t => t.classList.toggle('is-active', t.dataset.view === view));
  if (view === 'historico') desenharHistorico();
  if (view === 'ajustes')   desenharAjustes();
  if (view === 'painel')    desenharPainel();
}

function redesenhar() {
  desenharPainel();
  if (telaAtual === 'historico') desenharHistorico();
  if (telaAtual === 'ajustes')   desenharAjustes();
}

function ligarEventos() {
  // navegação
  $$('.tab').forEach(t => t.addEventListener('click', () => mostrar(t.dataset.view)));

  // botões de lançamento
  $$('[data-novo]').forEach(b => b.addEventListener('click', () => abrirFicha(b.dataset.novo)));

  // período
  $$('#segmented .seg').forEach(s => s.addEventListener('click', () => {
    periodo = s.dataset.periodo;
    $$('#segmented .seg').forEach(o => o.classList.toggle('is-active', o === s));
    desenharPainel();
  }));

  // filtro do histórico
  $$('#hist-filtro .seg').forEach(s => s.addEventListener('click', () => {
    filtroHist = s.dataset.tipo;
    $$('#hist-filtro .seg').forEach(o => o.classList.toggle('is-active', o === s));
    desenharHistorico();
  }));

  // abrir item do histórico para editar
  $('#hist-lista').addEventListener('click', e => {
    const b = e.target.closest('[data-editar]');
    if (b) abrirFicha(b.dataset.editar, b.dataset.id);
  });

  // ficha
  $('#sheet-cancel').addEventListener('click', fecharFicha);
  $('#backdrop').addEventListener('click', fecharFicha);
  $('#sheet-save').addEventListener('click', salvarFicha);
  $('#sheet-form').addEventListener('submit', e => { e.preventDefault(); salvarFicha(); });

  $('#sheet-form').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (chip) {
      const grupo = chip.closest('[data-chips]');
      $$('.chip', grupo).forEach(c => c.classList.toggle('is-on', c === chip));
      $(`[name="${grupo.dataset.chips}"]`, $('#sheet-form')).value = chip.dataset.valor;
      return;
    }
    const sw = e.target.closest('[data-switch]');
    if (sw) {
      sw.classList.toggle('is-on');
      sw.setAttribute('aria-pressed', sw.classList.contains('is-on'));
      return;
    }
    if (e.target.closest('[data-apagar]')) {
      if (confirm('Apagar este lançamento?')) apagarAtual();
    }
  });

  // cálculo automático litros <-> preço
  $('#sheet-form').addEventListener('input', e => {
    if (!edicao || edicao.tipo !== 'abastecimento') return;
    const f = $('#sheet-form');
    const campo = e.target.name;
    if (!['valor', 'precoLitro', 'litros'].includes(campo)) return;

    const valor = num(f.valor.value), preco = num(f.precoLitro.value), litros = num(f.litros.value);
    if (campo !== 'litros' && valor > 0 && preco > 0) {
      f.litros.value = dec(valor / preco, 2);
    } else if (campo === 'litros' && valor > 0 && litros > 0) {
      f.precoLitro.value = dec(valor / litros, 3);
    }
  });

  // ajustes
  ['#cfg-nome', '#cfg-carro', '#cfg-meta-dia', '#cfg-meta-semana']
    .forEach(s => $(s).addEventListener('change', guardarConfig));

  $('#btn-nova-manut').addEventListener('click', () => abrirFicha('manutencao'));
  $('#cfg-manut').addEventListener('click', e => {
    const ed = e.target.closest('[data-editar-manut]');
    if (ed) return abrirFicha('manutencao', ed.dataset.editarManut);
    const rm = e.target.closest('[data-remover-manut]');
    if (rm && confirm('Remover este item de manutenção?')) {
      db.manutencoes = db.manutencoes.filter(m => m.id !== rm.dataset.removerManut);
      salvar();
      redesenhar();
    }
  });

  $('#btn-export-csv').addEventListener('click', exportarCSV);
  $('#btn-backup').addEventListener('click', fazerBackup);
  $('#btn-restore').addEventListener('click', () => $('#file-restore').click());
  $('#file-restore').addEventListener('change', e => {
    if (e.target.files[0]) restaurarBackup(e.target.files[0]);
    e.target.value = '';
  });
  $('#btn-apagar').addEventListener('click', apagarTudo);

  // fechar ficha com Esc (útil no computador)
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('#sheet').hidden) fecharFicha();
  });

  // volta pro painel quando o app é reaberto (pode ter virado o dia)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) redesenhar();
  });
}

/* ---------------- 10. Início ---------------- */

ligarEventos();
mostrar('painel');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* sem offline, mas o app funciona */ });
  });
}
