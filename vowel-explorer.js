// Data-driven vowel explorer. Absolute timestamps extracted from the source WAV using Praat/Burg.
const DATA='data/formants_timestamped_drukmo.csv';
const AUDIO='audio/22050_norm/F-Bud-Green_Tara_mantra-Drukmo_Gyal.wav';
let frames=[], audio=null, panel=null, canvas=null, ctx=null, visible=false, selected=null;
let segments=[], playing=false, playIndex=0, playbackTimer=null;
const P={left:49,right:19,top:39,bottom:43};
const R={f1min:150,f1max:1150,f2min:400,f2max:3200};
const W=460,H=350;
const x=f2=>P.left+(R.f2max-f2)/(R.f2max-R.f2min)*(W-P.left-P.right);
const y=f1=>P.top+(f1-R.f1min)/(R.f1max-R.f1min)*(H-P.top-P.bottom);
const fromX=xx=>R.f2max-(xx-P.left)/(W-P.left-P.right)*(R.f2max-R.f2min);
const fromY=yy=>R.f1min+(yy-P.top)/(H-P.top-P.bottom)*(R.f1max-R.f1min);
export function initVowelExplorer(){
 panel=document.createElement('section');panel.id='vowel-explorer';panel.setAttribute('aria-label','Vowel resonance listening explorer');
 panel.innerHTML=
    `  <div class="vowel-top">
    <strong>VOWEL RESONANCE MAP</strong>
    <span>DRUKMO GYAL · GREEN TARA</span>
  </div>

  <div class="vowel-explanation">
    <p>
      <strong>What is a formant?</strong><br>
      A formant is a resonant frequency of the vocal tract.
      As we chant or speak, the tongue, jaw, and lips reshape
      the mouth and throat, amplifying different frequencies.
      These resonances help distinguish vowel sounds.
    </p>

    <p>
      <strong>F1 — Tongue height / Vowel openness</strong><br>
      The first formant is associated with tongue height.
      Higher F1 generally corresponds to a lower tongue
      position and a more open vowel.
    </p>

    <p>
      <strong>F2 — Tongue frontness / Backness</strong><br>
      The second formant is associated with the tongue's
      front-to-back position.
      Higher F2 generally corresponds to a more forward
      tongue position.
    </p>

    <p>
      <strong>Reading the map:</strong><br>
      Moving downward: higher F1, more open vowels.<br>
      Moving leftward: higher F2, more front vowels.
    </p>
  </div>

  <p class="vowel-instruction">
    Each point represents a measured moment in the chant.
    Drag across a region to hear corresponding passages.
  </p>

  <canvas
    width="460"
    height="350"
    aria-label="F1–F2 vowel resonance scatterplot; drag to select">
  </canvas>

  <div class="vowel-bottom">
    <button id="vowel-full" type="button">▶ Full chant</button>
    <button id="vowel-stop" type="button">■ Stop</button>
    <span id="vowel-status" aria-live="polite">
      Loading measurements…
    </span>
  </div>

  <p class="vowel-note">
    F1 and F2 are acoustic measurements in Hz,
    not direct measurements of tongue position.
  </p>`;
 document.body.append(panel);canvas=panel.querySelector('canvas');ctx=canvas.getContext('2d');
 audio=new Audio(AUDIO);audio.preload='auto';
 panel.querySelector('#vowel-full').addEventListener('click',()=>{stop();audio.currentTime=0;audio.play().then(()=>status('Playing complete chant')).catch(()=>status('Audio playback unavailable'));});
 panel.querySelector('#vowel-stop').addEventListener('click',stop);
 let drag=null;
 const pos=e=>{let r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height}};
 canvas.addEventListener('pointerdown',e=>{let p=pos(e);drag={a:p,b:p};canvas.setPointerCapture(e.pointerId);stop();draw(drag)});
 canvas.addEventListener('pointermove',e=>{if(!drag)return;drag.b=pos(e);draw(drag)});
 canvas.addEventListener('pointerup',e=>{if(!drag)return;drag.b=pos(e);let a=drag.a,b=drag.b;drag=null;if(Math.abs(a.x-b.x)<7||Math.abs(a.y-b.y)<7){draw();return}selected={f1min:Math.min(fromY(a.y),fromY(b.y)),f1max:Math.max(fromY(a.y),fromY(b.y)),f2min:Math.min(fromX(a.x),fromX(b.x)),f2max:Math.max(fromX(a.x),fromX(b.x))};draw();playSelection()});
 fetch(DATA).then(r=>{if(!r.ok)throw Error('Data missing');return r.text()}).then(t=>{frames=t.trim().split(/\r?\n/).slice(1).map(s=>s.split(',').map(Number)).filter(r=>r.length===3&&r.every(Number.isFinite));status(`${frames.length} timestamped measurements · select a region`);draw()}).catch(e=>status(e.message));draw();
}
function status(s){if(panel)panel.querySelector('#vowel-status').textContent=s}
export function setVowelExplorerVisible(v){visible=v;if(panel)panel.classList.toggle('visible',v);if(!v)stop()}
function stop(){if(playbackTimer){clearTimeout(playbackTimer);playbackTimer=null}playing=false;if(audio){audio.pause()}if(panel&&frames.length)status('Stopped · drag to explore')}
function draw(drag){if(!ctx)return;ctx.clearRect(0,0,W,H);ctx.fillStyle='#10151c';ctx.fillRect(0,0,W,H);ctx.strokeStyle='#43505a';ctx.strokeRect(P.left,P.top,W-P.left-P.right,H-P.top-P.bottom);
 ctx.fillStyle='#d8b97b';ctx.font='12px monospace';ctx.fillText('FRONT  ·  F2 resonance (Hz)  ·  BACK',P.left,20);ctx.fillText('CLOSED',3,P.top-11);ctx.fillText('OPEN',7,H-13);
 for(let i=0;i<=4;i++){let xx=P.left+i*(W-P.left-P.right)/4;ctx.fillStyle='#89949d';ctx.fillText(String(Math.round(fromX(xx))),xx-16,H-22)}
 for(const [t,f1,f2] of frames){let isSel=selected&&f1>=selected.f1min&&f1<=selected.f1max&&f2>=selected.f2min&&f2<=selected.f2max;ctx.fillStyle=isSel?'rgba(234,188,100,.9)':'rgba(142,207,216,.27)';ctx.beginPath();ctx.arc(x(f2),y(f1),isSel?2.8:1.8,0,Math.PI*2);ctx.fill()}
 let rect=drag?{x1:drag.a.x,x2:drag.b.x,y1:drag.a.y,y2:drag.b.y}:selected?{x1:x(selected.f2max),x2:x(selected.f2min),y1:y(selected.f1min),y2:y(selected.f1max)}:null;
 if(rect){let xx=Math.min(rect.x1,rect.x2),yy=Math.min(rect.y1,rect.y2);ctx.strokeStyle='#eabc64';ctx.lineWidth=2;ctx.strokeRect(xx,yy,Math.abs(rect.x2-rect.x1),Math.abs(rect.y2-rect.y1))}
}
function playSelection(){if(!selected||!frames.length)return;
 const hits=frames.filter(([t,f1,f2])=>f1>=selected.f1min&&f1<=selected.f1max&&f2>=selected.f2min&&f2<=selected.f2max);
 if(!hits.length){status('No measurements in selected region');return}
 // Group measurements using their ACTUAL timestamps, never filtered-row indices.
 let runs=[],cur=[];for(let i=0;i<hits.length;i++){let h=hits[i];if(cur.length&&h[0]-cur[cur.length-1][0]>.12){runs.push(cur);cur=[]}cur.push(h)}if(cur.length)runs.push(cur);
 // Require at least 3 matching frames in a run, then add context to form listenable excerpts.
 segments=runs.filter(r=>r.length>=3).map(r=>{let mid=(r[0][0]+r[r.length-1][0])/2;let dur=Math.min(1.8,Math.max(.65,r[r.length-1][0]-r[0][0]+.35));return {start:Math.max(0,mid-dur/2),end:Math.min(audio.duration||30.33,mid+dur/2),count:r.length}}).sort((a,b)=>b.count-a.count).slice(0,5);
 if(!segments.length){status(`${hits.length} matches, but no sustained region; select a larger area`);return}
 playIndex=0;playing=true;status(`${hits.length} matches · playing ${segments.length} excerpts`);playNext();
}
function playNext(){if(!playing||playIndex>=segments.length){playing=false;status('Finished · select another region');return}let seg=segments[playIndex++];audio.pause();audio.currentTime=seg.start;audio.play().then(()=>{playbackTimer=setTimeout(()=>{audio.pause();playbackTimer=setTimeout(playNext,180)},Math.max(100,(seg.end-seg.start)*1000))}).catch(()=>{playing=false;status('Playback blocked; click again')})}
