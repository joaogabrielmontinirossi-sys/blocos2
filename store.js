'use strict';
/* Blocos 2 — dados. Caixas guardam blocos; blocos se encaixam uns dentro dos outros.
   Tudo fica no aparelho (localStorage) em listas de registros { id, mod }; `mod` decide quem vence na sincronização. */

const KEY = 'blocos2-v1';
const byId = (l, id) => l.find(r => r.id === id);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const debounce = (f, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; };

const S = { set: { gClient: '', gWas: false, tema: 'auto', som: true, vibra: true, anim: true, estilo: 'pinos', denso: false } };

const DEF = {
  cores: [
    { id: 'vermelho', nome: 'Urgente', cor: '#E0483C' }, { id: 'azul', nome: 'Trabalho', cor: '#2D7DD2' }, { id: 'verde', nome: 'Pessoal', cor: '#2FA05A' },
    { id: 'amarelo', nome: 'Ideia', cor: '#E8B81F' }, { id: 'roxo', nome: 'Estudo', cor: '#8B5CF6' }, { id: 'cinza', nome: 'Rotina', cor: '#C9CED8' },
  ],
  caixas: [{ id: 'entrada', nome: 'Entrada', icone: '📥', vista: 'lista' }],
  colunas: [{ id: 'entrada-c', caixa: 'entrada', nome: 'Entrada' }],
  ajustes: [{ id: 'cfg', meta: 5 }],
};

// Modelos de caixa que já vêm no app. `col` é o índice da coluna; `feito` marca a coluna que conclui o bloco.
const C = (nome, feito, limite) => ({ nome, feito: !!feito, limite: limite || 0 });
const MODELOS = [
  { nome: 'Quadro simples', icone: '🧱', vista: 'quadro', colunas: [C('A fazer'), C('Fazendo', 0, 3), C('Feito', 1)] },
  { nome: 'Lista de tarefas', icone: '✅', vista: 'lista', colunas: [C('Tarefas')] },
  { nome: 'Caderno de notas', icone: '📓', vista: 'notas', colunas: [C('Notas')] },
  { nome: 'Projeto', icone: '🏗️', vista: 'quadro', colunas: [C('Ideias'), C('Planejado'), C('Em andamento', 0, 3), C('Em revisão'), C('Entregue', 1)] },
  { nome: 'Semana', icone: '🗓️', vista: 'quadro', colunas: [C('Segunda'), C('Terça'), C('Quarta'), C('Quinta'), C('Sexta'), C('Fim de semana'), C('Feito', 1)] },
  { nome: 'Estudos', icone: '📚', vista: 'quadro', colunas: [C('Para estudar'), C('Estudando', 0, 2), C('Revisar'), C('Dominado', 1)] },
  { nome: 'Leituras', icone: '📖', vista: 'quadro', colunas: [C('Quero ler'), C('Lendo', 0, 2), C('Lido', 1)] },
  { nome: 'Compras', icone: '🛒', vista: 'lista', colunas: [C('Comprar')], blocos: [{ titulo: 'Mercado', filhos: ['Arroz', 'Café', 'Frutas'] }] },
  { nome: 'Viagem', icone: '🧳', vista: 'quadro', colunas: [C('Antes de ir'), C('Malas'), C('Durante'), C('Pronto', 1)], blocos: [{ titulo: 'Documentos', col: 0, filhos: ['Passagens', 'Reserva', 'Seguro'] }, { titulo: 'Roupas', col: 1 }] },
  { nome: 'Prazos e processos', icone: '⚖️', vista: 'tabela', colunas: [C('A protocolar'), C('Aguardando'), C('Concluído', 1)] },
];
const EXEMPLO = { icone: '🚀', vista: 'quadro', colunas: [C('A fazer'), C('Fazendo', 0, 3), C('Feito', 1)], blocos: [
  { titulo: 'Arraste este bloco para “Fazendo”', col: 0, cor: 'azul', texto: 'No quadro, cada coluna é uma etapa. Soltar o bloco na coluna **Feito** conclui a tarefa.' },
  { titulo: 'Abra um bloco e veja os encaixes', col: 0, cor: 'verde', peso: 2, filhos: ['Um bloco pode ter blocos dentro', 'Marque os de dentro para encher a barra', 'O de fora mostra o progresso'] },
  { titulo: 'Nota: como capturar rápido', col: 0, cor: 'amarelo', forma: 'nota', texto: '# Captura rápida\nEscreva uma linha e use os atalhos:\n- `amanhã`, `sex` ou `25/12` definem o prazo\n- `#etiqueta` pinta o bloco, `@caixa` escolhe onde guardar\n- `!` marca prioridade e `*` põe estrela\n\n- [ ] As caixinhas de marcar funcionam dentro da nota\n- [x] Esta já está marcada' },
  { titulo: 'Troque a vista: Quadro, Lista, Notas, Tabela, Calendário', col: 1, cor: 'roxo', prio: 2 },
  { titulo: 'Abrir o Blocos 2 pela primeira vez', col: 2, cor: 'cinza' },
] };

// Formato de cada registro; o que vem de fora (sincronização, backup) passa por aqui antes de entrar.
const SHAPE = {
  cores: { nome: 's', cor: 'c', ordem: 'n' },
  caixas: { nome: 's', icone: 's', desc: 's', vista: 's', ordem: 'n', fav: 'b', arquivada: 'b', criada: 'n' },
  colunas: { caixa: 's', nome: 's', ordem: 'n', limite: 'n', feito: 'b', fechada: 'b' },
  blocos: { caixa: 's', coluna: 's', pai: 's', titulo: 's', texto: 't', forma: 's', cor: 's', tags: 's', prazo: 'd', hora: 'h', feito: 'n', prio: 'n', peso: 'n', estrela: 'b', fixo: 'b', hoje: 'd', repete: 's', link: 's', ordem: 'n', criado: 'n', lixo: 'n', arquivado: 'b', x: 'n', y: 'n' },
  modelos: { nome: 's', tipo: 's', dados: 'T' },
  ajustes: { meta: 'n' },
};
function norm(store, r) {
  const o = { id: String(r.id), mod: Number(r.mod) || 0 };
  for (const [k, t] of Object.entries(SHAPE[store])) {
    const v = r[k];
    o[k] = t === 's' ? String(v == null ? '' : v).slice(0, 500)
      : t === 't' ? String(v == null ? '' : v).slice(0, 20000)
      : t === 'T' ? String(v == null ? '' : v).slice(0, 200000)
      : t === 'n' ? Number(v) || 0
      : t === 'b' ? !!v
      : t === 'c' ? (/^#[0-9a-f]{6}$/i.test(v) ? v : '#9AA3AF')
      : t === 'h' ? (/^\d{2}:\d{2}$/.test(v) ? v : '')
      : (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
  }
  if (store === 'blocos') { o.prio = Math.max(0, Math.min(3, Math.round(o.prio))); o.peso = Math.max(1, Math.min(3, Math.round(o.peso) || 1)); if (o.forma !== 'nota') o.forma = 'tarefa'; }
  if (store === 'ajustes') o.meta = Math.max(0, Math.min(99, Math.round(r.meta == null ? 5 : o.meta)));
  if (r.seed) o.seed = true;
  return o;
}

const DB = {
  SYNCED: Object.keys(SHAPE),
  onChange: null,
  _tomb: {},
  tomb: () => DB._tomb,

  load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
    DB.SYNCED.forEach(s => S[s] = (d && Array.isArray(d[s]) ? d[s] : []).filter(r => r && r.id).map(r => norm(s, r)));
    DB._tomb = (d && d.tomb && typeof d.tomb === 'object') ? d.tomb : {};
    try { Object.assign(S.set, JSON.parse(localStorage.getItem(KEY + '-set') || '{}')); } catch (e) {}
    // padrões de fábrica: entram com mod 0, então qualquer edição (ou exclusão) feita por você vence
    for (const s of Object.keys(DEF)) DEF[s].forEach((r, i) => { if (!byId(S[s], r.id) && !DB._tomb[s + ':' + r.id]) S[s].push(norm(s, Object.assign({ ordem: i }, r))); });
    if (!d) Data.montar(EXEMPLO, 'Primeiros passos (exemplo)', true);
    // a lixeira se esvazia sozinha depois de 30 dias
    S.blocos.filter(b => b.lixo && b.lixo < Date.now() - 30 * 864e5).forEach(b => Data.del('blocos', b.id, true));
    DB.persist();
  },
  persist() {
    const d = { tomb: DB._tomb };
    DB.SYNCED.forEach(s => d[s] = S[s]);
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
  },
  saveSet() { try { localStorage.setItem(KEY + '-set', JSON.stringify(S.set)); } catch (e) {} },
  changed() { DB.persist(); if (DB.onChange) DB.onChange(); },
};

const Data = {
  // gravações feitas por você: carimbam a data e, na primeira, adotam o exemplo como dado de verdade
  put(store, rec, quiet) {
    if (!rec.id) rec.id = uid();
    Object.assign(rec, norm(store, rec));
    rec.mod = Date.now();
    Data.adopt();
    if (!byId(S[store], rec.id)) S[store].push(rec);
    if (!quiet) DB.changed();
    return rec;
  },
  del(store, id, quiet) {
    const i = S[store].findIndex(r => r.id === id);
    if (i < 0) return;
    S[store].splice(i, 1);
    DB._tomb[store + ':' + id] = Date.now();
    if (!quiet) DB.changed();
  },
  adopt() { DB.SYNCED.forEach(s => S[s].forEach(r => { delete r.seed; })); },
  // gravações vindas da sincronização: não mexem em `mod`
  raw(store, rec) { const i = S[store].findIndex(r => r.id === rec.id); if (i < 0) S[store].push(rec); else S[store][i] = rec; },
  rawDel(store, id) { const i = S[store].findIndex(r => r.id === id); if (i >= 0) S[store].splice(i, 1); },

  // monta uma caixa inteira a partir de um modelo: colunas, blocos e os blocos de dentro
  montar(d, nome, seed) {
    const now = Date.now(), tag = r => { if (seed) r.seed = true; return r; };
    const cx = tag(norm('caixas', { id: uid(), nome, icone: d.icone || '', desc: d.desc || '', vista: d.vista || 'quadro', ordem: Math.max(0, ...S.caixas.map(c => c.ordem)) + 1, criada: now, mod: now }));
    S.caixas.push(cx);
    const cols = (d.colunas && d.colunas.length ? d.colunas : [{ nome: 'A fazer' }]).map((c, i) => { const r = tag(norm('colunas', { id: uid(), caixa: cx.id, nome: c.nome, ordem: i, limite: c.limite, feito: c.feito, mod: now })); S.colunas.push(r); return r; });
    (d.blocos || []).forEach((b, i) => {
      const col = cols[b.col || 0] || cols[0];
      const r = tag(norm('blocos', Object.assign({}, b, { id: uid(), caixa: cx.id, coluna: col.id, pai: '', ordem: i, criado: now, feito: col.feito ? now : 0, mod: now })));
      S.blocos.push(r);
      (b.filhos || []).forEach((t, j) => S.blocos.push(tag(norm('blocos', { id: uid(), caixa: cx.id, coluna: col.id, pai: r.id, titulo: String(t), ordem: j, criado: now, mod: now }))));
    });
    return cx;
  },
};
