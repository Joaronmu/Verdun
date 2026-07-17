const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const ui = {
  intro: document.querySelector('#intro'), end: document.querySelector('#end'), start: document.querySelector('#startButton'), restart: document.querySelector('#restartButton'),
  view: document.querySelector('#viewButton'), health: document.querySelector('#healthFill'), healthText: document.querySelector('#healthText'), ammo: document.querySelector('#ammoText'),
  capture: document.querySelector('#captureFill'), objective: document.querySelector('#objectiveText'), status: document.querySelector('#statusText'), flash: document.querySelector('#hitFlash'), guide: document.querySelector('#guideText'),
  endKicker: document.querySelector('#endKicker'), endTitle: document.querySelector('#endTitle'), endText: document.querySelector('#endText'), joystick: document.querySelector('#joystick'), stick: document.querySelector('#stick'), fire: document.querySelector('#fireButton'), reload: document.querySelector('#reloadButton')
};
const bg = new Image(); bg.src = 'assets/fort-vaux-gallery.png';
const french = new Image(); french.src = 'assets/french-poilu.png';
const frenchRear = new Image(); frenchRear.src = 'assets/french-poilu-rear.png';
const german = new Image(); german.src = 'assets/german-infantry.png';
const germanFiring = new Image(); germanFiring.src = 'assets/german-firing.png';
const keys = {}; let w=0,h=0,dpr=1,last=0, running=false, end=false, shotAt=0, reloading=false;
let view='first', player, enemies, capture, phase, hold, hasMoved, locomotion=0, tracers=[], threats=[], enemyVolleyUntil=0, aim={x:0,y:0,active:false}, move={x:0,y:0}, joyId=null;

function reset(){
  player={x:.5,y:.78,health:100,ammo:5,reserve:25,kills:0}; capture=0; phase=1; hold=0; hasMoved=false; view='first'; end=false; reloading=false;
  tracers=[]; threats=[]; enemyVolleyUntil=0; enemies=[{x:.27,y:.34,h:100,dead:false,phase:0},{x:.68,y:.24,h:100,dead:false,phase:1.3},{x:.78,y:.55,h:100,dead:false,phase:2.5},{x:.36,y:.57,h:100,dead:false,phase:3.8}];
  ui.view.textContent='第一人称'; ui.objective.textContent='01 · 夺回弹药库'; ui.status.textContent='任务一：占领甬道尽头的弹药库。'; sync();
}
function fit(){dpr=Math.min(devicePixelRatio||1,2);w=innerWidth;h=innerHeight;canvas.width=w*dpr;canvas.height=h*dpr;canvas.style.width=w+'px';canvas.style.height=h+'px';aim.x=w/2;aim.y=h/2;ctx.setTransform(dpr,0,0,dpr,0,0)}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))} function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function sync(){ui.health.style.width=player.health+'%';ui.healthText.textContent=Math.ceil(player.health);ui.ammo.textContent=player.ammo;ui.capture.style.width=Math.min(100,capture)+'%'}
function setStatus(text){ui.status.textContent=text}
function start(){reset();running=true;ui.intro.classList.add('is-hidden');ui.end.classList.add('is-hidden');last=performance.now();requestAnimationFrame(loop)}
function finish(win){running=false;end=true;ui.endKicker.textContent=win?'任务完成':'防线失守';ui.endTitle.textContent=win?'沃堡暂时守住':'你倒在了沃堡甬道';ui.endText.textContent=win?`你击退了 ${player.kills} 名敌军，并夺回弹药库。`: `仍有 ${enemies.filter(e=>!e.dead).length} 名敌军在堡垒内活动。`;ui.end.classList.remove('is-hidden')}
function loop(now){if(!running)return;const dt=Math.min(.04,(now-last)/1000);last=now;update(dt,now);draw(now);requestAnimationFrame(loop)}
function update(dt,now){
  let dx=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0)+move.x;
  let dy=(keys.KeyS||keys.ArrowDown?1:0)-(keys.KeyW||keys.ArrowUp?1:0)+move.y; const len=Math.hypot(dx,dy)||1; const speed=.19*dt;
  locomotion=Math.abs(dx)+Math.abs(dy)>.08?1:0; if(locomotion)hasMoved=true;
  player.x=clamp(player.x+dx/len*speed,.08,.92);player.y=clamp(player.y+dy/len*speed,.10,.92);
  const point=phase===3?{x:.5,y:.72}:{x:.5,y:.28}; const near=dist(player,point)<.13;
  if(phase===1){
    ui.guide.textContent=!hasMoved?'第一步：用 W/A/S/D 或左下摇杆向金色圆环移动。':!near?'继续前进：小地图蓝点是你，金点是弹药库。':'站在金色圆环内，等待进度条走满。';
    if(near && enemies.filter(e=>!e.dead).length<3){capture=Math.min(100,capture+dt*27);setStatus(capture<100?'正在夺回弹药库……':'弹药库已夺回！');} else if(capture>0&&!near) capture=Math.max(0,capture-dt*7);
    if(capture>=100){phase=2;capture=0;ui.objective.textContent='02 · 肃清西侧甬道';setStatus('任务二：清除堡垒内所有敌军。')}
  } else if(phase===2) {
    const left=enemies.filter(e=>!e.dead).length; ui.objective.textContent=`02 · 肃清西侧甬道（${left}）`; ui.guide.textContent='第二步：瞄准敌军，点击或按右下角“射击”。';
    if(left===0){phase=3;capture=0;hold=0;enemies=[{x:.2,y:.25,h:100,dead:false,phase:1},{x:.8,y:.30,h:100,dead:false,phase:2.2},{x:.68,y:.12,h:100,dead:false,phase:3.4}];ui.objective.textContent='03 · 守住最后铁门';setStatus('任务三：退回铁门，坚持 12 秒。')}
  } else {
    ui.guide.textContent=near?'第三步：留在金色圆环内，守住铁门。':'回到金色圆环，开始坚守最后铁门。';
    if(near){hold=Math.min(12,hold+dt);capture=hold/12*100;setStatus(`坚守铁门：${Math.ceil(12-hold)} 秒`)} else if(hold>0){hold=Math.max(0,hold-dt*.45);capture=hold/12*100}
    if(hold>=12){finish(true);return}
  }
  enemies.filter(e=>!e.dead).forEach(e=>{e.phase+=dt;let d=dist(player,e); if(d>.22){e.x+=(player.x-e.x)*dt*.018;e.y+=(player.y-e.y)*dt*.018;} if(d<.40 && now>(e.nextShot||0) && now>enemyVolleyUntil)enemyFire(e,now)});
  tracers.forEach(t=>t.life-=dt);tracers=tracers.filter(t=>t.life>0);
  threats.forEach(t=>t.life-=dt);threats=threats.filter(t=>t.life>0);
  if(player.health<=0)finish(false); sync();
}
function damage(n){player.health=Math.max(0,player.health-n);ui.flash.style.opacity='.9';setTimeout(()=>ui.flash.style.opacity='0',80)}
function enemyFire(e,now){enemyVolleyUntil=now+1450+Math.random()*700;e.nextShot=now+1700+Math.random()*900;e.firingUntil=now+150;const p=worldToScreen(e.x,e.y),size=clamp(62+(e.y-player.y)*190,58,180);const from={x:p.x+size*.06,y:p.y-size*.83};const hit=Math.random()<.14;const to={x:w*.5+(Math.random()-.5)*(hit?36:330),y:h*.58+(Math.random()-.5)*(hit?36:230)};tracers.push({from,to,life:.28,max:.28,hit});threats.push({angle:Math.atan2((e.y-player.y)*.7,e.x-player.x),life:.9,max:.9});if(hit){damage(6);setStatus('敌军火力压制！移动躲避弹道。')}}
function targetAtAim(){return enemies.filter(e=>!e.dead).map(e=>{const p=worldToScreen(e.x,e.y);const size=clamp(62+(e.y-player.y)*190,58,180);return {e,p,size,d:Math.hypot(p.x-aim.x,p.y-size*.55-aim.y)}}).filter(v=>v.d<v.size*.95).sort((a,b)=>a.d-b.d)[0]?.e||null}
function fire(){if(!running||reloading)return;if(player.ammo<1){setStatus('弹仓已空，正在装填。');reload();return}const now=performance.now();if(now-shotAt<440)return;shotAt=now;player.ammo--;const target=targetAtAim();if(target){target.h-=60;if(target.h<=0){target.dead=true;player.kills++;setStatus('命中，敌军倒下。')}else setStatus('命中敌军。')}else setStatus('未瞄准敌军：移动鼠标，让准星压住敌人后射击。');sync();}
function reload(){if(reloading||player.reserve===0||player.ammo===5)return;reloading=true;setStatus('正在装填勒贝尔步枪……');setTimeout(()=>{let n=Math.min(5-player.ammo,player.reserve);player.ammo+=n;player.reserve-=n;reloading=false;setStatus('装填完成。');sync()},1250)}
function draw(now){
  ctx.clearRect(0,0,w,h); let par=(player.x-.5)*22; if(bg.complete){const s=Math.max(w/bg.width,h/bg.height);const bw=bg.width*s,bh=bg.height*s;ctx.drawImage(bg,(w-bw)/2-par,(h-bh)/2+(player.y-.5)*9,bw,bh)} else {ctx.fillStyle='#171814';ctx.fillRect(0,0,w,h)}
  const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,'rgba(0,0,0,.34)');g.addColorStop(.55,'rgba(0,0,0,.02)');g.addColorStop(1,'rgba(0,0,0,.54)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  const target=phase===3?{x:.5,y:.72}:{x:.5,y:.28}; const point=worldToScreen(target.x,target.y); drawObjective(point,now);
  enemies.filter(e=>!e.dead).sort((a,b)=>a.y-b.y).forEach(e=>drawEnemy(e,now));drawTracers();
  drawMiniMap(); if(phase===1&&!hasMoved)drawArrow(point); if(view==='third')drawPlayer(now);else{drawRifle();drawThreats()}
  if(view==='first'){ctx.fillStyle='rgba(233,218,185,.12)';ctx.fillRect(w/2-1,h/2-1,2,2)}
}
function worldToScreen(x,y){let scale=Math.min(w,h)*1.55;return{x:w/2+(x-player.x)*scale,y:h*.58+(y-player.y)*scale*.7,depth:y}}
function drawObjective(p,now){const pulse=5+Math.sin(now/250)*3;ctx.save();ctx.strokeStyle='rgba(243,203,128,.9)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,16+pulse,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#f0c47d';ctx.beginPath();ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.fill();ctx.font='700 12px Georgia';ctx.textAlign='center';ctx.fillText(phase===1?'弹药库':phase===3?'最后铁门':'西侧甬道',p.x,p.y-32);ctx.restore()}
function drawEnemy(e,now){const p=worldToScreen(e.x,e.y);if(p.y<-90||p.y>h+90)return;let size=clamp(62+(e.y-player.y)*190,58,180),step=Math.sin(now/110+e.phase)*size*.018,recoil=now<(e.firingUntil||0)?-size*.045:0;ctx.save();ctx.translate(p.x+step,p.y+Math.abs(step)*.4);ctx.rotate(step*.006);ctx.fillStyle='rgba(0,0,0,.43)';ctx.beginPath();ctx.ellipse(0,size*.37,size*.31,size*.08,0,0,Math.PI*2);ctx.fill();if(germanFiring.complete)ctx.drawImage(germanFiring,-size*.48,-size*1.28+recoil,size*.96,size*1.58);else if(german.complete)ctx.drawImage(german,-size*.45,-size*1.25,size*.9,size*1.55);ctx.restore();if(now<(e.firingUntil||0)){ctx.save();ctx.fillStyle='#ffd176';ctx.shadowBlur=14;ctx.shadowColor='#f07d2e';ctx.beginPath();ctx.arc(p.x+size*.06,p.y-size*.83,Math.max(4,size*.08),0,Math.PI*2);ctx.fill();ctx.restore()}if(targetAtAim()===e){ctx.save();ctx.strokeStyle='#e3bf72';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y-size*.55,size*.36,0,Math.PI*2);ctx.stroke();ctx.restore()}}
function drawTracers(){tracers.forEach(t=>{const a=t.life/t.max;ctx.save();ctx.globalAlpha=Math.min(1,a*2);ctx.lineWidth=t.hit?3:2;ctx.strokeStyle=t.hit?'#ffba73':'#efd484';ctx.shadowBlur=10;ctx.shadowColor='#f08135';ctx.beginPath();ctx.moveTo(t.from.x,t.from.y);ctx.lineTo(t.to.x,t.to.y);ctx.stroke();ctx.fillStyle='#fff2c0';ctx.beginPath();ctx.arc(t.to.x,t.to.y,t.hit?4:2.5,0,Math.PI*2);ctx.fill();ctx.restore()})}
function drawPlayer(now){const bob=(locomotion?Math.sin(now/85)*8:Math.sin(now/720))*1.4;ctx.save();ctx.translate(w*.5,h*.99+bob);ctx.fillStyle='rgba(0,0,0,.42)';ctx.beginPath();ctx.ellipse(0,4,95,18,0,0,Math.PI*2);ctx.fill();if(frenchRear.complete)ctx.drawImage(frenchRear,-145,-350,290,435);ctx.restore()}
function drawMiniMap(){const x=20,y=92,s=view==='first'?Math.min(142,Math.max(110,w*.16)):Math.min(112,Math.max(84,w*.13));ctx.save();ctx.fillStyle='rgba(8,10,9,.78)';ctx.fillRect(x,y,s,s);ctx.strokeStyle='rgba(232,213,177,.42)';ctx.strokeRect(x,y,s,s);ctx.strokeStyle='rgba(220,201,165,.25)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+s*.18,y);ctx.lineTo(x+s*.18,y+s);ctx.moveTo(x+s*.5,y);ctx.lineTo(x+s*.5,y+s);ctx.moveTo(x+s*.82,y);ctx.lineTo(x+s*.82,y+s);ctx.stroke();const target=phase===3?{x:.5,y:.72}:{x:.5,y:.28};ctx.fillStyle='#e6bb77';ctx.beginPath();ctx.arc(x+target.x*s,y+target.y*s,6,0,Math.PI*2);ctx.fill();ctx.fillStyle='#77c4d9';ctx.beginPath();ctx.arc(x+player.x*s,y+player.y*s,7,0,Math.PI*2);ctx.fill();ctx.fillStyle='#c16452';enemies.filter(e=>!e.dead).forEach(e=>{ctx.fillRect(x+e.x*s-3,y+e.y*s-3,6,6)});ctx.font='700 10px system-ui';ctx.fillStyle='#e6dfcf';ctx.fillText(view==='first'?'战术定位  蓝=我':'沃堡甬道',x+7,y+s-8);ctx.restore()}
function drawThreats(){threats.forEach(t=>{const a=t.life/t.max,r=Math.min(w,h)*.37,x=w*.5+Math.cos(t.angle)*r,y=h*.5+Math.sin(t.angle)*r;ctx.save();ctx.globalAlpha=Math.min(1,a*1.6);ctx.translate(x,y);ctx.rotate(t.angle+Math.PI);ctx.fillStyle='#ee765c';ctx.shadowBlur=11;ctx.shadowColor='#b22d20';ctx.beginPath();ctx.moveTo(19,0);ctx.lineTo(-12,-11);ctx.lineTo(-5,0);ctx.lineTo(-12,11);ctx.closePath();ctx.fill();ctx.restore();ctx.save();ctx.globalAlpha=a;ctx.fillStyle='#ffd2ba';ctx.font='700 11px system-ui';ctx.textAlign='center';ctx.fillText('来弹',x,y-22);ctx.restore()})}
function drawArrow(p){const sx=w*.5,sy=Math.max(h*.62,p.y+105),dx=p.x-sx,dy=p.y-sy,a=Math.atan2(dy,dx);ctx.save();ctx.translate(sx,sy);ctx.rotate(a);ctx.fillStyle='rgba(238,190,106,.92)';ctx.beginPath();ctx.moveTo(35,0);ctx.lineTo(-12,-17);ctx.lineTo(-2,0);ctx.lineTo(-12,17);ctx.closePath();ctx.fill();ctx.restore()}
function drawRifle(){ctx.save();ctx.translate(w*.72,h*.91);ctx.rotate(-.16);ctx.fillStyle='#4a2d1b';ctx.fillRect(-10,-24,w*.34,19);ctx.fillStyle='#1d211e';ctx.fillRect(w*.11,-29,w*.32,8);ctx.fillStyle='#0b0d0c';ctx.fillRect(w*.35,-34,36,17);ctx.restore()}
function toggleView(){view=view==='first'?'third':'first';ui.view.textContent=view==='first'?'第一人称':'第三人称';setStatus(view==='first'?'切换至第一人称。':'切换至第三人称。')}
addEventListener('resize',fit);fit();reset();
addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='Space'){e.preventDefault();fire()}if(e.code==='KeyR')reload();if(e.code==='KeyV')toggleView()});addEventListener('keyup',e=>keys[e.code]=false);
function setAim(e){const r=canvas.getBoundingClientRect();aim.x=clamp(e.clientX-r.left,0,w);aim.y=clamp(e.clientY-r.top,0,h);aim.active=true;const cross=document.querySelector('#crosshair');cross.style.left=aim.x+'px';cross.style.top=aim.y+'px'}
canvas.addEventListener('pointermove',e=>{if(e.pointerType==='mouse')setAim(e)});canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button===0){setAim(e);fire()}});ui.start.onclick=start;ui.restart.onclick=start;ui.view.onclick=toggleView;ui.fire.onclick=fire;ui.reload.onclick=reload;
ui.joystick.addEventListener('pointerdown',e=>{joyId=e.pointerId;ui.joystick.setPointerCapture(e.pointerId);joy(e)});ui.joystick.addEventListener('pointermove',e=>{if(e.pointerId===joyId)joy(e)});ui.joystick.addEventListener('pointerup',()=>{joyId=null;move={x:0,y:0};ui.stick.style.transform='translate(0,0)'});
function joy(e){const r=ui.joystick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let x=(e.clientX-cx)/(r.width*.32),y=(e.clientY-cy)/(r.height*.32),l=Math.hypot(x,y);if(l>1){x/=l;y/=l}move={x,y};ui.stick.style.transform=`translate(${x*26}px,${y*26}px)`}
