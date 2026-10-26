'use strict';
const $ = s => document.querySelector(s);
const {settle, notice, combinedNotice, won, removeTable, restoreTable} = Settlement;
const key = 'deep-dive-english.v1';
const uid = () => crypto.randomUUID();
const escapeHTML = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const newTable = name => ({id:uid(),name,people:[],items:[],payer:'',account:{bank:'',holder:'',number:''},paid:{}});
let state = {version:1,date:new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date()),tables:[newTable('1번 테이블')]};
let storageBlocked = false;
try {
 const saved = localStorage.getItem(key);
 if (saved) {
  const parsed = JSON.parse(saved);
  if (parsed.version !== 1 || !Array.isArray(parsed.tables) || !parsed.tables.length || typeof parsed.date !== 'string') throw Error('invalid');
  for (const t of parsed.tables) {
   if (!t.id || typeof t.name !== 'string' || !Array.isArray(t.people) || !Array.isArray(t.items) || !t.account || !t.paid) throw Error('invalid');
   for (const p of t.people) if (typeof p.id !== 'string' || typeof p.name !== 'string') throw Error('invalid');
   for (const i of t.items) if (typeof i.id !== 'string' || typeof i.name !== 'string' || !Array.isArray(i.members)) throw Error('invalid');
  }
  state = parsed;
 }
} catch { storageBlocked = true; $('#save-state').textContent = '저장 내용을 읽지 못했습니다 · 원본 보존 중'; }
let active = state.tables[0].id;
const table = () => state.tables.find(t => t.id === active);
let toastTimer;
function toast(message) { $('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,4200); }
function save(financial = false) {
 if (financial && Object.values(table().paid).some(Boolean)) { table().paid={};toast('정산 내용이 바뀌어 입금 확인 표시를 초기화했습니다.'); }
 if (!storageBlocked) try {localStorage.setItem(key,JSON.stringify(state));$('#save-state').textContent='✓ 이 브라우저에 저장됨';} catch {$('#save-state').textContent='저장 실패 · 기록을 다운로드해 주세요';}
}
function renderTabs() {
 $('#delete-table').disabled=state.tables.length<=1;
 $('#delete-table').setAttribute('aria-label',`${table().name||'이름 없는 테이블'} 삭제`);
 $('#table-delete-help').textContent=state.tables.length<=1?'테이블은 최소 한 개가 필요합니다.':'';
 $('#restore-table').hidden=!state.deletedTable;

 $('#table-tabs').innerHTML=state.tables.map(t=>`<button data-table="${escapeHTML(t.id)}" class="tab ${t.id===active?'active':''}" aria-pressed="${t.id===active}">${escapeHTML(t.name||'이름 없는 테이블')}<span>${t.people.length}</span></button>`).join('');
}
function renderPeople() {
 const t=table();
 $('#people').innerHTML=t.people.length?t.people.map(p=>`<span class="person-chip">${escapeHTML(p.name)}<button data-remove-person="${escapeHTML(p.id)}" aria-label="${escapeHTML(p.name)} 삭제">×</button></span>`).join(''):'<p class="empty-small">아직 참석자가 없어요. 이름을 하나씩 추가해 주세요.</p>';
 $('#payer').innerHTML='<option value="">결제자를 선택하세요</option>'+t.people.map(p=>`<option value="${escapeHTML(p.id)}" ${p.id===t.payer?'selected':''}>${escapeHTML(p.name)}</option>`).join('');
}
function renderItems() {
 const t=table();
 $('#items').innerHTML=t.items.length?t.items.map((item,i)=>`<article class="menu" data-item="${escapeHTML(item.id)}"><div class="menu-top"><span class="menu-index">MENU ${String(i+1).padStart(2,'0')}</span><button data-remove-item="${escapeHTML(item.id)}" class="text-button" aria-label="${escapeHTML(item.name||'메뉴')} 삭제">삭제</button></div><div class="menu-fields"><label>메뉴명<input data-field="name" value="${escapeHTML(item.name)}" maxlength="80" placeholder="예: 마르게리타 피자"></label><label>메뉴 총액 (원)<input data-field="amount" type="number" min="0" step="1" value="${item.amount===null?'':item.amount}" placeholder="30,000" inputmode="numeric"></label></div><div class="menu-prompt">함께 먹은 사람 <button class="text-button" data-select-all="${escapeHTML(item.id)}">모두 선택</button></div><div class="checks">${t.people.map(p=>`<label class="check-chip"><input type="checkbox" data-member="${escapeHTML(p.id)}" ${item.members.includes(p.id)?'checked':''}><span>${escapeHTML(p.name)}</span></label>`).join('')||'<p class="empty-small">먼저 참석자를 입력해 주세요.</p>'}</div><div class="item-split" id="split-${escapeHTML(item.id)}"></div></article>`).join(''):'<div class="empty-menu"><span>＋</span><strong>우리 테이블의 첫 메뉴</strong><p>메뉴를 추가하면 참석자를 선택할 수 있어요.</p></div>';
}
function renderSummary() {
 const t=table();$('#summary-table').textContent=t.name;
 const validAmounts=t.items.every(i=>Number.isSafeInteger(i.amount)&&i.amount>=0);
 const sum=t.items.reduce((s,i)=>s+(Number.isSafeInteger(i.amount)?i.amount:0),0);
 $('#total').innerHTML=validAmounts&&Number.isSafeInteger(sum)?`${sum.toLocaleString('ko-KR')}<span>원</span>`:'—';
 for (const item of t.items) {
  const el=document.getElementById(`split-${item.id}`); if(!el)continue;
  let text='먹은 사람을 선택해 주세요.';
  if(item.members.length && Number.isSafeInteger(item.amount) && item.amount>=0) {
   const base=Math.floor(item.amount/item.members.length), extra=item.amount%item.members.length;
   text=`${item.members.length}명 선택 · 1인 ${won(base)}${extra?` + ${extra}명은 1원 추가`:''}`;
  } else if(item.members.length) text='메뉴 금액을 입력해 주세요.';
  el.textContent=text;el.classList.toggle('warning',!item.members.length);
 }
 let result;
 try {result=settle(t);} catch(error) {$('#summary-content').innerHTML=`<div class="summary-empty">${escapeHTML(error.message)}</div>`;$('#make-notice').disabled=true;return;}
 if(!t.items.length){$('#summary-content').innerHTML='<div class="summary-empty">메뉴를 추가하면 개인별 정산 금액이 여기에 표시됩니다.</div>';$('#make-notice').disabled=true;return;}
 const collected=result.rows.reduce((s,p)=>s+(t.paid[p.id]?p.transfer:0),0);
 $('#summary-content').innerHTML=`<div class="people-totals">${result.rows.map(p=>`<div class="person-total"><div><strong>${escapeHTML(p.name)}</strong><small>${p.id===t.payer?'결제자 · 본인 부담':p.transfer?'입금할 금액':'부담 없음'}</small></div><div class="person-amount"><strong>${won(p.share)}</strong>${p.id===t.payer?'<small>송금 없음</small>':p.transfer?`<label class="paid-label"><input type="checkbox" data-paid="${escapeHTML(p.id)}" ${t.paid[p.id]?'checked':''}> 입금 확인</label>`:''}</div></div>`).join('')}</div><div class="balance"><span>받을 금액</span><strong>${won(result.receivable)}</strong><span>입금 확인</span><strong>${won(collected)}</strong><span>남은 금액</span><strong class="remaining">${won(result.receivable-collected)}</strong></div>`;
 $('#make-notice').disabled=false;
}
function render() {
 const t=table();$('#meeting-date').value=state.date;$('#table-name').value=t.name;
 $('#bank').value=t.account.bank;$('#holder').value=t.account.holder;$('#account-number').value=t.account.number;
 renderTabs();renderPeople();renderItems();renderSummary();
}
$('#person-form').addEventListener('submit',event=>{
 event.preventDefault();const name=$('#person-name').value.trim();if(!name)return;
 if(table().people.some(p=>p.name===name)){toast('같은 이름이 있어요. 성이나 별칭을 덧붙여 주세요.');return;}
 table().people.push({id:uid(),name});$('#person-name').value='';save(true);renderPeople();renderItems();renderSummary();renderTabs();$('#person-name').focus();
});
$('#people').addEventListener('click',event=>{
 const button=event.target.closest('[data-remove-person]');if(!button)return;
 const t=table(),id=button.dataset.removePerson;
 if(t.items.some(i=>i.members.includes(id))&&!confirm('이 참석자를 모든 메뉴에서 제외할까요? 분담액이 다시 계산됩니다.'))return;
 t.people=t.people.filter(p=>p.id!==id);t.items.forEach(i=>i.members=i.members.filter(m=>m!==id));if(t.payer===id)t.payer='';save(true);render();
});
$('#payer').addEventListener('change',()=>{table().payer=$('#payer').value;save(true);renderItems();renderSummary();});
$('#add-item').addEventListener('click',()=>{table().items.push({id:uid(),name:'',amount:null,members:[]});save(true);renderItems();renderSummary();$('#items .menu:last-child input').focus();});
$('#items').addEventListener('input',event=>{
 const field=event.target.dataset.field;if(!field)return;
 const item=table().items.find(i=>i.id===event.target.closest('[data-item]').dataset.item);
 item[field]=field==='amount'?(event.target.value===''?null:Number(event.target.value)):event.target.value;
 save(true);renderSummary();
});
$('#items').addEventListener('change',event=>{
 const id=event.target.dataset.member;if(!id)return;
 const item=table().items.find(i=>i.id===event.target.closest('[data-item]').dataset.item);
 item.members=event.target.checked?[...item.members,id]:item.members.filter(m=>m!==id);save(true);renderSummary();
});
$('#items').addEventListener('click',event=>{
 const remove=event.target.closest('[data-remove-item]'), all=event.target.closest('[data-select-all]');
 if(remove){const item=table().items.find(i=>i.id===remove.dataset.removeItem);if((item.name||item.amount)&&!confirm('이 메뉴를 삭제할까요?'))return;table().items=table().items.filter(i=>i.id!==item.id);}
 else if(all){table().items.find(i=>i.id===all.dataset.selectAll).members=table().people.map(p=>p.id);}else return;
 save(true);renderItems();renderSummary();
});
$('#summary-content').addEventListener('change',event=>{const id=event.target.dataset.paid;if(id){table().paid[id]=event.target.checked;save();renderSummary();}});
$('#table-tabs').addEventListener('click',event=>{const button=event.target.closest('[data-table]');if(button){active=button.dataset.table;render();}});
$('#add-table').addEventListener('click',()=>{let n=1;while(state.tables.some(t=>t.name===`${n}번 테이블`))n++;const t=newTable(`${n}번 테이블`);state.tables.push(t);active=t.id;save();render();$('#person-name').focus();});
$('#delete-table').addEventListener('click',()=>{
 const t=table();
 const hasData=t.people.length||t.items.length||t.payer||Object.values(t.account).some(Boolean)||Object.values(t.paid).some(Boolean);
 if(hasData&&!confirm(`“${t.name||'이름 없는 테이블'}”을 삭제할까요? 참석자, 메뉴, 계좌와 입금 확인 내역이 함께 삭제됩니다. 가장 최근에 삭제한 테이블은 복원할 수 있습니다.`))return;
 try{active=removeTable(state,active);save();render();$('#delete-table').focus();toast('테이블을 삭제했습니다. 최근 삭제한 테이블 복원 버튼으로 되돌릴 수 있습니다.');}catch(error){toast(error.message);}
});
$('#restore-table').addEventListener('click',()=>{
 try{active=restoreTable(state);save();render();$('#table-name').focus();toast('테이블과 입력 내역을 복원했습니다.');}catch(error){toast(error.message);}
});
$('#table-name').addEventListener('input',()=>{table().name=$('#table-name').value;save();renderTabs();renderSummary();});
$('#meeting-date').addEventListener('change',()=>{state.date=$('#meeting-date').value;save();});
for(const [selector,field] of [['#bank','bank'],['#holder','holder'],['#account-number','number']])$(selector).addEventListener('input',()=>{table().account[field]=$(selector).value;save();});
$('#make-notice').addEventListener('click',()=>{try {openNotice(notice(table(),state.date));}catch(error){toast(error.message);}});
$('#close-notice').addEventListener('click',()=>$('#notice-dialog').close());
$('#copy-notice').addEventListener('click',async()=>{
 try {await navigator.clipboard.writeText($('#notice-text').value);toast('정산 공지를 복사했습니다.');}
 catch {$('#notice-text').focus();$('#notice-text').select();toast('복사할 내용을 선택했습니다. ⌘C 또는 Ctrl+C를 눌러 주세요.');}
});
$('#backup').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`deep-dive-${state.date||'settlement'}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
$('#demo').addEventListener('click',()=>{
 const existing=state.tables.find(t=>t.demo);if(existing){active=existing.id;render();return;}
 const t=newTable('예시 테이블');t.demo=true;t.people=['Eric','지영','민수','수진'].map(name=>({id:uid(),name}));t.payer=t.people[0].id;
 t.items=[{id:uid(),name:'마르게리타 피자',amount:30000,members:t.people.slice(0,3).map(p=>p.id)},{id:uid(),name:'맥주 2잔',amount:12000,members:t.people.slice(0,2).map(p=>p.id)},{id:uid(),name:'레모네이드',amount:6000,members:[t.people[3].id]}];
 state.tables.push(t);active=t.id;save();render();toast('예시 테이블을 추가했습니다. 기존 입력은 그대로 보관됩니다.');
});
render();

$('#all-notice').addEventListener('click',()=>{
 try { openNotice(combinedNotice(state.tables,state.date)); }
 catch(error){toast(error.message);}
});

let imageRequest=0;
let imageURLs=[];
function clearNoticeImages(){
 imageRequest++;
 imageURLs.forEach(url=>URL.revokeObjectURL(url));imageURLs=[];
 $('#notice-images').replaceChildren();$('#notice-images').hidden=true;
 $('#image-status').textContent='';$('#make-image').disabled=false;
}
function openNotice(text){
 clearNoticeImages();$('#notice-text').value=text;$('#notice-dialog').showModal();
}
$('#notice-dialog').addEventListener('close',clearNoticeImages);
$('#make-image').addEventListener('click',async()=>{
 clearNoticeImages();const request=imageRequest;
 $('#make-image').disabled=true;$('#image-status').textContent='공지 전체를 이미지로 만들고 있습니다…';
 try{
  const blobs=await NoticeImage.renderNotice($('#notice-text').value);
  if(request!==imageRequest||!$('#notice-dialog').open)return;
  const fragment=document.createDocumentFragment();
  blobs.forEach((blob,index)=>{
   const url=URL.createObjectURL(blob);imageURLs.push(url);
   const name=`deep-dive-${state.date||'settlement'}-${index+1}of${blobs.length}.png`;
   const card=document.createElement('article');card.className='notice-image-card';
   const heading=document.createElement('h3');heading.textContent=`정산 공지 ${index+1} / ${blobs.length}장`;
   const img=document.createElement('img');img.src=url;img.alt=`정산 공지 ${index+1}/${blobs.length}장 미리보기`;
   const actions=document.createElement('div');actions.className='notice-actions';
   const download=document.createElement('a');download.href=url;download.download=name;download.className='image-download';download.textContent=`${index+1}장 PNG 저장`;
   actions.append(download);
   if(typeof File==='function'&&navigator.canShare&&navigator.share){
    const file=new File([blob],name,{type:'image/png'});
    if(navigator.canShare({files:[file]})){
     const share=document.createElement('button');share.textContent=`${index+1}장 이미지 공유`;
     share.addEventListener('click',async()=>{
      try{await navigator.share({files:[file]});}
      catch(error){if(error.name!=='AbortError')$('#image-status').textContent='공유를 열지 못했습니다. PNG 저장 또는 이미지 길게 누르기를 이용해 주세요.';}
     });actions.append(share);
    }
   }
   card.append(heading,img,actions);fragment.append(card);
  });
  $('#notice-images').append(fragment);$('#notice-images').hidden=false;
  $('#image-status').textContent=`${blobs.length}장의 이미지를 만들었습니다. 각 장을 저장해 채팅방에 올려 주세요. 휴대폰에서는 이미지를 길게 눌러 저장할 수도 있습니다.`;
  $('#notice-images').scrollIntoView({block:'start',behavior:'smooth'});
 }catch(error){
  if(request===imageRequest){$('#image-status').textContent=error.message||'이미지를 만들지 못했습니다. 텍스트 복사를 이용해 주세요.';}
 }finally{if(request===imageRequest)$('#make-image').disabled=false;}
});
