/* MADING KITA ♡ — ONLINE / SUPABASE */
const $ = (s, p=document) => p.querySelector(s);
const $$ = (s, p=document) => [...p.querySelectorAll(s)];

const CFG = {
  url: window.MADING_SUPABASE_URL || "",
  key: window.MADING_SUPABASE_ANON_KEY || ""
};
const isConfigured = CFG.url && CFG.key && !CFG.url.includes("PASTE_YOUR_") && !CFG.key.includes("PASTE_YOUR_");
const sb = isConfigured && window.supabase ? window.supabase.createClient(CFG.url, CFG.key) : null;

let notes = [];
let activeFilter = "all";
let selectedColor = "cream";
let editingId = null;
let photoFile = null;
let photoPath = null;
let photoPreviewUrl = null;
let removePhotoFlag = false;
let voiceBlob = null;
let voicePath = null;
let voicePreviewUrl = null;
let removeVoiceFlag = false;
let mediaRecorder = null;
let audioChunks = [];
let recordTimer = null;
let recordSeconds = 0;
let musicUrl = null;
let dragState = null;
let activeRoomId = localStorage.getItem("mading-active-room") || null;
let authorName = localStorage.getItem("mading-author") || "Aku";
let roomName = localStorage.getItem("mading-room-name") || "";
let realtimeChannel = null;
let loadingNotes = false;

const board = $("#board");
const modal = $("#editorModal");

function uid(){ return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)+Math.random().toString(36).slice(2); }
function today(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function esc(s=""){ const d=document.createElement("div"); d.textContent=s; return d.innerHTML; }
function formatDate(s){ if(!s) return ""; const d=new Date(s+"T00:00:00"); return d.toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}); }
function toast(msg){ const t=$("#toast"); t.textContent=msg; t.classList.add("show"); clearTimeout(toast.t); toast.t=setTimeout(()=>t.classList.remove("show"),2600); }
function clamp(v,min,max){ return Math.max(min,Math.min(max,v)); }
function setHidden(el, hidden){ if(el) el.classList.toggle("hidden", hidden); }
function mediaExt(type, fallback="bin"){
  const t=(type||"").toLowerCase();
  if(t.includes("png")) return "png"; if(t.includes("webp")) return "webp"; if(t.includes("gif")) return "gif"; if(t.includes("jpeg")||t.includes("jpg")) return "jpg";
  if(t.includes("mp4")) return "mp4"; if(t.includes("ogg")) return "ogg"; if(t.includes("mpeg")) return "mp3"; return fallback;
}
function mediaPath(roomId, kind, type){ return `${roomId}/${kind}/${uid()}.${mediaExt(type, kind==="photos"?"jpg":"webm")}`; }

function resetEditor(){
  if(photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl); if(voicePreviewUrl) URL.revokeObjectURL(voicePreviewUrl);
  editingId=null; photoFile=null; photoPath=null; photoPreviewUrl=null; removePhotoFlag=false; voiceBlob=null; voicePath=null; voicePreviewUrl=null; removeVoiceFlag=false;
  $("#noteTitle").value=""; $("#noteText").value=""; $("#noteAuthor").value=authorName; $("#charCount").textContent="0"; $("#noteDate").value=today();
  $("#photoPreview").innerHTML=""; $("#photoPreview").classList.add("hidden"); $("#recordPreview").classList.add("hidden"); $("#recordAudio").removeAttribute("src");
  $("#recordBtn").textContent="Mulai rekam"; $("#recordBtn").classList.remove("recording"); $("#photoInput").value="";
  selectedColor="cream"; $$(".swatch").forEach(s=>s.classList.toggle("active",s.dataset.color==="cream"));
}

async function ensureAuth(){
  if(!sb) return false;
  const {data:{session}} = await sb.auth.getSession();
  if(session) return true;
  const {error} = await sb.auth.signInAnonymously();
  if(error){
    console.error("Anonymous sign-in error:", error);
    const msg = String(error.message || "");
    if(msg.toLowerCase().includes("anonymous") || msg.toLowerCase().includes("disabled")){
      toast("Anonymous Sign-Ins belum aktif di Supabase.");
    }else{
      toast(`Gagal masuk ke Supabase: ${error.message || "cek Auth"}`);
    }
    return false;
  }
  return true;
}

function updateRoomUI(){
  $("#roomNameLabel").textContent = activeRoomId ? (roomName || "Mading Kita ♡") : "Belum terhubung";
  $("#roomCodeLabel").textContent = localStorage.getItem("mading-active-code") || "—";
  $("#currentRoomCode").textContent = localStorage.getItem("mading-active-code") || "—";
  setHidden($("#currentRoomBox"), !activeRoomId);
}

async function subscribeRoom(){
  if(!sb || !activeRoomId) return;
  if(realtimeChannel) await sb.removeChannel(realtimeChannel);
  realtimeChannel = sb.channel(`mading-notes-${activeRoomId}`)
    .on("postgres_changes", {event:"*", schema:"public", table:"notes", filter:`room_id=eq.${activeRoomId}`}, async()=>{ await loadNotes(); })
    .subscribe();
}

async function signMedia(paths, bucket){
  const clean=[...new Set(paths.filter(Boolean))]; if(!clean.length) return new Map();
  const map=new Map();
  for(let i=0;i<clean.length;i+=100){
    const chunk=clean.slice(i,i+100); const {data,error}=await sb.storage.from(bucket).createSignedUrls(chunk, 3600);
    if(error){ console.error(error); continue; }
    (data||[]).forEach(x=>{ if(x.signedUrl) map.set(x.path,x.signedUrl); });
  }
  return map;
}

async function loadNotes(){
  if(!sb || !activeRoomId) { notes=[]; render(); return; }
  if(loadingNotes) return; loadingNotes=true;
  try{
    const {data,error}=await sb.from("notes").select("*").eq("room_id",activeRoomId).order("created_at",{ascending:false});
    if(error) throw error;
    const rows=data||[];
    const [photos,voices]=await Promise.all([signMedia(rows.map(n=>n.photo_path),"mading-media"),signMedia(rows.map(n=>n.voice_path),"mading-media")]);
    notes=rows.map(n=>({...n,photo:n.photo_path?photos.get(n.photo_path):null,voice:n.voice_path?voices.get(n.voice_path):null}));
    render();
  }catch(e){ console.error(e); toast("Gagal mengambil mading online. Cek koneksi dan Supabase."); }
  finally{ loadingNotes=false; }
}

function filteredNotes(){
  const q=$("#searchInput").value.trim().toLowerCase();
  let list=notes.filter(n=>{
    if(activeFilter==="favorite"&&!n.favorite)return false;
    if(activeFilter==="photo"&&!n.photo_path)return false;
    if(activeFilter==="voice"&&!n.voice_path)return false;
    if(activeFilter==="text"&&!n.text)return false;
    return !q || [n.title,n.text,n.author].join(" ").toLowerCase().includes(q);
  });
  const sort=$("#sortSelect").value;
  if(sort==="newest")list.sort((a,b)=>new Date(b.created_at||b.date)-new Date(a.created_at||a.date));
  if(sort==="oldest")list.sort((a,b)=>new Date(a.created_at||a.date)-new Date(b.created_at||b.date));
  if(sort==="random")list.sort(()=>Math.random()-.5);
  return list;
}
function ensureBoardHeight(){
  const minHeight=window.innerWidth<=800?1100:900; let needed=minHeight;
  notes.forEach(n=>{if(Number.isFinite(n.y))needed=Math.max(needed,n.y+300)});
  board.style.minHeight=needed+"px";
}
function arrangeNewNotePosition(note){
  if(note.x!=null&&note.y!=null)return;
  const gap=28, noteW=window.innerWidth<=500?175:(window.innerWidth<=800?190:230), noteH=window.innerWidth<=800?220:250;
  const cols=Math.max(1,Math.floor((board.clientWidth-80)/(noteW+gap))); const i=Math.max(0,notes.findIndex(x=>x.id===note.id));
  note.x=30+(i%cols)*(noteW+gap); note.y=35+Math.floor(i/cols)*(noteH+gap); note.rot=note.rot??((Math.random()*5)-2.5);
}
function scrollToNote(note){requestAnimationFrame(()=>{const el=board.querySelector(`[data-id="${note.id}"]`);if(el)el.scrollIntoView({behavior:"smooth",block:"center"})})}
function render(){
  board.innerHTML=""; notes.forEach(arrangeNewNotePosition); ensureBoardHeight(); $("#noteCount").textContent=notes.length;
  const list=filteredNotes(); setHidden($("#emptyState"),list.length!==0); if(!list.length)return; list.forEach((n,i)=>board.appendChild(makeNote(n,i))); ensureBoardHeight();
}
function makeNote(n,i){
  const el=document.createElement("article"); el.className=`sticky-note ${n.color||"cream"}`; el.dataset.id=n.id;
  el.style.setProperty("--rot",`${n.rot??((i%5)-2)*1.5}deg`); el.style.left=`${n.x??30}px`; el.style.top=`${n.y??35}px`;
  const title=n.title?`<h4>${esc(n.title)}</h4>`:"", text=n.text?`<p>${esc(n.text)}</p>`:"";
  const photo=n.photo?`<img class="note-photo" src="${n.photo}" alt="Foto pada sticky note">`:"", voice=n.voice?`<audio class="note-voice" controls src="${n.voice}"></audio>`:"";
  el.innerHTML=`<div class="pin"></div><div class="note-tape"></div><div class="note-tools"><button class="mini-btn favorite-btn ${n.favorite?"is-fav":""}" title="Favorit">${n.favorite?"♥":"♡"}</button><button class="mini-btn edit-btn" title="Edit">✎</button><button class="mini-btn delete-btn" title="Hapus">×</button></div><div class="note-content">${title}${photo}${text}${voice}</div><div class="note-footer"><span>${formatDate(n.date)}${n.author?` · ${esc(n.author)}`:""}</span><span class="media-badges">${n.photo_path?"📷 ":""}${n.voice_path?"🎙 ":""}${n.text?"✎":""}</span></div>`;
  $(".favorite-btn",el).onclick=async e=>{e.stopPropagation();await updateNote(n.id,{favorite:!n.favorite});};
  $(".edit-btn",el).onclick=e=>{e.stopPropagation();openEditor(n)}; $(".delete-btn",el).onclick=e=>{e.stopPropagation();deleteNote(n.id)};
  el.addEventListener("dblclick",()=>openViewer(n)); attachDrag(el,n); return el;
}
function attachDrag(el,n){
  // Desktop: drag langsung. Mobile/tablet: tahan sebentar agar scroll biasa tidak ikut menyeret note.
  let pressTimer = null;
  let pending = null;
  let movedBeforeDrag = false;
  const isTouch = () => window.matchMedia("(pointer: coarse)").matches;
  const cancelPending = () => {
    if(pressTimer){ clearTimeout(pressTimer); pressTimer=null; }
    pending=null;
  };
  const beginDrag = (e) => {
    const r=el.getBoundingClientRect();
    el.setPointerCapture?.(e.pointerId);
    dragState={el,n,dx:e.clientX-r.left,dy:e.clientY-r.top,pointerId:e.pointerId};
    el.classList.add("dragging");
    if(navigator.vibrate) navigator.vibrate(12);
  };

  el.addEventListener("pointerdown",e=>{
    if(e.target.closest("button,audio,img,input,textarea"))return;
    movedBeforeDrag=false;
    if(isTouch()){
      pending={x:e.clientX,y:e.clientY,pointerId:e.pointerId};
      pressTimer=setTimeout(()=>{
        if(pending && !movedBeforeDrag) beginDrag(e);
      },360);
    }else{
      beginDrag(e);
    }
  });

  el.addEventListener("pointermove",e=>{
    if(pending && !dragState){
      const dx=e.clientX-pending.x, dy=e.clientY-pending.y;
      if(Math.hypot(dx,dy)>9){ movedBeforeDrag=true; cancelPending(); }
      return;
    }
    if(!dragState||dragState.el!==el)return;
    e.preventDefault();
    const br=board.getBoundingClientRect();
    const x=clamp(e.clientX-br.left-dragState.dx,10,Math.max(10,board.clientWidth-el.offsetWidth-10));
    // Di HP hanya geser kiri/kanan. Scroll vertikal halaman tetap normal.
    const touchMode = window.matchMedia("(pointer: coarse)").matches;
    const y = touchMode ? (n.y ?? 10) : Math.max(10,e.clientY-br.top-dragState.dy);
    el.style.left=x+"px";el.style.top=y+"px";n.x=x;n.y=y;
    if(!touchMode && y+el.offsetHeight+100>board.clientHeight)board.style.minHeight=(y+el.offsetHeight+140)+"px";
  });

  const finish=async e=>{
    if(pending && !dragState) cancelPending();
    if(!dragState||dragState.el!==el)return;
    try{el.releasePointerCapture?.(dragState.pointerId ?? e.pointerId)}catch{}
    el.classList.remove("dragging");
    const finalX=n.x, finalY=n.y;
    dragState=null;
    await updateNote(n.id,{x:finalX,y:finalY});
  };
  el.addEventListener("pointerup",finish);
  el.addEventListener("pointercancel",finish);
  el.addEventListener("lostpointercapture",()=>{
    if(dragState?.el===el){ el.classList.remove("dragging"); dragState=null; }
  });
}

async function updateNote(id,patch){
  if(!sb||!activeRoomId)return;
  const {error}=await sb.from("notes").update(patch).eq("id",id).eq("room_id",activeRoomId); if(error){console.error(error);toast("Perubahan gagal disimpan.");return} await loadNotes();
}

async function uploadMedia(fileOrBlob, kind, type){
  const path=mediaPath(activeRoomId,kind,type); const {error}=await sb.storage.from("mading-media").upload(path,fileOrBlob,{contentType:type||undefined,upsert:false}); if(error)throw error; return path;
}
async function removeMedia(path){ if(!path)return; const {error}=await sb.storage.from("mading-media").remove([path]); if(error)console.warn("Media cleanup:",error); }

function showPhoto(src){
  $("#photoPreview").innerHTML=`<img src="${src}" alt="Pratinjau foto"><button class="text-btn danger" id="removePhoto">× Hapus foto</button>`; $("#photoPreview").classList.remove("hidden");
  $("#removePhoto").onclick=()=>{photoFile=null;removePhotoFlag=true;photoPath=null;$("#photoPreview").classList.add("hidden");$("#photoPreview").innerHTML=""};
}
$("#photoBtn").onclick=()=>$("#photoInput").click();
$("#photoInput").onchange=e=>{const file=e.target.files[0];if(!file)return;if(file.size>8*1024*1024){toast("Foto terlalu besar. Maksimal 8 MB.");return}photoFile=file;removePhotoFlag=false;if(photoPreviewUrl)URL.revokeObjectURL(photoPreviewUrl);photoPreviewUrl=URL.createObjectURL(file);showPhoto(photoPreviewUrl)};
$("#noteText").oninput=e=>$("#charCount").textContent=e.target.value.length;
$$('.swatch').forEach(s=>s.onclick=()=>{$$('.swatch').forEach(x=>x.classList.remove('active'));s.classList.add('active');selectedColor=s.dataset.color});

$("#recordBtn").onclick=async()=>{
  if(mediaRecorder){stopRecording();return} if(!navigator.mediaDevices?.getUserMedia){toast("Browser ini tidak mendukung rekaman suara.");return}
  try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:true}); audioChunks=[];
    const mime=MediaRecorder.isTypeSupported("audio/webm;codecs=opus")?"audio/webm;codecs=opus":"audio/webm";
    mediaRecorder=new MediaRecorder(stream,{mimeType:mime});
    mediaRecorder.ondataavailable=e=>{if(e.data.size)audioChunks.push(e.data)};
    mediaRecorder.onstop=()=>{voiceBlob=new Blob(audioChunks,{type:mediaRecorder?.mimeType||mime});if(voicePreviewUrl)URL.revokeObjectURL(voicePreviewUrl);voicePreviewUrl=URL.createObjectURL(voiceBlob);$("#recordAudio").src=voicePreviewUrl;$("#recordPreview").classList.remove("hidden");stream.getTracks().forEach(t=>t.stop())};
    mediaRecorder.start();recordSeconds=0;updateRecordTime();recordTimer=setInterval(()=>{recordSeconds++;updateRecordTime()},1000);$("#recordBtn").textContent="■ Berhenti";$("#recordBtn").classList.add("recording");
  }catch(e){console.error(e);toast("Izin mikrofon belum diberikan.")}
};
function updateRecordTime(){$("#recordTime").textContent=`${String(Math.floor(recordSeconds/60)).padStart(2,"0")}:${String(recordSeconds%60).padStart(2,"0")}`}
function stopRecording(){if(!mediaRecorder)return;const r=mediaRecorder;r.stop();clearInterval(recordTimer);mediaRecorder=null;$("#recordBtn").textContent="Rekam ulang";$("#recordBtn").classList.remove("recording");}
$("#removeRecord").onclick=()=>{voiceBlob=null;removeVoiceFlag=true;voicePath=null;$("#recordAudio").removeAttribute("src");$("#recordPreview").classList.add("hidden")};

function openEditor(note=null){
  resetEditor(); editingId=note?.id||null;
  if(note){
    $("#noteTitle").value=note.title||"";$("#noteText").value=note.text||"";$("#noteAuthor").value=note.author||authorName;$("#noteDate").value=note.date||today();selectedColor=note.color||"cream";$$('.swatch').forEach(s=>s.classList.toggle('active',s.dataset.color===selectedColor));
    photoPath=note.photo_path||null;voicePath=note.voice_path||null;
    if(note.photo)showPhoto(note.photo); if(note.voice){$("#recordAudio").src=note.voice;$("#recordPreview").classList.remove("hidden")}
  }
  $("#charCount").textContent=$("#noteText").value.length;modal.classList.remove("hidden");setTimeout(()=>$("#noteText").focus(),80);
}
function closeEditor(){if(mediaRecorder)stopRecording();modal.classList.add("hidden");resetEditor()}

$("#saveNoteBtn").onclick=async()=>{
  if(mediaRecorder)stopRecording(); if(!sb||!activeRoomId){toast("Buat atau gabung room online dulu.");return}
  const title=$("#noteTitle").value.trim(),text=$("#noteText").value.trim(),author=$("#noteAuthor").value.trim()||"Aku";
  if(!title&&!text&&!photoFile&&!photoPath&&!voiceBlob&&!voicePath){toast("Isi setidaknya satu hal dulu ♡");return}
  const old=editingId?notes.find(n=>n.id===editingId):null; let newPhotoPath=photoPath,newVoicePath=voicePath;
  const oldPhoto=old?.photo_path||null,oldVoice=old?.voice_path||null;
  try{
    $("#saveNoteBtn").disabled=true; $("#saveNoteBtn").textContent="Menyimpan...";
    if(photoFile){newPhotoPath=await uploadMedia(photoFile,"photos",photoFile.type)} else if(removePhotoFlag)newPhotoPath=null;
    if(voiceBlob){newVoicePath=await uploadMedia(voiceBlob,"voices",voiceBlob.type)} else if(removeVoiceFlag)newVoicePath=null;
    const payload={room_id:activeRoomId,author,title,text,date:$("#noteDate").value||today(),color:selectedColor,photo_path:newPhotoPath,voice_path:newVoicePath,favorite:old?.favorite||false,x:old?.x??null,y:old?.y??null,rot:old?.rot??((Math.random()*5)-2.5)};
    let result;
    if(editingId)result=await sb.from("notes").update(payload).eq("id",editingId).eq("room_id",activeRoomId).select().single();
    else result=await sb.from("notes").insert(payload).select().single();
    if(result.error)throw result.error;
    if(oldPhoto&&oldPhoto!==newPhotoPath)await removeMedia(oldPhoto); if(oldVoice&&oldVoice!==newVoicePath)await removeMedia(oldVoice);
    closeEditor();await loadNotes();const fresh=notes.find(n=>n.id===result.data.id);if(fresh)scrollToNote(fresh);toast(editingId?"Cerita diperbarui ♡":"Cerita ditempel di mading ♡");
  }catch(e){console.error(e);toast(`Gagal menyimpan: ${e.message||"cek Supabase"}`)}
  finally{$("#saveNoteBtn").disabled=false;$("#saveNoteBtn").textContent="♡ Tempel di mading";}
};

async function deleteNote(id){
  const n=notes.find(x=>x.id===id);if(!n||!confirm("Hapus sticky note ini?"))return;
  try{const {error}=await sb.from("notes").delete().eq("id",id).eq("room_id",activeRoomId);if(error)throw error;await Promise.all([removeMedia(n.photo_path),removeMedia(n.voice_path)]);await loadNotes();toast("Sticky note dihapus.")}catch(e){console.error(e);toast("Gagal menghapus sticky note.")}
}

function openViewer(n){$("#viewContent").innerHTML=`${n.photo?`<img class="view-photo" src="${n.photo}" alt="Foto kenangan">`:""}<div class="view-inner"><div class="view-date">${formatDate(n.date)}${n.author?` · ${esc(n.author)}`:""}${n.favorite?" · ♥ favorit":""}</div><h3>${esc(n.title||"untitled memory")}</h3>${n.text?`<p>${esc(n.text)}</p>`:""}${n.voice?`<audio class="view-audio" controls src="${n.voice}"></audio>`:""}</div>`;$("#viewModal").classList.remove("hidden")}
$("#closeView").onclick=()=>$("#viewModal").classList.add("hidden");$("#viewModal").onclick=e=>{if(e.target.id==="viewModal")$("#viewModal").classList.add("hidden")};

async function createRoom(){
  if(!sb)return;const name=$("#newRoomName").value.trim()||"Mading Kita ♡",author=$("#newRoomAuthor").value.trim()||"Aku";
  try{const {data,error}=await sb.rpc("create_room",{p_name:name,p_author_name:author});if(error)throw error;activateRoom(data,author);closeRoomModal();toast(`Room dibuat: ${data.code}`)}catch(e){console.error(e);toast(`Gagal membuat room: ${e.message||"cek SQL"}`)}
}
async function joinRoom(){
  if(!sb)return;const code=$("#joinRoomCode").value.trim().toUpperCase(),author=$("#joinRoomAuthor").value.trim()||"Aku";if(!code){toast("Masukkan kode room.");return}
  try{const {data,error}=await sb.rpc("join_room",{p_code:code,p_author_name:author});if(error)throw error;activateRoom(data,author);closeRoomModal();toast("Berhasil masuk ke mading ♡")}catch(e){console.error(e);toast(`Gagal gabung: ${e.message||"kode salah"}`)}
}
function activateRoom(room,author){activeRoomId=room.id;authorName=author;roomName=room.name;localStorage.setItem("mading-active-room",room.id);localStorage.setItem("mading-active-code",room.code);localStorage.setItem("mading-author",author);localStorage.setItem("mading-room-name",room.name);updateRoomUI();subscribeRoom();loadNotes()}
async function leaveRoom(){if(realtimeChannel&&sb){await sb.removeChannel(realtimeChannel);realtimeChannel=null}activeRoomId=null;notes=[];localStorage.removeItem("mading-active-room");localStorage.removeItem("mading-active-code");localStorage.removeItem("mading-room-name");updateRoomUI();render();closeRoomModal();toast("Kamu keluar dari room di perangkat ini.")}
function openRoomModal(){if(!sb){toast("Isi supabase-config.js dulu sebelum membuat room.");return}$("#roomModal").classList.remove("hidden");$("#newRoomAuthor").value=authorName;$("#joinRoomAuthor").value=authorName;updateRoomUI()}
function closeRoomModal(){$("#roomModal").classList.add("hidden")}

$("#roomBtn").onclick=openRoomModal;$("#closeRoom").onclick=closeRoomModal;$("#roomModal").onclick=e=>{if(e.target.id==="roomModal")closeRoomModal()};$("#createRoomBtn").onclick=createRoom;$("#joinRoomBtn").onclick=joinRoom;$("#leaveRoomBtn").onclick=leaveRoom;
$("#addBtn").onclick=()=>activeRoomId?openEditor():openRoomModal();$("#emptyAddBtn").onclick=()=>activeRoomId?openEditor():openRoomModal();$("#closeEditor").onclick=closeEditor;modal.onclick=e=>{if(e.target===modal)closeEditor()};
$("#searchInput").oninput=render;$("#sortSelect").onchange=render;$$('.filter').forEach(b=>b.onclick=()=>{$$('.filter').forEach(x=>x.classList.remove('active'));b.classList.add('active');activeFilter=b.dataset.filter;render()});
$("#themeBtn").onclick=()=>{document.body.classList.toggle("dark");localStorage.setItem("mading-theme",document.body.classList.contains("dark")?"dark":"light");$("#themeBtn").textContent=document.body.classList.contains("dark")?"☀":"☾"};
$("#musicBtn").onclick=()=>$("#musicModal").classList.remove("hidden");$("#closeMusic").onclick=()=>$("#musicModal").classList.add("hidden");$("#musicModal").onclick=e=>{if(e.target.id==="musicModal")$("#musicModal").classList.add("hidden")};
$("#musicInput").onchange=e=>{const file=e.target.files[0];if(!file)return;if(musicUrl)URL.revokeObjectURL(musicUrl);musicUrl=URL.createObjectURL(file);$("#bgMusic").src=musicUrl;toast("Musik siap diputar ♫")};$("#playMusic").onclick=async()=>{if(!$("#bgMusic").src){toast("Pilih file musik dulu.");return}try{await $("#bgMusic").play()}catch(e){toast("Tekan play pada pemutar musik.")}};$("#clearMusic").onclick=()=>{$("#bgMusic").pause();$("#bgMusic").removeAttribute("src");$("#musicInput").value="";if(musicUrl)URL.revokeObjectURL(musicUrl);musicUrl=null;toast("Musik dihapus.")};

let resizeTimer=null;
window.addEventListener("resize",()=>{
  clearTimeout(resizeTimer);
  resizeTimer=setTimeout(()=>{ensureBoardHeight();render()},180);
});

async function init(){
  const dateInput=$("#noteDate");
  if(dateInput){ dateInput.value=today(); dateInput.max=today(); }
  const savedTheme=localStorage.getItem("mading-theme");if(savedTheme==="dark"){$("body").classList.add("dark");$("#themeBtn").textContent="☀"}
  updateRoomUI();$("#noteDate").value=today();
  if(!isConfigured){toast("Supabase belum dikonfigurasi. Isi supabase-config.js dulu.");openRoomModal();return}
  const ok=await ensureAuth();if(!ok)return;
  if(activeRoomId){
    try{const {data,error}=await sb.from("rooms").select("id,code,name").eq("id",activeRoomId).single();if(error)throw error;roomName=data.name;localStorage.setItem("mading-active-code",data.code);updateRoomUI();await subscribeRoom();await loadNotes();}
    catch(e){console.warn(e);activeRoomId=null;localStorage.removeItem("mading-active-room");updateRoomUI();openRoomModal()}
  }else openRoomModal();
}
init();
