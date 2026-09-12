const $ = (s, p=document) => p.querySelector(s);
const $$ = (s, p=document) => [...p.querySelectorAll(s)];

const DB_NAME = "mading-kita-db";
const STORE = "notes";
let notes = [];
let activeFilter = "all";
let selectedColor = "cream";
let editingId = null;
let photoData = null;
let voiceData = null;
let mediaRecorder = null;
let audioChunks = [];
let recordTimer = null;
let recordSeconds = 0;
let musicUrl = null;
let dragState = null;

const board = $("#board");
const modal = $("#editorModal");

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
function today(){ return new Date().toISOString().slice(0,10); }
function esc(s=""){ const d=document.createElement("div"); d.textContent=s; return d.innerHTML; }
function formatDate(s){
  if(!s) return "";
  const d = new Date(s+"T00:00:00");
  return d.toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"});
}
function toast(msg){
  const t=$("#toast"); t.textContent=msg; t.classList.add("show");
  clearTimeout(toast.t); toast.t=setTimeout(()=>t.classList.remove("show"),2200);
}

function openDB(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,1);
    req.onupgradeneeded=()=>req.result.createObjectStore(STORE,{keyPath:"id"});
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
async function dbPut(note){
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,"readwrite"); tx.objectStore(STORE).put(note);
    tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error);
  });
}
async function dbDelete(id){
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,"readwrite"); tx.objectStore(STORE).delete(id);
    tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error);
  });
}
async function dbAll(){
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const req=db.transaction(STORE,"readonly").objectStore(STORE).getAll();
    req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);
  });
}

async function init(){
  try{ notes=await dbAll(); }catch(e){ toast("Penyimpanan browser tidak tersedia."); notes=[]; }
  const savedTheme=localStorage.getItem("mading-theme");
  if(savedTheme==="dark") document.body.classList.add("dark");
  $("#noteDate").value=today();
  loadMusic();
  render();
}
function filteredNotes(){
  const q=$("#searchInput").value.trim().toLowerCase();
  let list=notes.filter(n=>{
    if(activeFilter==="favorite" && !n.favorite) return false;
    if(activeFilter==="photo" && !n.photo) return false;
    if(activeFilter==="voice" && !n.voice) return false;
    if(activeFilter==="text" && !n.text) return false;
    return !q || [n.title,n.text].join(" ").toLowerCase().includes(q);
  });
  const sort=$("#sortSelect").value;
  if(sort==="newest") list.sort((a,b)=>new Date(b.date)-new Date(a.date));
  if(sort==="oldest") list.sort((a,b)=>new Date(a.date)-new Date(b.date));
  if(sort==="random") list.sort(()=>Math.random()-.5);
  return list;
}
function render(){
  board.innerHTML="";
  const list=filteredNotes();
  $("#noteCount").textContent=notes.length;
  $("#emptyState").classList.toggle("hidden",list.length!==0);
  if(!list.length) return;
  list.forEach((n,i)=>board.appendChild(makeNote(n,i)));
}
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function makeNote(n,i){
  const el=document.createElement("article");
  el.className=`sticky-note ${n.color||"cream"}`;
  el.dataset.id=n.id;
  const rot=n.rot ?? ((i%5)-2)*1.5;
  el.style.setProperty("--rot",`${rot}deg`);
  // Keep notes in board coordinates; older notes without positions get arranged.
  const bw=board.clientWidth||1000, bh=board.clientHeight||760;
  const left=n.x ?? 30 + ((i*191)%(Math.max(260,bw-260)));
  const top=n.y ?? 35 + ((i*143)%(Math.max(260,bh-270)));
  el.style.left=`${left}px`; el.style.top=`${top}px`;
  const title=n.title?`<h4>${esc(n.title)}</h4>`:"";
  const text=n.text?`<p>${esc(n.text)}</p>`:"";
  const photo=n.photo?`<img class="note-photo" src="${n.photo}" alt="Foto pada sticky note">`:"";
  const voice=n.voice?`<audio class="note-voice" controls src="${n.voice}"></audio>`:"";
  el.innerHTML=`
    <div class="pin"></div><div class="note-tape"></div>
    <div class="note-tools">
      <button class="mini-btn favorite-btn ${n.favorite?"is-fav":""}" title="Favorit">${n.favorite?"♥":"♡"}</button>
      <button class="mini-btn edit-btn" title="Edit">✎</button>
      <button class="mini-btn delete-btn" title="Hapus">×</button>
    </div>
    <div class="note-content">${title}${photo}${text}${voice}</div>
    <div class="note-footer"><span>${formatDate(n.date)}</span><span class="media-badges">${n.photo?"📷 ":""}${n.voice?"🎙 ":""}${n.text?"✎":""}</span></div>`;
  $(".favorite-btn",el).onclick=async e=>{e.stopPropagation(); n.favorite=!n.favorite; await dbPut(n); render();}
  $(".edit-btn",el).onclick=e=>{e.stopPropagation(); openEditor(n)}
  $(".delete-btn",el).onclick=e=>{e.stopPropagation(); deleteNote(n.id)}
  el.addEventListener("dblclick",()=>openViewer(n));
  attachDrag(el,n);
  return el;
}

function attachDrag(el,n){
  el.addEventListener("pointerdown",e=>{
    if(e.target.closest("button,audio")) return;
    el.setPointerCapture(e.pointerId);
    const r=el.getBoundingClientRect(), br=board.getBoundingClientRect();
    dragState={el,n,dx:e.clientX-r.left,dy:e.clientY-r.top,br};
    el.classList.add("dragging");
  });
  el.addEventListener("pointermove",e=>{
    if(!dragState || dragState.el!==el) return;
    const br=board.getBoundingClientRect();
    const x=clamp(e.clientX-br.left-dragState.dx,10,board.clientWidth-el.offsetWidth-10);
    const y=clamp(e.clientY-br.top-dragState.dy,10,board.clientHeight-el.offsetHeight-10);
    el.style.left=x+"px"; el.style.top=y+"px"; n.x=x; n.y=y;
  });
  el.addEventListener("pointerup",async()=>{
    if(!dragState || dragState.el!==el) return;
    el.classList.remove("dragging"); dragState=null; await dbPut(n);
  });
}

function resetEditor(){
  editingId=null; photoData=null; voiceData=null;
  $("#noteTitle").value=""; $("#noteText").value=""; $("#charCount").textContent="0"; $("#noteDate").value=today();
  $("#photoPreview").innerHTML=""; $("#photoPreview").classList.add("hidden");
  $("#recordPreview").classList.add("hidden"); $("#recordAudio").src="";
  $("#recordBtn").textContent="Mulai rekam"; $("#recordBtn").classList.remove("recording");
  selectedColor="cream"; $$(".swatch").forEach(s=>s.classList.toggle("active",s.dataset.color==="cream"));
}
function openEditor(note=null){
  resetEditor();
  editingId=note?.id||null;
  if(note){
    $("#noteTitle").value=note.title||""; $("#noteText").value=note.text||""; $("#noteDate").value=note.date||today();
    selectedColor=note.color||"cream"; $$(".swatch").forEach(s=>s.classList.toggle("active",s.dataset.color===selectedColor));
    if(note.photo){photoData=note.photo; showPhoto(photoData)}
    if(note.voice){voiceData=note.voice; $("#recordAudio").src=voiceData; $("#recordPreview").classList.remove("hidden")}
  }
  $("#charCount").textContent=$("#noteText").value.length;
  modal.classList.remove("hidden");
  setTimeout(()=>$("#noteText").focus(),80);
}
function closeEditor(){ if(mediaRecorder) stopRecording(); modal.classList.add("hidden"); resetEditor(); }

function showPhoto(src){
  $("#photoPreview").innerHTML=`<img src="${src}" alt="Pratinjau foto"><button class="text-btn danger" id="removePhoto">× Hapus foto</button>`;
  $("#photoPreview").classList.remove("hidden");
  $("#removePhoto").onclick=()=>{photoData=null;$("#photoPreview").classList.add("hidden");$("#photoPreview").innerHTML=""}
}
$("#photoBtn").onclick=()=>$("#photoInput").click();
$("#photoInput").onchange=e=>{
  const file=e.target.files[0]; if(!file)return;
  if(file.size>8*1024*1024){toast("Foto terlalu besar. Pilih foto di bawah 8 MB.");return}
  const reader=new FileReader(); reader.onload=()=>{photoData=reader.result;showPhoto(photoData)}; reader.readAsDataURL(file);
};
$("#noteText").oninput=e=>$("#charCount").textContent=e.target.value.length;
$$(".swatch").forEach(s=>s.onclick=()=>{$$(".swatch").forEach(x=>x.classList.remove("active"));s.classList.add("active");selectedColor=s.dataset.color});

$("#recordBtn").onclick=async()=>{
  if(mediaRecorder){stopRecording();return}
  if(!navigator.mediaDevices?.getUserMedia){toast("Browser ini tidak mendukung rekaman suara.");return}
  try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:true});
    audioChunks=[]; mediaRecorder=new MediaRecorder(stream);
    mediaRecorder.ondataavailable=e=>{if(e.data.size)audioChunks.push(e.data)}
    mediaRecorder.onstop=()=>{
      const blob=new Blob(audioChunks,{type:mediaRecorder.mimeType||"audio/webm"});
      const reader=new FileReader(); reader.onload=()=>{voiceData=reader.result;$("#recordAudio").src=voiceData;$("#recordPreview").classList.remove("hidden")}; reader.readAsDataURL(blob);
      stream.getTracks().forEach(t=>t.stop());
    };
    mediaRecorder.start(); recordSeconds=0; updateRecordTime();
    recordTimer=setInterval(()=>{recordSeconds++;updateRecordTime()},1000);
    $("#recordBtn").textContent="■ Berhenti"; $("#recordBtn").classList.add("recording");
  }catch(e){toast("Izin mikrofon belum diberikan.");}
};
function updateRecordTime(){ $("#recordTime").textContent=`${String(Math.floor(recordSeconds/60)).padStart(2,"0")}:${String(recordSeconds%60).padStart(2,"0")}` }
function stopRecording(){
  if(!mediaRecorder)return;
  mediaRecorder.stop(); clearInterval(recordTimer); mediaRecorder=null;
  $("#recordBtn").textContent="Rekam ulang"; $("#recordBtn").classList.remove("recording");
}
$("#removeRecord").onclick=()=>{voiceData=null;$("#recordAudio").src="";$("#recordPreview").classList.add("hidden")};

$("#saveNoteBtn").onclick=async()=>{
  if(mediaRecorder)stopRecording();
  const title=$("#noteTitle").value.trim(), text=$("#noteText").value.trim();
  if(!title && !text && !photoData && !voiceData){toast("Isi setidaknya satu hal dulu ♡");return}
  const old=editingId?notes.find(n=>n.id===editingId):null;
  const note={
    id:editingId||uid(),title,text,date:$("#noteDate").value||today(),color:selectedColor,
    photo:photoData,voice:voiceData,favorite:old?.favorite||false,
    x:old?.x,y:old?.y,rot:old?.rot??((Math.random()*5)-2.5)
  };
  try{
    await dbPut(note);
    const idx=notes.findIndex(n=>n.id===note.id); if(idx>=0)notes[idx]=note;else notes.push(note);
    closeEditor();render();toast(editingId?"Cerita diperbarui ♡":"Cerita ditempel di mading ♡");
  }catch(e){toast("Tidak cukup ruang penyimpanan browser.");}
};

async function deleteNote(id){
  const n=notes.find(x=>x.id===id); if(!n)return;
  if(!confirm("Hapus sticky note ini?"))return;
  await dbDelete(id); notes=notes.filter(x=>x.id!==id);render();toast("Sticky note dihapus.");
}

function openViewer(n){
  $("#viewContent").innerHTML=`
    ${n.photo?`<img class="view-photo" src="${n.photo}" alt="Foto kenangan">`:""}
    <div class="view-inner">
      <div class="view-date">${formatDate(n.date)} ${n.favorite?" · ♥ favorit":""}</div>
      <h3>${esc(n.title||"untitled memory")}</h3>
      ${n.text?`<p>${esc(n.text)}</p>`:""}
      ${n.voice?`<audio class="view-audio" controls src="${n.voice}"></audio>`:""}
    </div>`;
  $("#viewModal").classList.remove("hidden");
}
$("#closeView").onclick=()=>$("#viewModal").classList.add("hidden");
$("#viewModal").onclick=e=>{if(e.target.id==="viewModal")$("#viewModal").classList.add("hidden")};

$("#addBtn").onclick=()=>openEditor();$("#emptyAddBtn").onclick=()=>openEditor();
$("#closeEditor").onclick=closeEditor;
modal.onclick=e=>{if(e.target===modal)closeEditor()};
$("#searchInput").oninput=render;$("#sortSelect").onchange=render;
$$(".filter").forEach(b=>b.onclick=()=>{$$(".filter").forEach(x=>x.classList.remove("active"));b.classList.add("active");activeFilter=b.dataset.filter;render()});

$("#themeBtn").onclick=()=>{
  document.body.classList.toggle("dark");localStorage.setItem("mading-theme",document.body.classList.contains("dark")?"dark":"light");
  $("#themeBtn").textContent=document.body.classList.contains("dark")?"☀":"☾";
};

$("#musicBtn").onclick=()=>$("#musicModal").classList.remove("hidden");
$("#closeMusic").onclick=()=>$("#musicModal").classList.add("hidden");
$("#musicModal").onclick=e=>{if(e.target.id==="musicModal")$("#musicModal").classList.add("hidden")};
$("#musicInput").onchange=e=>{
  const file=e.target.files[0];if(!file)return;
  if(musicUrl)URL.revokeObjectURL(musicUrl);
  musicUrl=URL.createObjectURL(file);$("#bgMusic").src=musicUrl;localStorage.setItem("mading-music-name",file.name);toast("Musik siap diputar ♫");
};
$("#playMusic").onclick=async()=>{
  if(!$("#bgMusic").src){toast("Pilih file musik dulu.");return}
  try{await $("#bgMusic").play()}catch(e){toast("Tekan play pada pemutar musik.");}
};
$("#clearMusic").onclick=()=>{ $("#bgMusic").pause();$("#bgMusic").removeAttribute("src");$("#musicInput").value="";musicUrl=null;localStorage.removeItem("mading-music-name");toast("Musik dihapus.");};
function loadMusic(){ /* File object tidak dapat dipulihkan setelah refresh; browser hanya mengingat namanya. */ }

window.addEventListener("resize",()=>{notes.forEach(n=>{if(n.x>board.clientWidth-20)n.x=20;if(n.y>board.clientHeight-20)n.y=20});render()});
init();
