'use strict';
/* Media and radio are opt-in. Only the user can enable camera/mic. */
(() => {
  const byId=id=>document.getElementById(id);
  const send=(name,data)=>new Promise((resolve,reject)=>socket.timeout(9500).emit(name,data,(err,ack)=>err||!ack?.ok?reject(Error(ack?.error||'Connection unavailable')):resolve(ack)));
  let cameraStream=null,recorder=null,recordClock=null,recordStop=null,objectUrl=null;
  let captureNonce=0,chosenKind='photo',facing='environment',captured=null;
  const maxPhoto=1100000,maxVideo=2200000;
  const startedAt=()=>new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  const displayCapture=(text)=>{byId('captureStatus').textContent=text};
  function clearClips(){
    if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=null;}
    byId('photoPreview').hidden=true;
    byId('photoPreview').removeAttribute('src');
    byId('clipPreview').pause();byId('clipPreview').removeAttribute('src');byId('clipPreview').load();byId('clipPreview').hidden=true;
    captured=null;
    byId('sendMediaChat').disabled=true;byId('sendMediaMap').disabled=true;byId('retakeMedia').disabled=true;
  }
  function stopCamera(){
    if(cameraStream){cameraStream.getTracks().forEach(t=>t.stop());cameraStream=null;}
    byId('cameraPreview').srcObject=null;
  }
  function cancelRecorder(){
    clearTimeout(recordStop);clearInterval(recordClock);recordStop=recordClock=null;
    if(recorder&&recorder.state!=='inactive')try{recorder.stop()}catch{}
    recorder=null;
    byId('stopRecording').hidden=true;
    byId('startRecording').hidden=false;
  }
  function closeCamera(){
    captureNonce++;
    cancelRecorder();stopCamera();clearClips();
    byId('captureOverlay').hidden=true;
  }
  async function openStream(){
    const nonce=++captureNonce;
    stopCamera();
    displayCapture('CAMERA PERMISSION REQUESTED');
    const video={width:{ideal:640},height:{ideal:480},frameRate:{ideal:15},facingMode:{ideal:facing}};
    let stream;
    try{stream=await navigator.mediaDevices.getUserMedia({video,audio:chosenKind==='video'?{echoCancellation:true,noiseSuppression:true}:false})}
    catch(e){
      if(chosenKind==='video'){
        // Some phones permit the camera but not the microphone.
        try{stream=await navigator.mediaDevices.getUserMedia({video,audio:false});toast('Microphone unavailable: recording video without sound.');}
        catch(e2){throw e2}
      }else throw e;
    }
    if(nonce!==captureNonce||byId('captureOverlay').hidden){stream.getTracks().forEach(t=>t.stop());return;}
    cameraStream=stream;
    const preview=byId('cameraPreview');preview.hidden=false;preview.srcObject=stream;
    await preview.play().catch(()=>{});
    displayCapture(`${chosenKind.toUpperCase()} / ${facing==='environment'?'REAR':'FRONT'} CAMERA READY`);
  }
  async function openCamera(kind){
    if(!state.joined){toast('Join the field room first.');return;}
    if(!navigator.mediaDevices?.getUserMedia){toast('Browser camera requires HTTPS, a compatible browser, and permission.');return;}
    chosenKind=kind;facing='environment';
    byId('captureTitle').textContent=kind==='photo'?'BROWSER PHOTO':'BROWSER VIDEO';
    byId('captureOverlay').hidden=false;clearClips();
    byId('cameraPreview').hidden=false;
    byId('capturePhotoBtn').hidden=kind!=='photo';
    byId('startRecording').hidden=kind!=='video';
    byId('stopRecording').hidden=true;
    displayCapture('OPENING CAMERA');
    try{await openStream()}catch(e){displayCapture('CAMERA UNAVAILABLE');toast(`Cannot open camera: ${e.message}`)}
  }
  function onCaptured(data){
    captured=data;stopCamera();byId('cameraPreview').hidden=true;
    byId('sendMediaChat').disabled=false;byId('sendMediaMap').disabled=false;byId('retakeMedia').disabled=false;
    displayCapture(`${data.kind.toUpperCase()} READY / ${(data.data.length/1024).toFixed(0)} KB ENCODED`);
  }
  function takePhoto(){
    if(!cameraStream||chosenKind!=='photo')return toast('Open the photo camera first.');
    const v=byId('cameraPreview');
    if(!v.videoWidth)return toast('Camera is still starting.');
    const canvas=document.createElement('canvas');
    const ratio=Math.min(1,960/v.videoWidth);canvas.width=Math.round(v.videoWidth*ratio);canvas.height=Math.round(v.videoHeight*ratio);
    canvas.getContext('2d',{alpha:false}).drawImage(v,0,0,canvas.width,canvas.height);
    const data=canvas.toDataURL('image/jpeg',.7);
    if(data.length>maxPhoto*4/3+100)return toast('Photo too large. Move closer and try again.');
    byId('photoPreview').src=data;byId('photoPreview').hidden=false;
    onCaptured({kind:'photo',mime:'image/jpeg',data});
  }
  function supportedMime(){
    if(!window.MediaRecorder)return '';
    const variants=['video/webm;codecs=vp8,opus','video/webm','video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4'];
    return variants.find(v=>MediaRecorder.isTypeSupported(v))||'';
  }
  function readBlob(b){return new Promise((resolve,reject)=>{const r=new FileReader();r.onerror=()=>reject(Error('Could not read recording.'));r.onload=()=>resolve(r.result);r.readAsDataURL(b)})}
  function startRecording(){
    if(!cameraStream)return toast('Open the video camera first.');
    if(recorder?.state==='recording')return;
    const mime=supportedMime();
    if(!mime)return toast('This browser does not support in-browser video recording.');
    let rec;
    try{rec=new MediaRecorder(cameraStream,{mimeType:mime,videoBitsPerSecond:360000,audioBitsPerSecond:48000})}
    catch(e){toast(`Recording unavailable: ${e.message}`);return}
    const nonce=captureNonce;
    const chunks=[];recorder=rec;const begin=Date.now();
    rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
    rec.onerror=()=>{toast('Video recorder error.');stopRecording()};
    rec.onstop=async()=>{
      clearInterval(recordClock);clearTimeout(recordStop);recordClock=recordStop=null;
      byId('stopRecording').hidden=true;byId('startRecording').hidden=false;
      if(nonce!==captureNonce)return;
      const mime2=(rec.mimeType||mime).split(';')[0];
      const clip=new Blob(chunks,{type:mime2});
      if(clip.size>maxVideo)return displayCapture('VIDEO TOO LARGE / RETAKE AT LOWER QUALITY');
      if(clip.size<64)return displayCapture('EMPTY VIDEO / RETAKE');
      try{
        const data=await readBlob(clip);
        if(nonce!==captureNonce)return;
        objectUrl=URL.createObjectURL(clip);
        byId('clipPreview').src=objectUrl;byId('clipPreview').hidden=false;
        onCaptured({kind:'video',mime:mime2,data});
      }catch(e){toast(e.message)}
    };
    try{rec.start(250)}catch(e){return toast(`Video start failed: ${e.message}`)}
    byId('startRecording').hidden=true;byId('stopRecording').hidden=false;
    displayCapture('REC ● 0.0 / 8.0 SECONDS');
    recordClock=setInterval(()=>{displayCapture(`REC ● ${Math.min(8,(Date.now()-begin)/1000).toFixed(1)} / 8.0 SECONDS`)},250);
    recordStop=setTimeout(stopRecording,8000);
  }
  function stopRecording(){
    if(recorder?.state==='recording'){
      clearTimeout(recordStop);recordStop=null;
      try{recorder.stop()}catch(e){toast(e.message)}
    }
  }
  async function retake(){
    if(!byId('captureOverlay').hidden){clearClips();
      byId('cameraPreview').hidden=false;
      try{await openStream()}catch(e){toast(e.message)}
    }
  }
  async function sendChat(){
    if(!captured)return;
    const b=byId('sendMediaChat');b.disabled=true;displayCapture('SHARING TO ROOM…');
    try{await send('border:media',captured);toast('Photo/video sent to field chat.');closeCamera();}
    catch(e){toast(e.message);b.disabled=false;displayCapture('SEND FAILED / RETRY')}
  }
  function placeOnMap(){
    if(!captured)return;
    // Retain the selected media until the user places their map marker.
    pendingMedia=captured;
    captureNonce++;cancelRecorder();stopCamera();byId('captureOverlay').hidden=true;
    setMode('media');
    byId('mapViewport').scrollIntoView({behavior:'smooth',block:'center'});
    toast('Tap a fictional map location for the photo/video report.');
  }
  let pendingMedia=null;
  const pending=()=>pendingMedia;
  const clearPending=()=>{pendingMedia=null;clearClips()};
  
  // Browser-based, permission-controlled live push-to-talk audio via WebRTC.
  let audioContext=null,hasEnabledAudio=false;
  let localTalk=null,pressed=false,starting=false,transmitting=false,radioActive=null,radioWatchdog=null;
  const outbound=new Map(),inbound=new Map(),remoteSources=new Map(),iceQueue=new Map();
  const rtcCfg={iceServers:[{urls:'stun:stun.l.google.com:19302'}]};
  const tone=text=>{byId('radioStatus').textContent=text};
  async function enableAudio(){
    try{
      if(!window.AudioContext&&!window.webkitAudioContext)throw Error('Audio playback not supported');
      if(!audioContext)audioContext=new (window.AudioContext||window.webkitAudioContext)();
      await audioContext.resume();hasEnabledAudio=true;
      byId('enableAudio').textContent='SPEAKER ENABLED';
      toast('Radio speaker enabled.');
    }catch(e){toast('Tap ENABLE SPEAKER again: '+e.message)}
  }
  function closePeer(pc){try{pc?.close()}catch{}}
  function closeRadioPeers(){
    for(const p of outbound.values())closePeer(p);
    for(const p of inbound.values())closePeer(p);
    outbound.clear();inbound.clear();iceQueue.clear();
    for(const n of remoteSources.values())try{n.disconnect()}catch{}
    remoteSources.clear();
  }
  function stopLocalAudio(){
    if(localTalk){localTalk.getTracks().forEach(t=>t.stop());localTalk=null;}
  }
  const signal=(to,type,signal)=>socket.emit('border:radio:signal',{to,type,signal},()=>{});
  function radioUI(){
    byId('radioTalk').classList.toggle('transmitting',transmitting);
    byId('radioTalk').textContent=transmitting?'TRANSMITTING / RELEASE TO STOP':'HOLD TO TALK';
    if(transmitting)tone('ON AIR / YOU');
    else if(radioActive?.active)tone(`ON AIR / ${radioActive.name}`);
    else tone('IDLE');
  }
  async function stopTalk(){
    pressed=false;
    clearTimeout(radioWatchdog);radioWatchdog=null;
    if(transmitting){transmitting=false;socket.emit('border:radio:stop',{},()=>{})}
    starting=false;stopLocalAudio();
    for(const pc of outbound.values())closePeer(pc);outbound.clear();
    radioUI();
  }
  async function startTalk(){
    if(!state.joined)return toast('Join the field room first.');
    if(!socket.connected)return toast('Not connected to field room.');
    if(transmitting||starting)return;
    if(radioActive?.active&&radioActive.id!==state.id)return toast(`Radio busy: ${radioActive.name}`);
    if(!navigator.mediaDevices?.getUserMedia||!window.RTCPeerConnection)return toast('Radio needs HTTPS and WebRTC support.');
    pressed=true;starting=true;tone('REQUESTING MICROPHONE');
    try{
      localTalk=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
      if(!pressed){stopLocalAudio();starting=false;radioUI();return}
      const reply=await send('border:radio:start',{});
      if(!pressed){socket.emit('border:radio:stop',{},()=>{});stopLocalAudio();starting=false;radioUI();return}
      transmitting=true;starting=false;radioActive={active:true,id:state.id,name:state.name};radioUI();
      radioWatchdog=setTimeout(()=>stopTalk(),29000);
      const others=(reply.roster||[]).filter(u=>u.id!==state.id);
      await Promise.all(others.map(async u=>{
        if(!transmitting)return;
        const pc=new RTCPeerConnection(rtcCfg);outbound.set(u.id,pc);
        for(const track of localTalk.getTracks())pc.addTrack(track,localTalk);
        pc.onicecandidate=e=>{if(e.candidate&&transmitting)signal(u.id,'ice',{candidate:e.candidate.toJSON()})};
        const offer=await pc.createOffer();await pc.setLocalDescription(offer);
        if(transmitting)signal(u.id,'offer',{sdp:pc.localDescription});
      }));
    }catch(e){toast(`Radio unavailable: ${e.message}`);await stopTalk()}
  }
  async function applyCandidates(peer,from){
    const list=iceQueue.get(from)||[];iceQueue.delete(from);
    for(const c of list)try{await peer.addIceCandidate(c)}catch{}
  }
  async function onSignal(d){
    if(!state.joined||!d||d.from===state.id)return;
    if(d.type==='ice'){
      if(!d.signal?.candidate)return;
      const pc=inbound.get(d.from)||outbound.get(d.from);
      if(pc?.remoteDescription){try{await pc.addIceCandidate(d.signal.candidate)}catch{}}
      else{const list=iceQueue.get(d.from)||[];list.push(d.signal.candidate);if(list.length>40)list.shift();iceQueue.set(d.from,list)}
      return;
    }
    if(d.type==='offer'){
      if(!radioActive?.active||radioActive.id!==d.from||!window.RTCPeerConnection)return;
      if(!hasEnabledAudio){byId('enableAudio').textContent='TAP TO HEAR RADIO';}
      const old=inbound.get(d.from);if(old)closePeer(old);
      const pc=new RTCPeerConnection(rtcCfg);inbound.set(d.from,pc);
      pc.addTransceiver('audio',{direction:'recvonly'});
      pc.onicecandidate=e=>{if(e.candidate)signal(d.from,'ice',{candidate:e.candidate.toJSON()})};
      pc.ontrack=async e=>{
        const media=e.streams[0]||new MediaStream([e.track]);
        if(!audioContext)try{audioContext=new (window.AudioContext||window.webkitAudioContext)()}catch{}
        if(audioContext){
          try{const n=audioContext.createMediaStreamSource(media);remoteSources.get(d.from)?.disconnect();n.connect(audioContext.destination);remoteSources.set(d.from,n);await audioContext.resume()}catch{byId('enableAudio').textContent='TAP TO HEAR RADIO'}
        }
      };
      try{await pc.setRemoteDescription(d.signal?.sdp);await applyCandidates(pc,d.from);const answer=await pc.createAnswer();await pc.setLocalDescription(answer);signal(d.from,'answer',{sdp:pc.localDescription})}catch(e){toast('Radio link issue: '+e.message)}
    }
    if(d.type==='answer'){
      const pc=outbound.get(d.from);if(!pc||!transmitting)return;
      try{await pc.setRemoteDescription(d.signal?.sdp);await applyCandidates(pc,d.from)}catch{}
    }
  }
  function onRadioState(d){
    radioActive=d||{active:false};
    if(!radioActive.active){
      if(transmitting||starting)stopTalk();
      closeRadioPeers();
    }
    radioUI();
  }
  function bindPTT(){
    const button=byId('radioTalk');
    button.addEventListener('pointerdown',e=>{if(e.button!==0&&e.pointerType==='mouse')return;e.preventDefault();try{button.setPointerCapture(e.pointerId)}catch{};startTalk()});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>{if(pressed||transmitting)stopTalk()});
    button.addEventListener('contextmenu',e=>e.preventDefault());
    button.addEventListener('keydown',e=>{if([' ','Enter'].includes(e.key)&&!e.repeat){e.preventDefault();startTalk()}});
    button.addEventListener('keyup',e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();stopTalk()}});
    byId('enableAudio').addEventListener('click',enableAudio);
    // Join and Send are user-initiated interactions suitable for audio-unlocking.
    byId('joinBtn').addEventListener('click',()=>{
      if(!audioContext&&(window.AudioContext||window.webkitAudioContext)){
        try{audioContext=new(window.AudioContext||window.webkitAudioContext)();audioContext.resume().then(()=>{hasEnabledAudio=true;byId('enableAudio').textContent='SPEAKER ENABLED'}).catch(()=>{})}catch{}
      }
    });
    socket.on('border:radio:state',onRadioState);
    socket.on('border:radio:signal',d=>{onSignal(d).catch(()=>{})});
    socket.on('disconnect',()=>{stopTalk();closeRadioPeers();radioActive=null;radioUI()});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)stopTalk()});
    window.addEventListener('pagehide',()=>{stopTalk();closeCamera()});
  }
  function init(){
    byId('takePhoto').addEventListener('click',()=>openCamera('photo'));
    byId('recordVideo').addEventListener('click',()=>openCamera('video'));
    byId('captureClose').addEventListener('click',closeCamera);
    byId('captureOverlay').addEventListener('click',e=>{if(e.target===e.currentTarget)closeCamera()});
    byId('flipCamera').addEventListener('click',async()=>{
      if(recorder?.state==='recording')return toast('Stop recording before switching cameras.');
      facing=facing==='environment'?'user':'environment';clearClips();try{await openStream()}catch(e){toast(e.message)}
    });
    byId('capturePhotoBtn').addEventListener('click',takePhoto);
    byId('startRecording').addEventListener('click',startRecording);
    byId('stopRecording').addEventListener('click',stopRecording);
    byId('sendMediaChat').addEventListener('click',sendChat);
    byId('sendMediaMap').addEventListener('click',placeOnMap);
    byId('retakeMedia').addEventListener('click',retake);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!byId('captureOverlay').hidden)closeCamera()});
    bindPTT();
  }
  window.BCMedia={init,pending,clearPending,onRadioState};
  init();
})();
