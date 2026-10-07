'use strict';
/* Blocos 2 — núcleo: regras dos blocos, barra lateral, vistas gerais (Hoje, Próximos, Busca…), cartão do bloco e eventos. */

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
const today = () => ymd(new Date());
const fmtData = (s, o) => parse(s).toLocaleDateString('pt-BR', o || { weekday: 'long', day: 'numeric', month: 'long' });
const fmtDia = s => { const t = today(); return s === t ? 'Hoje' : s === addDays(t, 1) ? 'Amanhã' : s === addDays(t, -1) ? 'Ontem' : fmtData(s, { weekday: 'short', day: 'numeric', month: 'short' }); };
const fmtQuando = ts => new Date(ts).toLocaleString('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const plural = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);
const norma = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// texto escuro ou claro, conforme a cor da peça
const ink = c => { const n = parseInt(c.slice(1), 16), l = 0.299 * (n >> 16) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255); return l > 150 ? '#1B1F2A' : '#FFFFFF'; };

const SEM_COR = { id: '', nome: 'Sem etiqueta', cor: '#D8D2C4' };
const corDe = id => byId(S.cores, id) || SEM_COR;
const cores = () => S.cores.slice().sort((a, b) => a.ordem - b.ordem);
const cfg = () => byId(S.ajustes, 'cfg');
const colsDe = cx => S.colunas.filter(c => c.caixa === cx).sort((a, b) => a.ordem - b.ordem);
const caixaDe = b => byId(S.caixas, b.caixa);
const caixas = () => S.caixas.filter(c => !c.arquivada).sort((a, b) => (b.id === 'entrada') - (a.id === 'entrada') || (b.fav - a.fav) || a.ordem - b.ordem);
const ordB = (a, b) => (b.fixo - a.fixo) || (a.ordem - b.ordem);
const vivo = b => { const c = caixaDe(b); return !b.lixo && !b.arquivado && !!c && !c.arquivada; };
const filhos = id => S.blocos.filter(b => b.pai === id && !b.lixo && !b.arquivado).sort((a, b) => a.ordem - b.ordem);
const descend = id => S.blocos.filter(b => b.pai === id).flatMap(b => [b, ...descend(b.id)]);
const raizes = cx => S.blocos.filter(b => b.caixa === cx && !b.pai && !b.lixo && !b.arquivado);
const atrasado = b => !b.feito && !!b.prazo && b.prazo < today();
const tagsDe = b => b.tags.split(',').map(x => x.trim()).filter(Boolean);
const REPETE = { '': 'Não se repete', dia: 'Todo dia', util: 'Dias úteis', semana: 'Toda semana', mes: 'Todo mês' };

const U = { v: 'hoje', caixa: '', q: '', f: { txt: '', cor: '', prio: '', prazo: '', feitos: true }, ord: 'manual', ts: { k: 'ordem', d: 1 }, mes: today().slice(0, 7), sel: null, abertos: new Set(), verFeitos: false, pv: 'agenda', aberto: '', ler: false };
let inst = null, toastT = null, desfazer = null, ultima = '';

function toast(msg, undo) {
  const t = $('#toast'); desfazer = undo || null;
  t.innerHTML = esc(msg) + (undo ? ' <button data-act="desfazer">Desfazer</button>' : '');
  t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), undo ? 6000 : 3200);
}
function recusa(id, msg) { toast(msg); FX.no(); document.querySelectorAll(`[data-id="${id}"].bk, [data-fx="${id}"]`).forEach(el => FX.play(el, 'shake')); return false; }
async function copiar(txt, ok) { try { if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ text: txt }); else { await navigator.clipboard.writeText(txt); toast(ok || 'Copiado.'); } } catch (e) { if (e && e.name !== 'AbortError') toast('Não consegui copiar.'); } }
function baixar(nome, txt, tipo) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: tipo || 'application/json' })); a.download = nome; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }
// executa uma mudança em blocos e oferece "Desfazer": guarda como eles estavam e apaga o que nasceu
function comUndo(recs, fn, msg) {
  const antes = recs.map(r => JSON.stringify(r)), ids = new Set(S.blocos.map(b => b.id));
  fn(); DB.changed();
  toast(msg, () => {
    S.blocos.filter(b => !ids.has(b.id)).forEach(b => Data.del('blocos', b.id, true));
    antes.forEach(j => { const o = JSON.parse(j), r = byId(S.blocos, o.id); if (r) { Object.keys(r).forEach(k => delete r[k]); Object.assign(r, o); Data.put('blocos', r, true); } });
    DB.changed(); refresh();
  });
}

/* ---------- a peça ---------- */
function card(b, o = {}) {
  const c = corDe(b.cor), k = filhos(b.id), kd = k.filter(x => x.feito).length, late = atrasado(b), cx = caixaDe(b), meta = [];
  if (b.prazo) meta.push(`<i class="${late ? 'bad' : ''}">${fmtDia(b.prazo)}${b.hora ? ' ' + b.hora : ''}</i>`);
  if (k.length) meta.push(`<i>${kd}/${k.length}</i>`);
  if (b.prio) meta.push(`<i class="pr">${'!'.repeat(b.prio)}</i>`);
  if (b.repete) meta.push('<i title="Repete">↻</i>');
  if (b.texto) meta.push('<i title="Tem texto">¶</i>');
  if (b.link) meta.push('<i title="Tem link">↗</i>');
  tagsDe(b).slice(0, 3).forEach(t => meta.push(`<i>#${esc(t)}</i>`));
  if (o.caixa && cx) meta.push(`<i>${esc((cx.icone ? cx.icone + ' ' : '') + cx.nome)}</i>`);
  return `<div class="bk${b.feito ? ' feito' : ''}${late ? ' late' : ''}${U.sel && U.sel.has(b.id) ? ' sel' : ''}${b.forma === 'nota' ? ' nota' : ''}" role="button" tabindex="0" draggable="true" data-act="abrir" data-id="${b.id}" style="--c:${c.cor};--ink:${ink(c.cor)};--st:${b.peso}">
    ${b.forma === 'nota' ? '<span class="chk nt" title="Nota">¶</span>' : `<button class="chk" data-act="check" data-id="${b.id}" aria-label="${b.feito ? 'Reabrir' : 'Concluir'}">${b.feito ? '✓' : ''}</button>`}
    <span class="tx"><b>${esc(b.titulo) || 'Sem título'}</b>${meta.length ? `<small>${meta.join('')}</small>` : ''}${k.length ? `<span class="pg"><i style="width:${kd / k.length * 100}%"></i></span>` : ''}</span>
    ${b.estrela ? '<span class="mk" title="Estrela">★</span>' : ''}${b.fixo ? '<span class="mk" title="Fixado">◆</span>' : ''}${o.mais || ''}</div>`;
}
// texto com marcação leve: títulos, listas, citações, negrito, itálico, código, links e caixinhas de marcar
function md(src, id) {
  let n = -1;
  const inl = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>').replace(/~~([^~]+)~~/g, '<s>$1</s>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>').replace(/(^|\s)(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
  return src.split('\n').map(l => {
    let m;
    if ((m = l.match(/^(#{1,3})\s+(.*)/))) return `<h${m[1].length + 2}>${inl(m[2])}</h${m[1].length + 2}>`;
    if ((m = l.match(/^\s*(?:[-*]\s+)?\[( |x|X)\]\s+(.*)/))) { n++; return `<label class="mdc"><input type="checkbox" ${id ? `data-mdc="${n}" data-id="${id}"` : 'disabled'} ${m[1] === ' ' ? '' : 'checked'}><span>${inl(m[2])}</span></label>`; }
    if ((m = l.match(/^(\s*)[-*]\s+(.*)/))) return `<div class="li" style="margin-left:${Math.min(3, m[1].length / 2) * 16}px">${inl(m[2])}</div>`;
    if ((m = l.match(/^\s*(\d+)[.)]\s+(.*)/))) return `<div class="li num" data-n="${m[1]}.">${inl(m[2])}</div>`;
    if ((m = l.match(/^>\s?(.*)/))) return `<blockquote>${inl(m[1])}</blockquote>`;
    if (/^-{3,}\s*$/.test(l)) return '<hr>';
    return l.trim() ? `<p>${inl(l)}</p>` : '<div class="gap"></div>';
  }).join('');
}

/* ---------- regras ---------- */
// "Pagar boleto sexta às 14h #urgente @casa ! *" → título, prazo, hora, etiqueta, caixa, prioridade e estrela
function interpreta(txt) {
  const r = { tags: [], prio: 0, estrela: false, prazo: '', hora: '', cor: '', caixa: '' }, t = today(), DS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
  txt = (' ' + txt + ' ').replace(/\s\*(?=\s)/g, () => { r.estrela = true; return ' '; })
    .replace(/\s(!{1,3})(?=\s)/g, (m, x) => { r.prio = x.length; return ' '; })
    .replace(/\s#([^\s#]+)/g, (m, w) => { const c = S.cores.find(x => norma(x.nome).startsWith(norma(w))); if (c && !r.cor) r.cor = c.id; else r.tags.push(w); return ' '; })
    .replace(/\s@(\S+)/g, (m, w) => { const c = caixas().find(x => norma(x.nome).replace(/\s+/g, '').startsWith(norma(w))); if (c) { r.caixa = c.id; return ' '; } return m; })
    .replace(/\s(?:às|as)\s(\d{1,2})(?:[:h](\d{2})?)?(?=\s)/i, (m, h, mi) => { if (+h < 24) { r.hora = pad(+h) + ':' + (mi || '00'); return ' '; } return m; })
    .replace(/\s(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?(?=\s)/, (m, d, mo, y) => { if (+d < 1 || +d > 31 || +mo < 1 || +mo > 12) return m; let s = `${y || t.slice(0, 4)}-${pad(+mo)}-${pad(+d)}`; if (!y && s < t) s = `${+t.slice(0, 4) + 1}${s.slice(4)}`; r.prazo = s; return ' '; })
    .replace(/\s(hoje|amanh[aã]|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo|seg|ter|qua|qui|sex|s[aá]b|dom)(?=\s)/i, (m, w) => {
      if (r.prazo) return m;
      const k = norma(w); if (k === 'hoje') r.prazo = t; else if (k === 'amanha') r.prazo = addDays(t, 1); else { const alvo = DS.indexOf(k.slice(0, 3)); r.prazo = addDays(t, ((alvo - parse(t).getDay() + 6) % 7) + 1); }
      return ' ';
    });
  r.titulo = txt.replace(/\s+/g, ' ').trim().slice(0, 300);
  return r;
}
function novo(p) {
  const cx = byId(S.caixas, p.caixa) ? p.caixa : 'entrada', cols = colsDe(cx), c0 = byId(S.colunas, p.coluna);
  const col = c0 && c0.caixa === cx ? c0.id : ((cols.find(c => !c.feito) || cols[0] || {}).id || '');
  const irm = S.blocos.filter(b => b.caixa === cx && b.pai === (p.pai || ''));
  return Data.put('blocos', Object.assign({ criado: Date.now(), ordem: Math.max(0, ...irm.map(b => b.ordem)) + 1, forma: 'tarefa', peso: 1 }, p, { caixa: cx, coluna: col }), true);
}
// cada linha vira um bloco; `ctx` diz onde ele nasce
function capturar(txt, ctx = {}) {
  const out = [];
  txt.split('\n').forEach(l => {
    const r = interpreta(l); if (!r.titulo) return;
    const pai = ctx.pai && byId(S.blocos, ctx.pai);
    out.push(novo({ titulo: r.titulo, prazo: r.prazo || ctx.prazo || '', hora: r.hora, cor: r.cor, tags: r.tags.join(', '), prio: r.prio, estrela: r.estrela, forma: ctx.forma || 'tarefa',
      caixa: pai ? pai.caixa : (r.caixa || ctx.caixa || 'entrada'), coluna: pai ? pai.coluna : (r.caixa && r.caixa !== ctx.caixa ? '' : ctx.coluna), pai: pai ? pai.id : '', hoje: ctx.hoje ? today() : '' }));
  });
  out.forEach(b => FX.mark(b.id, 'pop')); if (out.length) { FX.pluck(); DB.changed(); }
  return out;
}
const proxima = (d, rep) => {
  if (rep === 'dia') return addDays(d, 1);
  if (rep === 'semana') return addDays(d, 7);
  if (rep === 'util') { let x = addDays(d, 1); while ([0, 6].includes(parse(x).getDay())) x = addDays(x, 1); return x; }
  const p = parse(d), dia = p.getDate(); p.setDate(1); p.setMonth(p.getMonth() + 1); p.setDate(Math.min(dia, new Date(p.getFullYear(), p.getMonth() + 1, 0).getDate())); return ymd(p);
};
function clonar(b, extra, paiNovo) {
  const n = Data.put('blocos', Object.assign({}, b, { id: uid(), feito: 0, lixo: 0, criado: Date.now(), pai: paiNovo == null ? b.pai : paiNovo }, extra), true);
  S.blocos.filter(x => x.pai === b.id && !x.lixo).forEach(x => clonar(x, { caixa: n.caixa, coluna: n.coluna }, n.id));
  return n;
}
// concluir leva o bloco para a coluna de conclusão (se a caixa tiver uma) e conclui os de dentro
function setFeito(b, v) {
  const cols = colsDe(b.caixa), cur = byId(S.colunas, b.coluna);
  b.feito = v ? Date.now() : 0;
  if (!b.pai) { if (v) { const f = cols.find(c => c.feito); if (f) b.coluna = f.id; } else if (cur && cur.feito) { const a = cols.find(c => !c.feito); if (a) b.coluna = a.id; } }
  Data.put('blocos', b, true);
}
function concluir(id, v) {
  const b = byId(S.blocos, id), dentro = descend(id).filter(x => !x.lixo), colAntes = b.coluna;
  comUndo([b, ...dentro], () => {
    setFeito(b, v);
    if (v) dentro.filter(x => !x.feito).forEach(x => { x.feito = Date.now(); Data.put('blocos', x, true); });
    if (v && b.repete) { const n = clonar(b, { coluna: colAntes, prazo: proxima(b.prazo || today(), b.repete), hoje: '' }); FX.mark(n.id, 'pop'); }
  }, v ? (b.repete ? `Concluído. Volta ${fmtDia(proxima(b.prazo || today(), b.repete)).toLowerCase()}.` : 'Concluído.') : 'Reaberto.');
  if (!v) return;
  FX.mark(id, 'snap'); FX.novo = id; FX.snap();
  const pai = b.pai && byId(S.blocos, b.pai), raiz = raizes(b.caixa).filter(x => x.forma !== 'nota'), t = today();
  if (pai && !pai.feito && filhos(pai.id).every(x => x.feito)) { FX.mark(pai.id, 'lib'); setTimeout(FX.free, 160); toast(`Tudo encaixado dentro de “${pai.titulo}”. Falta só concluir o bloco.`, desfazer); }
  else if (!b.pai && b.caixa !== 'entrada' && raiz.length >= 3 && raiz.every(x => x.feito)) { FX.confete(); FX.win(); toast(`Caixa montada: ${caixaDe(b).nome}.`, desfazer); }
  else if (!S.blocos.some(x => vivo(x) && !x.feito && x.forma !== 'nota' && ((x.prazo && x.prazo <= t) || x.hoje === t)) && (b.prazo === t || b.hoje === t)) { FX.win(); toast('Dia limpo: nada mais para hoje.', desfazer); }
}
function moverColuna(b, colId, antesId) {
  const col = byId(S.colunas, colId), de = byId(S.colunas, b.coluna); if (!col) return false;
  const la = S.blocos.filter(x => x.coluna === colId && !x.pai && !x.lixo && !x.arquivado && x.id !== b.id).sort(ordB);
  if (col.id !== b.coluna && col.limite && la.filter(x => !x.feito).length >= col.limite) { document.querySelectorAll(`[data-fx="${colId}"]`).forEach(el => FX.play(el, 'shake')); return recusa(b.id, `“${col.nome}” está no limite de ${plural(col.limite, 'bloco', 'blocos')}. Termine um antes de puxar outro.`); }
  const i = la.findIndex(x => x.id === antesId);
  b.ordem = i < 0 ? Math.max(0, ...la.map(x => x.ordem)) + 1 : ((i ? la[i - 1].ordem : la[i].ordem - 1) + la[i].ordem) / 2;
  if (b.caixa !== col.caixa) { b.caixa = col.caixa; descend(b.id).forEach(x => { x.caixa = col.caixa; x.coluna = colId; Data.put('blocos', x, true); }); }
  b.coluna = colId; b.pai = '';
  if (col.feito && !b.feito) { b.feito = Date.now(); FX.mark(b.id, 'snap'); FX.novo = b.id; FX.snap(); } else if (!col.feito && b.feito && de && de.feito) b.feito = 0;
  if (!col.feito || !b.feito) FX.mark(b.id, 'pop');
  Data.put('blocos', b); return true;
}
function moverCaixa(b, cxId) {
  const cols = colsDe(cxId), col = (cols.find(c => !c.feito) || cols[0] || {}).id || '';
  Object.assign(b, { caixa: cxId, coluna: col, pai: '', ordem: Math.max(0, ...raizes(cxId).map(x => x.ordem)) + 1 }); if (b.feito && cols.find(c => c.feito)) b.coluna = cols.find(c => c.feito).id;
  descend(b.id).forEach(x => { x.caixa = cxId; x.coluna = b.coluna; Data.put('blocos', x, true); });
  Data.put('blocos', b, true); FX.mark(b.id, 'pop');
}
function encaixarEm(b, paiId) {
  const pai = byId(S.blocos, paiId);
  if (!pai) { b.pai = ''; b.ordem = Math.max(0, ...raizes(b.caixa).map(x => x.ordem)) + 1; return Data.put('blocos', b); }
  if (pai.id === b.id || descend(b.id).some(x => x.id === pai.id)) return recusa(b.id, 'Um bloco não pode ficar dentro dele mesmo.');
  Object.assign(b, { pai: pai.id, caixa: pai.caixa, coluna: pai.coluna, ordem: Math.max(0, ...filhos(pai.id).map(x => x.ordem)) + 1 });
  descend(b.id).forEach(x => { x.caixa = pai.caixa; x.coluna = pai.coluna; Data.put('blocos', x, true); });
  Data.put('blocos', b); U.abertos.add(pai.id);
}
const marcar = (b, k, v) => [b, ...descend(b.id)].forEach(x => { x[k] = v; Data.put('blocos', x, true); });
function apagar(id) { descend(id).forEach(x => Data.del('blocos', x.id, true)); Data.del('blocos', id, true); }
function textoDe(b, n = 0) { return `${'  '.repeat(n)}- [${b.feito ? 'x' : ' '}] ${b.titulo}${b.prazo ? ' (' + fmtData(b.prazo, { day: 'numeric', month: 'short' }) + ')' : ''}\n` + filhos(b.id).map(x => textoDe(x, n + 1)).join(''); }
const doDia = () => { const t = today(); return S.blocos.filter(b => vivo(b) && !b.feito && b.forma !== 'nota' && ((b.prazo && b.prazo <= t) || b.hoje === t)); };

/* ---------- barra lateral ---------- */
function drawSide() {
  const item = (v, ic, n, cnt, extra) => `<button class="si${U.v === v ? ' on' : ''}" data-act="ir" data-v="${v}" ${extra || ''}><span>${ic}</span><b>${n}</b>${cnt ? `<i>${cnt}</i>` : ''}</button>`;
  const err = Sync.error || Sync.g.error, lixo = S.blocos.filter(b => b.lixo && !(b.pai && (byId(S.blocos, b.pai) || {}).lixo)).length;
  $('#side').innerHTML = `<div class="brand"><img src="logo.svg" alt=""><span>Blocos 2</span></div>
    <form data-form="captura" data-global="1" class="cap"><input name="q" placeholder="Capturar um bloco…" aria-label="Captura rápida" autocomplete="off" maxlength="300"><button class="btn pri" aria-label="Capturar">＋</button></form>
    ${item('hoje', '☀', 'Hoje', doDia().length, 'data-drop="hoje"')}${item('prox', '▦', 'Próximos')}${item('estrelas', '★', 'Estrelas', S.blocos.filter(b => vivo(b) && b.estrela && !b.feito).length)}${item('busca', '⌕', 'Buscar')}
    <h4>Caixas <button class="ib sm" data-act="novaCaixa" aria-label="Nova caixa" title="Nova caixa">＋</button></h4>
    <div class="cxs">${caixas().map(c => { const n = raizes(c.id).filter(b => !b.feito).length; return `<button class="si${U.v === 'caixa' && U.caixa === c.id ? ' on' : ''}" data-act="irCaixa" data-id="${c.id}" data-drop="caixa"><span>${esc(c.icone) || '▪'}</span><b>${esc(c.nome)}</b>${c.fav ? '<em>★</em>' : ''}${n ? `<i>${n}</i>` : ''}</button>`; }).join('')}</div>
    <div class="sf">${item('painel', '▥', 'Painel')}${item('arquivo', '▤', 'Arquivo')}${item('lixo', '✕', 'Lixeira', lixo, 'data-drop="lixo"')}${item('ajustes', '⚙', 'Ajustes')}
      <button class="sync${Sync.any() && err ? ' bad' : ''}" data-act="ir" data-v="ajustes" title="${esc(err)}">${Sync.status()}</button></div>`;
}
const topo = (tit, extra) => `<div class="top"><button class="ib burger" data-act="side" aria-label="Abrir o menu">☰</button><div class="grow">${tit}</div>${extra || ''}</div>`;
const lista = (bs, o) => bs.map(b => card(b, o || { caixa: 1 })).join('');

/* ---------- vistas gerais ---------- */
function vHoje() {
  const t = today(), todos = doDia(), at = todos.filter(b => b.prazo && b.prazo < t).sort(ordPrazo), hj = todos.filter(b => !(b.prazo && b.prazo < t)).sort((a, b) => b.prio - a.prio || (a.hora || '99').localeCompare(b.hora || '99'));
  const fe = S.blocos.filter(b => vivo(b) && b.feito && b.forma !== 'nota' && ymd(new Date(b.feito)) === t), meta = cfg().meta, R = 26, C = 2 * Math.PI * R;
  const ids = new Set(todos.map(b => b.id)), sug = S.blocos.filter(b => vivo(b) && !b.feito && b.forma !== 'nota' && !ids.has(b.id) && (b.estrela || b.prio >= 2 || (b.prazo && b.prazo <= addDays(t, 3)))).sort((a, b) => b.prio - a.prio).slice(0, 6);
  return topo(`<h2>Hoje</h2><p class="muted">${fmtData(t)}</p>`, `<div class="anel"><svg viewBox="0 0 64 64" width="52" height="52" aria-hidden="true"><circle cx="32" cy="32" r="${R}" fill="none" stroke="var(--soft)" stroke-width="7"/><circle cx="32" cy="32" r="${R}" fill="none" stroke="var(--ok)" stroke-width="7" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - Math.min(1, meta ? fe.length / meta : 0))}" transform="rotate(-90 32 32)"/></svg><div><b>${fe.length}${meta ? '/' + meta : ''}</b><span class="muted sm">concluídos</span></div></div>`)
    + `${capForm('data-hoje="1"', 'O que entra no dia de hoje?')}
    ${at.length ? `<h4><span class="bad">Atrasados</span> <span class="muted">${at.length}</span> <button class="btn sm" data-act="trazer">Trazer todos para hoje</button></h4>${lista(at)}` : ''}
    <h4>Para hoje <span class="muted">${hj.length}</span>${hj.length ? ` <button class="btn sm" data-act="empurrar">Empurrar o que sobrou para amanhã</button>` : ''}</h4>
    ${lista(hj) || `<p class="empty">${fe.length ? 'Dia limpo: tudo de hoje foi concluído.' : 'Nada marcado para hoje. Capture acima ou puxe uma sugestão.'}</p>`}
    ${sug.length ? `<h4>Sugestões <span class="muted">com estrela, prioridade ou prazo chegando</span></h4>${sug.map(b => card(b, { caixa: 1, mais: `<button class="btn sm" data-act="hoje" data-id="${b.id}">＋ Hoje</button>` })).join('')}` : ''}
    ${fe.length ? `<details class="feitos"><summary>Concluídos hoje (${fe.length})</summary>${lista(fe)}</details>` : ''}`;
}
const ordPrazo = (a, b) => (a.prazo || '9').localeCompare(b.prazo || '9') || b.prio - a.prio;
function vProx() {
  const t = today(), bs = S.blocos.filter(b => vivo(b) && b.prazo && (!b.feito || U.pv === 'cal'));
  const dias = Array.from({ length: 14 }, (_, i) => addDays(t, i)), ab = bs.filter(b => !b.feito), depois = ab.filter(b => b.prazo > dias[13]).sort(ordPrazo);
  return topo('<h2>Próximos</h2><p class="muted">Tudo o que tem prazo, de todas as caixas.</p>', `<div class="seg"><button data-act="pv" data-v="agenda" class="${U.pv === 'agenda' ? 'on' : ''}">Agenda</button><button data-act="pv" data-v="cal" class="${U.pv === 'cal' ? 'on' : ''}">Calendário</button></div>`)
    + (U.pv === 'cal' ? vCal(S.blocos.filter(b => vivo(b) && !b.pai), '') : (dias.map(d => { const l = ab.filter(b => b.prazo === d).sort((a, b) => (a.hora || '99').localeCompare(b.hora || '99')); return l.length || d === t ? `<section data-drop="dia" data-dia="${d}"><h4>${fmtDia(d)} <span class="muted">${fmtData(d, { day: 'numeric', month: 'long' })}</span></h4>${lista(l) || '<p class="muted sm">Nada com prazo.</p>'}</section>` : ''; }).join('')
      + (depois.length ? `<h4>Mais adiante <span class="muted">${depois.length}</span></h4>${lista(depois)}` : '')));
}
function vEstrelas() {
  const bs = S.blocos.filter(b => vivo(b) && b.estrela).sort((a, b) => !!a.feito - !!b.feito || ordPrazo(a, b));
  return topo('<h2>Estrelas</h2><p class="muted">Os blocos que você marcou como importantes.</p>') + (lista(bs) || '<p class="empty">Nenhum bloco com estrela. Abra um bloco e toque em ★.</p>');
}
// busca com atalhos: #etiqueta, @caixa, :feito, :aberto, :atrasado, :nota, :estrela, :hoje, :semprazo
function buscar(q) {
  const termos = [], fs = [];
  q.split(/\s+/).filter(Boolean).forEach(w => {
    const n = norma(w.slice(1));
    if (w[0] === '#' && n) fs.push(b => norma(corDe(b.cor).nome).startsWith(n) || tagsDe(b).some(t => norma(t).startsWith(n)));
    else if (w[0] === '@' && n) fs.push(b => norma((caixaDe(b) || {}).nome).replace(/\s+/g, '').startsWith(n));
    else if (w[0] === ':' && n) fs.push({ feito: b => !!b.feito, aberto: b => !b.feito, atrasado, nota: b => b.forma === 'nota', estrela: b => b.estrela, hoje: b => b.prazo === today() || b.hoje === today(), semprazo: b => !b.prazo }[n] || (() => true));
    else termos.push(norma(w));
  });
  return S.blocos.filter(b => vivo(b) && fs.every(f => f(b)) && termos.every(t => norma(b.titulo + ' ' + b.texto + ' ' + b.tags + ' ' + b.link).includes(t)));
}
function resBusca() {
  if (!U.q.trim()) return `<p class="empty">Escreva para buscar em títulos, textos, etiquetas e links.</p><p class="muted sm">Atalhos: <code>#etiqueta</code> <code>@caixa</code> <code>:atrasado</code> <code>:feito</code> <code>:aberto</code> <code>:nota</code> <code>:estrela</code> <code>:hoje</code> <code>:semprazo</code></p>
    <div class="chips">${cores().map(c => `<button class="cor" data-act="buscaCor" data-v="${esc(c.nome)}" style="--c:${c.cor};--ink:${ink(c.cor)}">${esc(c.nome)}</button>`).join('')}</div>`;
  const r = buscar(U.q), porCx = caixas().map(c => ({ c, l: r.filter(b => b.caixa === c.id) })).filter(x => x.l.length);
  return `<p class="muted sm">${plural(r.length, 'bloco encontrado', 'blocos encontrados')}</p>` + porCx.map(x => `<h4>${esc((x.c.icone ? x.c.icone + ' ' : '') + x.c.nome)} <span class="muted">${x.l.length}</span></h4>${lista(x.l.slice(0, 60), {})}`).join('');
}
function vBusca() { return topo('<h2>Buscar</h2>') + `<input type="search" class="busca" data-u="q" value="${esc(U.q)}" placeholder="Buscar em todas as caixas…" aria-label="Buscar" autofocus><div id="res">${resBusca()}</div>`; }
function vLixo() {
  const bs = S.blocos.filter(b => b.lixo && !(b.pai && (byId(S.blocos, b.pai) || {}).lixo)).sort((a, b) => b.lixo - a.lixo);
  return topo('<h2>Lixeira</h2><p class="muted">Os blocos ficam aqui por 30 dias antes de sumir.</p>', bs.length ? `<button class="btn sm danger" data-act="esvaziar">Esvaziar</button>` : '')
    + (bs.map(b => `<div class="rowl"><div class="grow"><b>${esc(b.titulo) || 'Sem título'}</b><span class="muted sm"> · ${esc((caixaDe(b) || {}).nome || 'caixa excluída')} · ${fmtQuando(b.lixo)}</span></div><button class="btn sm" data-act="restaurar" data-id="${b.id}">Restaurar</button><button class="btn sm danger" data-act="apagar" data-id="${b.id}">Apagar</button></div>`).join('') || '<p class="empty">A lixeira está vazia.</p>');
}
function vArquivo() {
  const cx = S.caixas.filter(c => c.arquivada), bs = S.blocos.filter(b => b.arquivado && !b.lixo && !(b.pai && (byId(S.blocos, b.pai) || {}).arquivado));
  return topo('<h2>Arquivo</h2><p class="muted">O que saiu de cena, mas não foi apagado.</p>')
    + `<h4>Caixas arquivadas <span class="muted">${cx.length}</span></h4>${cx.map(c => `<div class="rowl"><div class="grow"><b>${esc((c.icone ? c.icone + ' ' : '') + c.nome)}</b></div><button class="btn sm" data-act="arquivarCaixa" data-id="${c.id}">Desarquivar</button><button class="btn sm danger" data-act="delCaixa" data-id="${c.id}">Excluir</button></div>`).join('') || '<p class="muted sm">Nenhuma.</p>'}
    <h4>Blocos arquivados <span class="muted">${bs.length}</span></h4>${bs.map(b => `<div class="rowl"><div class="grow"><b>${esc(b.titulo) || 'Sem título'}</b><span class="muted sm"> · ${esc((caixaDe(b) || {}).nome || '')}</span></div><button class="btn sm" data-act="desarquivar" data-id="${b.id}">Desarquivar</button><button class="btn sm danger" data-act="lixo" data-id="${b.id}">Lixeira</button></div>`).join('') || '<p class="muted sm">Nenhum.</p>'}`;
}
const PALETAS = { 'Clássica': ['#E0483C', '#2D7DD2', '#2FA05A', '#E8B81F', '#8B5CF6', '#C9CED8'], 'Pastel': ['#F4A9A2', '#9CC5F2', '#A8DDB5', '#F6E09A', '#CDB9F5', '#DDE1E8'], 'Alto contraste': ['#B3140A', '#0B4FA8', '#0E6B33', '#FFD400', '#5B21B6', '#111827'], 'Terra': ['#B5533C', '#3E7C8C', '#6E8B3D', '#D9A441', '#8C5E7A', '#BFB5A2'] };
function vAjustes() {
  const s = S.set, gOn = Sync.gOn(), canInst = !Sync.avail && !matchMedia('(display-mode: standalone)').matches;
  const chk = (k, n) => `<label class="tog"><input type="checkbox" data-s="${k}" ${s[k] ? 'checked' : ''}><span>${n}</span></label>`;
  return topo('<h2>Ajustes</h2>', `<button class="btn sm" data-act="ajuda">Manual e atalhos</button>`) + `<div class="cols">
  <section class="panel"><h3>Etiquetas (as cores das peças)</h3>
    ${cores().map(t => `<div class="rowf"><input type="color" data-store="cores" data-id="${t.id}" data-f="cor" value="${t.cor}" aria-label="Cor"><input data-store="cores" data-id="${t.id}" data-f="nome" value="${esc(t.nome)}" aria-label="Nome" class="w2"><span class="muted sm">${S.blocos.filter(b => b.cor === t.id && vivo(b)).length}</span><button class="ib sm" data-act="delCor" data-id="${t.id}" aria-label="Excluir etiqueta">✕</button></div>`).join('')}
    <button class="btn sm add" data-act="novaCor">＋ Etiqueta</button>
    <h4>Paletas prontas</h4><div class="chips">${Object.entries(PALETAS).map(([n, p]) => `<button class="btn sm pal" data-act="paleta" data-v="${n}">${p.map(x => `<i style="background:${x}"></i>`).join('')}${n}</button>`).join('')}</div>
    <h4>Meta do dia</h4><div class="rowf"><label class="inl">Concluir <input type="number" min="0" max="99" data-cfg="meta" value="${cfg().meta}" class="w0"> blocos por dia (0 = sem meta)</label></div></section>
  <section class="panel"><h3>Este aparelho</h3>
    <h4>Aparência</h4><div class="chips">${[['auto', 'Automática'], ['claro', 'Clara'], ['escuro', 'Escura']].map(([v, n]) => `<button class="btn sm ${s.tema === v ? 'pri' : ''}" data-act="set" data-k="tema" data-v="${v}">${n}</button>`).join('')}</div>
    <h4>Estilo das peças</h4><div class="chips">${[['pinos', 'Com pinos'], ['liso', 'Lisas'], ['contorno', 'Só contorno']].map(([v, n]) => `<button class="btn sm ${s.estilo === v ? 'pri' : ''}" data-act="set" data-k="estilo" data-v="${v}">${n}</button>`).join('')}</div>
    <h4>Sensações</h4><div class="chips">${chk('anim', 'Animações')}${chk('som', 'Sons')}${chk('vibra', 'Vibração')}${chk('denso', 'Peças compactas')}</div>
    <h4>Seus modelos</h4>${S.modelos.map(m => `<div class="rowl"><div class="grow">${esc(m.nome)} <span class="muted sm">· ${m.tipo === 'caixa' ? 'caixa' : 'bloco'}</span></div><button class="ib sm" data-act="delModelo" data-id="${m.id}" aria-label="Excluir modelo">✕</button></div>`).join('') || '<p class="muted sm">Salve uma caixa ou um bloco como modelo para reaproveitar.</p>'}
    <h4>Backup e exportação</h4><div class="row"><button class="btn sm" data-act="exportar">Exportar backup</button><button class="btn sm" data-act="importar">Importar backup</button><button class="btn sm" data-act="exportarTudo">Baixar tudo em texto (.md)</button></div>
    ${canInst ? `<h4>Aplicativo</h4><p class="muted sm">${inst ? 'Instale o Blocos 2 para abrir em tela cheia, com ícone próprio e sem internet.' : 'No celular: menu do navegador › “Adicionar à tela inicial”. No Windows há também o Blocos2.exe em <a href="https://github.com/joaogabrielmontinirossi-sys/blocos2/releases/latest" target="_blank" rel="noopener">Releases</a>.'}</p>${inst ? `<button class="btn sm" data-act="install">Instalar o aplicativo</button>` : ''}` : ''}</section>
  <section class="panel"><h3>Sincronização</h3>
    ${Sync.avail ? `<h4>Pasta do Google Drive para computador</h4>
      <p class="muted sm">${Sync.on ? `Ativa em <b>${esc(Sync.folder)}</b>${Sync.error ? ' · ' + esc(Sync.error) : ''}` : Sync.detected ? 'Desativada.' : 'Não encontrei o Google Drive neste computador; escolha uma pasta sincronizada.'}</p>
      <div class="row">${Sync.drives.filter(d => d !== Sync.folder).map(d => `<button class="btn sm" data-act="syncUse" data-path="${esc(d)}">Usar ${esc(d)}</button>`).join('')}
        <button class="btn sm" data-act="syncPick">Escolher pasta…</button>${Sync.on ? `<button class="btn sm" data-act="syncOff">Desativar</button>` : ''}</div>` : ''}
    <h4>Conta Google (Windows, site e celular)</h4>
    <p class="muted sm">${gOn ? `Conectada${Sync.g.error ? ' · ' + esc(Sync.g.error) : ''}. O arquivo blocos2-sync.json fica na área privada do app no seu Google Drive.` : 'Use o mesmo ID de cliente em todos os aparelhos para ver as mesmas caixas.'}</p>
    <label class="fld">ID do cliente OAuth<input data-s="gClient" value="${esc(s.gClient)}" placeholder="0000000000-xxxxxxxx.apps.googleusercontent.com" autocomplete="off" spellcheck="false"></label>
    <div class="row"><button class="btn pri sm" data-act="gConnect">${gOn ? 'Sincronizar agora' : s.gWas ? 'Reconectar' : 'Conectar'}</button>${gOn || s.gWas ? `<button class="btn sm" data-act="gOff">Desconectar</button>` : ''}</div>
    <details><summary>Como criar o ID do cliente (uma vez só)</summary><ol class="muted sm">
      <li>Abra <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noopener">console.cloud.google.com</a> e crie um projeto, ou use o mesmo dos seus outros aplicativos (o ID já existente serve).</li>
      <li>Em <b>APIs e serviços › Biblioteca</b>, ative a <b>Google Drive API</b>.</li>
      <li>Em <b>Tela de permissão OAuth</b>, escolha <b>Externo</b> e adicione o seu e-mail em <b>Usuários de teste</b>.</li>
      <li>Em <b>Credenciais › Criar credenciais › ID do cliente OAuth</b>, tipo <b>Aplicativo da Web</b>. Em <b>Origens JavaScript autorizadas</b>, adicione:<br><code>https://joaogabrielmontinirossi-sys.github.io</code><br><code>http://localhost:${PORT}</code></li>
      <li>Copie o ID do cliente, cole acima e clique em Conectar. Repita só a colagem nos outros aparelhos.</li></ol></details></section>
  </div>`;
}

/* ---------- desenho ---------- */
const VIEWS = { hoje: vHoje, prox: vProx, estrelas: vEstrelas, busca: vBusca, lixo: vLixo, arquivo: vArquivo, painel: vPainel, ajustes: vAjustes, caixa: vCaixa };
function draw() {
  const s = S.set, b = document.body, y = scrollY, main = $('#main');
  document.documentElement.dataset.theme = s.tema === 'claro' ? 'light' : s.tema === 'escuro' ? 'dark' : '';
  b.dataset.estilo = s.estilo; b.classList.toggle('denso', !!s.denso); b.classList.toggle('noanim', !FX.on());
  main.innerHTML = (VIEWS[U.v] || vHoje)();
  drawSide();
  const chave = U.v + U.caixa + (U.v === 'caixa' ? (byId(S.caixas, U.caixa) || {}).vista : '');
  if (ultima !== chave) { ultima = chave; FX.play(main, 'tab'); } else scrollTo(0, y);
  const n = U.sel ? U.sel.size : 0;
  $('#selbar').innerHTML = U.sel ? `<b>${plural(n, 'bloco', 'blocos')}</b><button class="btn sm" data-act="selFazer" data-k="feito">Concluir</button><button class="btn sm" data-act="selFazer" data-k="hoje">Hoje</button>
    <select data-sel="caixa" aria-label="Mover para a caixa"><option value="">Mover para…</option>${caixas().map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join('')}</select>
    <select data-sel="cor" aria-label="Etiquetar"><option value="">Etiquetar…</option>${cores().map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join('')}</select>
    <button class="btn sm" data-act="selFazer" data-k="arquivar">Arquivar</button><button class="btn sm danger" data-act="selFazer" data-k="lixo">Lixeira</button><button class="btn sm" data-act="selModo">Cancelar</button>` : '';
  b.classList.toggle('selecao', !!U.sel);
  const hj = doDia().length; document.title = (hj ? `(${hj}) ` : '') + 'Blocos 2';
  FX.flush();
}
function refresh() { draw(); if (U.aberto && document.body.classList.contains('sheet')) { const y = $('#sheet').scrollTop; sheetBloco(U.aberto, true); $('#sheet').scrollTop = y; } }

/* ---------- folhas ---------- */
function sheet(html, cls) { const el = $('#sheet'); el.className = cls || ''; el.innerHTML = html; document.body.classList.add('sheet'); const f = $('#sheet [autofocus]'); if (f) f.focus(); }
function closeSheet() { document.body.classList.remove('sheet'); $('#sheet').innerHTML = ''; U.aberto = ''; }

// O cartão do bloco: título, etiqueta, propriedades, texto e os blocos de dentro.
function sheetBloco(id, manter) {
  const b = byId(S.blocos, id); if (!b) return closeSheet();
  if (!manter || U.aberto !== id) U.ler = !!b.texto;
  U.aberto = id;
  const c = corDe(b.cor), k = filhos(id), kd = k.filter(x => x.feito).length, t = today(), pai = b.pai && byId(S.blocos, b.pai), cols = colsDe(b.caixa);
  const F = (f, x) => `data-store="blocos" data-id="${id}" data-f="${f}" ${x || ''}`, pal = b.texto.trim() ? b.texto.trim().split(/\s+/).length : 0;
  const seg = (k2, vals, cur) => `<div class="seg">${vals.map(([v, n]) => `<button data-act="prop" data-id="${id}" data-k="${k2}" data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${n}</button>`).join('')}</div>`;
  sheet(`<div class="shead">${b.forma === 'nota' ? '' : `<button class="chk big" data-act="check" data-id="${id}" aria-label="${b.feito ? 'Reabrir' : 'Concluir'}" style="--c:${c.cor};--ink:${ink(c.cor)}">${b.feito ? '✓' : ''}</button>`}
      ${seg('forma', [['tarefa', 'Tarefa'], ['nota', 'Nota']], b.forma)}<span class="grow"></span>
      <button class="ib ${b.estrela ? 'on' : ''}" data-act="flag" data-id="${id}" data-k="estrela" aria-label="Estrela" title="Estrela">★</button><button class="ib ${b.fixo ? 'on' : ''}" data-act="flag" data-id="${id}" data-k="fixo" aria-label="Fixar no topo" title="Fixar no topo">◆</button>
      <button class="ib" data-act="fechar" aria-label="Fechar">✕</button></div>
    ${pai ? `<p class="muted sm">Dentro de <a href="#" data-act="abrir" data-id="${pai.id}">${esc(pai.titulo) || 'Sem título'}</a></p>` : ''}
    <div class="cartao" style="--c:${c.cor}">
      <input class="title big" ${F('titulo')} value="${esc(b.titulo)}" placeholder="Título do bloco" aria-label="Título" maxlength="300">
      <div class="chips">${cores().map(x => `<button class="cor ${b.cor === x.id ? 'on' : ''}" data-act="prop" data-id="${id}" data-k="cor" data-v="${b.cor === x.id ? '' : x.id}" style="--c:${x.cor};--ink:${ink(x.cor)}">${esc(x.nome)}</button>`).join('')}</div>
      <div class="props">
        <label>Prazo<input type="date" ${F('prazo', 'data-rs')} value="${b.prazo}" class="${atrasado(b) ? 'bad' : ''}"></label><label>Hora<input type="time" ${F('hora')} value="${b.hora}"></label>
        <label>Repete<select ${F('repete', 'data-rs')}>${Object.entries(REPETE).map(([v, n]) => `<option value="${v}" ${b.repete === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        ${pai ? '' : `<label>Caixa<select ${F('caixa', 'data-rs')}>${caixas().map(x => `<option value="${x.id}" ${x.id === b.caixa ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select></label>
        ${cols.length > 1 ? `<label>Coluna<select ${F('coluna', 'data-rs')}>${cols.map(x => `<option value="${x.id}" ${x.id === b.coluna ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select></label>` : ''}`}
        <label>Etiquetas livres<input ${F('tags')} value="${esc(b.tags)}" placeholder="casa, banco" maxlength="200"></label>
        <label class="w">Link${b.link ? ` <a href="${esc(/^https?:\/\//i.test(b.link) ? b.link : 'https://' + b.link)}" target="_blank" rel="noopener">abrir ↗</a>` : ''}<input ${F('link', 'data-rs')} value="${esc(b.link)}" placeholder="https://…" maxlength="500"></label>
      </div>
      <div class="row tight"><button class="btn sm" data-act="prazo" data-id="${id}" data-n="0">Hoje</button><button class="btn sm" data-act="prazo" data-id="${id}" data-n="1">Amanhã</button><button class="btn sm" data-act="prazo" data-id="${id}" data-n="7">Em uma semana</button>${b.prazo ? `<button class="btn sm" data-act="prazo" data-id="${id}" data-n="x">Sem prazo</button>` : ''}
        <button class="btn sm ${b.hoje === t ? 'pri' : ''}" data-act="hoje" data-id="${id}">☀ ${b.hoje === t ? 'No meu dia' : 'Pôr no meu dia'}</button></div>
      <div class="row tight"><span class="muted sm">Prioridade</span>${seg('prio', [[0, '—'], [1, '!'], [2, '!!'], [3, '!!!']], b.prio)}<span class="muted sm">Peso</span>${seg('peso', [[1, '1 pino'], [2, '2'], [3, '3']], b.peso)}</div>
      <h3>Texto <span class="muted sm">${pal ? plural(pal, 'palavra', 'palavras') : ''}</span><span class="grow"></span>${seg('ler', [['', 'Escrever'], ['1', 'Ler']], U.ler ? '1' : '')}</h3>
      ${U.ler ? `<div class="md" data-act="prop" data-id="${id}" data-k="ler" data-v="" title="Clique para escrever">${b.texto ? md(b.texto, id) : '<p class="muted">Sem texto. Clique para escrever.</p>'}</div>`
        : `<textarea ${F('texto')} rows="7" placeholder="Anote aqui. Use # título, - lista, [ ] caixinha, **negrito**, *itálico* e links." aria-label="Texto">${esc(b.texto)}</textarea>`}
      <h3>Blocos de dentro <span class="muted sm">${k.length ? kd + '/' + k.length : ''}</span></h3>
      ${k.length ? `<div class="meter"><i style="width:${kd / k.length * 100}%"></i></div>` : ''}
      ${k.map(x => card(x)).join('')}${capForm(`data-pai="${id}"`, 'Encaixar um bloco aqui dentro…')}
      <details class="mais"><summary>Mais ações</summary><div class="acts">
        <button class="btn sm" data-act="duplicar" data-id="${id}">Duplicar</button>
        ${b.texto ? `<button class="btn sm" data-act="desmontar" data-id="${id}">Desmontar o texto em blocos</button>` : ''}${k.length ? `<button class="btn sm" data-act="juntar" data-id="${id}">Juntar os de dentro no texto</button><button class="btn sm" data-act="concluirDentro" data-id="${id}">Concluir os de dentro</button>` : ''}
        ${pai ? `<button class="btn sm" data-act="soltar" data-id="${id}">Tirar de dentro (bloco solto)</button>` : ''}
        <button class="btn sm" data-act="salvarModeloBloco" data-id="${id}">Salvar como modelo</button><button class="btn sm" data-act="copiarBloco" data-id="${id}">Copiar como texto</button>
        <button class="btn sm" data-act="arquivar" data-id="${id}">Arquivar</button><button class="btn sm danger" data-act="lixo" data-id="${id}">Lixeira</button></div>
        <label class="fld">Encaixar dentro de outro bloco<select ${F('pai', 'data-rs')}><option value="">Nenhum (bloco solto)</option>${S.blocos.filter(x => x.caixa === b.caixa && vivo(x) && x.id !== id && !x.pai).slice(0, 200).map(x => `<option value="${x.id}" ${x.id === b.pai ? 'selected' : ''}>${esc(x.titulo.slice(0, 60))}</option>`).join('')}</select></label></details>
      <p class="muted sm hist">${b.criado ? 'Criado em ' + fmtQuando(b.criado) : ''}${b.mod ? ' · alterado em ' + fmtQuando(b.mod) : ''}${b.feito ? ' · concluído em ' + fmtQuando(b.feito) : ''}</p>
    </div>`, 'card');
}
function sheetCaixa() {
  const meus = S.modelos.filter(m => m.tipo === 'caixa');
  sheet(`<form data-form="caixa"><div class="shead"><b>Nova caixa</b><span class="grow"></span><button type="button" class="ib" data-act="fechar" aria-label="Fechar">✕</button></div>
    <label class="fld">Nome<input name="nome" placeholder="Reforma da cozinha" required autofocus maxlength="80"></label>
    <div class="fld">Montar a partir de<div class="mods">${MODELOS.map((m, i) => `<label class="pick"><input type="radio" name="modelo" value="f${i}" ${i ? '' : 'checked'}><span>${m.icone} ${m.nome}<small>${m.colunas.map(c => c.nome).join(' · ')}</small></span></label>`).join('')}
      ${meus.map(m => `<label class="pick"><input type="radio" name="modelo" value="${m.id}"><span>⭐ ${esc(m.nome)}<small>modelo seu</small></span></label>`).join('')}</div></div>
    <div class="acts"><button class="btn pri">Criar caixa</button></div></form>`);
}
function sheetTexto(cx) {
  sheet(`<form data-form="texto" data-id="${cx}"><div class="shead"><b>Colar uma lista</b><span class="grow"></span><button type="button" class="ib" data-act="fechar" aria-label="Fechar">✕</button></div>
    <p class="muted sm">Uma linha por bloco. Linhas com <code>#</code> no começo abrem uma coluna. Linhas recuadas (dois espaços) entram dentro do bloco de cima. <code>[x]</code> marca como concluído. Os atalhos da captura rápida também valem.</p>
    <textarea name="t" rows="10" required autofocus placeholder="# A fazer&#10;Comprar tinta sábado #casa&#10;  Rolo&#10;  Fita crepe&#10;# Feito&#10;[x] Medir a parede"></textarea>
    <div class="acts"><button class="btn pri">Criar blocos</button></div></form>`);
}
function sheetModelos(cx) {
  const ms = S.modelos.filter(m => m.tipo === 'bloco');
  sheet(`<div class="shead"><b>Novo bloco de um modelo</b><span class="grow"></span><button class="ib" data-act="fechar" aria-label="Fechar">✕</button></div>
    ${ms.map(m => `<div class="rowl"><div class="grow"><b>${esc(m.nome)}</b></div><button class="btn sm pri" data-act="usarModelo" data-id="${m.id}" data-caixa="${cx}">Usar</button></div>`).join('') || '<p class="empty">Nenhum modelo de bloco ainda. Abra um bloco e use <b>Mais ações › Salvar como modelo</b>: o título, o texto e os blocos de dentro ficam guardados.</p>'}`);
}
function sheetAjuda() {
  sheet(`<div class="shead"><b>Manual do Blocos 2</b><span class="grow"></span><button class="ib" data-act="fechar" aria-label="Fechar">✕</button></div>
    <ol class="sm"><li><b>Caixas</b> guardam blocos. Cada caixa pode ser vista como Quadro, Lista, Notas, Tabela ou Calendário.</li><li><b>Blocos</b> são tarefas ou notas. A cor é a etiqueta; o número de pinos é o peso.</li><li><b>Encaixe:</b> um bloco pode ter blocos dentro. O de fora mostra o progresso dos de dentro.</li><li><b>Entrada</b> recebe o que você captura sem pensar; depois é só arrastar para a caixa certa.</li></ol>
    <h3>Captura rápida</h3><p class="muted sm"><code>hoje</code>, <code>amanhã</code>, <code>sex</code>, <code>25/12</code> definem o prazo; <code>às 14h</code> a hora; <code>#etiqueta</code> a cor (ou uma etiqueta livre); <code>@caixa</code> o destino; <code>!</code> a <code>!!!</code> a prioridade; <code>*</code> a estrela. Várias linhas coladas viram vários blocos.</p>
    <h3>Arrastar</h3><p class="muted sm">Entre colunas, para um dia do calendário, para uma caixa da barra lateral, para Hoje ou para a Lixeira.</p>
    <h3>Atalhos</h3><dl class="io"><dt>N</dt><dd>Capturar</dd><dt>/</dt><dd>Buscar</dd><dt>1 a 5</dt><dd>Hoje, Próximos, Estrelas, Entrada, Painel</dd><dt>Q L T B C</dt><dd>Quadro, Lista, Tabela, Notas (bloco de notas), Calendário</dd><dt>?</dt><dd>Este manual</dd><dt>Esc</dt><dd>Fechar</dd></dl>`);
}

const ir = (v, cx) => { U.v = v; U.caixa = cx || ''; U.sel = null; if (v === 'caixa') U.f = { txt: '', cor: '', prio: '', prazo: '', feitos: true }; document.body.classList.remove('lado'); draw(); scrollTo(0, 0); };
const B = el => byId(S.blocos, el.dataset.id);
const exportaCaixa = cx => `# ${cx.nome}\n\n` + colsDe(cx.id).map(c => `## ${c.nome}\n` + raizes(cx.id).filter(b => b.coluna === c.id).sort(ordB).map(b => textoDe(b)).join('')).join('\n');
function modeloDeCaixa(cx) { const cols = colsDe(cx.id); return { icone: cx.icone, desc: cx.desc, vista: cx.vista, colunas: cols.map(c => ({ nome: c.nome, limite: c.limite, feito: c.feito })), blocos: raizes(cx.id).sort(ordB).map(b => ({ titulo: b.titulo, texto: b.texto, forma: b.forma, cor: b.cor, prio: b.prio, peso: b.peso, tags: b.tags, col: Math.max(0, cols.findIndex(c => c.id === b.coluna)), filhos: filhos(b.id).map(x => x.titulo) })) }; }

const A = {
  side() { document.body.classList.toggle('lado'); },
  ir(el) { ir(el.dataset.v); },
  irCaixa(el) { ir('caixa', el.dataset.id); },
  desfazer() { const f = desfazer; desfazer = null; $('#toast').classList.remove('on'); if (f) f(); },
  fechar() { closeSheet(); },
  abrir(el, e) {
    if (e) e.preventDefault();
    if (U.sel) { U.sel.has(el.dataset.id) ? U.sel.delete(el.dataset.id) : U.sel.add(el.dataset.id); return draw(); }
    sheetBloco(el.dataset.id);
  },
  check(el) { const b = B(el); concluir(b.id, !b.feito); refresh(); },
  prop(el) {
    const k = el.dataset.k, v = el.dataset.v;
    if (k === 'ler') { U.ler = !!v; return sheetBloco(el.dataset.id, true); }
    const b = B(el); b[k] = k === 'prio' || k === 'peso' ? +v : v;
    if (k === 'forma' && v === 'nota') b.feito = 0;
    Data.put('blocos', b); if (k === 'cor' || k === 'peso') FX.mark(b.id, 'pop'); refresh();
  },
  flag(el) { const b = B(el); b[el.dataset.k] = !b[el.dataset.k]; Data.put('blocos', b); refresh(); },
  prazo(el) { const b = B(el), n = el.dataset.n; b.prazo = n === 'x' ? '' : addDays(today(), +n); Data.put('blocos', b); refresh(); },
  hoje(el) { const b = B(el), t = today(); b.hoje = b.hoje === t ? '' : t; Data.put('blocos', b); FX.mark(b.id, 'pop'); refresh(); toast(b.hoje ? 'Está no seu dia de hoje.' : 'Saiu do dia de hoje.'); },
  duplicar(el) { const b = B(el), n = clonar(b, { titulo: b.titulo + ' (cópia)', ordem: b.ordem + 0.5 }); DB.changed(); FX.mark(n.id, 'pop'); closeSheet(); draw(); toast('Bloco duplicado, com os de dentro.'); },
  desmontar(el) {
    const b = B(el), ls = b.texto.split('\n').map(l => l.replace(/^\s*(?:[-*]\s+)?(?:\[.\]\s+)?(?:#+\s+)?/, '').trim()).filter(Boolean);
    if (!ls.length) return;
    capturar(ls.join('\n'), { pai: b.id }); b.texto = ''; Data.put('blocos', b); FX.crack(); refresh(); toast(`O texto virou ${plural(ls.length, 'bloco', 'blocos')} de dentro.`);
  },
  juntar(el) { const b = B(el), k = filhos(b.id); b.texto = (b.texto ? b.texto + '\n' : '') + k.map(x => `- [${x.feito ? 'x' : ' '}] ${x.titulo}`).join('\n'); k.forEach(x => apagar(x.id)); Data.put('blocos', b); U.ler = true; refresh(); toast('Os blocos de dentro viraram uma lista no texto.'); },
  concluirDentro(el) { const k = filhos(el.dataset.id).filter(x => !x.feito); comUndo(k, () => k.forEach(x => { x.feito = Date.now(); Data.put('blocos', x, true); }), 'Blocos de dentro concluídos.'); FX.snap(); refresh(); },
  soltar(el) { encaixarEm(B(el), ''); refresh(); toast('Agora é um bloco solto na caixa.'); },
  copiarBloco(el) { const b = B(el); copiar(textoDe(b) + (b.texto ? '\n' + b.texto : ''), 'Bloco copiado.'); },
  arquivar(el) { const b = B(el); comUndo([b, ...descend(b.id)], () => marcar(b, 'arquivado', true), 'Bloco arquivado.'); closeSheet(); draw(); },
  desarquivar(el) { marcar(B(el), 'arquivado', false); DB.changed(); draw(); },
  lixo(el) { const b = B(el), agora = Date.now(); comUndo([b, ...descend(b.id)], () => marcar(b, 'lixo', agora), 'Bloco na lixeira.'); closeSheet(); draw(); },
  restaurar(el) { const b = B(el); marcar(b, 'lixo', 0); if (!caixaDe(b)) moverCaixa(b, 'entrada'); DB.changed(); draw(); toast('Bloco restaurado.'); },
  apagar(el) { if (confirm('Apagar este bloco para sempre?')) { apagar(el.dataset.id); DB.changed(); draw(); } },
  esvaziar() { if (confirm('Apagar para sempre tudo o que está na lixeira?')) { S.blocos.filter(b => b.lixo).forEach(b => Data.del('blocos', b.id, true)); DB.changed(); draw(); } },
  salvarModeloBloco(el) { const b = B(el), n = prompt('Nome do modelo:', b.titulo); if (n && n.trim()) { Data.put('modelos', { nome: n.trim().slice(0, 80), tipo: 'bloco', dados: JSON.stringify({ titulo: b.titulo, texto: b.texto, forma: b.forma, cor: b.cor, prio: b.prio, peso: b.peso, tags: b.tags, filhos: filhos(b.id).map(x => x.titulo) }) }); toast('Modelo de bloco salvo.'); } },
  modelosBloco(el) { sheetModelos(el.dataset.id); },
  usarModelo(el) { const m = byId(S.modelos, el.dataset.id); let d = {}; try { d = JSON.parse(m.dados); } catch (e) {} const b = novo(Object.assign({}, d, { caixa: el.dataset.caixa })); (d.filhos || []).forEach((t, i) => novo({ titulo: String(t), caixa: b.caixa, coluna: b.coluna, pai: b.id, ordem: i })); DB.changed(); FX.mark(b.id, 'pop'); closeSheet(); draw(); },
  delModelo(el) { Data.del('modelos', el.dataset.id); draw(); },
  // dia
  trazer() { const t = today(), l = doDia().filter(b => b.prazo && b.prazo < t); comUndo(l, () => l.forEach(b => { b.prazo = t; Data.put('blocos', b, true); }), `${plural(l.length, 'bloco veio', 'blocos vieram')} para hoje.`); draw(); },
  empurrar() { const t = today(), l = doDia().filter(b => !(b.prazo && b.prazo < t)); comUndo(l, () => l.forEach(b => { if (b.prazo === t) b.prazo = addDays(t, 1); if (b.hoje === t) { b.hoje = ''; if (!b.prazo) b.prazo = addDays(t, 1); } Data.put('blocos', b, true); }), `${plural(l.length, 'bloco foi', 'blocos foram')} para amanhã.`); draw(); },
  pv(el) { U.pv = el.dataset.v; draw(); },
  mes(el) { const n = +el.dataset.n; if (!n) U.mes = today().slice(0, 7); else { const [y, m] = U.mes.split('-').map(Number), d = new Date(y, m - 1 + n, 1); U.mes = ymd(d).slice(0, 7); } draw(); },
  novoDia(el) { const d = el.dataset.dia, t = prompt(`Novo bloco para ${fmtData(d, { day: 'numeric', month: 'long' })}:`); if (t && t.trim()) { capturar(t, { caixa: el.dataset.caixa || 'entrada', prazo: d }); draw(); } },
  buscaCor(el) { U.q = '#' + norma(el.dataset.v).split(' ')[0]; draw(); },
  // caixa
  novaCaixa() { sheetCaixa(); },
  vista(el) { const c = byId(S.caixas, U.caixa); c.vista = el.dataset.v; Data.put('caixas', c); draw(); },
  favCaixa(el) { const c = byId(S.caixas, el.dataset.id); c.fav = !c.fav; Data.put('caixas', c); draw(); },
  limparFiltro() { U.f = { txt: '', cor: '', prio: '', prazo: '', feitos: true }; draw(); },
  selModo() { U.sel = U.sel ? null : new Set(); draw(); },
  selFazer(el) {
    const k = el.dataset.k, l = [...U.sel].map(id => byId(S.blocos, id)).filter(Boolean), t = today(), agora = Date.now();
    if (!l.length) return toast('Toque nos blocos para selecionar.');
    comUndo(l.flatMap(b => [b, ...descend(b.id)]), () => l.forEach(b => { if (k === 'feito') { if (!b.feito) setFeito(b, true); } else if (k === 'hoje') { b.hoje = t; Data.put('blocos', b, true); } else if (k === 'arquivar') marcar(b, 'arquivado', true); else if (k === 'lixo') marcar(b, 'lixo', agora); else if (k === 'caixa') moverCaixa(b, el.dataset.v); else if (k === 'cor') { b.cor = el.dataset.v; Data.put('blocos', b, true); } }), `${plural(l.length, 'bloco alterado', 'blocos alterados')}.`);
    if (k === 'feito') FX.snap(); U.sel = null; draw();
  },
  abrirSub(el) { const id = el.dataset.id; U.abertos.has(id) ? U.abertos.delete(id) : U.abertos.add(id); draw(); },
  abrirTodos() { if (U.abertos.size) U.abertos.clear(); else raizes(U.caixa).forEach(b => { if (filhos(b.id).length) U.abertos.add(b.id); }); draw(); },
  verFeitos() { U.verFeitos = !U.verFeitos; },
  novaNota(el) { const b = novo({ caixa: el.dataset.id, forma: 'nota', titulo: '' }); DB.changed(); draw(); sheetBloco(b.id); const i = $('#sheet .title.big'); if (i) i.focus(); },
  tsort(el) { const k = el.dataset.k; U.ts = { k, d: U.ts.k === k ? -U.ts.d : 1 }; draw(); },
  importarTexto(el) { sheetTexto(el.dataset.id); },
  exportarCaixa(el) { copiar(exportaCaixa(byId(S.caixas, el.dataset.id)), 'Caixa copiada como texto.'); },
  exportarTudo() { baixar(`blocos2-${today()}.md`, caixas().map(exportaCaixa).join('\n\n'), 'text/markdown'); },
  arquivarFeitos(el) { const l = raizes(el.dataset.id).filter(b => b.feito); if (!l.length) return toast('Nenhum bloco concluído nesta caixa.'); comUndo(l.flatMap(b => [b, ...descend(b.id)]), () => l.forEach(b => marcar(b, 'arquivado', true)), `${plural(l.length, 'concluído arquivado', 'concluídos arquivados')}.`); draw(); },
  salvarModeloCaixa(el) { const c = byId(S.caixas, el.dataset.id), n = prompt('Nome do modelo:', c.nome); if (n && n.trim()) { Data.put('modelos', { nome: n.trim().slice(0, 80), tipo: 'caixa', dados: JSON.stringify(modeloDeCaixa(c)) }); toast('Modelo salvo. Ele aparece em “Nova caixa”.'); } },
  duplicarCaixa(el) { const c = byId(S.caixas, el.dataset.id), n = Data.montar(modeloDeCaixa(c), c.nome + ' (cópia)'); Data.put('caixas', n); ir('caixa', n.id); toast('Caixa duplicada, com os blocos reabertos.'); },
  moverCaixa(el) { const l = caixas().filter(c => c.id !== 'entrada'), c = byId(S.caixas, el.dataset.id), o = l[l.indexOf(c) + +el.dataset.n]; if (!o || o.fav !== c.fav) return; l.forEach((x, i) => { x.ordem = i + 1; }); [c.ordem, o.ordem] = [o.ordem, c.ordem]; l.forEach(x => Data.put('caixas', x, true)); DB.changed(); draw(); },
  arquivarCaixa(el) { const c = byId(S.caixas, el.dataset.id); c.arquivada = !c.arquivada; Data.put('caixas', c); if (c.arquivada) ir('hoje'); else draw(); toast(c.arquivada ? 'Caixa arquivada. Ela está em Arquivo.' : 'Caixa de volta à barra lateral.'); },
  delCaixa(el) {
    const c = byId(S.caixas, el.dataset.id), n = S.blocos.filter(b => b.caixa === c.id).length;
    if (!confirm(`Excluir a caixa “${c.nome}”${n ? ` e ${plural(n, 'bloco', 'blocos')}` : ''}? Isso não vai para a lixeira.`)) return;
    S.blocos.filter(b => b.caixa === c.id).forEach(b => Data.del('blocos', b.id, true)); colsDe(c.id).forEach(x => Data.del('colunas', x.id, true)); Data.del('caixas', c.id);
    if (U.caixa === c.id) ir('hoje'); else draw();
  },
  // colunas
  colNova(el) { const n = prompt('Nome da coluna:'); if (n && n.trim()) { const c = Data.put('colunas', { caixa: el.dataset.id, nome: n.trim().slice(0, 60), ordem: Math.max(0, ...colsDe(el.dataset.id).map(c => c.ordem)) + 1 }); FX.mark(c.id, 'pop'); draw(); } },
  colMover(el) { const c = byId(S.colunas, el.dataset.id), l = colsDe(c.caixa), o = l[l.indexOf(c) + +el.dataset.n]; if (!o) return; l.forEach((x, i) => { x.ordem = i; }); [c.ordem, o.ordem] = [o.ordem, c.ordem]; l.forEach(x => Data.put('colunas', x, true)); DB.changed(); draw(); },
  colLimite(el) { const c = byId(S.colunas, el.dataset.id), n = prompt('Quantos blocos abertos cabem nesta coluna? (0 = sem limite)', c.limite || 0); if (n == null) return; c.limite = Math.max(0, Math.min(99, Math.floor(+n) || 0)); Data.put('colunas', c); draw(); },
  colFinal(el) { const c = byId(S.colunas, el.dataset.id); colsDe(c.caixa).forEach(x => { if (x.id !== c.id && x.feito) { x.feito = false; Data.put('colunas', x, true); } }); c.feito = !c.feito; Data.put('colunas', c); draw(); toast(c.feito ? 'Soltar um bloco nesta coluna passa a concluí-lo.' : 'Esta coluna não conclui mais os blocos.'); },
  colOrdenar(el) { raizes(U.caixa).filter(b => b.coluna === el.dataset.id).sort((a, b) => ordPrazo(a, b)).forEach((b, i) => { b.ordem = i + 1; Data.put('blocos', b, true); }); DB.changed(); draw(); },
  colFechar(el) { const c = byId(S.colunas, el.dataset.id); c.fechada = !c.fechada; Data.put('colunas', c); draw(); },
  colDel(el) {
    const c = byId(S.colunas, el.dataset.id), l = colsDe(c.caixa), bs = S.blocos.filter(b => b.coluna === c.id);
    if (l.length < 2) return toast('A caixa precisa de pelo menos uma coluna.');
    const dest = l.find(x => x.id !== c.id);
    if (bs.length && !confirm(`Excluir “${c.nome}”? ${plural(bs.filter(b => !b.pai).length, 'bloco vai', 'blocos vão')} para “${dest.nome}”.`)) return;
    bs.forEach(b => { b.coluna = dest.id; Data.put('blocos', b, true); }); Data.del('colunas', c.id); draw();
  },
  // ajustes
  ajuda() { sheetAjuda(); },
  novaCor() { Data.put('cores', { nome: 'Nova etiqueta', cor: '#F28C28', ordem: Math.max(0, ...S.cores.map(c => c.ordem)) + 1 }); draw(); },
  delCor(el) { const n = S.blocos.filter(b => b.cor === el.dataset.id).length; if (n && !confirm(`${plural(n, 'bloco usa', 'blocos usam')} esta etiqueta e vão ficar sem cor. Excluir?`)) return; Data.del('cores', el.dataset.id); draw(); },
  paleta(el) { const p = PALETAS[el.dataset.v]; cores().forEach((t, i) => { t.cor = p[i % p.length]; Data.put('cores', t, true); }); DB.changed(); draw(); },
  set(el) { S.set[el.dataset.k] = el.dataset.v; DB.saveSet(); draw(); },
  exportar() { baixar(`blocos2-${today()}.json`, JSON.stringify(Sync.payload())); },
  importar() { $('#filepick').click(); },
  async install() { if (!inst) return; inst.prompt(); await inst.userChoice.catch(() => {}); inst = null; draw(); },
  syncUse(el) { busy(el, () => Sync.config(el.dataset.path)); },
  syncPick(el) { toast('Escolha a pasta na janela que abriu.'); busy(el, () => Sync.config('choose')); },
  syncOff(el) { busy(el, () => Sync.config('off')); },
  gConnect(el) {
    const v = $('[data-s=gClient]').value.trim();
    if (!/\.apps\.googleusercontent\.com$/.test(v)) return toast('Cole o ID do cliente OAuth (termina em .apps.googleusercontent.com).');
    S.set.gClient = v; DB.saveSet(); busy(el, () => Sync.gOn() ? Sync.run() : Sync.connect());
  },
  gOff() { Sync.disconnect(); draw(); },
};
Object.assign(A, A2);
async function busy(el, f) { el.disabled = true; try { await f(); } catch (e) { toast(e.message || 'Não deu certo.'); } draw(); }

const FORMS = {
  captura(f) {
    const d = f.dataset, txt = f.q.value; if (!txt.trim()) return;
    const col = d.col && byId(S.colunas, d.col), l = capturar(txt, { caixa: d.caixa || (col ? col.caixa : d.global || d.hoje ? 'entrada' : U.caixa), coluna: d.col, pai: d.pai, hoje: !!d.hoje, prazo: d.prazo });
    if (!l.length) return;
    if (d.pai) U.abertos.add(d.pai);
    refresh();
    const sel = d.pai ? `form[data-pai="${d.pai}"] input` : d.col ? `form[data-col="${d.col}"] input` : d.hoje ? 'form[data-hoje] input' : d.global ? '#side .cap input' : d.prazo ? `form[data-prazo="${d.prazo}"] input` : 'form[data-caixa] input';
    const i = (document.body.classList.contains('sheet') && $('#sheet ' + sel)) || $(sel); if (i) i.focus();
    if (d.global) { const b = l[0], c = caixaDe(b); toast(`Capturado em ${c.nome}${b.prazo ? ' para ' + fmtDia(b.prazo).toLowerCase() : ''}.`); }
  },
  caixa(f) {
    const v = f.modelo.value; let d = MODELOS[+v.slice(1)];
    if (v[0] !== 'f') { try { d = JSON.parse(byId(S.modelos, v).dados); } catch (e) { d = MODELOS[0]; } }
    const c = Data.montar(d, f.nome.value.trim()); Data.put('caixas', c); closeSheet(); ir('caixa', c.id);
  },
  texto(f) {
    const cx = f.dataset.id; let col = colsDe(cx)[0], ult = null, n = 0;
    f.t.value.split('\n').forEach(l => {
      if (!l.trim()) return;
      if (/^#+\s/.test(l)) { const nome = l.replace(/^#+\s*/, '').trim().slice(0, 60); col = colsDe(cx).find(c => norma(c.nome) === norma(nome)) || Data.put('colunas', { caixa: cx, nome, ordem: Math.max(0, ...colsDe(cx).map(c => c.ordem)) + 1 }, true); ult = null; return; }
      const dentro = /^(\s{2,}|\t)/.test(l) && ult, m = l.trim().match(/^(?:[-*]\s+)?(?:\[( |x|X)\]\s+)?(.*)/), b = capturar(m[2], dentro ? { pai: ult.id } : { caixa: cx, coluna: col.id })[0];
      if (!b) return;
      if (m[1] && m[1] !== ' ') { b.feito = Date.now(); Data.put('blocos', b, true); }
      if (!dentro) ult = b; n++;
    });
    DB.changed(); closeSheet(); draw(); toast(`${plural(n, 'bloco criado', 'blocos criados')}.`);
  },
};
Object.assign(FORMS, F2);

/* ---------- eventos ---------- */
document.addEventListener('click', e => {
  if (e.target.id === 'scrim') return closeSheet();
  if (e.target.id === 'veu') return document.body.classList.remove('lado');
  document.querySelectorAll('details.menu[open]').forEach(m => { if (!m.contains(e.target)) m.open = false; });
  const el = e.target.closest('[data-act]');
  if (!el || !A[el.dataset.act] || (e.target !== el && e.target.closest('input,select,textarea,a,label,summary') && !e.target.closest('summary[data-act]'))) return;
  A[el.dataset.act](el, e);
});
document.addEventListener('keydown', e => {
  const campo = e.target.matches('input,select,textarea');
  if (e.key === 'Escape') { if (document.body.classList.contains('sheet')) closeSheet(); else if (U.sel) A.selModo(); else if (campo) e.target.blur(); else document.body.classList.remove('lado'); return; }
  if (e.key === 'Enter' && e.target.matches('[role=button]')) return e.target.click();
  if (e.key === 'Enter' && e.target.matches('input[data-f]')) return e.target.blur();
  if (campo || e.ctrlKey || e.metaKey || e.altKey || document.body.classList.contains('sheet')) return;
  const k = e.key.toLowerCase(), vistas = { q: 'quadro', l: 'lista', t: 'tabela', b: 'notas', c: 'cal' };
  if (k === 'n') { e.preventDefault(); document.body.classList.add('lado'); $('#side .cap input').focus(); }
  else if (k === '/') { e.preventDefault(); ir('busca'); $('.busca').focus(); }
  else if (k === '?') sheetAjuda();
  else if (k >= '1' && k <= '5') { const v = ['hoje', 'prox', 'estrelas', 'caixa', 'painel'][+k - 1]; ir(v, v === 'caixa' ? 'entrada' : ''); }
  else if (vistas[k] && U.v === 'caixa') A.vista({ dataset: { v: vistas[k] } });
});
document.addEventListener('submit', e => { e.preventDefault(); const f = e.target.dataset.form; if (FORMS[f]) FORMS[f](e.target); });
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.u === 'q') { U.q = el.value; $('#res').innerHTML = resBusca(); }
  else if (el.dataset.uf === 'txt') { U.f.txt = el.value; $('#vista').innerHTML = vVista(byId(S.caixas, U.caixa)); }
});
// campos editados no lugar: gravam ao sair do campo
document.addEventListener('change', e => {
  const el = e.target, d = el.dataset;
  if (d.f) {
    const r = byId(S[d.store], d.id); if (!r) return;
    const v = el.value.trim();
    if (!v && d.f === 'nome') { el.value = r.nome; return; }
    if (d.store === 'blocos' && d.f === 'coluna') moverColuna(r, v);
    else if (d.store === 'blocos' && d.f === 'caixa') { moverCaixa(r, v); DB.changed(); }
    else if (d.store === 'blocos' && d.f === 'pai') encaixarEm(r, v);
    else { r[d.f] = v; Data.put(d.store, r); }
    if (d.store === 'blocos' && 'rs' in d) refresh(); else if (d.store === 'blocos' || 'redraw' in d) { if (el.closest('#sheet')) { const y = scrollY; draw(); scrollTo(0, y); } else if (el.closest('.tab')) draw(); else drawSide(); }
    else drawSide();
  } else if (d.mdc) {
    const b = byId(S.blocos, d.id); let n = -1;
    b.texto = b.texto.split('\n').map(l => { if (/^\s*(?:[-*]\s+)?\[( |x|X)\]\s+/.test(l) && ++n === +d.mdc) return l.replace(/\[( |x|X)\]/, el.checked ? '[x]' : '[ ]'); return l; }).join('\n');
    Data.put('blocos', b);
  }
  else if (d.chk) { concluir(d.chk, el.checked); refresh(); }
  else if (d.cfg) { const c = cfg(); c[d.cfg] = Math.max(0, Math.floor(+el.value) || 0); Data.put('ajustes', c); }
  else if (d.uf) { U.f[d.uf] = el.type === 'checkbox' ? el.checked : el.value; draw(); }
  else if (d.u) { U[d.u] = el.value; draw(); }
  else if (d.sel && el.value) A.selFazer({ dataset: { k: d.sel, v: el.value } });
  else if (d.s) { S.set[d.s] = el.type === 'checkbox' ? el.checked : el.value.trim(); DB.saveSet(); if (d.s === 'som' && el.checked) FX.snap(); if (el.type === 'checkbox') draw(); }
  else if (el.id === 'filepick' && el.files[0]) {
    el.files[0].text().then(t => { const j = JSON.parse(t); if (j.app !== 'blocos2') throw 0; Sync.merge(j); DB.changed(); draw(); toast('Backup importado e mesclado.'); }).catch(() => toast('Este arquivo não é um backup do Blocos 2.'));
    el.value = '';
  }
});
// arrastar: entre colunas, para um dia, para uma caixa da barra lateral, para Hoje ou para a Lixeira
document.addEventListener('dragstart', e => { const b = e.target.closest && e.target.closest('[draggable=true][data-id]'); if (!b) return; e.dataTransfer.setData('text/plain', b.dataset.id); e.dataTransfer.effectAllowed = 'move'; document.body.classList.add('drag'); b.classList.add('pego'); });
document.addEventListener('dragend', () => { document.body.classList.remove('drag'); document.querySelectorAll('.over,.pego').forEach(x => x.classList.remove('over', 'pego')); });
document.addEventListener('dragover', e => { const z = e.target.closest('[data-drop]'); if (!z) return; e.preventDefault(); z.classList.add('over'); });
document.addEventListener('dragleave', e => { const z = e.target.closest('[data-drop]'); if (z && !z.contains(e.relatedTarget)) z.classList.remove('over'); });
document.addEventListener('drop', e => {
  const z = e.target.closest('[data-drop]'); if (!z) return;
  e.preventDefault();
  const b = byId(S.blocos, e.dataTransfer.getData('text/plain')), k = z.dataset.drop; if (!b) return;
  if (k === 'col') { const sobre = e.target.closest('.bk'); moverColuna(b, z.dataset.col, sobre && sobre.dataset.id !== b.id ? sobre.dataset.id : ''); }
  else if (k === 'g') gdrop(b, z.dataset.modo, z.dataset.col, e, z);
  else if (k === 'dia') { b.prazo = z.dataset.dia; Data.put('blocos', b); FX.mark(b.id, 'pop'); }
  else if (k === 'caixa') { if (b.caixa !== z.dataset.id || b.pai) { moverCaixa(b, z.dataset.id); DB.changed(); toast(`Movido para ${byId(S.caixas, z.dataset.id).nome}.`); } }
  else if (k === 'hoje') { b.hoje = today(); Data.put('blocos', b); toast('Está no seu dia de hoje.'); }
  else if (k === 'lixo') return A.lixo({ dataset: { id: b.id } });
  draw();
});
addEventListener('beforeinstallprompt', e => { e.preventDefault(); inst = e; if (U.v === 'ajustes') draw(); });

const App = {
  // a sincronização trouxe novidades: redesenha, sem atrapalhar quem está digitando
  synced(changed) { if (changed && !document.body.classList.contains('sheet') && !(document.activeElement && document.activeElement.matches('input,select,textarea'))) draw(); else drawSide(); },
};

DB.load();
// primeira abertura: começa dentro da caixa de exemplo, que mostra o quadro montado
{ const ex = S.caixas.find(c => c.seed); if (ex) { U.v = 'caixa'; U.caixa = ex.id; } }
draw();
Sync.init();
try { if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) {}
