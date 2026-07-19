import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

const canvas = document.querySelector('#game');
const ui = {
  intro: document.querySelector('#intro'), end: document.querySelector('#end'), start: document.querySelector('#startButton'), restart: document.querySelector('#restartButton'),
  view: document.querySelector('#viewButton'), health: document.querySelector('#healthFill'), healthText: document.querySelector('#healthText'), ammo: document.querySelector('#ammoText'),
  capture: document.querySelector('#captureFill'), objective: document.querySelector('#objectiveText'), status: document.querySelector('#statusText'), guide: document.querySelector('#guideText'),
  endKicker: document.querySelector('#endKicker'), endTitle: document.querySelector('#endTitle'), endText: document.querySelector('#endText'), joystick: document.querySelector('#joystick'), stick: document.querySelector('#stick'), fire: document.querySelector('#fireButton'), reload: document.querySelector('#reloadButton'),
  reserve: document.querySelector('#reserveText'), reloadState: document.querySelector('#reloadState'), crosshair: document.querySelector('#crosshair'), pitchNeedle: document.querySelector('#pitchNeedle'), damageArrow: document.querySelector('#damageArrow'),
  weaponName: document.querySelector('#weaponName'), weaponStats: document.querySelector('#weaponStats'), weaponButton: document.querySelector('#weaponButton'), weaponPanel: document.querySelector('#weaponPanel'), closeWeapons: document.querySelector('#closeWeapons'), weaponChoices: [...document.querySelectorAll('.weapon-choice')]
};

const renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'});
renderer.shadowMap.enabled = false; renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x1d2420); scene.fog = new THREE.FogExp2(0x1d2420, 0.018);
const camera = new THREE.PerspectiveCamera(68, 1, .1, 180);
const clock = new THREE.Clock(); const raycaster = new THREE.Raycaster(); const coverRaycaster = new THREE.Raycaster();
const keys = {}; const tracers = []; const enemies = []; const coverZones = []; const coverBlockers = []; const muzzleFlashes = []; const deathEffects = [];
const weapons={lebel:{name:'勒贝尔 M1886',mag:5,reserve:25,damage:62,rate:.32,reload:1.05,stats:'5 发弹仓 · 190 发/分 · 高伤害'},chauchat:{name:'绍沙轻机枪',mag:20,reserve:60,damage:34,rate:.115,reload:1.85,stats:'20 发弹匣 · 420 发/分 · 压制火力'},carbine:{name:'贝蒂埃卡宾枪',mag:8,reserve:32,damage:48,rate:.18,reload:1.25,stats:'8 发弹仓 · 330 发/分 · 均衡'}};
let currentWeapon='lebel',running = false, view = 'first', health = 100, ammo = 5, reserve = 25, phase = 1, hold = 0, reloadAt = 0, lastShot = 0, joy = {x:0,z:0}, joyId = null, aimId = null, yaw = 0, pitch = 0, touchAim = null, waveAt = 0, finalWaves = 0, cameraKick = 0, audioContext = null;

function stoneTexture(){const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');x.fillStyle='#4c514b';x.fillRect(0,0,512,512);for(let y=0;y<512;y+=58){let offset=(Math.floor(y/58)%2)*37;for(let i=-1;i<8;i++){const w=55+Math.random()*46,h=42+Math.random()*12,px=i*92+offset,py=y+6;x.fillStyle=`hsl(95 7% ${26+Math.random()*15}%)`;x.fillRect(px,py,w,h);x.strokeStyle='rgba(13,16,14,.72)';x.lineWidth=5;x.strokeRect(px,py,w,h);for(let n=0;n<18;n++){x.fillStyle='rgba(225,225,190,.07)';x.fillRect(px+Math.random()*w,py+Math.random()*h,2,2)}}}const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(3,2);t.colorSpace=THREE.SRGBColorSpace;return t}
const stoneMap=stoneTexture();
const concrete = new THREE.MeshStandardMaterial({color:0x9ca49a, map:stoneMap, roughness:.95, metalness:.02});
const concreteDark = new THREE.MeshStandardMaterial({color:0x343a35, map:stoneMap, roughness:1});
const wet = new THREE.MeshStandardMaterial({color:0x1a221f, roughness:.23, metalness:.28});
const wood = new THREE.MeshStandardMaterial({color:0x4b3726, roughness:.85});
const steel = new THREE.MeshStandardMaterial({color:0x343b37, roughness:.48, metalness:.72});

scene.add(new THREE.HemisphereLight(0x9fb2bd, 0x292219, 2.0));
const player = new THREE.Group(); player.position.set(0, 0, 8); scene.add(player);
const playerBody = makeSoldier(0x586e82, false); playerBody.position.y = 0; player.add(playerBody);

function box(w,h,d,mat,x,y,z,shadow=true){ const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); m.position.set(x,y,z); m.castShadow=shadow; m.receiveShadow=true; scene.add(m); return m; }
function routeCenter(z){if(z>-64)return 0;if(z>-108){const t=(z+64)/-44;return THREE.MathUtils.smoothstep(t,0,1)*2.7;}if(z>-160)return 2.7;if(z>-202){const t=(z+160)/-42;return THREE.MathUtils.lerp(2.7,-2.6,THREE.MathUtils.smoothstep(t,0,1));}return -2.6;}
function makeCorridor(){
  for(let z=14; z>-226; z-=8){
    const cx=routeCenter(z);box(8.8,.24,8,concrete,cx,-.12,z); box(8.8,.25,8,concreteDark,cx,4.82,z);
    box(.35,4.8,8,concrete,cx-4.55,2.35,z); box(.35,4.8,8,concrete,cx+4.55,2.35,z);
    if(Math.abs(z)%24<1){box(9.2,.24,.3,steel,cx,4.48,z);box(.25,4.7,.28,steel,cx-4.26,2.2,z);box(.25,4.7,.28,steel,cx+4.26,2.2,z);}
    if(Math.abs(z)%16<1){const puddle = new THREE.Mesh(new THREE.CircleGeometry(1.1+Math.random(),20),wet);puddle.rotation.x=-Math.PI/2;puddle.position.set(cx+(Math.random()-.5)*4,0.015,z+(Math.random()-.5)*5);scene.add(puddle)}
  }
  stoneCladding();
  for(let z=2; z>-220; z-=18) lamp(z, z%36===0?0xffd59a:0xa9cbe0,routeCenter(z));
  for(let z=-20;z>-210;z-=28) debris(z,routeCenter(z));
  for(let z=-24,i=0;z>-210;z-=14,i++){const cx=routeCenter(z);cover(cx+(i%2?2.65:-2.65),z,i);if(i%3===0)cover(cx+(i%2?-2.55:2.55),z-5,i+1);}
  const doorX=routeCenter(-222),door = box(5.8,4.4,.35,steel,doorX,2.18,-222); door.material = new THREE.MeshStandardMaterial({color:0x202823,metalness:.7,roughness:.36});
  box(6.5,.36,.65,concreteDark,doorX,4.42,-222); box(.48,4.6,.65,concreteDark,doorX-3.15,2.25,-222); box(.48,4.6,.65,concreteDark,doorX+3.15,2.25,-222);
}
function stoneCladding(){const rows=6,segments=58,count=rows*segments*2;const blocks=new THREE.InstancedMesh(new THREE.BoxGeometry(.14,.52,1.65),new THREE.MeshStandardMaterial({color:0x6a7168,map:stoneMap,roughness:1}),count);const d=new THREE.Object3D();let i=0;for(const side of [-1,1])for(let z=10;z>-222;z-=4)for(let row=0;row<rows;row++){d.position.set(routeCenter(z)+side*4.285,.34+row*.72,z+(row%2?-.35:.35));d.rotation.y=(Math.random()-.5)*.13;d.rotation.z=(Math.random()-.5)*.08;d.scale.set(.45+Math.random()*1.2,.52+Math.random()*.75,.45+Math.random()*1.1);d.updateMatrix();blocks.setMatrixAt(i++,d.matrix)}blocks.instanceMatrix.needsUpdate=true;blocks.castShadow=true;blocks.receiveShadow=true;scene.add(blocks)}
function lamp(z,color,cx){
  const fixture=box(.35,.3,.45,steel,cx+2.9,3.62,z); const bulb = new THREE.Mesh(new THREE.SphereGeometry(.09,12,8),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:2.4}));bulb.position.set(cx+2.9,3.4,z);scene.add(bulb);
  const light=new THREE.PointLight(color,4.8,20,1.65);light.position.copy(bulb.position);scene.add(light);
}
function debris(z,cx){
  box(.9,.75,.65,wood,cx-2.9+Math.random()*1.3,.4,z+(Math.random()-.5)*3); box(.55,.38,.9,wood,cx+2.6-Math.random(),.22,z-3);
  for(let i=0;i<3;i++){ const sack=new THREE.Mesh(new THREE.SphereGeometry(.35,12,8),new THREE.MeshStandardMaterial({color:0x625f4d,roughness:1}));sack.scale.set(1.5,.58,1);sack.position.set(-3.55,i*.31+.25,z+1);sack.castShadow=true;scene.add(sack); }
}
function cover(x,z,kind){
  const zone={point:new THREE.Vector3(x,0,z), hide:new THREE.Vector3(x,0,z-.84), peek:new THREE.Vector3(x,0,z+.72)}; coverZones.push(zone);
  // 隐形碰撞体与可见掩体的尺寸一致：子弹会被它拦住，而不是只给命中率加成。
  const blocker=new THREE.Mesh(new THREE.BoxGeometry(2.4,1.35,.82),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false})); blocker.position.set(x,.68,z); blocker.userData.cover=true; scene.add(blocker); coverBlockers.push(blocker);
  if(kind%3===0){for(let row=0;row<4;row++)for(let col=0;col<4;col++){const sack=new THREE.Mesh(new THREE.SphereGeometry(.34,12,8),new THREE.MeshStandardMaterial({color:0x77705a,roughness:1}));sack.scale.set(1.45,.62,1);sack.position.set(x+(col-1.5)*.48+(row%2?.12:0),.23+row*.29,z+(col%2?-.18:.18));sack.rotation.y=(Math.random()-.5)*.25;sack.castShadow=true;sack.receiveShadow=true;scene.add(sack)}}
  else if(kind%3===1){box(2.18,.72,.78,wood,x,.36,z);const top=box(1.72,.65,.74,wood,x+(x<0?.18:-.18),1.02,z+.15);top.rotation.z=x<0?-.11:.11;const side=box(.72,.54,.7,wood,x-(x<0?.8:-.8),.28,z-.6);side.rotation.y=.22;}
  else {for(let row=0;row<2;row++)for(let i=0;i<4;i++){const drum=new THREE.Mesh(new THREE.CylinderGeometry(.29,.29,.82,16),new THREE.MeshStandardMaterial({color:(i+row)%3===1?0x8d6434:0x485c58,metalness:.55,roughness:.42}));drum.rotation.z=Math.PI/2+(i-1.5)*.08;drum.position.set(x+(i-1.5)*.48,.36+row*.43,z+(i%2?-.25:.25));drum.castShadow=true;scene.add(drum)}box(1.85,.58,.72,wood,x,.29,z-.62);}
  const plate=box(.12,1.32,1.25,steel,x+(x<0?.98:-.98),.66,z-.05);plate.rotation.z=x<0?-.18:.18;
}
function makeSoldier(color, enemy){
  const g=new THREE.Group(); const cloth=new THREE.MeshStandardMaterial({color,roughness:.88}); const leather=new THREE.MeshStandardMaterial({color:0x35271c,roughness:.76}); const skin=new THREE.MeshStandardMaterial({color:0xa97a5e,roughness:.9});
  const legL=new THREE.Mesh(new THREE.CylinderGeometry(.19,.22,1.18,10),cloth),legR=legL.clone();legL.position.set(-.2,.62,0);legR.position.set(.2,.62,0);legL.castShadow=legR.castShadow=true;g.add(legL,legR);
  const coat=new THREE.Mesh(new THREE.CylinderGeometry(.58,.48,1.45,12),cloth);coat.position.y=1.73;coat.castShadow=true;g.add(coat);
  const belt=new THREE.Mesh(new THREE.TorusGeometry(.5,.045,8,18),leather);belt.rotation.x=Math.PI/2;belt.position.y=1.43;g.add(belt);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.31,14,10),skin);head.position.y=2.55;g.add(head);
  if(enemy){const eyeMat=new THREE.MeshStandardMaterial({color:0x171411,roughness:.7});const eyeL=new THREE.Mesh(new THREE.SphereGeometry(.035,8,6),eyeMat),eyeR=eyeL.clone();eyeL.position.set(-.105,2.58,-.29);eyeR.position.set(.105,2.58,-.29);const nose=new THREE.Mesh(new THREE.ConeGeometry(.045,.13,6),skin);nose.rotation.x=Math.PI/2;nose.position.set(0,2.5,-.325);g.add(eyeL,eyeR,nose);}
  const helmet=new THREE.Mesh(new THREE.SphereGeometry(.43,16,10,0,Math.PI*2,0,Math.PI*.65),steel);helmet.position.y=2.72;helmet.scale.z=1.12;g.add(helmet);
  const armL=new THREE.Mesh(new THREE.CylinderGeometry(.12,.16,.82,8),cloth),armR=armL.clone();armL.position.set(-.43,2.0,-.18);armR.position.set(.43,2.0,-.18);armL.rotation.z=-.72;armR.rotation.z=.72;armL.rotation.x=enemy?-.62:0;armR.rotation.x=enemy?-.62:0;g.add(armL,armR);
  const gun=new THREE.Mesh(new THREE.BoxGeometry(.13,.13,1.78),wood);gun.position.set(enemy?.04:0,enemy?2.02:1.92,enemy?-.56:-.62);gun.rotation.x=enemy?-.78:0;g.add(gun);
  const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.98,8),steel);barrel.rotation.x=Math.PI/2;barrel.position.set(enemy?.04:0,enemy?2.26:1.92,enemy?-1.18:-1.42);g.add(barrel);
  const pack=new THREE.Mesh(new THREE.BoxGeometry(.75,.78,.25),enemy?cloth:leather);pack.position.set(0,1.9,.5);g.add(pack);
  const collar=new THREE.Mesh(new THREE.TorusGeometry(.34,.045,8,14,Math.PI),leather);collar.rotation.x=Math.PI/2;collar.position.set(0,2.25,-.04);g.add(collar);
  for(const side of [-1,1]){const strap=new THREE.Mesh(new THREE.BoxGeometry(.07,.92,.06),leather);strap.position.set(side*.29,1.95,-.39);strap.rotation.z=-side*.26;g.add(strap);const pouch=new THREE.Mesh(new THREE.BoxGeometry(.22,.27,.12),leather);pouch.position.set(side*.25,1.35,-.48);g.add(pouch);}
  const helmetRim=new THREE.Mesh(new THREE.TorusGeometry(.39,.045,8,18),steel);helmetRim.rotation.x=Math.PI/2;helmetRim.position.y=2.63;g.add(helmetRim);
  const canteen=new THREE.Mesh(new THREE.CylinderGeometry(.14,.14,.36,10),steel);canteen.rotation.z=Math.PI/2;canteen.position.set(enemy?.48:-.48,1.38,.15);g.add(canteen);
  if(enemy){const bayonet=new THREE.Mesh(new THREE.BoxGeometry(.035,.035,.5),steel);bayonet.position.set(.04,2.2,-1.7);bayonet.rotation.x=Math.PI/2;g.add(bayonet);}return g;
}
function nearestCover(pos){return coverZones.reduce((best,zone)=>!best||zone.point.distanceToSquared(pos)<best.point.distanceToSquared(pos)?zone:best,null);}
function spawnEnemy(x,z,role=Math.random()<.24?'charger':'rifle'){const g=new THREE.Group(),body=makeSoldier(role==='charger'?0x6a6250:0x596055,true),anchor=new THREE.Vector3(x,0,z);g.add(body);g.position.copy(anchor);scene.add(g);enemies.push({g,body,health:role==='charger'?92:122,shot:0,alive:true,dead:false,role,seed:Math.random()*6.2,anchor,wander:anchor.clone(),nextMove:0,cover:nearestCover(anchor),inCover:false,firingUntil:0});}
function reset(){
  enemies.splice(0).forEach(e=>scene.remove(e.g)); tracers.splice(0).forEach(t=>scene.remove(t.line)); muzzleFlashes.splice(0).forEach(f=>scene.remove(f.flash));deathEffects.splice(0).forEach(f=>{scene.remove(f.sprite);f.sprite.material.dispose();});
  currentWeapon='lebel';Object.values(weapons).forEach(w=>{w.ammo=w.mag;w.stock=w.reserve;});health=100;ammo=weapons.lebel.ammo;reserve=weapons.lebel.stock;phase=1;hold=0;waveAt=0;finalWaves=0;reloadAt=0;yaw=0;pitch=0;cameraKick=0;updateAimUi();player.position.set(0,0,8);playerBody.visible=false;
  spawnEnemy(routeCenter(-33)-1.8,-33);spawnEnemy(routeCenter(-49)+2.2,-49);spawnEnemy(routeCenter(-72)-2.5,-72);spawnEnemy(routeCenter(-88)+1.5,-88);spawnEnemy(routeCenter(-104)-2.25,-104); sync();
  ui.objective.textContent='01 · 夺回弹药库';ui.guide.textContent='沿甬道前进，抵达金色信号火焰。';ui.status.textContent='沃堡甬道：纵深 220 米。';
}
function sync(){const weapon=weapons[currentWeapon];weapon.ammo=ammo;weapon.stock=reserve;ui.health.style.width=health+'%';ui.healthText.textContent=Math.ceil(health);ui.ammo.textContent=ammo;ui.reserve.textContent=reserve;ui.weaponName.textContent=weapon.name;ui.weaponStats.textContent=weapon.stats;ui.reloadState.textContent=reloadAt?'装填中…':ammo===0?'需装填':`弹仓 ${ammo}/${weapon.mag}`;ui.reloadState.classList.toggle('is-reloading',Boolean(reloadAt));ui.capture.style.width=(phase===1?hold/3:phase===3?hold/12:0)*100+'%';}
function selectWeapon(id){if(!weapons[id]||reloadAt)return;weapons[currentWeapon].ammo=ammo;weapons[currentWeapon].stock=reserve;currentWeapon=id;ammo=weapons[id].ammo;reserve=weapons[id].stock;ui.weaponChoices.forEach(button=>button.classList.toggle('is-selected',button.dataset.weapon===id));ui.weaponPanel.classList.add('is-hidden');ui.status.textContent=`已装备 ${weapons[id].name}。`;sync();}
function playSound(type){try{audioContext??=new AudioContext();if(audioContext.state==='suspended')audioContext.resume();const oscillator=audioContext.createOscillator(),gain=audioContext.createGain(),now=audioContext.currentTime;const config={fire:[currentWeapon==='chauchat'?115:78,.07,.025],enemy:[62,.055,.014],hit:[72,.15,.06],down:[190,.18,.02]}[type]||[110,.08,.02];oscillator.type=type==='down'?'triangle':'sawtooth';oscillator.frequency.setValueAtTime(config[0],now);oscillator.frequency.exponentialRampToValueAtTime(Math.max(30,config[0]*.55),now+config[1]);gain.gain.setValueAtTime(config[2],now);gain.gain.exponentialRampToValueAtTime(.001,now+config[1]);oscillator.connect(gain).connect(audioContext.destination);oscillator.start(now);oscillator.stop(now+config[1]);}catch{}}
function hurt(n,origin){health=Math.max(0,health-n);playSound('hit');const flash=document.querySelector('#hitFlash');flash.style.opacity='.92';flash.classList.remove('is-hit');void flash.offsetWidth;flash.classList.add('is-hit');cameraKick=.13;if(origin){const angle=Math.atan2(origin.x-player.position.x,-(origin.z-player.position.z))-yaw;ui.damageArrow.style.transform=`translate(-50%,-50%) rotate(${angle}rad)`;ui.damageArrow.classList.add('is-hit');setTimeout(()=>ui.damageArrow.classList.remove('is-hit'),280);}setTimeout(()=>{flash.style.opacity='0';flash.classList.remove('is-hit');},180);if(health<=0)finish(false)}
function finish(win){running=false;ui.endKicker.textContent=win?'任务完成':'防线失守';ui.endTitle.textContent=win?'沃堡暂时守住':'沃堡甬道失守';ui.endText.textContent=win?'你已夺回弹药库并守住铁门。':'重新部署，利用甬道纵深和掩体推进。';ui.end.classList.remove('is-hidden')}
function marker(){const z=phase===3?-216:-112;return new THREE.Vector3(routeCenter(z),0,z);}
const flare=new THREE.PointLight(0xe7ad5c,3.2,12,2);scene.add(flare); const flareOrb=new THREE.Mesh(new THREE.SphereGeometry(.14,12,8),new THREE.MeshStandardMaterial({color:0xf0c479,emissive:0xe6813d,emissiveIntensity:3}));scene.add(flareOrb);
function update(dt,time){
  if(!running)return;if(keys.KeyQ)adjustPitch(dt*.18);if(keys.KeyE)adjustPitch(-dt*.18);if(keys.KeyJ)yaw+=dt*.16;if(keys.KeyL)yaw-=dt*.16;cameraKick=Math.max(0,cameraKick-dt*.68);const forward=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0)+joy.z;const side=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0)+joy.x;const moving=Math.abs(forward)+Math.abs(side)>.05;const speed=(keys.ShiftLeft?5.5:3.4)*dt;
  const forwardDir=new THREE.Vector3(Math.sin(yaw),0,-Math.cos(yaw)),rightDir=new THREE.Vector3(Math.cos(yaw),0,Math.sin(yaw));
  player.position.addScaledVector(forwardDir,forward*speed).addScaledVector(rightDir,side*speed);player.position.z=THREE.MathUtils.clamp(player.position.z,-218,11);player.position.x=THREE.MathUtils.clamp(player.position.x,routeCenter(player.position.z)-3.75,routeCenter(player.position.z)+3.75);playerBody.position.y=moving?Math.abs(Math.sin(time*10))*.06:0;
  const m=marker();flare.position.set(m.x,1.55,m.z);flareOrb.position.copy(flare.position);flareOrb.position.y+=Math.sin(time*4)*.14;
  const close=player.position.distanceTo(m)<2.2;
  if(phase===1){if(close){hold=Math.min(3,hold+dt);ui.guide.textContent='正在夺回弹药库……';}else{hold=Math.max(0,hold-dt);ui.guide.textContent='前进至金色信号火焰，夺回弹药库。';}if(hold>=3){phase=2;hold=0;ui.objective.textContent='02 · 肃清西侧甬道';ui.guide.textContent='敌军会在掩体后探身射击：利用掩体推进。';}}
  else if(phase===2){const left=enemies.filter(e=>e.alive).length;ui.objective.textContent=`02 · 肃清西侧甬道（${left}）`;if(!left){phase=3;hold=0;waveAt=time+2.1;ui.objective.textContent='03 · 守住最后铁门';ui.guide.textContent='穿过 Z 型甬道，抵达铁门，坚持 12 秒。';spawnEnemy(routeCenter(-151)-2.2,-151);spawnEnemy(routeCenter(-180)+2.2,-180);spawnEnemy(routeCenter(-195),-195);}}
  else {if(close){hold=Math.min(12,hold+dt);ui.guide.textContent=`坚守铁门：${Math.ceil(12-hold)} 秒`;if(hold>=12)finish(true)}if(close&&finalWaves<3&&time>waveAt){const z=[-163,-190,-205][finalWaves],x=routeCenter(z)+(finalWaves===1?2.35:-2.4);finalWaves++;spawnEnemy(x,z);waveAt=time+2.6;ui.status.textContent='敌军增援进入甬道！';}}
  enemies.filter(e=>e.alive).forEach(e=>{const d=e.g.position.distanceTo(player.position);if(time>e.nextMove){if(e.role==='charger'&&d>7){e.inCover=false;const runTo=player.position.clone().sub(e.g.position).normalize().multiplyScalar(Math.min(5,d-5)).add(e.g.position);e.wander.set(THREE.MathUtils.clamp(runTo.x,routeCenter(runTo.z)-3.45,routeCenter(runTo.z)+3.45),0,THREE.MathUtils.clamp(runTo.z,-216,10));e.nextMove=time+.32;}else{e.inCover=Boolean(e.cover&&Math.random()<.58);const next=e.inCover?e.cover.hide:e.cover?e.cover.peek:e.anchor;e.wander.set(THREE.MathUtils.clamp(next.x+(Math.random()-.5)*.28,routeCenter(next.z)-3.45,routeCenter(next.z)+3.45),0,next.z+(Math.random()-.5)*.22);e.nextMove=time+(e.inCover?1.1:.72)+Math.random()*1.15;}}e.g.position.lerp(e.wander,(e.role==='charger'?1.45:.72)*dt);e.g.rotation.y=Math.atan2(player.position.x-e.g.position.x,-(player.position.z-e.g.position.z));e.body.position.y=Math.sin(time*(e.role==='charger'?13:7)+e.seed)*.035;e.body.rotation.x=time<e.firingUntil?-.12:0;if(d<52&&!e.inCover&&time>e.shot)enemyFire(e,time);});
  for(let i=tracers.length-1;i>=0;i--){const t=tracers[i];t.life-=dt;t.line.material.opacity=Math.max(0,t.life/.22);if(t.life<=0){scene.remove(t.line);tracers.splice(i,1);}}
  for(let i=muzzleFlashes.length-1;i>=0;i--){const flash=muzzleFlashes[i];flash.life-=dt;flash.flash.material.opacity=Math.max(0,flash.life/.075);if(flash.life<=0){scene.remove(flash.flash);flash.flash.material.dispose();muzzleFlashes.splice(i,1);}}
  for(let i=deathEffects.length-1;i>=0;i--){const effect=deathEffects[i];effect.life-=dt;effect.velocity.y-=dt*3.8;effect.sprite.position.addScaledVector(effect.velocity,dt);effect.sprite.material.opacity=Math.max(0,effect.life/effect.max);effect.sprite.scale.multiplyScalar(1+dt*.8);if(effect.life<=0){scene.remove(effect.sprite);effect.sprite.material.dispose();deathEffects.splice(i,1);}}
  sync(); updateReticle();
}
function nearCover(pos){return coverZones.some(c=>Math.hypot(pos.x-c.point.x,pos.z-c.point.z)<2.05)}
function blockedByCover(from,to){const direction=to.clone().sub(from),distance=direction.length();coverRaycaster.set(from,direction.normalize());coverRaycaster.far=Math.max(0,distance-.14);return coverRaycaster.intersectObjects(coverBlockers,false)[0]||null;}
function muzzleFlash(e){const flash=new THREE.Sprite(new THREE.SpriteMaterial({color:0xffcf73,transparent:true,opacity:1,depthWrite:false}));flash.scale.set(.34,.34,1);flash.position.copy(e.g.position).add(new THREE.Vector3(0,2.05,-.46));scene.add(flash);muzzleFlashes.push({flash,life:.075});}
function leaveBody(e){e.dead=true;e.body.position.y=.08;e.body.rotation.set(-Math.PI/2,0,(Math.random()-.5)*.38);e.body.position.z=(Math.random()-.5)*.18;}
function deathBurst(position){for(let i=0;i<6;i++){const sprite=new THREE.Sprite(new THREE.SpriteMaterial({color:i%2?0xd5b486:0x7e7565,transparent:true,opacity:.92,depthWrite:false}));sprite.scale.set(.08+Math.random()*.1,.08+Math.random()*.1,1);sprite.position.copy(position).add(new THREE.Vector3((Math.random()-.5)*.35,1.2+Math.random()*.8,(Math.random()-.5)*.28));scene.add(sprite);deathEffects.push({sprite,life:.42,max:.42,velocity:new THREE.Vector3((Math.random()-.5)*1.7,.8+Math.random()*1.1,(Math.random()-.5)*1.2)});}}
function enemyFire(e,time){e.shot=time+1.05+Math.random()*.7;e.firingUntil=time+.16;const start=e.g.position.clone().add(new THREE.Vector3(0,2.05,0)),target=player.position.clone().add(new THREE.Vector3(0,1.25,0)),coverHit=blockedByCover(start,target),protectedByCover=Boolean(coverHit)||nearCover(player.position);const hit=!coverHit&&Math.random()<(protectedByCover ? .08 : .23);const end=coverHit?coverHit.point:target.add(new THREE.Vector3((Math.random()-.5)*(hit?.35:4.8),(Math.random()-.5)*(hit?.25:2.8),(Math.random()-.5)*(hit?.35:3.5)));const geo=new THREE.BufferGeometry().setFromPoints([start,end]);const mat=new THREE.LineBasicMaterial({color:hit?0xff8f53:'#f4d383',transparent:true,opacity:1});const line=new THREE.Line(geo,mat);scene.add(line);tracers.push({line,life:.28});muzzleFlash(e);playSound('enemy');if(protectedByCover)ui.status.textContent=coverHit?'掩体挡住了敌军子弹。':'贴近掩体，敌军命中率降低。';if(hit)hurt(9,e.g.position)}
function aimedEnemy(){raycaster.setFromCamera(new THREE.Vector2(0,0),camera);const targets=[...coverBlockers,...enemies.filter(e=>e.alive).flatMap(e=>e.g.children.map(c=>c))];const hit=raycaster.intersectObjects(targets,true)[0];if(!hit||hit.object.userData.cover)return null;return enemies.find(e=>e.g===hit.object.parent||e.g.children.includes(hit.object)||e.g.getObjectById(hit.object.id));}
function updateReticle(){ui.crosshair.classList.toggle('is-target',Boolean(aimedEnemy()));}
function fire(){if(!running||reloadAt)return;if(ammo<1){reload();return}const t=clock.getElapsedTime(),weapon=weapons[currentWeapon];if(t-lastShot<weapon.rate)return;lastShot=t;ammo--;weapon.ammo=ammo;playSound('fire');const e=aimedEnemy();if(e){e.health-=weapon.damage;ui.status.textContent='命中敌军。';if(e.health<=0){e.alive=false;leaveBody(e);deathBurst(e.g.position);playSound('down');ui.status.textContent='敌军被击倒。';}}else ui.status.textContent='射击落空：让准星对准敌军。';sync();}
function reload(){const weapon=weapons[currentWeapon];if(reloadAt||ammo===weapon.mag||!reserve)return;reloadAt=clock.getElapsedTime()+weapon.reload;ui.status.textContent='正在装填……';}
function cameraFollow(){const forwardDir=new THREE.Vector3(Math.sin(yaw),0,-Math.cos(yaw)),look=player.position.clone().addScaledVector(forwardDir,8).add(new THREE.Vector3(0,1.55+pitch*8,0)),shake=cameraKick?new THREE.Vector3((Math.random()-.5)*cameraKick,(Math.random()-.5)*cameraKick,0):new THREE.Vector3();if(view==='first'){playerBody.visible=false;camera.position.lerp(player.position.clone().add(new THREE.Vector3(0,1.62,.05)),.35);camera.position.add(shake);camera.rotation.set(pitch,yaw,0,'YXZ');}else{playerBody.visible=true;camera.position.lerp(player.position.clone().addScaledVector(forwardDir,-5.8).add(new THREE.Vector3(0,2.8,0)),.2);camera.position.add(shake);camera.lookAt(look);}}
function render(){const dt=Math.min(.05,clock.getDelta()),time=clock.getElapsedTime();if(reloadAt&&time>reloadAt){const n=Math.min(weapons[currentWeapon].mag-ammo,reserve);ammo+=n;reserve-=n;reloadAt=0;ui.status.textContent='装填完成。';}update(dt,time);cameraFollow();renderer.render(scene,camera);requestAnimationFrame(render)}
function resize(){const w=innerWidth,h=innerHeight,lowPower=matchMedia('(pointer:coarse), (prefers-reduced-motion: reduce)').matches;renderer.setPixelRatio(Math.min(devicePixelRatio,lowPower?1.25:1.6));renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
function toggleView(){view=view==='first'?'third':'first';ui.view.textContent=view==='first'?'第一人称':'第三人称';}
function joystick(e){const r=ui.joystick.getBoundingClientRect(),dx=(e.clientX-(r.left+r.width/2))/(r.width*.32),dy=(e.clientY-(r.top+r.height/2))/(r.height*.32),l=Math.hypot(dx,dy)||1;joy={x:THREE.MathUtils.clamp(dx/l,-1,1)*Math.min(l,1),z:THREE.MathUtils.clamp(-dy/l,-1,1)*Math.min(l,1)};ui.stick.style.transform=`translate(${joy.x*26}px,${-joy.z*26}px)`;}
function updateAimUi(){ui.pitchNeedle.style.top=`${THREE.MathUtils.clamp(50-pitch*48,10,90)}%`;}
function adjustPitch(amount){pitch=THREE.MathUtils.clamp(pitch+amount,-.78,.58);updateAimUi();}
function rotate(dx,dy){yaw-=dx*.0027;adjustPitch(-dy*.00105);}
function clearInput(){Object.keys(keys).forEach(k=>delete keys[k]);joy={x:0,z:0};touchAim=null;aimId=null;ui.stick.style.transform='translate(0,0)';}
addEventListener('resize',resize);addEventListener('blur',clearInput);addEventListener('keydown',e=>{keys[e.code]=true;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(e.code==='Space')fire();if(e.code==='KeyR')reload();if(e.code==='KeyV')toggleView()});addEventListener('keyup',e=>keys[e.code]=false);
document.addEventListener('pointerlockchange',()=>{if(running&&document.pointerLockElement!==canvas&&matchMedia('(pointer:fine)').matches)ui.status.textContent='鼠标已释放：点击画面继续瞄准。';});
document.addEventListener('pointermove',e=>{if(document.pointerLockElement===canvas)rotate(e.movementX,e.movementY);});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button===0){if(canvas.requestPointerLock&&document.pointerLockElement!==canvas)canvas.requestPointerLock();fire();}if(e.pointerType==='touch'){aimId=e.pointerId;touchAim={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);}});
canvas.addEventListener('pointermove',e=>{if(e.pointerId===aimId&&touchAim){rotate(e.clientX-touchAim.x,e.clientY-touchAim.y);touchAim={x:e.clientX,y:e.clientY};}});
canvas.addEventListener('pointerup',e=>{if(e.pointerId===aimId){aimId=null;touchAim=null;}});
ui.start.onclick=()=>{reset();running=true;ui.intro.classList.add('is-hidden');ui.end.classList.add('is-hidden');ui.status.textContent=matchMedia('(pointer:fine)').matches?'点击画面锁定鼠标；J / L 左右精瞄，Q / E 微调仰角。':'左侧移动，右侧画面滑动瞄准。';};ui.restart.onclick=ui.start.onclick;ui.view.onclick=toggleView;ui.fire.onclick=fire;ui.reload.onclick=reload;ui.weaponButton.onclick=()=>ui.weaponPanel.classList.toggle('is-hidden');ui.closeWeapons.onclick=()=>ui.weaponPanel.classList.add('is-hidden');ui.weaponChoices.forEach(button=>button.onclick=()=>selectWeapon(button.dataset.weapon));
ui.joystick.addEventListener('pointerdown',e=>{joyId=e.pointerId;ui.joystick.setPointerCapture(e.pointerId);joystick(e)});ui.joystick.addEventListener('pointermove',e=>{if(e.pointerId===joyId)joystick(e)});ui.joystick.addEventListener('pointerup',()=>{joyId=null;joy={x:0,z:0};ui.stick.style.transform='translate(0,0)'});
makeCorridor();resize();reset();render();
