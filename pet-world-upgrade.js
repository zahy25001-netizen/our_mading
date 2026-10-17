/* MADING KITA — 3D cat world + shared album. Uses existing global Supabase room/auth state. */
(() => {
 const pet=document.getElementById('catPet'); if(!pet)return;
 const hit=pet.querySelector('.pet-cat-hitbox'); if(!hit)return;
 let renderer,scene,camera,catRoot,tail,head,body,legs=[],eyes=[],muzzle,ears=[],outfitMesh,hatMesh,bowMesh,ball,ballTarget=null,anim='idle',animUntil=0,last=0,clock=0,weather='clear',rainAudio=null,audioCtx=null;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const outfitColors=[0x2c3442,0x4b7799,0x8062a0,0x8ba77b,0xe5b4b9,0x547b8d,0xb94e3f]; let selectedOutfit=0;
 const mat=(color,roughness=.78,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
 function sphere(parent,name,pos,scale,material,seg=24){const m=new THREE.Mesh(new THREE.SphereGeometry(1,seg,Math.max(12,Math.floor(seg*.7))),material);m.name=name;m.position.set(...pos);m.scale.set(...scale);parent.add(m);return m;}
 function cylinder(parent,pos,r1,r2,h,material,seg=16){const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,seg),material);m.position.set(...pos);parent.add(m);return m;}
 function buildCat(){
  scene=new THREE.Scene();scene.background=null;scene.fog=new THREE.Fog(0x211720,8,18);
  camera=new THREE.PerspectiveCamera(34,1,.1,100);camera.position.set(0,2.15,7.9);camera.lookAt(0,1.25,0);
  renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.7));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.domElement.id='pet3dCanvas';renderer.domElement.setAttribute('aria-label','Kucing 3D interaktif');hit.appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xffe3cc,0x292333,2.0));const key=new THREE.DirectionalLight(0xffb36c,3.0);key.position.set(-3,6,5);key.castShadow=true;scene.add(key);const rim=new THREE.PointLight(0xff492d,18,12);rim.position.set(3,2,1);scene.add(rim);const fill=new THREE.PointLight(0x6b9eff,7,10);fill.position.set(-4,2,-2);scene.add(fill);
  const floor=sphere(scene,'floor',[0,-.28,-.1],[4.4,.18,2.1],mat(0x38252b,.9));floor.castShadow=false;
  catRoot=new THREE.Group();scene.add(catRoot);
  const fur=mat(0xc87936),furLight=mat(0xe8a557),furDark=mat(0x70401f),cream=mat(0xf4d6ad),pink=mat(0xb96d69),eyeMat=mat(0x9cae42,.22),pupil=mat(0x101019,.18),shine=new THREE.MeshBasicMaterial({color:0xffffff});
  // seated body and haunches
  body=sphere(catRoot,'body',[0,.95,0],[.72,.92,.48],fur,32);body.rotation.x=-.13; sphere(catRoot,'chest',[0,1.05,.31],[.48,.64,.27],furLight,28);
  sphere(catRoot,'haunchL',[-.43,.52,.02],[.42,.48,.42],fur,28);sphere(catRoot,'haunchR',[.39,.52,-.03],[.37,.43,.37],fur,28);
  // forelegs / paws
  for(const x of [-.28,.28]){const g=new THREE.Group();g.position.set(x,.66,.27);catRoot.add(g);const leg=sphere(g,'leg',[0,-.25,.03],[.17,.48,.18],furLight,20);const paw=sphere(g,'paw',[0,-.55,.12],[.2,.13,.23],furLight,20);for(let i=-1;i<=1;i++)sphere(g,'toe',[i*.07,-.57,.30],[.035,.045,.025],cream,10);legs.push(g);}
  // tail as curved segmented chain rebuilt every frame
  tail=new THREE.Group();tail.position.set(.48,.65,-.15);catRoot.add(tail);for(let i=0;i<9;i++){const t=sphere(tail,'tailSegment',[.06+i*.09,-.04+Math.sin(i*.34)*.07,-i*.035],[.12-i*.005,.12-i*.005,.13-i*.005],i>6?furDark:fur,14);t.rotation.z=-i*.12;}
  head=new THREE.Group();head.position.set(0,1.92,.12);catRoot.add(head);
  sphere(head,'skull',[0,0,0],[.57,.48,.43],fur,32);
  // cheek tufts and muzzle
  sphere(head,'cheekL',[-.34,-.18,.27],[.27,.22,.22],furLight,20);sphere(head,'cheekR',[.34,-.18,.27],[.27,.22,.22],furLight,20);
  sphere(head,'muzzleL',[-.13,-.13,.39],[.18,.13,.12],cream,20);sphere(head,'muzzleR',[.13,-.13,.39],[.18,.13,.12],cream,20);muzzle=sphere(head,'nose',[0,-.045,.505],[.075,.052,.04],pink,16);
  for(const x of [-.32,.32]){const ear=sphere(head,'ear',[x,.36,-.015],[.22,.31,.13],fur,20);ear.rotation.z=x<0?-.27:.27;const inner=sphere(head,'innerEar',[x,.36,.092],[.12,.21,.035],pink,16);inner.rotation.z=ear.rotation.z;ears.push(ear);}
  for(const x of [-.235,.235]){sphere(head,'eyeSocket',[x,.055,.36],[.17,.19,.09],furDark,20);const e=sphere(head,'eye',[x,.05,.424],[.125,.14,.06],eyeMat,20);eyes.push(e);sphere(head,'pupil',[x,.045,.475],[.052,.105,.025],pupil,16);sphere(head,'glint',[x-.025,.095,.497],[.025,.032,.012],shine,10);}
  // whiskers as thin curves
  for(const side of [-1,1])for(let j=0;j<3;j++){const pts=[new THREE.Vector3(side*.18,-.16,.43),new THREE.Vector3(side*.43,-.16+(j-1)*.08,.46),new THREE.Vector3(side*.72,-.12+(j-1)*.14,.40)];const geo=new THREE.BufferGeometry().setFromPoints(pts);const line=new THREE.Line(geo,new THREE.LineBasicMaterial({color:0xf6e2c7,transparent:true,opacity:.7}));head.add(line);}
  // soft tabby stripes across forehead/cheeks
  const stripeMat=mat(0x8a4a24);for(let i=-2;i<=2;i++){const s=sphere(head,'foreheadStripe',[i*.105,.31-Math.abs(i)*.035,.407],[.025,.12,.018],stripeMat,10);s.rotation.z=i*.18;}
  // garment fitted around torso: layered torso mesh and sleeves
  outfitMesh=new THREE.Group();catRoot.add(outfitMesh);const garment=new THREE.Mesh(new THREE.SphereGeometry(1,28,20),mat(outfitColors[0],.58));garment.scale.set(.755,.59,.51);garment.position.set(0,1.03,.015);outfitMesh.add(garment);for(const x of [-.34,.34]){const sleeve=new THREE.Mesh(new THREE.CylinderGeometry(.13,.17,.39,16),mat(outfitColors[0],.58));sleeve.position.set(x,.83,.12);sleeve.rotation.z=x<0?-.22:.22;outfitMesh.add(sleeve);}const collar=new THREE.Mesh(new THREE.TorusGeometry(.32,.055,10,32),mat(0xeac6a4));collar.position.set(0,1.42,.20);collar.rotation.x=Math.PI/2;outfitMesh.add(collar);
  hatMesh=new THREE.Group();catRoot.add(hatMesh);const cap=sphere(hatMesh,'cap',[0,2.34,.03],[.35,.14,.31],mat(0x384d64),20);const brim=sphere(hatMesh,'brim',[0,2.29,.26],[.36,.035,.2],mat(0x253345),16);
  bowMesh=new THREE.Group();catRoot.add(bowMesh);sphere(bowMesh,'bowL',[-.18,2.25,.18],[.15,.10,.07],mat(0xf1a0b0),16);sphere(bowMesh,'bowR',[.18,2.25,.18],[.15,.10,.07],mat(0xf1a0b0),16);sphere(bowMesh,'bowKnot',[0,2.25,.24],[.07,.07,.06],mat(0xffd2d8),12);
  ball=new THREE.Group();scene.add(ball);sphere(ball,'yarn',[0,0,0],[.17,.17,.17],mat(0xd85a86),20);for(let i=0;i<3;i++){const tor=new THREE.Mesh(new THREE.TorusGeometry(.13,.012,6,24),mat(0xffd6de));tor.rotation.set(i*.7,i*.8,i*.3);ball.add(tor);}ball.visible=false;
  applyOutfit(0);resize();window.addEventListener('resize',resize);renderer.domElement.addEventListener('pointerdown',()=>{if(anim==='sleep')setAnim('wake',1600);});
 }
 function resize(){if(!renderer)return;const w=Math.max(1,hit.clientWidth),h=Math.max(1,hit.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
 function applyOutfit(i){selectedOutfit=i%outfitColors.length;outfitMesh?.children.forEach(m=>{if(m.material?.color && m.geometry.type!=='TorusGeometry')m.material.color.setHex(outfitColors[selectedOutfit]);});if(hatMesh)hatMesh.visible=[0,2,4,6].includes(selectedOutfit);if(bowMesh)bowMesh.visible=[1,3,5].includes(selectedOutfit);}
 function setAnim(name,ms=1800){anim=name;animUntil=performance.now()+ms;pet.dataset.mood=name==='sleep'?'mengantuk':name==='play'?'ceria':name==='pet'?'sayang':'tenang';}
 function animate(t){requestAnimationFrame(animate);if(!renderer)return;const dt=Math.min(.04,(t-last)/1000||.016);last=t;clock+=dt;const idle=anim==='idle'||anim==='sleep';catRoot.position.y=(anim==='sleep'?-.08:0)+(anim==='wake'?Math.sin(clock*5)*.06:Math.sin(clock*2.1)*.025);catRoot.rotation.y=anim==='walk'?Math.sin(clock*5)*.22:Math.sin(clock*.65)*.035;head.rotation.x=anim==='sleep'?.26:anim==='lick'?Math.sin(clock*8)*.2:anim==='wake'?-Math.max(0,Math.sin(clock*4))*.2:Math.sin(clock*1.4)*.025;head.rotation.z=anim==='pet'?Math.sin(clock*6)*.08:0;tail.rotation.x=Math.sin(clock*2.2)*.17;tail.rotation.y=Math.sin(clock*1.7)*.2;
  if(anim==='walk'||anim==='play'){legs.forEach((l,i)=>l.rotation.x=Math.sin(clock*9+i*Math.PI)*.35);}else legs.forEach(l=>l.rotation.x=0);
  if(anim==='sleep'){catRoot.rotation.z=.03; }else if(anim==='wake'){catRoot.rotation.z=Math.sin(clock*4)*.06;}else catRoot.rotation.z=0;
  if(anim!=='idle'&&t>animUntil){anim='idle';catRoot.rotation.z=0;}
  if(ball.visible&&ballTarget){ball.position.lerp(ballTarget,Math.min(1,dt*2.8));ball.rotation.x+=dt*2;ball.rotation.z+=dt*1.3;if(ball.position.distanceTo(ballTarget)<.15){ballTarget=new THREE.Vector3((Math.random()-.5)*2,.22,(Math.random()-.5)*.8);setAnim('play',4000);}}
  if(!document.hidden&&Math.random()<.0018&&anim==='idle'){head.scale.y=.82;setTimeout(()=>{if(head)head.scale.y=1},140);}
  renderer.render(scene,camera);
 }
 function say(s){const b=document.getElementById('petBubble');b.textContent=s;b.classList.add('show');clearTimeout(say.timer);say.timer=setTimeout(()=>b.classList.remove('show'),2600)}
 function purr(){try{audioCtx ||= new (AudioContext||webkitAudioContext)();audioCtx.resume();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='triangle';o.frequency.value=75+Math.random()*25;g.gain.value=.018;o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+.35)}catch(e){}}
 function hearts(){for(let i=0;i<4;i++){const h=document.createElement('span');h.className='pet-heart';h.textContent=['♥','♡','✦'][i%3];h.style.left=(25+Math.random()*50)+'%';h.style.top='35%';pet.appendChild(h);setTimeout(()=>h.remove(),1200)}}
 hit.addEventListener('click',()=>{setAnim('pet',1600);say('prrrrr… suka dielus 💗');purr();hearts()});
 document.getElementById('petFeed')?.addEventListener('click',()=>{setAnim('lick',1800);say('nyam… makasih ya 🐟');purr()});
 document.getElementById('petPlay')?.addEventListener('click',()=>{if(!ball)return;ball.visible=true;ball.position.set(-1.2,.2,1);ballTarget=new THREE.Vector3(1.3,.22,.3);setAnim('play',6000);say('ayo kejar bolanya! 🧶');hearts();setTimeout(()=>{if(ball)ball.visible=false;ballTarget=null},6500)});
 document.getElementById('petDress')?.addEventListener('click',()=>{applyOutfit((selectedOutfit+1)%outfitColors.length);setAnim('wake',900);say('outfit baru! ✨');scheduleSharedOutfit(selectedOutfit)});
 // Keep outfit changes shared through the existing pet profile saver.
 function scheduleSharedOutfit(i){try{if(window.MadingPetSync?.setOutfit)window.MadingPetSync.setOutfit(i);else{localStorage.setItem('mading-cat-3d-outfit',String(i));}}catch(e){}}
 const oldNameBtn=document.getElementById('petNameBtn');oldNameBtn?.addEventListener('click',()=>setTimeout(()=>{const label=document.getElementById('petName')?.textContent||'Mochi';say('hai, aku '+label+' 🐾')},20));
 // Auto behavior, day/night lighting, and rainy window ambience.
 function updateWorld(){const hour=new Date().getHours(),night=hour>=19||hour<6;pet.dataset.time=night?'night':'day';const ambient=scene?.children.find(x=>x.isHemisphereLight);if(ambient)ambient.intensity=night?1.15:2;const light=scene?.children.find(x=>x.isDirectionalLight);if(light)light.intensity=night?1.6:3;}
 updateWorld();setInterval(updateWorld,60000);
 setInterval(()=>{if(document.hidden||anim!=='idle')return;const h=new Date().getHours();if(h>=6&&h<10){setAnim('wake',2200);say('selamat pagi… stretch dulu 🌤️')}else if(h>=21||h<5){setAnim('sleep',9000);say('ngantuk… bobok yuk zzz');}else if(Math.random()<.35){setAnim('lick',1800);say('lagi merapikan bulu ✨')}},24000);
 // Rain button is intentionally user-activated (browser audio permission); toggled from album weather chip.
 function toggleRain(){weather=weather==='rain'?'clear':'rain';pet.dataset.weather=weather;if(weather==='rain'){say('hujan di luar… waktunya tidur 🌧️');setAnim('sleep',9000);try{audioCtx ||= new (AudioContext||webkitAudioContext)();const n=audioCtx.createBufferSource(),buf=audioCtx.createBuffer(1,audioCtx.sampleRate*2,audioCtx.sampleRate),d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*.15;const filter=audioCtx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=850;const g=audioCtx.createGain();g.gain.value=.04;n.buffer=buf;n.loop=true;n.connect(filter);filter.connect(g);g.connect(audioCtx.destination);n.start();rainAudio={n,g};}catch(e){}}else{if(rainAudio){try{rainAudio.n.stop()}catch(e){}rainAudio=null}say('hujannya sudah reda ☀️')}}
 // Add weather toggle to controls.
 const controls=pet.querySelector('.pet-controls');if(controls&&!document.getElementById('petWeather')){const b=document.createElement('button');b.id='petWeather';b.title='Cuaca hujan';b.textContent='🌧️';b.addEventListener('click',toggleRain);controls.appendChild(b)}
 // New notes make the pet react with tiny hearts.
 document.addEventListener('click',e=>{if(e.target.closest('#saveNoteBtn, #noteSaveBtn, .save-note, #editorSaveBtn')){setAnim('wake',1000);hearts();say('ada kenangan baru! 💌')} });
 try{buildCat();animate(0)}catch(e){console.error('3D pet failed; fallback to original pet CSS:',e);say('model 3D belum bisa dimuat di browser ini')}
})();

/* Shared Polaroid album: room-scoped rows + Supabase Storage. */
(() => {
 const grid=document.getElementById('albumGrid'),input=document.getElementById('albumPhotoInput'),status=document.getElementById('albumStatus');if(!grid||!input)return;
 const light=document.getElementById('albumLightbox'),large=document.getElementById('albumLarge'),caption=document.getElementById('albumCaption');let channel=null;
 const noteStatus=m=>{status.textContent=m};
 function showLight(url,cap){large.src=url;caption.textContent=cap||'Kenangan kita ♡';light.classList.remove('hidden')}
 document.getElementById('albumClose').onclick=()=>light.classList.add('hidden');light.addEventListener('click',e=>{if(e.target===light)light.classList.add('hidden')});
 async function loadAlbum(){if(!sb||!activeRoomId){noteStatus('Buat atau gabung room mading untuk memakai album bersama.');grid.innerHTML='';return}try{const {data,error}=await sb.from('pet_album_photos').select('*').eq('room_id',activeRoomId).order('created_at',{ascending:false});if(error)throw error;grid.innerHTML='';for(const row of data||[]){const card=document.createElement('button');card.className='album-polaroid';card.style.setProperty('--tilt',(Math.random()*5-2.5)+'deg');card.type='button';const img=document.createElement('img');img.src=row.photo_url;img.alt=row.caption||'Foto kenangan';const cap=document.createElement('span');cap.textContent=row.caption||'momen kita ♡';card.append(img,cap);card.onclick=()=>showLight(row.photo_url,row.caption);grid.appendChild(card)}noteStatus((data?.length||0)+' foto tersimpan di album room kita ♡')}catch(e){console.error(e);noteStatus('Aktifkan tabel album dengan menjalankan PET-ALBUM.sql di Supabase.')}}
 input.addEventListener('change',async()=>{if(!input.files?.length)return;if(!sb||!activeRoomId){noteStatus('Buat atau gabung room mading dulu sebelum upload.');input.value='';return}const files=[...input.files].filter(f=>f.type.startsWith('image/')).slice(0,12);for(const file of files){try{const ext=(file.name.split('.').pop()||'jpg').replace(/[^a-z0-9]/gi,'').toLowerCase();const path=`${activeRoomId}/${crypto.randomUUID()}.${ext}`;noteStatus('Mengunggah '+file.name+'…');const up=await sb.storage.from('pet-album').upload(path,file,{contentType:file.type,upsert:false});if(up.error)throw up.error;const pub=sb.storage.from('pet-album').getPublicUrl(path).data.publicUrl;const ins=await sb.from('pet_album_photos').insert({room_id:activeRoomId,photo_url:pub,storage_path:path,caption:file.name.replace(/\.[^.]+$/,'').slice(0,80)});if(ins.error)throw ins.error;}catch(e){console.error(e);noteStatus('Upload gagal: '+(e.message||'periksa PET-ALBUM.sql dan Storage'));break}}input.value='';await loadAlbum()});
 document.addEventListener('mading-room-ready',()=>{loadAlbum();if(channel&&sb)sb.removeChannel(channel);if(sb&&activeRoomId){channel=sb.channel('pet-album-'+activeRoomId).on('postgres_changes',{event:'*',schema:'public',table:'pet_album_photos',filter:`room_id=eq.${activeRoomId}`},loadAlbum).subscribe()}});
 if(typeof activeRoomId!=='undefined'&&activeRoomId)setTimeout(loadAlbum,1800);
})();
