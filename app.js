/* ============================================================
   IQ Cutting — محسّن قص ألواح الأخشاب (2D Guillotine)
   كل الأبعاد بالسنتيمتر — الأسعار بالدولار $
   ============================================================ */

const $ = (s) => document.querySelector(s);
const palette = ['#dbe7f5','#fde9d2','#d8f0e0','#f5d8e6','#e7dcf5','#fdf0c8',
                 '#d2eef5','#f5dcd2','#e2f5d2','#f0d2f0','#d2d8f5','#f5f0d2'];

/* ---------------- الحالة (State) ---------------- */
let bandTypes = [
  { id: 'b1', name: 'PVC', price: 0.50 },
  { id: 'b0', name: 'بدون تلبيس', price: 0.00 },
];
let pieces = [];
let showExtra = false;
function applyExtraToggleUI(){
  const btn=document.getElementById('toggleExtra'); if(!btn) return;
  btn.classList.toggle('on', showExtra);
  btn.textContent = showExtra ? '⚙ إخفاء الخيارات الإضافية' : '⚙ خيارات إضافية';
}
let sheetTypes = [ { id:'s1', name:'', l:null, w:null, qty:null, price:null, grain:false } ];
let activeSheetIds = ['s1'];
let layout = null;
let settings = null;
let projectImage = null;
let uid = 100;
let appUserProfile = null;
function canAccess(service){ return checkAccess(service, appUserProfile); }
const nid = () => 'x' + (++uid);
const emptyPiece=()=>({id:nid(),name:'',l:null,w:null,qty:null,bandId:bandTypes[0]?.id,edges:{t:false,b:false,l:false,r:false},sheetTypeId:sheetTypes[0]?.id});

/* ---------------- أدوات مساعدة ---------------- */
function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.remove('hidden');
  clearTimeout(t._tm); t._tm=setTimeout(()=>t.classList.add('hidden'),2600); }
function escapeHtml(s){ if(s==null) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function bandById(id){ return bandTypes.find(b=>b.id===id) || {name:'-',price:0}; }


/* ---------------- حفظ آخر مشروع تلقائياً ---------------- */
const LS_KEY='iqcutting_project_v3';
function _readInputs(){ return {
  planName:($('#planName')&&$('#planName').value)||'',
  kerf:($('#kerf')&&$('#kerf').value)||'',
  cutFee:($('#cutFee')&&$('#cutFee').value)||'',
  cutDir:($('#cutDir')&&$('#cutDir').value)||'length'
}; }
function saveState(){ try{ localStorage.setItem(LS_KEY, JSON.stringify({pieces,sheetTypes,bandTypes,activeSheetIds,showExtra,layout,settings,uid,inputs:_readInputs(),projectImage})); }catch(_){} }
let _saveT=null; function scheduleSave(){ clearTimeout(_saveT); _saveT=setTimeout(saveState,400); }
function loadState(){ try{ const raw=localStorage.getItem(LS_KEY); if(!raw) return null; const d=JSON.parse(raw);
  if(Array.isArray(d.pieces)) pieces=d.pieces;
  if(Array.isArray(d.sheetTypes)&&d.sheetTypes.length) sheetTypes=d.sheetTypes;
  if(Array.isArray(d.bandTypes)&&d.bandTypes.length) bandTypes=d.bandTypes;
  if(Array.isArray(d.activeSheetIds)) activeSheetIds=d.activeSheetIds;
  else if(d.activeSheetId) activeSheetIds=[d.activeSheetId];
  showExtra=!!d.showExtra; layout=d.layout||null; settings=d.settings||null;
  projectImage=d.projectImage||null;
  if(typeof d.uid==='number') uid=Math.max(uid,d.uid);
  sheetTypes.forEach(s=>{ if(s.grain===undefined) s.grain=false; });
  pieces.forEach(p=>{ if(!p.sheetTypeId) p.sheetTypeId=sheetTypes[0]?.id; });
  if(layout&&layout.length&&!layout[0].sheets){
    const mt=sheetTypes[0];
    if(mt&&mt.l&&mt.w) layout=[{materialId:mt.id,materialName:mt.name,L:mt.l,W:mt.w,sheetPrice:mt.price||0,sheets:layout}];
    else layout=null;
  }
  return d.inputs||{};
}catch(_){ return null; } }

/* ---------------- المقاسات المكررة: مفتاح المقاس وعدّ التكرارات ---------------- */
function sizeKey(p){ const a=(p.origL!=null?p.origL:p.l), b=(p.origW!=null?p.origW:p.w); const mn=Math.min(a,b), mx=Math.max(a,b); return mn+'x'+mx; }

/* ---------------- تجميع الألواح المتطابقة ---------------- */
function sheetFingerprint(sh, materialId){
  return (materialId||'')+'|'+sh.pieces.map(p=>[Math.round(p.x*10),Math.round(p.y*10),Math.round(p.l*10),Math.round(p.w*10),(p.rot?1:0),(p.bandId||''),(p.edges?(''+(!!p.edges.t)+(!!p.edges.b)+(!!p.edges.l)+(!!p.edges.r)):'')].join(','))
    .sort().join('|');
}
function groupSheets(sheets, materialId){
  const groups=[]; const map={};
  (sheets||[]).forEach((sh,idx)=>{
    const fp=sheetFingerprint(sh,materialId);
    if(map[fp]!=null){ const g=groups[map[fp]]; g.count++; g.idxs.push(idx); }
    else { map[fp]=groups.length; groups.push({sheet:sh, idx:idx, count:1, idxs:[idx], fp:fp}); }
  });
  return groups;
}

/* ---------------- وصف اتجاه القص ---------------- */
function cutDirLabel(d){ return d==='length'?'طولي ‖':(d==='cross'?'عرضي ═':'حر ✲'); }


/* ---------------- جداول الإدخال ---------------- */
function renderBandTable(){
  const tb = $('#bandTable tbody'); tb.innerHTML='';
  bandTypes.forEach(b=>{
    const tr=document.createElement('tr');
    tr.innerHTML = `
      <td><input value="${escapeHtml(b.name)}" data-id="${b.id}" data-f="name"></td>
      <td><input type="number" step="0.01" min="0" value="${b.price}" data-id="${b.id}" data-f="price"></td>
      <td><button class="btn btn-danger" data-del="${b.id}">✕</button></td>`;
    tb.appendChild(tr);
  });
  tb.querySelectorAll('input').forEach(inp=>inp.addEventListener('input',e=>{
    const b=bandTypes.find(x=>x.id===e.target.dataset.id); const f=e.target.dataset.f;
    b[f] = f==='price' ? (parseFloat(e.target.value)||0) : e.target.value;
  }));
  tb.querySelectorAll('[data-del]').forEach(btn=>btn.addEventListener('click',e=>{
    bandTypes=bandTypes.filter(x=>x.id!==e.target.dataset.del); renderBandTable(); renderPieceTable();
  }));
}

function renderSheetTable(){
  const tb=$('#sheetTable tbody'); if(!tb) return; tb.innerHTML='';
  const val=v=>v==null?'':v;
  sheetTypes.forEach(s=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td><input value="${escapeHtml(s.name)}" data-id="${s.id}" data-f="name" class="sheet-compact-input" placeholder="اسم" style="min-width:44px"></td>
      <td><input type="number" min="1" value="${val(s.l)}" data-id="${s.id}" data-f="l" class="sheet-compact-input"></td>
      <td><input type="number" min="1" value="${val(s.w)}" data-id="${s.id}" data-f="w" class="sheet-compact-input"></td>
      <td><input type="number" min="1" value="${val(s.qty)}" data-id="${s.id}" data-f="qty" class="sheet-compact-input"></td>
      <td><input type="number" min="0" step="0.01" value="${val(s.price)}" data-id="${s.id}" data-f="price" class="sheet-compact-input"></td>
      <td style="text-align:center"><input type="checkbox" data-grain="${s.id}" ${s.grain?'checked':''} title="عرق اللوح"></td>
      <td><button class="btn btn-danger" data-del="${s.id}" style="padding:3px 6px;font-size:11px">\u2715</button></td>`;
    tb.appendChild(tr);
  });
  tb.querySelectorAll('input[data-f]').forEach(inp=>inp.addEventListener('input',e=>{
    const s=sheetTypes.find(x=>x.id===e.target.dataset.id); const f=e.target.dataset.f;
    s[f]=['l','w','qty','price'].includes(f)?(e.target.value===''?null:parseFloat(e.target.value)):e.target.value;
  }));
  tb.querySelectorAll('[data-grain]').forEach(cb=>cb.addEventListener('change',e=>{
    const s=sheetTypes.find(x=>x.id===e.target.dataset.grain); if(s) s.grain=e.target.checked;
  }));
  tb.querySelectorAll('[data-del]').forEach(btn=>btn.addEventListener('click',e=>{
    if(sheetTypes.length<=1){ toast('يجب إبقاء خامة واحدة على الأقل'); return; }
    const id=e.target.dataset.del;
    sheetTypes=sheetTypes.filter(x=>x.id!==id);
    activeSheetIds=activeSheetIds.filter(aid=>aid!==id);
    if(!activeSheetIds.length) activeSheetIds=[sheetTypes[0].id];
    pieces.forEach(p=>{ if(p.sheetTypeId===id) p.sheetTypeId=sheetTypes[0].id; });
    renderSheetTable(); renderPieceTable();
  }));
  renderActiveSheetCheckboxes();
}

function renderActiveSheetCheckboxes(){
  let div=document.getElementById('activeSheetsCheckboxes');
  if(!div) return;
  div.innerHTML=sheetTypes.map(s=>`<label><input type="checkbox" data-asid="${s.id}" ${activeSheetIds.includes(s.id)?'checked':''}> ${escapeHtml(s.name)}</label>`).join(' ');
  div.querySelectorAll('input').forEach(cb=>cb.addEventListener('change',e=>{
    if(e.target.checked){ if(!activeSheetIds.includes(e.target.dataset.asid)) activeSheetIds.push(e.target.dataset.asid); }
    else { activeSheetIds=activeSheetIds.filter(id=>id!==e.target.dataset.asid); }
  }));
}

function renderPieceTable(){
  const tb=$('#pieceTable tbody'); tb.innerHTML='';
  const val=v=>v==null?'':v;
  pieces.forEach(p=>{
    const opts=bandTypes.map(b=>`<option value="${b.id}" ${b.id===p.bandId?'selected':''}>${escapeHtml(b.name)}</option>`).join('');
    const matOpts=sheetTypes.map(s=>`<option value="${s.id}" ${s.id===p.sheetTypeId?'selected':''}>${escapeHtml(s.name)}</option>`).join('');
    const eb=(k,sym)=>`<button class="edge-btn ${p.edges[k]?'on':''}" data-id="${p.id}" data-e="${k}" title="${k}">${sym}</button>`;

    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td><input type="number" min="1" value="${val(p.l)}" data-id="${p.id}" data-f="l"></td>
      <td><input type="number" min="1" value="${val(p.w)}" data-id="${p.id}" data-f="w"></td>
      <td><input type="number" min="1" value="${val(p.qty)}" data-id="${p.id}" data-f="qty"></td>
      <td><select data-id="${p.id}" data-f="sheetTypeId" style="font-size:11px;padding:2px;width:60px">${matOpts}</select></td>
      <td><button class="btn btn-danger" data-del="${p.id}">✕</button></td>`;
    tb.appendChild(tr);

    if(showExtra){
      const tro=document.createElement('tr');
      tro.className='opt-row';
      tro.dataset.optrow=p.id;
      tro.innerHTML=`
        <td colspan="5">
          <div class="opt-grid">
            <label class="opt-field">اسم القطعة
              <input value="${escapeHtml(p.name)}" data-id="${p.id}" data-f="name" placeholder="اختياري">
            </label>
            <label class="opt-field">نوع الحرف
              <select data-id="${p.id}" data-f="bandId">${opts}</select>
            </label>
            <div class="opt-field">مكان التلبيس (الأطراف)
              <div class="edge-toggles">${eb('t','↑')}${eb('b','↓')}${eb('l','←')}${eb('r','→')}</div>
            </div>
          </div>
        </td>`;
      tb.appendChild(tro);
    }
  });

  tb.querySelectorAll('input,select').forEach(inp=>inp.addEventListener('input',e=>{
    const p=pieces.find(x=>x.id===e.target.dataset.id); const f=e.target.dataset.f;
    if(f==='sheetTypeId') p[f]=e.target.value;
    else p[f]=['l','w','qty'].includes(f)?(e.target.value===''?null:parseFloat(e.target.value)):e.target.value;
  }));
  tb.querySelectorAll('.edge-btn').forEach(btn=>{
    btn.addEventListener('pointerdown',e=>{
      e.preventDefault();
      const p=pieces.find(x=>x.id===btn.dataset.id); const k=btn.dataset.e;
      if(!p) return; p.edges[k]=!p.edges[k]; btn.classList.toggle('on',p.edges[k]);
    });
  });
  tb.querySelectorAll('[data-del]').forEach(btn=>{
    btn.addEventListener('mousedown',e=>e.preventDefault());
    btn.addEventListener('click',e=>{
      const delId=e.currentTarget.dataset.del;
      const idx=pieces.findIndex(x=>x.id===delId);
      pieces=pieces.filter(x=>x.id!==delId); renderPieceTable();
      if(pieces.length){
        const ni=Math.min(idx, pieces.length-1);
        const inp=document.querySelector(`#pieceTable tbody input[data-id="${pieces[ni].id}"][data-f="l"]`);
        if(inp) inp.focus();
      }
    });
  });
}

/* ---------------- إدخال صورة مرجعية ---------------- */
let _importBound=false;
function renderImageInput(){
  if(_importBound) return; _importBound=true;
  const status=document.getElementById('importStatus');
  function setImportStatus(msg){ if(status) status.textContent=msg; }

  /* --- كاميرا / صورة (مرجع فقط) --- */
  const cameraFile=document.getElementById('importFileCamera');
  const imageFile=document.getElementById('importFileImage');
  document.getElementById('btnImportCamera')?.addEventListener('click',()=>cameraFile.click());
  document.getElementById('btnImportImage')?.addEventListener('click',()=>imageFile.click());
  function handleImageRef(e){
    const file=e.target.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=()=>{ projectImage=reader.result; setImportStatus('✓ تم تحميل الصورة كمرجع'); scheduleSave(); };
    reader.readAsDataURL(file);
    e.target.value='';
  }
  if(cameraFile) cameraFile.addEventListener('change',handleImageRef);
  if(imageFile) imageFile.addEventListener('change',handleImageRef);

  /* --- PDF --- */
  document.getElementById('btnImportPdf')?.addEventListener('click',()=>document.getElementById('importFilePdf')?.click());
  document.getElementById('importFilePdf')?.addEventListener('change',async function(e){
    const file=e.target.files[0]; if(!file) return;
    setImportStatus('جاري قراءة PDF...');
    try{
      if(typeof pdfjsLib==='undefined'){ setImportStatus('❌ مكتبة PDF غير متوفرة — تحقق من الاتصال بالإنترنت'); return; }
      pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const arrayBuffer=await file.arrayBuffer();
      const pdf=await pdfjsLib.getDocument({data:arrayBuffer}).promise;
      let allText='';
      for(let i=1;i<=pdf.numPages;i++){
        const page=await pdf.getPage(i);
        const tc=await page.getTextContent();
        allText+=tc.items.map(it=>it.str).join(' ')+'\n';
      }
      const dims=parseDimensionsFromText(allText);
      if(dims.length){ importParsedDimensions(dims); setImportStatus('✓ تم استخراج '+dims.length+' قطعة من PDF'); }
      else setImportStatus('⚠ لم يتم العثور على مقاسات في PDF');
    }catch(err){ setImportStatus('❌ خطأ في قراءة PDF: '+err.message); }
    e.target.value='';
  });

  /* --- Excel / CSV --- */
  document.getElementById('btnImportExcel')?.addEventListener('click',()=>document.getElementById('importFileExcel')?.click());
  document.getElementById('importFileExcel')?.addEventListener('change',function(e){
    const file=e.target.files[0]; if(!file) return;
    setImportStatus('جاري قراءة الملف...');
    const reader=new FileReader();
    reader.onload=function(ev){
      try{
        if(typeof XLSX==='undefined'){ setImportStatus('❌ مكتبة Excel غير متوفرة — تحقق من الاتصال بالإنترنت'); return; }
        const wb=XLSX.read(ev.target.result,{type:'array'});
        const ws=wb.Sheets[wb.SheetNames[0]];
        const data=XLSX.utils.sheet_to_json(ws,{header:1});
        const dims=parseDimensionsFromRows(data);
        if(dims.length){ importParsedDimensions(dims); setImportStatus('✓ تم استخراج '+dims.length+' قطعة من '+file.name); }
        else setImportStatus('⚠ لم يتم العثور على مقاسات في الملف');
      }catch(err){ setImportStatus('❌ خطأ في قراءة الملف: '+err.message); }
    };
    reader.readAsArrayBuffer(file);
    e.target.value='';
  });

  /* --- Google Sheets --- */
  document.getElementById('btnImportGsheet')?.addEventListener('click',async function(){
    const url=prompt('الصق رابط Google Sheet العام (يجب أن يكونمشاركة عامة):');
    if(!url) return;
    setImportStatus('جاري جلب البيانات...');
    try{
      let csvUrl=url;
      const match=url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
      if(match) csvUrl='https://docs.google.com/spreadsheets/d/'+match[1]+'/export?format=csv';
      const resp=await fetch(csvUrl);
      if(!resp.ok) throw new Error('HTTP '+resp.status);
      const text=await resp.text();
      const lines=text.split('\n').map(l=>l.split(',').map(c=>c.trim().replace(/^"|"$/g,'')));
      const dims=parseDimensionsFromRows(lines);
      if(dims.length){ importParsedDimensions(dims); setImportStatus('✓ تم استخراج '+dims.length+' قطعة من Google Sheets'); }
      else setImportStatus('⚠ لم يتم العثور على مقاسات في الجدول');
    }catch(err){ setImportStatus('❌ خطأ في جلب البيانات: '+err.message); }
  });
}

/* --- استخراج المقاسات من نص (PDF) --- */
function parseDimensionsFromText(text){
  const dims=[];
  const re=/(\d+\.?\d*)\s*[x×*]\s*(\d+\.?\d*)/gi;
  let m;
  while((m=re.exec(text))!==null){
    const l=parseFloat(m[1]), w=parseFloat(m[2]);
    if(l>0&&w>0) dims.push({name:'',l:l,w:w,qty:1});
  }
  if(!dims.length){
    const lines=text.split(/\n/);
    const numRe=/^\s*(\d+\.?\d*)\s+(\d+\.?\d*)\s*(?:[x×*]\s*(\d+\.?\d*))?\s*$/;
    lines.forEach(line=>{
      const m2=line.match(numRe);
      if(m2){
        const l=parseFloat(m2[1]), w=parseFloat(m2[2]), q=m2[3]?parseInt(m2[3]):1;
        if(l>0&&w>0&&q>0) dims.push({name:'',l:l,w:w,qty:q});
      }
    });
  }
  return dims;
}

/* --- استخراج المقاسات من صفوف جدول (Excel/CSV) --- */
function parseDimensionsFromRows(rows){
  const dims=[];
  if(!rows||!rows.length) return dims;
  let startIdx=0;
  const header=rows[0];
  if(header&&header.some&&header.some(c=>typeof c==='string'&&/طول|عرض|عدد|كمية|length|width|qty|quantity/i.test(c))){
    startIdx=1;
  }
  for(let i=startIdx;i<rows.length;i++){
    const row=rows[i];
    if(!row||!row.length) continue;
    const nums=[];
    let nameVal='';
    for(let j=0;j<row.length;j++){
      const v=typeof row[j]==='string'?row[j].trim():row[j];
      if(v===''||v==null) continue;
      const n=parseFloat(v);
      if(!isNaN(n)&&n>0) nums.push(n);
      else if(typeof v==='string'&&v.length&&!/^[x×*]+$/.test(v)) nameVal=v;
    }
    if(nums.length>=2){
      const l=nums[0], w=nums[1], q=nums.length>=3?Math.floor(nums[2]):1;
      if(q>0) dims.push({name:nameVal,l:l,w:w,qty:q});
    }
  }
  return dims;
}

/* --- إدراج المقاسات المستخرجة في جدول القطع --- */
function importParsedDimensions(dims){
  dims.forEach(d=>{
    let target=null;
    for(const p of pieces){
      if(p.l==null&&p.w==null){ target=p; break; }
    }
    if(!target){
      target=emptyPiece();
      pieces.push(target);
    }
    target.name=d.name;
    target.l=d.l;
    target.w=d.w;
    target.qty=d.qty;
    if(sheetTypes.length&&!target.sheetTypeId) target.sheetTypeId=sheetTypes[0].id;
    if(bandTypes.length&&!target.bandId) target.bandId=bandTypes[0].id;
  });
  renderPieceTable();
}
function optimize(){
  const kerf=+$('#kerf').value||0, cutDir=$('#cutDir').value;
  const cutFee=+$('#cutFee').value||0, planName=$('#planName').value.trim();
  settings={kerf,cutDir,cutFee,planName};

  const itemsByMaterial={};
  let invalidCount=0;
  pieces.forEach(p=>{
    const l=parseFloat(p.l), w=parseFloat(p.w), q=parseInt(p.qty)||0;
    if(!(l>0&&w>0&&q>0)){ invalidCount++; return; }
    let matId=p.sheetTypeId;
    if(!sheetTypes.find(s=>s.id===matId)) matId=sheetTypes[0]?.id;
    if(!matId) return;
    if(!activeSheetIds.includes(matId)) return;
    if(!itemsByMaterial[matId]) itemsByMaterial[matId]=[];
    for(let i=0;i<q;i++) itemsByMaterial[matId].push({...p, _l:l, _w:w, _sheetTypeId:matId});
  });
  if(invalidCount) toast('\u26a0\ufe0f تُجاهل '+invalidCount+' قطعة بأبعاد غير صحيحة');

  layout=[];
  let totalPlaced=0, totalUnplaced=0, totalSheetsNeeded=0;

  Object.keys(itemsByMaterial).forEach(matId=>{
    const items=itemsByMaterial[matId];
    if(!items||!items.length) return;
    const at=sheetTypes.find(s=>s.id===matId)||sheetTypes[0];
    const L=+at.l, W=+at.w, qty=+at.qty||0;
    if(!(L>0&&W>0)){ toast('\u26a0\ufe0f أبعاد خامة "'+at.name+'" غير صحيحة \u2014 تُتجاهل'); return; }
    const allowRotate=!at.grain;

    items.sort((a,b)=> (b._l*b._w)-(a._l*a._w) || Math.max(b._l,b._w)-Math.max(a._l,a._w));

    const sheets=[]; const unplaced=[];
    const fits=(fr,pl,pw)=> pl<=fr.w+1e-6 && pw<=fr.h+1e-6;

    function tryPlace(s,it){
      let best=null,score=Infinity,rot=false;
      for(const fr of s.free){
        if(fits(fr,it._l,it._w)){ const sc=Math.min(fr.w-it._l,fr.h-it._w); if(sc<score){score=sc;best=fr;rot=false;} }
        if(allowRotate&&fits(fr,it._w,it._l)){ const sc=Math.min(fr.w-it._w,fr.h-it._l); if(sc<score){score=sc;best=fr;rot=true;} }
      }
      if(!best) return false;
      const pl=rot?it._w:it._l, pw=rot?it._l:it._w;
      s.placed.push({ x:best.x, y:best.y, l:pl, w:pw, rot, src:it, origL:it._l, origW:it._w });
      const rightW=best.w-pl-kerf, bottomH=best.h-pw-kerf;
      if(rightW>0.05) s.cuts++; if(bottomH>0.05) s.cuts++;
      s.free=s.free.filter(f=>f!==best);
      let r1,r2;
      if(cutDir==='length'){
        r1={x:best.x+pl+kerf, y:best.y, w:rightW, h:best.h};
        r2={x:best.x, y:best.y+pw+kerf, w:pl, h:bottomH};
      } else if(cutDir==='cross'){
        r1={x:best.x, y:best.y+pw+kerf, w:best.w, h:bottomH};
        r2={x:best.x+pl+kerf, y:best.y, w:rightW, h:pw};
      } else {
        const aR1={x:best.x+pl+kerf, y:best.y, w:rightW, h:best.h};
        const aR2={x:best.x, y:best.y+pw+kerf, w:pl, h:bottomH};
        const bR1={x:best.x, y:best.y+pw+kerf, w:best.w, h:bottomH};
        const bR2={x:best.x+pl+kerf, y:best.y, w:rightW, h:pw};
        const maxA=Math.max(aR1.w*aR1.h, aR2.w*aR2.h);
        const maxB=Math.max(bR1.w*bR1.h, bR2.w*bR2.h);
        if(maxA>=maxB){ r1=aR1; r2=aR2; } else { r1=bR1; r2=bR2; }
      }
      if(r1.w>0.05&&r1.h>0.05) s.free.push(r1);
      if(r2.w>0.05&&r2.h>0.05) s.free.push(r2);
      return true;
    }

    for(const it of items){
      let done=false;
      for(const s of sheets){ if(tryPlace(s,it)){done=true;break;} }
      if(!done){
        const s={free:[{x:0,y:0,w:L,h:W}],placed:[],cuts:0};
        if(tryPlace(s,it)){ sheets.push(s); done=true; }
      }
      if(!done) unplaced.push(it);
    }

    const matSheets=sheets.map(s=>({
      cuts:s.cuts,
      pieces:s.placed.map(p=>({
        id:nid(), x:p.x, y:p.y, l:p.l, w:p.w, rot:p.rot,
        name:p.src.name, bandId:p.src.bandId, edges:{...p.src.edges},
        origL:p.origL, origW:p.origW
      }))
    }));

    layout.push({
      materialId:at.id, materialName:at.name,
      L, W, sheetPrice:+at.price||0,
      sheets:matSheets
    });

    totalPlaced+=items.length-unplaced.length;
    totalUnplaced+=unplaced.length;
    totalSheetsNeeded+=sheets.length;
    if(sheets.length>qty) toast('\u26a0\ufe0f خامة "'+at.name+'": تحتاج '+sheets.length+' لوحاً وهو أكثر من المتاح ('+qty+')');
  });

  if(!layout.length){ toast('أضف قطعاً بأبعاد صحيحة واختر خامة نشطة أولاً'); return; }
  if(totalUnplaced) toast('\u26a0\ufe0f '+totalUnplaced+' قطعة أكبر من اللوح ولم تُوضع');
  else toast('\u2713 تم: '+totalSheetsNeeded+' لوح، '+totalPlaced+' قطعة');

  renderResults();
  saveState();
}

/* ---------------- حساب الإحصائيات ---------------- */
function pieceBanding(p){
  let cm=0;
  if(p.edges.t) cm+=p.origL; if(p.edges.b) cm+=p.origL;
  if(p.edges.l) cm+=p.origW; if(p.edges.r) cm+=p.origW;
  const m=cm/100; return { m, cost:m*bandById(p.bandId).price };
}
function recomputeCuts(sheet, L, W){
  const xs=new Set(), ys=new Set();
  sheet.pieces.forEach(p=>{
    const x1=Math.round(p.x*10)/10, x2=Math.round((p.x+p.l)*10)/10;
    const y1=Math.round(p.y*10)/10, y2=Math.round((p.y+p.w)*10)/10;
    if(x1>0.1) xs.add(x1); if(x2<L-0.1) xs.add(x2);
    if(y1>0.1) ys.add(y1); if(y2<W-0.1) ys.add(y2);
  });
  return xs.size + ys.size;
}
function sheetStats(sheet, L, W){
  if(!L||!W) return {used:0,area:0,util:0,waste:100,meters:0,cost:0,count:0,cuts:0};
  const area=L*W;
  let used=0,m=0,cost=0;
  sheet.pieces.forEach(p=>{ used+=p.l*p.w; const b=pieceBanding(p); m+=b.m; cost+=b.cost; });
  return { used, area, util:used/area*100, waste:(1-used/area)*100, meters:m, cost, count:sheet.pieces.length, cuts:recomputeCuts(sheet,L,W) };
}
function sheetCutLength(sheet, L, W){
  const xs=new Set(), ys=new Set();
  sheet.pieces.forEach(p=>{
    const x2=Math.round((p.x+p.l)*10)/10, y2=Math.round((p.y+p.w)*10)/10;
    if(x2<L-0.1) xs.add(x2);
    if(y2<W-0.1) ys.add(y2);
  });
  return xs.size*W + ys.size*L;
}
function totals(){
  let used=0,m=0,cost=0,cuts=0,count=0,cutLen=0; const byType={};
  let totalSheets=0, totalArea=0;
  const perMaterial=[];
  (layout||[]).forEach(mg=>{
    let mUsed=0,mCuts=0,mCount=0,mCutLen=0,mMeters=0,mCost=0;
    (mg.sheets||[]).forEach(sh=>{
      sh.pieces.forEach(p=>{
        used+=p.l*p.w; mUsed+=p.l*p.w;
        const b=pieceBanding(p); m+=b.m; cost+=b.cost; mMeters+=b.m; mCost+=b.cost;
        const t=bandById(p.bandId).name; byType[t]=byType[t]||{m:0,cost:0}; byType[t].m+=b.m; byType[t].cost+=b.cost;
      });
      mCuts+=recomputeCuts(sh,mg.L,mg.W); mCount+=sh.pieces.length; mCutLen+=sheetCutLength(sh,mg.L,mg.W);
    });
    totalSheets+=mg.sheets.length; totalArea+=mg.sheets.length*mg.L*mg.W;
    cuts+=mCuts; count+=mCount; cutLen+=mCutLen;
    perMaterial.push({materialId:mg.materialId,materialName:mg.materialName,L:mg.L,W:mg.W,sheetPrice:mg.sheetPrice,
      sheets:mg.sheets.length,used:mUsed,area:mg.sheets.length*mg.L*mg.W,cuts:mCuts,count:mCount,cutLen:mCutLen,meters:mMeters,cost:mCost});
  });
  const area=totalArea;
  return {sheets:totalSheets,area,used,util:area?used/area*100:0,waste:area?(1-used/area)*100:0,
          meters:m,cost,cuts,count,cutLen,byType,perMaterial};
}

/* ---------------- رسم النتائج ---------------- */
const fmtNum=n=>Number.isInteger(n)?n:Math.round(n*10)/10;

function recomputeWaste(sheet, L, W){
  const cl=(v,a,b)=>Math.max(a,Math.min(b,v));
  const xsSet=new Set([0,L]), ysSet=new Set([0,W]);
  sheet.pieces.forEach(p=>{ xsSet.add(cl(p.x,0,L)); xsSet.add(cl(p.x+p.l,0,L)); ysSet.add(cl(p.y,0,W)); ysSet.add(cl(p.y+p.w,0,W)); });
  const xs=[...xsSet].sort((a,b)=>a-b), ys=[...ysSet].sort((a,b)=>a-b);
  const nC=xs.length-1, nR=ys.length-1;
  if(nC<1||nR<1) return [];
  const occ=[], usedC=[];
  for(let r=0;r<nR;r++){ occ[r]=[]; usedC[r]=new Array(nC).fill(false);
    for(let c=0;c<nC;c++){
      const cx=(xs[c]+xs[c+1])/2, cy=(ys[r]+ys[r+1])/2;
      occ[r][c]=sheet.pieces.some(p=>cx>=p.x&&cx<=p.x+p.l&&cy>=p.y&&cy<=p.y+p.w);
    }
  }
  const rects=[];
  for(let r=0;r<nR;r++) for(let c=0;c<nC;c++){
    if(occ[r][c]||usedC[r][c]) continue;
    let c2=c; while(c2+1<nC && !occ[r][c2+1] && !usedC[r][c2+1]) c2++;
    let r2=r, ok=true;
    while(r2+1<nR && ok){ for(let cc=c;cc<=c2;cc++){ if(occ[r2+1][cc]||usedC[r2+1][cc]){ok=false;break;} } if(ok) r2++; }
    for(let rr=r;rr<=r2;rr++) for(let cc=c;cc<=c2;cc++) usedC[rr][cc]=true;
    const x=xs[c], y=ys[r], w=xs[c2+1]-xs[c], h=ys[r2+1]-ys[r];
    if(w>2.5&&h>2.5) rects.push({x:Math.round(x*10)/10,y:Math.round(y*10)/10,w:Math.round(w*10)/10,h:Math.round(h*10)/10});
  }
  return rects;
}

function displayEdges(p){
  const e=p.edges;
  if(!p.rot) return {t:e.t,b:e.b,l:e.l,r:e.r};
  return { t:e.l, b:e.r, l:e.b, r:e.t };
}

function buildSheetCanvas(sheet, idx, colorMap, interactive, count, material, materialIdx, sheetIdx){
  count=count||1;
  const L=material.L, W=material.W, materialName=material.materialName;
  const st=sheetStats(sheet,L,W);
  const block=document.createElement('div'); block.className='sheet-block';
  block.innerHTML=`
    <div class="sheet-head">
      <h3>${count>1?`ألواح متطابقة <span class="sheet-mult">×${count}</span>`:`اللوح ${idx+1}`} <span class="dim-note">${escapeHtml(materialName)} · ${L}×${W} سم</span></h3>
      <div class="sheet-meta">
        <span>القص: <b>${cutDirLabel(settings.cutDir)}</b></span>
        <span>القطع: <b>${st.count}</b></span>
        <span>القصّات: <b>${st.cuts}</b></span>
        <span>الاستفادة: <b style="color:#16a34a">${st.util.toFixed(1)}%</b></span>
        <span>الهدر: <b style="color:#dc2626">${st.waste.toFixed(1)}%</b></span>
        <span>التلبيس: <b>${st.meters.toFixed(2)} م</b></span>
      </div>
    </div>
    <div class="stage">
      ${count>1?`<div class="mult-badge" title="عدد الألواح المتطابقة">*${count}</div>`:''}
      <div class="canvas-wrap"><div class="sheet-canvas" data-material-idx="${materialIdx}" data-sheet-idx="${sheetIdx}"></div></div>
      <div class="ruler-y"><span>${fmtNum(W)}</span></div>
      <div class="ruler-x"><span>${fmtNum(L)}</span></div>
    </div>`;
  const canvas=block.querySelector('.sheet-canvas');
  canvas.style.direction='ltr';
  canvas._sheet=sheet; canvas._L=L; canvas._W=W; canvas._materialName=materialName;
  canvas._materialIdx=materialIdx; canvas._sheetIdx=sheetIdx;
  canvas._colorMap=colorMap; canvas._interactive=interactive;
  return { block, canvas };
}

function positionPieces(canvas, scale){
  const sheet=canvas._sheet, L=canvas._L, W=canvas._W;
  canvas.style.height=(W*scale)+'px';
  canvas.innerHTML='';
  canvas.style.background = '#ffffff';
  canvas.classList.remove('cut-length','cut-width');
  canvas.classList.add(settings.cutDir==='length'?'cut-length':'cut-width');
  recomputeWaste(sheet,L,W).forEach(w=>{
    const wd=document.createElement('div'); wd.className='waste';
    wd.style.left=(w.x*scale)+'px'; wd.style.top=(w.y*scale)+'px';
    wd.style.width=(w.w*scale)+'px'; wd.style.height=(w.h*scale)+'px';
    wd.innerHTML=`<span class="wd-h">${fmtNum(w.w)}</span><span class="wd-v">${fmtNum(w.h)}</span>`;
    canvas.appendChild(wd);
  });
  const sizeCounts={};
  sheet.pieces.forEach(p=>{ const k=sizeKey(p); sizeCounts[k]=(sizeCounts[k]||0)+1; });
  sheet.pieces.forEach((p,pi)=>{
    const el=document.createElement('div'); el.className='piece';
    el.style.left=(p.x*scale)+'px'; el.style.top=(p.y*scale)+'px';
    el.style.width=(p.l*scale)+'px'; el.style.height=(p.w*scale)+'px';
    el.style.background=palette[pi % palette.length];
    el.dataset.materialIdx=canvas._materialIdx; el.dataset.sheetIdx=canvas._sheetIdx; el.dataset.pi=pi;
    const small=(p.l*scale<44||p.w*scale<26);
    const k=sizeKey(p); const dc=sizeCounts[k];
    const dupLabel=dc>1?` <b>\u00d7${dc}</b>`:'';
    el.innerHTML=`<span class="dim-h">${fmtNum(p.l)}</span>
                  <span class="dim-v">${fmtNum(p.w)}</span>
                  ${small?'':`<span class="pname">${escapeHtml(p.name)}${dupLabel}${p.rot?' \u21bb':''}</span>`}`;
    const de=displayEdges(p);
    ['t','b','l','r'].forEach(s=>{ if(de[s]){ const bd=document.createElement('span'); bd.className='band '+s; el.appendChild(bd);} });
    if(canvas._interactive){ el.addEventListener('pointerdown',startDrag); el.addEventListener('touchstart',startDrag,{passive:false}); }
    canvas.appendChild(el);
  });
  markOverlaps(canvas);
}

function markOverlaps(canvas){
  const els=[...canvas.querySelectorAll('.piece')];
  els.forEach(e=>e.classList.remove('overlap'));
  for(let i=0;i<els.length;i++)for(let j=i+1;j<els.length;j++){
    const a=els[i].getBoundingClientRect(), b=els[j].getBoundingClientRect();
    if(a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1){
      els[i].classList.add('overlap'); els[j].classList.add('overlap');
    }
  }
}

let liveCanvases=[];
function renderResults(){
  const area=$('#sheetsArea'); area.innerHTML=''; liveCanvases=[];
  $('#statsBar').innerHTML='';
  if(!layout||!layout.length){ $('#emptyState').classList.remove('hidden'); $('#dragHint').classList.add('hidden'); return; }
  $('#emptyState').classList.add('hidden'); $('#dragHint').classList.remove('hidden');

  const t=totals();
  const stat=(l,v,cls='')=>`<div class="stat ${cls}"><div class="v">${v}</div><div class="l">${l}</div></div>`;
  const m2=(cm2)=>(cm2/10000).toLocaleString('en',{maximumFractionDigits:2});
  const sheetsCost=t.perMaterial.reduce((s,m)=>s+m.sheets*(m.sheetPrice||0),0);
  const cutCost=t.sheets*(settings.cutFee||0);
  const grand=sheetsCost+cutCost+t.cost;
  let matBreakdown='';
  t.perMaterial.forEach(pm=>{ matBreakdown+=stat(pm.materialName,pm.sheets+' لوح · '+pm.L+'×'+pm.W+' سم'); });
  $('#statsBar').innerHTML =
    (settings.planName?stat('مخطط العمل',escapeHtml(settings.planName)):'')+
    stat('الألواح المستخدمة',t.sheets)+
    matBreakdown+
    stat('المساحة المستخدمة',m2(t.used)+' م\u00b2 · '+t.util.toFixed(0)+'%','good')+
    stat('المساحة المهدورة',m2(t.area-t.used)+' م\u00b2 · '+t.waste.toFixed(0)+'%','warn')+
    stat('إجمالي القصّات',t.cuts)+
    stat('طول القص (تقديري)',fmtNum(Math.round(t.cutLen))+' سم')+
    stat('حرف التلبيس',t.meters.toFixed(2)+' م')+
    stat('تكلفة الألواح','$'+sheetsCost.toFixed(2))+
    stat('أجور القص','$'+cutCost.toFixed(2))+
    stat('تكلفة التلبيس','$'+t.cost.toFixed(2))+
    stat('التكلفة الإجمالية','$'+grand.toFixed(2),'good');

  const colorMap={};
  layout.forEach((mg,mi)=>{
    const groups=groupSheets(mg.sheets, mg.materialId);
    groups.forEach(g=>{
      const {block,canvas}=buildSheetCanvas(g.sheet,g.idx,colorMap,true,g.count,mg,mi,g.idx);
      area.appendChild(block); liveCanvases.push(canvas);
    });
  });
  requestAnimationFrame(()=>liveCanvases.forEach(c=>c.isConnected&&positionPieces(c, c.clientWidth/c._L)));
}

window.addEventListener('resize',()=>{ if(layout) liveCanvases.forEach(c=>{ if(c.isConnected) positionPieces(c,c.clientWidth/c._L); }); });

/* ---------------- السحب والإفلات (press-and-hold) — Desktop + Mobile ---------------- */
const HOLD_MS=200;
const MOVE_TOL=9;
let drag=null;

function getPointerXY(e){
  if(e.touches&&e.touches.length){return{x:e.touches[0].clientX,y:e.touches[0].clientY};}
  return{x:e.clientX,y:e.clientY};
}

function startDrag(e){
  if(e.button&&e.button!==0) return;
  if(e.type==='touchstart') e.preventDefault();
  const el=e.currentTarget;
  const canvas=el.closest('.sheet-canvas');
  if(!canvas) return;
  const r=el.getBoundingClientRect();
  const mi=+canvas.dataset.materialIdx, si=+canvas.dataset.sheetIdx, pi=+el.dataset.pi;
  const pt=getPointerXY(e);
  drag={el,canvas,fromMaterialIdx:mi,fromSheetIdx:si,fromPieceIdx:pi,
    piece:layout[mi].sheets[si].pieces[pi],
    offX:pt.x-r.left,offY:pt.y-r.top,w:r.width,h:r.height,
    startX:pt.x,startY:pt.y,lastX:pt.x,lastY:pt.y,
    lifted:false};
  el.classList.add('armed');
  drag.timer=setTimeout(lift,HOLD_MS);
  document.addEventListener('pointermove',onDrag,{passive:false});
  document.addEventListener('pointerup',endDrag);
  document.addEventListener('pointercancel',cancelDrag);
  document.addEventListener('touchmove',onDragTouch,{passive:false});
  document.addEventListener('touchend',endDragTouch);
  document.addEventListener('touchcancel',cancelDragTouch);
}

function lift(){
  if(!drag) return;
  drag.lifted=true;
  const el=drag.el;
  el.classList.remove('armed');el.classList.add('lifting');
  if(navigator.vibrate)try{navigator.vibrate(25);}catch(_){}
  el.style.position='fixed';el.style.margin='0';
  el.style.width=drag.w+'px';el.style.height=drag.h+'px';
  moveFixed(drag.lastX,drag.lastY);
  highlightTarget(drag.lastX,drag.lastY);
}

function moveFixed(x,y){drag.el.style.left=(x-drag.offX)+'px';drag.el.style.top=(y-drag.offY)+'px';}

function highlightTarget(x,y){
  drag.el.style.pointerEvents='none';
  const t=document.elementFromPoint(x,y);
  drag.el.style.pointerEvents='';
  const tc=t?(t.closest('.sheet-canvas')||(t.closest('.sheet-block')?t.closest('.sheet-block').querySelector('.sheet-canvas'):null)):null;
  liveCanvases.forEach(c=>c.classList.toggle('drop-target',c===tc));
}

function onDrag(e){
  if(!drag) return;
  drag.lastX=e.clientX;drag.lastY=e.clientY;
  if(!drag.lifted){
    if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>MOVE_TOL) cancelDrag();
    return;
  }
  e.preventDefault();
  moveFixed(e.clientX,e.clientY);
  highlightTarget(e.clientX,e.clientY);
}

function onDragTouch(e){
  if(!drag) return;
  e.preventDefault();
  const pt=getPointerXY(e);
  drag.lastX=pt.x;drag.lastY=pt.y;
  if(!drag.lifted){
    if(Math.hypot(pt.x-drag.startX,pt.y-drag.startY)>MOVE_TOL) cancelDrag();
    return;
  }
  moveFixed(pt.x,pt.y);
  highlightTarget(pt.x,pt.y);
}

function cancelDrag(){
  if(!drag) return;
  clearTimeout(drag.timer);
  drag.el.classList.remove('armed','lifting');
  drag.el.style.position='';drag.el.style.left='';drag.el.style.top='';drag.el.style.pointerEvents='';drag.el.style.width='';drag.el.style.height='';
  document.removeEventListener('pointermove',onDrag);
  document.removeEventListener('pointerup',endDrag);
  document.removeEventListener('pointercancel',cancelDrag);
  document.removeEventListener('touchmove',onDragTouch);
  document.removeEventListener('touchend',endDragTouch);
  document.removeEventListener('touchcancel',cancelDragTouch);
  liveCanvases.forEach(c=>c.classList.remove('drop-target'));
  drag=null;
}

function overlapsAny(mi,si,piece,x,y,exceptIdx){
  const ps=layout[mi].sheets[si].pieces;
  for(let i=0;i<ps.length;i++){
    if(i===exceptIdx) continue;
    const o=ps[i];
    if(x<o.x+o.l&&x+piece.l>o.x&&y<o.y+o.w&&y+piece.w>o.y) return true;
  }
  return false;
}

function findFreeSpot(mi,si,piece,wx,wy,exceptIdx){
  if(!overlapsAny(mi,si,piece,wx,wy,exceptIdx)) return {x:wx,y:wy};
  const L=layout[mi].L,W=layout[mi].W;
  const step=2,maxX=L-piece.l,maxY=W-piece.w;
  let best=null,bestD=Infinity;
  for(let gy=0;gy<=maxY+0.001;gy+=step){
    for(let gx=0;gx<=maxX+0.001;gx+=step){
      if(!overlapsAny(mi,si,piece,gx,gy,exceptIdx)){
        const d=(gx-wx)*(gx-wx)+(gy-wy)*(gy-wy);
        if(d<bestD){bestD=d;best={x:gx,y:gy};}
      }
    }
  }
  return best;
}

function magnetSnap(mi,si,piece,nx,ny,exceptIdx){
  const ps=layout[mi].sheets[si].pieces,kerf=settings.kerf||0;
  const L=layout[mi].L,W=layout[mi].W;
  const maxX=L-piece.l,maxY=W-piece.w;
  const candidates=[];
  const add=(x,y)=>{x=Math.max(0,Math.min(x,maxX));y=Math.max(0,Math.min(y,maxY));candidates.push({x,y});};
  add(0,0);add(maxX,0);add(0,maxY);add(maxX,maxY);
  ps.forEach((o,i)=>{if(i===exceptIdx) return;
    const right=o.x+o.l+kerf,left=o.x-piece.l-kerf;
    const below=o.y+o.w+kerf,above=o.y-piece.w-kerf;
    const yTop=o.y,yBot=o.y+o.w-piece.w;
    const xLeft=o.x,xRight=o.x+o.l-piece.l;
    add(right,yTop);add(right,yBot);
    add(left,yTop);add(left,yBot);
    add(xLeft,below);add(xRight,below);
    add(xLeft,above);add(xRight,above);
  });
  let best=null,bd=Infinity;
  for(const c of candidates){
    if(c.x<-0.01||c.x>maxX+0.01||c.y<-0.01||c.y>maxY+0.01) continue;
    if(overlapsAny(mi,si,piece,c.x,c.y,exceptIdx)) continue;
    const d=(c.x-nx)*(c.x-nx)+(c.y-ny)*(c.y-ny);
    if(d<bd){bd=d;best=c;}
  }
  return best;
}

function _dropPiece(){
  const el=drag.el,piece=drag.piece;
  el.style.pointerEvents='none';
  const target=document.elementFromPoint(drag.lastX,drag.lastY);
  el.style.pointerEvents='';
  const tCanvas=target?(target.closest('.sheet-canvas')||(target.closest('.sheet-block')?target.closest('.sheet-block').querySelector('.sheet-canvas'):null)):null;

  if(tCanvas){
    const toMi=+tCanvas.dataset.materialIdx,toSi=+tCanvas.dataset.sheetIdx;
    if(toMi!==drag.fromMaterialIdx){
      toast('⚠️ لا يمكن نقل القطعة إلى خامة مختلفة');
    } else {
      const matL=layout[toMi].L,matW=layout[toMi].W;
      if(piece.l>matL+0.01||piece.w>matW+0.01){
        toast('⚠️ القطعة أكبر من اللوح — رُفض الإفلات');
      } else {
        const cr=tCanvas.getBoundingClientRect();
        const scale=tCanvas.clientWidth/matL;
        let nx=(drag.lastX-cr.left-drag.offX)/scale;
        let ny=(drag.lastY-cr.top-drag.offY)/scale;
        nx=Math.max(0,Math.min(nx,matL-piece.l));
        ny=Math.max(0,Math.min(ny,matW-piece.w));
        const except=(toMi===drag.fromMaterialIdx&&toSi===drag.fromSheetIdx)?drag.fromPieceIdx:-1;
        let pos=magnetSnap(toMi,toSi,piece,nx,ny,except);
        if(!pos) pos=findFreeSpot(toMi,toSi,piece,nx,ny,except);
        if(!pos){
          toast('⚠️ لا يوجد مكان كافٍ في هذا اللوح');
        } else {
          piece.x=Math.round(pos.x*10)/10;piece.y=Math.round(pos.y*10)/10;
          if(toSi!==drag.fromSheetIdx){
            layout[drag.fromMaterialIdx].sheets[drag.fromSheetIdx].pieces.splice(drag.fromPieceIdx,1);
            layout[toMi].sheets[toSi].pieces.push(piece);
            layout[drag.fromMaterialIdx].sheets=layout[drag.fromMaterialIdx].sheets.filter(s=>s.pieces.length>0);
            layout=layout.filter(mg=>mg.sheets.length>0);
          }
        }
      }
    }
  }
}

function endDrag(e){
  if(!drag) return;
  clearTimeout(drag.timer);
  document.removeEventListener('pointermove',onDrag);
  document.removeEventListener('pointerup',endDrag);
  document.removeEventListener('pointercancel',cancelDrag);
  document.removeEventListener('touchmove',onDragTouch);
  document.removeEventListener('touchend',endDragTouch);
  document.removeEventListener('touchcancel',cancelDragTouch);
  liveCanvases.forEach(c=>c.classList.remove('drop-target'));

  if(!drag.lifted){drag.el.classList.remove('armed');drag=null;return;}

  _dropPiece();
  drag.el.classList.remove('lifting');drag.el.style.position='';drag.el.style.left='';drag.el.style.top='';drag.el.style.pointerEvents='';drag.el.style.width='';drag.el.style.height='';
  drag=null;
  refreshLive();
}

function endDragTouch(e){
  if(!drag) return;
  if(e.touches&&e.touches.length) return;
  const ct=e.changedTouches?e.changedTouches[0]:null;
  if(ct){drag.lastX=ct.clientX;drag.lastY=ct.clientY;}
  endDrag(e);
}

function cancelDragTouch(){ cancelDrag(); }

function refreshLive(){
  const scrollY=window.scrollY;
  renderResults();
  window.scrollTo(0,scrollY);
}

function resetProject(){
  if(!confirm('بدء مشروع جديد سيحذف كل البيانات الحالية (الاسم، الخامات، القطع، الإعدادات والمخطط). هل تريد المتابعة؟')) return;
  try{ localStorage.removeItem(LS_KEY); }catch(_){}
  pieces=Array.from({length:10},()=>emptyPiece());
  sheetTypes=[{id:'s1',name:'',l:null,w:null,qty:null,price:null,grain:false}];
  bandTypes=[{id:'b1',name:'PVC',price:0.50},{id:'b0',name:'بدون تلبيس',price:0.00}];
  activeSheetIds=['s1'];
  layout=null; settings=null;
  projectImage=null;
  const pn=$('#planName'); if(pn) pn.value='';
  const kf=$('#kerf'); if(kf) kf.value='';
  const cf=$('#cutFee'); if(cf) cf.value='';
  const cd=$('#cutDir'); if(cd) cd.value='length';
  showExtra=false; applyExtraToggleUI();
  renderSheetTable(); renderPieceTable(); renderResults(); renderImageInput();
  window.scrollTo(0,0);
  toast('✓ تم بدء مشروع جديد');
}

/* ---------------- ربط الأحداث ---------------- */
$('#addBand').addEventListener('click',()=>{ bandTypes.push({id:nid(),name:'نوع جديد',price:0.5}); renderBandTable(); renderPieceTable(); });
$('#addPiece').addEventListener('mousedown',e=>e.preventDefault());
$('#addPiece').addEventListener('click',()=>{
  pieces.push(emptyPiece());
  renderPieceTable();
  const lastP=pieces[pieces.length-1];
  const inp=document.querySelector('#pieceTable tbody input[data-id="'+lastP.id+'"][data-f="l"]');
  if(inp) inp.focus();
});
const btnAdd10=$('#addPiece10');
if(btnAdd10){
  btnAdd10.addEventListener('mousedown',e=>e.preventDefault());
  btnAdd10.addEventListener('click',()=>{
    let firstId=null;
    for(let i=0;i<10;i++){ const p=emptyPiece(); if(!firstId) firstId=p.id; pieces.push(p); }
    renderPieceTable();
    const inp=document.querySelector('#pieceTable tbody input[data-id="'+firstId+'"][data-f="l"]');
    if(inp) inp.focus();
    toast('✓ تمت إضافة ١٠ صفوف');
  });
}
const btnExtra=$('#toggleExtra');
if(btnExtra){
  btnExtra.addEventListener('click',()=>{
    showExtra=!showExtra;
    applyExtraToggleUI();
    renderPieceTable();
  });
}
applyExtraToggleUI();

$('#btnNew').addEventListener('click',resetProject);
$('#btnOptimize').addEventListener('click',function(){ if(!gateAccess('cutting')) return; optimize(); });
$('#addSheet').addEventListener('click',()=>{ sheetTypes.push({id:nid(),name:'خامة',l:null,w:null,qty:null,price:null,grain:false}); renderSheetTable(); renderPieceTable(); });
$('#cutDir').addEventListener('change',()=>{ if(layout) optimize(); });

/* ---------------- تهيئة التطبيق ---------------- */
const _saved=loadState();
if(!pieces.length){ for(let i=0;i<10;i++) pieces.push(emptyPiece()); }
if(_saved){
  const setV=(id,v)=>{ const el=$('#'+id); if(el!=null&&v!=null&&v!=='') el.value=v; };
  setV('planName',_saved.planName); setV('kerf',_saved.kerf); setV('cutFee',_saved.cutFee);
  if(_saved.cutDir){ const cd=$('#cutDir'); if(cd) cd.value=_saved.cutDir; }
}
applyExtraToggleUI();

renderSheetTable();
renderBandTable();
renderPieceTable();
renderImageInput();
if(layout&&layout.length) renderResults();

/* ---------------- حفظ تلقائي ---------------- */
document.addEventListener('input', scheduleSave);
document.addEventListener('change', scheduleSave);

/* ---------------- التحكم بالصلاحيات ---------------- */
function showSubscriptionWall(serviceName){
  const svc=SERVICES[serviceName]||{name:serviceName,icon:''};
  const info=getAccessInfo(appUserProfile);
  const wa=WHATSAPP_LINK||'#';
  let html='<div class="auth-card" style="max-width:380px;margin:40px auto;padding:24px;text-align:center">';
  html+='<div style="font-size:48px;margin-bottom:8px">'+svc.icon+'</div>';
  html+='<h3 style="margin:0 0 8px;color:#b5803c">'+svc.name+'</h3>';
  if(info.status==='expired'){
    html+='<p style="color:#dc2626;font-weight:700;margin-bottom:12px">انتهت الفترة التجريبية</p>';
    html+='<p style="font-size:13px;color:#64748b;margin-bottom:16px">للاستمرار في استخدام هذا الخدمة، يرجى التواصل معنا لتفعيل الاشتراك</p>';
  } else {
    html+='<p style="color:#f59e0b;font-weight:700;margin-bottom:12px">'+info.label+'</p>';
    html+='<p style="font-size:13px;color:#64748b;margin-bottom:16px">هذه الخدمة تتطلب اشتراكاً نشطاً</p>';
  }
  html+='<a href="'+wa+'" target="_blank" class="btn" style="display:inline-block;padding:10px 24px;background:#25d366;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">تواصل عبر واتساب</a>';
  html+='<br><button class="btn btn-sm" style="margin-top:12px" onclick="this.closest(\'.auth-card\').parentElement.remove()">إغلاق</button>';
  html+='</div>';
  const overlay=document.createElement('div');
  overlay.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  overlay.innerHTML=html;
  overlay.addEventListener('click',function(e){ if(e.target===overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

function gateAccess(serviceName){
  if(!appUserProfile) return true;
  if(canAccess(serviceName)) return true;
  showSubscriptionWall(serviceName);
  return false;
}

window.addEventListener('auth:login',function(e){
  appUserProfile=e.detail.profile;
  const info=getAccessInfo(appUserProfile);
  const badge=document.getElementById('userBadgeStatus');
  if(badge){
    badge.textContent=info.label;
    badge.style.color=info.color;
    badge.style.background=info.color+'18';
  }
  if(!canAccess('cutting')){
    showSubscriptionWall('cutting');
  }
});

window.addEventListener('auth:logout',function(){
  appUserProfile=null;
});
