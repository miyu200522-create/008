const DB='iroha-local-v1';let db,photos=[],tags=[],editingTagId=null,design={theme:'dark',color:'#0b0b0b',image:'',opacity:25,style:'simple',cellColor:'#ffffff',cellOpacity:12},month=new Date(new Date().getFullYear(),new Date().getMonth(),1),currentDay='',currentIndex=0,currentPhoto=null,activeTag=null,selectedDay=new Date().toISOString().slice(0,10);
const $=id=>document.getElementById(id),uid=()=>crypto.randomUUID();
function openDB(){return new Promise((res,rej)=>{let r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{let d=r.result;d.createObjectStore('photos',{keyPath:'id'});d.createObjectStore('tags',{keyPath:'id'});};r.onsuccess=()=>{db=r.result;res()};r.onerror=()=>rej(r.error)})}
function store(n,mode='readonly'){return db.transaction(n,mode).objectStore(n)}
function all(n){return new Promise((res,rej)=>{let r=store(n).getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function put(n,v){return new Promise((res,rej)=>{let r=store(n,'readwrite').put(v);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
function del(n,id){return new Promise((res,rej)=>{let r=store(n,'readwrite').delete(id);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
async function refresh(){photos=await all('photos');tags=await all('tags');renderCalendar()}
function orderedPhotos(list){return [...list].sort((a,b)=>{const ao=Number.isFinite(a.order)?a.order:null,bo=Number.isFinite(b.order)?b.order:null;if(ao!==null&&bo!==null)return ao-bo;if(ao!==null)return -1;if(bo!==null)return 1;return b.date.localeCompare(a.date)});}
function renderCalendar(){
 $('month').textContent=month.toLocaleDateString('ja-JP',{year:'numeric',month:'long'});
 let first=new Date(month.getFullYear(),month.getMonth(),1).getDay(),n=new Date(month.getFullYear(),month.getMonth()+1,0).getDate(),html='';
 let monthPhotos=photos.filter(p=>{let d=new Date(p.date);return d.getFullYear()===month.getFullYear()&&d.getMonth()===month.getMonth()});
 $('recordSummary').textContent=monthPhotos.length+'枚の記録・'+n+'日';
 for(let i=0;i<first;i++)html+='<div class="day empty"></div>';
 for(let d=1;d<=n;d++){
  let date=new Date(month.getFullYear(),month.getMonth(),d),s=[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(d).padStart(2,'0')].join('-'),arr=photos.filter(p=>p.date.slice(0,10)===s);
  arr=orderedPhotos(arr);
  if(activeTag)arr=arr.filter(p=>(p.tags||[]).includes(activeTag));
  html+=`<button class="day ${selectedDay===s?'selected':''}" data-day="${s}" aria-label="${s}">${arr[0]?`<img src="${arr[0].data}" alt="">`:''}</button>`;
 }
 $('calendar').innerHTML=html;
 $('calendar').querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>{selectedDay=b.dataset.day;const hasPhoto=photos.some(p=>p.date.slice(0,10)===selectedDay&&(!activeTag||(p.tags||[]).includes(activeTag)));renderCalendar();if(hasPhoto)openDay(selectedDay)});
 const sd=new Date(selectedDay+'T12:00:00'),arr=orderedPhotos(photos.filter(p=>p.date.slice(0,10)===selectedDay));
 $('selectedDateTitle').textContent=sd.toLocaleDateString('ja-JP',{month:'long',day:'numeric',weekday:'short'});
 $('selectedDateCount').textContent=arr.length+'件の記録';
 $('selectedPhotos').innerHTML=arr.length?`<button class="selectedCover" id="selectedCover" aria-label="${selectedDay}のアルバムを開く"><img src="${arr[0].data}" alt=""></button>`:'';if($('selectedCover'))$('selectedCover').onclick=()=>openDay(selectedDay);
}
function show(v){['calendarView','dayView','editDayView','settingsView','tagView','tagPhotosView'].forEach(x=>$(x).hidden=x!==v)}
function dayPhotos(){return orderedPhotos(photos.filter(p=>p.date.slice(0,10)===currentDay))}
function openDay(day){currentDay=day;currentIndex=0;if(!dayPhotos().length){pendingDefaultDate=day;$('photos').click();return}show('dayView');$('dayTitle').textContent=day;renderReader() }
function openEditDay(day){currentDay=day;show('editDayView');$('editDayTitle').textContent=day+' の編集';renderEditDay()}
function renderEditDay(){const a=dayPhotos();$('editDayList').innerHTML=a.map((p,i)=>`<div class="editPhotoRow"><img src="${p.data}" alt=""><div class="editPhotoText"><strong>${i+1}枚目・表紙順</strong>${escapeHTML(new Date(p.date).toLocaleString('ja-JP'))}<br>${escapeHTML(p.memo||'メモなし')}</div><div class="photoOrderControls"><button type="button" data-up="${p.id}" ${i===0?'disabled':''}>↑</button><button type="button" data-down="${p.id}" ${i===a.length-1?'disabled':''}>↓</button><button data-edit-photo="${p.id}">編集</button></div></div>`).join('')||'<p class="muted">この日の写真はまだありません。</p>';$('editDayList').querySelectorAll('[data-edit-photo]').forEach(b=>b.onclick=()=>{currentPhoto=photos.find(p=>p.id===b.dataset.editPhoto);if(currentPhoto)editCurrent()});$('editDayList').querySelectorAll('[data-up],[data-down]').forEach(b=>b.onclick=()=>movePhoto(b.dataset.up||b.dataset.down,b.hasAttribute('data-up')?-1:1))}
async function movePhoto(id,delta){const a=dayPhotos(),i=a.findIndex(p=>p.id===id),j=i+delta;if(i<0||j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];for(let n=0;n<a.length;n++){a[n].order=n;await put('photos',a[n])}await refresh();renderEditDay()}
function renderReader(){openGallery(currentDay)}
function openGallery(day){
 currentDay=day;const a=dayPhotos();if(!a.length)return;
 $('galleryDate').textContent=new Date(day+'T12:00:00').toLocaleDateString('ja-JP',{year:'numeric',month:'long',day:'numeric',weekday:'short'});
 $('galleryTrack').innerHTML=a.map((p,i)=>`<div class="gallerySlide" data-index="${i}"><img src="${p.data}" alt="${i+1}枚目"><div class="galleryInfo">${escapeHTML(new Date(p.date).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'}))}</div></div>`).join('');
 const dialog=$('zoomDialog'),track=$('galleryTrack');
 if(!dialog.open)dialog.showModal();
 // iOS SafariではshowModal直後のscrollIntoViewが効かないことがあるため、
 // トラック自身のscrollLeftをレイアウト確定後に設定する。
 requestAnimationFrame(()=>{track.scrollLeft=Math.max(0,currentIndex)*track.clientWidth;});
}
$('closeZoom').onclick=()=>$('zoomDialog').close();$('zoomDialog').addEventListener('close',()=>{show('calendarView');renderCalendar()});
$('zoomDialog').addEventListener('click',e=>{if(e.target===$('zoomDialog'))$('zoomDialog').close()});
function renderTagChoices(container,selected=[]){
 $(container).innerHTML=tags.map(t=>`<label class="tagChoice" style="--tag-color:${t.color||'#9b86c8'}"><input type="checkbox" value="${t.id}" ${selected.includes(t.id)?'checked':''}><span>${escapeHTML(t.name)}</span></label>`).join('')||'<span class="muted">タグはまだありません。設定から登録できます。</span>';
 $(container).querySelectorAll('input').forEach(input=>{const sync=()=>input.closest('label').classList.toggle('isSelected',input.checked);sync();input.addEventListener('change',sync)});
}
function editCurrent(){let p=currentPhoto;$('editDate').value=new Date(p.date).toISOString().slice(0,16);$('editMemo').value=p.memo||'';renderTagChoices('editTags',p.tags||[]);$('editDialog').showModal();$('editTitle').focus({preventScroll:true})}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
$('editForm').onsubmit=async e=>{e.preventDefault();let v=e.submitter?.value;if(v==='delete'){if(confirm('この写真を削除しますか？')){await del('photos',currentPhoto.id);await refresh();$('editDialog').close();if(!$('editDayView').hidden)renderEditDay();else renderReader()}return}if(v==='save'){currentPhoto.date=new Date($('editDate').value).toISOString();currentPhoto.memo=$('editMemo').value;currentPhoto.tags=[...$('editTags').querySelectorAll('input:checked')].map(x=>x.value);await put('photos',currentPhoto);await refresh();$('editDialog').close();if(!$('editDayView').hidden)renderEditDay();else renderReader()}};
function dayPhotosForKey(day){return orderedPhotos(photos.filter(p=>p.date.slice(0,10)===day));}
let pendingFiles=[],pendingDefaultDate='';
function localDateTimeValue(date){let d=new Date(date.getTime()-date.getTimezoneOffset()*60000);return d.toISOString().slice(0,16)}
function guessImageType(file){
 if(file.type&&file.type.startsWith('image/'))return file.type;
 let ext=(file.name.split('.').pop()||'').toLowerCase();
 return ({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',gif:'image/gif',webp:'image/webp',heic:'image/heic',heif:'image/heif',avif:'image/avif',bmp:'image/bmp'})[ext]||'';
}
function normalizeDataUrl(data,type){
 if(typeof data!=='string'||!data.startsWith('data:'))throw new Error('画像ファイルを読み込めませんでした');
 const comma=data.indexOf(','); if(comma<0)throw new Error('画像データが不正です');
 const header=data.slice(0,comma);
 if(!header.includes(';base64'))throw new Error('画像データの形式に対応していません');
 const mime=(header.match(/^data:([^;]*)/)||[])[1]||'';
 if(!mime.startsWith('image/')){
   if(!type.startsWith('image/'))throw new Error('画像形式を判別できません');
   data='data:'+type+';base64'+data.slice(comma);
 }
 return data;
}
function readFile(file){return new Promise((res,rej)=>{let r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error||new Error('読み込み失敗'));r.readAsDataURL(file)})}
function loadImage(data){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('この画像形式は表示できません。JPEG/PNGに変換してください'));img.src=data;});}
function canvasBlob(canvas,quality){return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('画像の圧縮に失敗しました')),'image/jpeg',quality));}
async function preparePhoto(file,type){
 const source=normalizeDataUrl(await readFile(file),type);
 const img=await loadImage(source);
 const maxSide=1920,scale=Math.min(1,maxSide/Math.max(img.naturalWidth,img.naturalHeight));
 const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
 const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw new Error('画像処理を開始できません');
 ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
 let blob=await canvasBlob(canvas,.82);
 if(blob.size>1400*1024)blob=await canvasBlob(canvas,.70);
 if(blob.size>1900*1024){const scale2=Math.sqrt((1900*1024)/blob.size)*.92;const c=document.createElement('canvas');c.width=Math.max(1,Math.round(canvas.width*scale2));c.height=Math.max(1,Math.round(canvas.height*scale2));const cctx=c.getContext('2d',{alpha:false});cctx.fillStyle='#fff';cctx.fillRect(0,0,c.width,c.height);cctx.drawImage(canvas,0,0,c.width,c.height);blob=await canvasBlob(c,.68);}
 const data=await readFile(blob);canvas.width=canvas.height=1;return data;
}
let addCalendarMonth=new Date();
function setAddDate(date){const d=new Date(date);const value=localDateTimeValue(d);$('addDate').value=value;$('addDateLabel').textContent=d.toLocaleDateString('ja-JP',{year:'numeric',month:'numeric',day:'numeric',weekday:'short'});}
function renderAddCalendar(){
 const y=addCalendarMonth.getFullYear(),m=addCalendarMonth.getMonth(),first=new Date(y,m,1).getDay(),last=new Date(y,m+1,0).getDate();
 $('addMonth').textContent=`${y}年${m+1}月`;let html='';for(let i=0;i<first;i++)html+='<span class="addDay blank"></span>';
 const current=$('addDate').value?new Date($('addDate').value):new Date();const key=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
 for(let day=1;day<=last;day++){const d=new Date(y,m,day),active=key(d)===key(current);html+=`<button type="button" class="addDay ${active?'selected':''}" data-add-day="${key(d)}">${day}</button>`;}
 $('addCalendar').innerHTML=html;$('addCalendar').querySelectorAll('[data-add-day]').forEach(b=>b.onclick=()=>{const [yy,mm,dd]=b.dataset.addDay.split('-').map(Number),old=$('addDate').value?new Date($('addDate').value):new Date();const d=new Date(yy,mm-1,dd,old.getHours(),old.getMinutes());setAddDate(d);renderAddCalendar()});
}
function updateAddCount(){const n=pendingFiles.length;$('addCount').textContent=`${n}枚選択中 / 20枚`;const preview=$('addPreview');preview.innerHTML='';pendingFiles.forEach((f,i)=>{const url=URL.createObjectURL(f),item=document.createElement('div');item.className='previewThumb';const img=document.createElement('img');img.src=url;img.alt='選択した写真';img.onload=()=>URL.revokeObjectURL(url);const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','写真を削除');remove.onclick=()=>{pendingFiles.splice(i,1);updateAddCount()};item.append(img,remove);preview.append(item)});}
function openAddDialog(files,defaultDate){
 pendingFiles=[...files];pendingDefaultDate=defaultDate||'';const d=pendingDefaultDate?new Date(pendingDefaultDate+'T12:00:00'):new Date();setAddDate(d);$('addTime').value=`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;addCalendarMonth=new Date(d.getFullYear(),d.getMonth(),1);renderAddCalendar();renderTagChoices('addTags',[]);updateAddCount();$('addDialog').showModal();$('addTitle').focus({preventScroll:true});
}
$('photos').onchange=e=>{const files=[...e.target.files||[]];e.target.value='';if(!files.length)return;if($('addDialog').open){pendingFiles.push(...files);updateAddCount()}else openAddDialog(files,pendingDefaultDate)};
$('addMorePhotos').onclick=()=>{$('photos').click()};
$('addPrevMonth').onclick=()=>{addCalendarMonth.setMonth(addCalendarMonth.getMonth()-1);renderAddCalendar()};$('addNextMonth').onclick=()=>{addCalendarMonth.setMonth(addCalendarMonth.getMonth()+1);renderAddCalendar()};
$('addTime').onchange=()=>{if(!$('addDate').value)return;const d=new Date($('addDate').value),[h,m]=$('addTime').value.split(':').map(Number);d.setHours(h||0,m||0,0,0);setAddDate(d)};
$('closeAdd').onclick=$('cancelAdd').onclick=()=>{$('addDialog').close();pendingFiles=[]};
$('addForm').onsubmit=async e=>{
 e.preventDefault();if(e.submitter?.value!=='add'){$('addDialog').close();pendingFiles=[];return;}
 const chosen=$('addDate').value?new Date($('addDate').value):new Date();const [hh,mi]=$('addTime').value.split(':').map(Number);chosen.setHours(hh||0,mi||0,0,0);$('addDate').value=localDateTimeValue(chosen);
 const dateValue=$('addDate').value;if(!dateValue){alert('日付を選択してください');return;}
 if(!pendingFiles.length){alert('先に写真を選択してください');return;}
 const base=new Date(dateValue);if(Number.isNaN(base.getTime())){alert('日付を確認してください');return;}
 const selectedTags=[...$('addTags').querySelectorAll('input:checked')].map(x=>x.value);
 let added=0,failed=[];
 const dayKey=base.getFullYear()+'-'+String(base.getMonth()+1).padStart(2,'0')+'-'+String(base.getDate()).padStart(2,'0');
 const already=photos.filter(p=>p.date.slice(0,10)===dayKey).length;
 const remaining=Math.max(0,20-already);if(remaining===0){alert('この日はすでに20枚登録されています。');return;}const filesToAdd=pendingFiles.slice(0,remaining);const skipped=pendingFiles.length-filesToAdd.length;
 $('confirmAdd').disabled=true;
 try{
  for(let i=0;i<filesToAdd.length;i++){
   const f=filesToAdd[i],type=guessImageType(f);
   try{
    if(!type)throw new Error('画像形式を判別できません（JPEGまたはPNGをお試しください）');
    const data=await preparePhoto(f,type);
    const photoDate=new Date(base.getTime()+i*1000);
    const existing=dayPhotosForKey(dayKey);for(let oi=0;oi<existing.length;oi++){if(!Number.isFinite(existing[oi].order)){existing[oi].order=oi;await put('photos',existing[oi])}}await put('photos',{id:uid(),date:photoDate.toISOString(),data,memo:'',tags:selectedTags,order:existing.length+added});added++;
   }catch(err){failed.push((f.name||'写真')+'：'+(err.name==='QuotaExceededError'?'端末の保存容量が不足しています。不要な写真を削除するか、バックアップ後に整理してください。':(err.message||'追加に失敗しました')));}
  }
 }catch(err){failed.push('保存処理：'+(err.message||'保存領域に書き込めませんでした'));}
 finally{$('confirmAdd').disabled=false;$('addDialog').close();pendingFiles=[];}
 await refresh();
 if(added){const d=new Date(base);month=new Date(d.getFullYear(),d.getMonth(),1);await renderCalendar();alert(added+'枚の写真を追加しました'+(skipped?'\n上限のため'+skipped+'枚は追加していません。':'')+(failed.length?'\n追加できなかった写真：\n'+failed.join('\n'):''));}
 else alert('写真を追加できませんでした。\n'+(failed.join('\n')||'保存領域に書き込めませんでした'));
};
$('prev').onclick=()=>{month.setMonth(month.getMonth()-1);selectedDay=[month.getFullYear(),String(month.getMonth()+1).padStart(2,'0'),'01'].join('-');renderCalendar()};$('next').onclick=()=>{month.setMonth(month.getMonth()+1);selectedDay=[month.getFullYear(),String(month.getMonth()+1).padStart(2,'0'),'01'].join('-');renderCalendar()};$('todayBtn').onclick=()=>{let d=new Date();month=new Date(d.getFullYear(),d.getMonth(),1);selectedDay=d.toISOString().slice(0,10);renderCalendar()};$('openSelected').onclick=()=>openEditDay(selectedDay);$('navCalendar').onclick=()=>{show('calendarView');renderCalendar()};$('navAdd').onclick=()=>{pendingDefaultDate=selectedDay;$('photos').click()};$('navTags').onclick=()=>{show('tagView');renderTags()};$('editDayAdd').onclick=()=>{pendingDefaultDate=currentDay;$('photos').click()};$('editDayBack').onclick=()=>{show('calendarView');renderCalendar()};$('back').onclick=()=>{show('calendarView');renderCalendar()};$('settings').onclick=()=>show('settingsView');$('settingsBack').onclick=()=>show('calendarView');$('tagBack').onclick=()=>{show('calendarView');renderCalendar()};$('tagPhotosBack').onclick=()=>{show('tagView');renderTags()};
function renderTags(){$('tagList').innerHTML=tags.map(t=>`<div class="tagrow"><span class="tagChip" style="--tag-color:${t.color||'#b98b79'}">${escapeHTML(t.name)}</span><button data-open="${t.id}">写真を見る</button><button data-edit-tag="${t.id}">編集</button><button data-del="${t.id}">削除</button></div>`).join('')||'<p class="muted">タグはまだありません。</p>';$('tagList').querySelectorAll('[data-edit-tag]').forEach(b=>b.onclick=()=>{const t=tags.find(x=>x.id===b.dataset.editTag);if(!t)return;editingTagId=t.id;$('editTagName').value=t.name;$('editTagColor').value=t.color||'#b98b79';$('tagEditDialog').showModal()});$('tagList').querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openTagPhotos(b.dataset.open));$('tagList').querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{let id=b.dataset.del;if(!confirm('このタグを削除しますか？写真自体は削除されません。'))return;for(let p of photos){p.tags=(p.tags||[]).filter(x=>x!==id);await put('photos',p)}await del('tags',id);await refresh();renderTags()})}
function openTagPhotos(id){activeTag=id;let t=tags.find(x=>x.id===id);$('tagPhotosTitle').textContent=t?t.name+' の写真':'タグの写真';let arr=photos.filter(p=>(p.tags||[]).includes(id)).sort((a,b)=>b.date.localeCompare(a.date));$('tagPhotoGrid').innerHTML=arr.map(p=>`<button class="tagPhotoTile" data-photo="${p.id}"><img src="${p.data}" alt=""></button>`).join('');$('tagPhotoEmpty').hidden=arr.length>0;$('tagPhotoGrid').querySelectorAll('[data-photo]').forEach(b=>b.onclick=()=>{let p=photos.find(x=>x.id===b.dataset.photo);if(!p)return;currentDay=p.date.slice(0,10);currentIndex=dayPhotos().findIndex(x=>x.id===p.id);openGallery(currentDay)});show('tagPhotosView')}
$('tagEditForm').onsubmit=async e=>{e.preventDefault();if(e.submitter?.value!=='save'){$('tagEditDialog').close();return}const t=tags.find(x=>x.id===editingTagId),name=$('editTagName').value.trim();if(!t||!name)return;if(tags.some(x=>x.id!==t.id&&x.name===name)){alert('同じ名前のタグがすでにあります');return}t.name=name;t.color=$('editTagColor').value;await put('tags',t);await refresh();renderTags();$('tagEditDialog').close()};
$('createTag').onclick=async()=>{let name=$('newTag').value.trim();if(!name)return;if(tags.some(t=>t.name===name)){alert('同じ名前のタグがすでにあります');return}await put('tags',{id:uid(),name,color:$('tagColor').value});$('newTag').value='';await refresh();renderTags()};
const DESIGN_KEY='iroha-design-v1';
function applyDesign(){document.documentElement.dataset.theme=design.theme;document.documentElement.style.setProperty('--custom-bg',design.color||'#0b0b0b');document.documentElement.style.setProperty('--bg-photo-opacity',String((design.opacity??25)/100));document.documentElement.style.setProperty('--calendar-style',design.style||'simple');document.documentElement.style.setProperty('--bg-photo',design.image?`url("${design.image}")`:'none');const hex=(design.cellColor||'#ffffff').replace('#','');const r=parseInt(hex.slice(0,2),16),g=parseInt(hex.slice(2,4),16),b=parseInt(hex.slice(4,6),16);document.documentElement.style.setProperty('--calendar-cell-color',`rgba(${r},${g},${b},${(design.cellOpacity??12)/100})`);}
function loadDesign(){try{design={...design,...JSON.parse(localStorage.getItem(DESIGN_KEY)||'{}')}}catch{}applyDesign();if($('designTheme')){$('designTheme').value=design.theme;$('designColor').value=design.color;$('designOpacity').value=design.opacity;$('designOpacityValue').textContent=design.opacity+'%';$('designStyle').value=design.style;if($('cellColor'))$('cellColor').value=design.cellColor||'#ffffff';if($('cellOpacity'))$('cellOpacity').value=design.cellOpacity??12;if($('cellOpacityValue'))$('cellOpacityValue').textContent=(design.cellOpacity??12)+'%'}}
function saveDesign(){try{localStorage.setItem(DESIGN_KEY,JSON.stringify(design));applyDesign()}catch{alert('背景画像が大きすぎて保存できません。別の画像を選んでください')}}
if($('designTheme'))$('designTheme').onchange=e=>{design.theme=e.target.value;design.color=({dark:'#0b0b0b',light:'#f2f2f2',pastel:'#e8dff0',glass:'#34424a'})[design.theme]||design.color;$('designColor').value=design.color;saveDesign()};
if($('designColor'))$('designColor').oninput=e=>{design.color=e.target.value;saveDesign()};
if($('designOpacity'))$('designOpacity').oninput=e=>{design.opacity=Number(e.target.value);$('designOpacityValue').textContent=design.opacity+'%';saveDesign()};
if($('cellColor'))$('cellColor').oninput=e=>{design.cellColor=e.target.value;saveDesign()};
if($('cellOpacity'))$('cellOpacity').oninput=e=>{design.cellOpacity=Number(e.target.value);$('cellOpacityValue').textContent=design.cellOpacity+'%';saveDesign()};
if($('designStyle'))$('designStyle').onchange=e=>{design.style=e.target.value;saveDesign()};
if($('clearDesignImage'))$('clearDesignImage').onclick=()=>{design.image='';$('designImage').value='';saveDesign()};
if($('designImage'))$('designImage').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const data=await readFile(f),img=await loadImage(data),scale=Math.min(1,1200/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext('2d').drawImage(img,0,0,c.width,c.height);design.image=c.toDataURL('image/jpeg',.62);saveDesign()}catch{alert('この画像は背景に設定できませんでした')}e.target.value=''};
loadDesign();
async function derive(pass,salt){let m=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:310000,hash:'SHA-256'},m,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
$('export').onclick=async()=>{let pass=prompt('バックアップ用パスワード（12文字以上）');if(!pass||pass.length<12){alert('12文字以上にしてください');return}let salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),k=await derive(pass,salt),raw=await crypto.subtle.encrypt({name:'AES-GCM',iv},k,new TextEncoder().encode(JSON.stringify({photos,tags}))),obj={version:1,salt:[...salt],iv:[...iv],data:[...new Uint8Array(raw)]},blob=new Blob([JSON.stringify(obj)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='iroha-backup.iroha';a.click();URL.revokeObjectURL(a.href)};
$('importBackup').onclick=()=>$('backupFile').click();$('backupFile').onchange=async e=>{try{let obj=JSON.parse(await e.target.files[0].text()),pass=prompt('バックアップのパスワード'),k=await derive(pass,new Uint8Array(obj.salt)),plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(obj.iv)},k,new Uint8Array(obj.data)),data=JSON.parse(new TextDecoder().decode(plain));if(!confirm('バックアップの写真とタグを追加しますか？'))return;for(let p of data.photos)await put('photos',p);for(let t of data.tags)await put('tags',t);await refresh();alert('復元しました')}catch{alert('復元できません。パスワードまたはファイルを確認してください')}e.target.value=''};
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));openDB().then(refresh).catch(e=>alert('保存領域を開けません: '+e.message));
