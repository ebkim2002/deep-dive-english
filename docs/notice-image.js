(function(root){
 'use strict';
 const WIDTH=1000, MARGIN=60, TOP=180, LINE=44, FOOTER=90, MAX_HEIGHT=2800;
 const FONT='28px system-ui, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
 const CAPACITY=Math.floor((MAX_HEIGHT-TOP-FOOTER)/LINE);
 function planNotice(text,measure){
  if(typeof text!=='string'||!text.trim())throw Error('이미지로 만들 공지가 없습니다.');
  if(text.length>100000)throw Error('공지가 너무 깁니다. 테이블별로 이미지를 만들어 주세요.');
  const segmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter('ko',{granularity:'grapheme'}):null;
  const lines=[];
  text.replace(/\r\n?/g,'\n').split('\n').forEach((source,sourceLine)=>{
   const parts=segmenter?Array.from(segmenter.segment(source),s=>s.segment):Array.from(source);
   let current='';
   for(const part of parts){
    if(measure(part)>WIDTH-MARGIN*2)throw Error('표시할 수 없는 긴 문자가 있습니다. 공지 내용을 확인해 주세요.');
    if(current&&measure(current+part)>WIDTH-MARGIN*2){lines.push({text:current,sourceLine});current='';}
    current+=part;
   }
   lines.push({text:current,sourceLine});
  });
  if(lines.length>CAPACITY*40)throw Error('공지가 너무 깁니다. 테이블별로 이미지를 만들어 주세요.');
  const pages=[];
  for(let start=0;start<lines.length;start+=CAPACITY){
   const chunk=lines.slice(start,start+CAPACITY);
   pages.push({width:WIDTH,height:TOP+chunk.length*LINE+FOOTER,lines:chunk.map((line,i)=>({...line,x:MARGIN,y:TOP+i*LINE}))});
  }
  return pages;
 }
 async function renderNotice(text,options={}){
  const createCanvas=options.createCanvas||(()=>document.createElement('canvas'));
  if(typeof document!=='undefined'&&document.fonts)await document.fonts.ready;
  const probe=createCanvas(),context=probe.getContext('2d');
  if(!context)throw Error('이 브라우저에서는 이미지 생성을 지원하지 않습니다.');
  context.font=FONT;
  const pages=planNotice(text,s=>context.measureText(s).width);
  probe.width=probe.height=0;
  const blobs=[];
  for(let i=0;i<pages.length;i++){
   const page=pages[i],canvas=createCanvas();canvas.width=page.width;canvas.height=page.height;
   try{
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('이미지를 만들 수 없습니다.');
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#21594b';ctx.fillRect(0,0,canvas.width,140);
    ctx.fillStyle='#d9ed9c';ctx.font='16px system-ui, sans-serif';ctx.textBaseline='top';ctx.fillText('DEEP DIVE ENGLISH',MARGIN,28);
    ctx.fillStyle='#ffffff';ctx.font='bold 42px system-ui, sans-serif';ctx.fillText('함께한 만큼, 깔끔하게.',MARGIN,61);
    ctx.font=FONT;ctx.fillStyle='#173c37';ctx.textBaseline='top';
    for(const line of page.lines)ctx.fillText(line.text,line.x,line.y);
    ctx.fillStyle='#74817a';ctx.font='20px system-ui, sans-serif';
    ctx.fillText(`정산 공지 · ${i+1} / ${pages.length}장${i<pages.length-1?' · 다음 장에 계속':''}`,MARGIN,page.height-52);
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('이미지 생성에 실패했습니다. 다시 시도해 주세요.')),'image/png'));
    blobs.push(blob);
   }finally{canvas.width=canvas.height=0;}
  }
  return blobs;
 }
 const api={planNotice,renderNotice};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.NoticeImage=api;
})(globalThis);
