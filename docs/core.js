(function (root) {
 'use strict';
 const won = n => n.toLocaleString('ko-KR') + '원';
 function settle(table) {
  const { people, items, payer } = table;
  if (!people.length) throw Error('먼저 테이블 참석자를 입력해 주세요.');
  const ids = people.map(p => p.id);
  if (new Set(ids).size !== ids.length || people.some(p => !p.id || !p.name.trim())) throw Error('참석자 정보가 올바르지 않습니다.');
  if (!ids.includes(payer)) throw Error('결제자를 선택해 주세요.');
  const rows = people.map(p => ({...p, share:0, transfer:0}));
  let total = 0;
  const breakdown = items.map((item, index) => {
   if (!item.name.trim()) throw Error(`${index + 1}번째 메뉴 이름을 입력해 주세요.`);
   if (!Number.isSafeInteger(item.amount) || item.amount < 0) throw Error(`${item.name}: 금액은 0 이상의 원 단위 정수로 입력해 주세요.`);
   if (!item.members.length) throw Error(`${item.name}: 먹은 사람을 한 명 이상 선택해 주세요.`);
   if (new Set(item.members).size !== item.members.length || item.members.some(id => !ids.includes(id))) throw Error(`${item.name}: 참여자 정보가 올바르지 않습니다.`);
   total += item.amount;
   if (!Number.isSafeInteger(total)) throw Error('정산 가능한 금액 범위를 초과했습니다.');
   const participants = rows.filter(p => item.members.includes(p.id));
   const base = Math.floor(item.amount / participants.length), remainder = item.amount % participants.length;
   const allocations = participants.map((p, i) => {
    const amount = base + (i < remainder ? 1 : 0); p.share += amount;
    return {id:p.id, name:p.name, amount};
   });
   return {...item, allocations};
  });
  rows.forEach(p => { p.transfer = p.id === payer ? 0 : p.share; });
  return {total, rows, breakdown, receivable:rows.reduce((s,p)=>s+p.transfer,0)};
 }
 function notice(table, date = '') {
  const result = settle(table);
  if (!table.items.length) throw Error('메뉴를 한 개 이상 추가해 주세요.');
  if (!table.account || ['bank','number','holder'].some(k=>!table.account[k]?.trim())) throw Error('은행, 계좌번호, 예금주를 모두 입력해 주세요.');
  const payer = table.people.find(p => p.id === table.payer);
  return [`[Deep Dive English 정산]`, `${date} · ${table.name}`, '', '■ 주문 내역',
   ...result.breakdown.map(item => `${item.name} ${won(item.amount)}\n  ${item.allocations.map(p=>`${p.name} ${won(p.amount)}`).join(' / ')}`),
   '', `총 결제액: ${won(result.total)}`, '', '■ 개인별 정산',
   ...result.rows.map(p=>p.id===table.payer ? `${p.name}: ${won(p.share)} (결제자 본인 부담 · 송금 없음)` : `${p.name}: ${won(p.transfer)}${p.transfer===0?' (송금 없음)':''}`),
   '', `입금 계좌: ${table.account.bank} ${table.account.number}`, `예금주: ${table.account.holder}`, `결제자: ${payer.name} · 받을 금액: ${won(result.receivable)}`,
   '', '입금 시 참석자 이름으로 보내 주세요.', '※ 나누어떨어지지 않는 금액은 메뉴별 참석자 등록 순서대로 1원씩 배분했습니다.'
  ].join('\n');
 }
 function combinedNotice(tables, date = '') {
  const included = tables.filter(t => t.people.length || t.items.length);
  if (!included.length) throw Error('정산할 테이블을 먼저 입력해 주세요.');
  let total = 0;
  const sections = included.map((t, index) => {
   let result;
   try { notice(t, date); result = settle(t); }
   catch (error) { throw Error(`${t.name || `${index + 1}번 테이블`}: ${error.message}`); }
   total += result.total;
   if (!Number.isSafeInteger(total)) throw Error('전체 정산 금액 범위를 초과했습니다.');
   return [`${index + 1}. ${t.name} — ${won(result.total)}`, '',
    ...result.breakdown.map(item => `${item.name} ${won(item.amount)} · ${item.allocations.map(p => p.name).join(', ')}`),
    '', ...result.rows.map(p => `• ${p.name}: ${won(p.share)}`), '',
    `입금 계좌: ${t.account.bank} / ${t.account.number} / ${t.account.holder}`].join('\n');
  });
  return ['[Deep Dive English 정산]', date, '', '함께 드신 메뉴 기준으로 나눴습니다. 각 테이블 계좌로 본인 이름을 적어 입금해 주세요.', '',
   sections.join('\n\n────────────\n\n'), '', `전체 ${included.length}개 테이블 · 총 ${won(total)}`, '',
   '※ 먼저 계산한 분은 본인 부담액을 따로 송금하지 않으시면 됩니다.',
   '※ 메뉴별 1원 단위 나머지는 참석자 등록 순서대로 배분했습니다.'].join('\n');
 }
 const api = {settle,notice,combinedNotice,won};
 if (typeof module !== 'undefined' && module.exports) module.exports = api;
 else root.Settlement = api;
})(globalThis);
