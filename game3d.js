import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

const canvas = document.querySelector('#game');
const ui = {
  intro: document.querySelector('#intro'), end: document.querySelector('#end'), start: document.querySelector('#startButton'), restart: document.querySelector('#restartButton'),
  view: document.querySelector('#viewButton'), health: document.querySelector('#healthFill'), healthText: document.querySelector('#healthText'), ammo: document.querySelector('#ammoText'),
  capture: document.querySelector('#captureFill'), objective: document.querySelector('#objectiveText'), status: document.querySelector('#statusText'), guide: document.querySelector('#guideText'),
  endKicker: document.querySelector('#endKicker'), endTitle: document.querySelector('#endTitle'), endText: document.querySelector('#endText'), joystick: document.querySelector('#joystick'), stick: document.querySelector('#stick'), fire: document.querySelector('#fireButton'), reload: document.querySelector('#reloadButton')
};

const renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'});
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x101512); scene.fog = new THREE.FogExp2(0x101512, 0.028);
const camera = new THREE.PerspectiveCamera(68, 1, .1, 180);
const clock = new THREE.Clock(); const raycaster = new THREE.Raycaster();
const keys = {}; const walls = []; const tracers = []; const enemies = []; const temp = new THREE.Vector3();
let running = false, view = 'first', health = 100, ammo = 5, reserve = 25, phase = 1, hold = 0, volley = 0, reloadAt = 0, lastShot = 0, joy = {x:0,z:0}, joyId = null;

const concrete = new THREE.MeshStandardMaterial({color:0x434842, roughness:.92, metalness:.06});
const concreteDark = new THREE.MeshStandardMaterial({color:0x242925, roughness:1});
const wet = new THREE.MeshStandardMaterial({color:0x1a221f, roughness:.23, metalness:.28});
const wood = new THREE.MeshStandardMaterial({color:0x4b3726, roughness:.85});
const steel = new THREE.MeshStandardMaterial({color:0x343b37, roughness:.48, metalness:.72});

scene.add(new THREE.HemisphereLight(0x7890a0, 0x17120c, 1.2));
const player = new THREE.Group(); player.position.set(0, 0, 8); scene.add(player);
const playerBody = makeSoldier(0x586e82, false); playerBody.position.y = 0; player.add(playerBody);

function box(w,h,d,mat,x,y,z,shadow=true){ const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); m.position.set(x,y,z); m.castShadow=shadow; m.receiveShadow=true; scene.add(m); return m; }
function makeCorridor(){
  for(let z=14; z>-226; z-=8){
    box(8.8,.24,8,concrete,0,-.12,z); box(8.8,.25,8,concreteDark,0,4.82,z);
    box(.35,4.8,8,concrete,-4.55,2.35,z); box(.35,4.8,8,concrete,4.55,2.35,z);
    if(Math.abs(z)%24<1){box(9.2,.24,.3,steel,0,4.48,z);box(.25,4.7,.28,steel,-4.26,2.2,z);box(.25,4.7,.28,steel,4.26,2.2,z);}
    if(Math.abs(z)%16<1){const puddle = new THREE.Mesh(new THREE.CircleGeometry(1.1+Math.random(),20),wet);puddle.rotation.x=-Math.PI/2;puddle.position.set((Math.random()-.5)*4,0.015,z+(Math.random()-.5)*5);scene.add(puddle)}
  }
  for(let z=2; z>-220; z-=26) lamp(z, z%52===0?0xdbc28a:0x687e90);
  for(let z=-20;z>-210;z-=34) debris(z);
  const door = box(5.8,4.4,.35,steel,0,2.18,-222); door.material = new THREE.MeshStandardMaterial({color:0x202823,metalness:.7,roughness:.36});
  box(6.5,.36,.65,concreteDark,0,4.42,-222); box(.48,4.6,.65,concreteDark,-3.15,2.25,-222); box(.48,4.6,.65,concreteDark,3.15,2.25,-222);
}
function lamp(z,color){
  const fixture=box(.35,.3,.45,steel,2.9,3.62,z); const bulb = new THREE.Mesh(new THREE.SphereGeometry(.09,12,8),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:2.4}));bulb.position.set(2.9,3.4,z);scene.add(bulb);
  const light=new THREE.PointLight(color,2.4,15,1.8);light.position.copy(bulb.position);scene.add(light);
}
function debris(z){
  box(.9,.75,.65,wood,-2.9+Math.random()*1.3,.4,z+(Math.random()-.5)*3); box(.55,.38,.9,wood,2.6-Math.random(),.22,z-3);
  for(let i=0;i<3;i++){ const sack=new THREE.Mesh(new THREE.SphereGeometry(.35,12,8),new THREE.MeshStandardMaterial({color:0x625f4d,roughness:1}));sack.scale.set(1.5,.58,1);sack.position.set(-3.55,i*.31+.25,z+1);sack.castShadow=true;scene.add(sack); }
}
function makeSoldier(color, enemy){
  const g=new THREE.Group(); const cloth=new THREE.MeshStandardMaterial({color,roughness:.88}); const leather=new THREE.MeshStandardMaterial({color:0x35271c,roughness:.76});
  const legs=new THREE.Mesh(new THREE.CylinderGeometry(.34,.4,1.18,10),cloth);legs.position.y=.62;legs.castShadow=true;g.add(legs);
  const coat=new THREE.Mesh(new THREE.CylinderGeometry(.57,.46,1.42,12),cloth);coat.position.y=1.75;coat.castShadow=true;g.add(coat);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.31,14,10),new THREE.MeshStandardMaterial({color:0xa97a5e,roughness:.9}));head.position.y=2.55;g.add(head);
  const helmet=new THREE.Mesh(new THREE.SphereGeometry(.42,14,10,0,Math.PI*2,0,Math.PI*.63),steel);helmet.position.y=2.69;helmet.scale.z=1.12;g.add(helmet);
  const gun=new THREE.Mesh(new THREE.BoxGeometry(.12,.12,1.7),wood);gun.position.set(enemy?.08:0,1.92,enemy?-.42:-.62);gun.rotation.x=enemy?-.55:0;g.add(gun);
  const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.032,.032,.85,8),steel);barrel.rotation.x=Math.PI/2;barrel.position.set(enemy?.08:0,enemy?2.15:1.92,enemy?-1.05:-1.4);g.add(barrel);
  const pack=new THREE.Mesh(new THREE.BoxGeometry(.72,.75,.22),enemy?cloth:leather);pack.position.set(0,1.9,.48);g.add(pack); return g;
}
function spawnEnemy(x,z){ const g=new THREE.Group();const body=makeSoldier(0x596055,true);g.add(body);g.position.set(x,0,z);scene.add(g);enemies.push({g,body,health:100,shot:0,alive:true,seed:Math.random()*6.2}); }
function reset(){
  enemies.splice(0).forEach(e=>scene.remove(e.g)); tracers.splice(0).forEach(t=>scene.remove(t.line));
  health=100;ammo=5;reserve=25;phase=1;hold=0;volley=0;reloadAt=0;player.position.set(0,0,8);playerBody.visible=false;
  spawnEnemy(-1.8,-33);spawnEnemy(2.2,-49);spawnEnemy(-2.5,-72);spawnEnemy(1.5,-88); sync();
  ui.objective.textContent='01 · 夺回弹药库';ui.guide.textContent='沿甬道前进，抵达金色信号火焰。';ui.status.textContent='沃堡甬道：纵深 220 米。';
}
function sync(){ui.health.style.width=health+'%';ui.healthText.textContent=Math.ceil(health);ui.ammo.textContent=ammo;ui.capture.style.width=(phase===1?hold/3:phase===3?hold/10:0)*100+'%';}
function hurt(n){health=Math.max(0,health-n);document.querySelector('#hitFlash').style.opacity='.8';setTimeout(()=>document.querySelector('#hitFlash').style.opacity='0',95);if(health<=0)finish(false)}
function finish(win){running=false;ui.endKicker.textContent=win?'任务完成':'防线失守';ui.endTitle.textContent=win?'沃堡暂时守住':'沃堡甬道失守';ui.endText.textContent=win?'你已夺回弹药库并守住铁门。':'重新部署，利用甬道纵深和掩体推进。';ui.end.classList.remove('is-hidden')}
function marker(){ return phase===3?new THREE.Vector3(0,0,-7):new THREE.Vector3(0,0,-112); }
const flare=new THREE.PointLight(0xe7ad5c,3.2,12,2);scene.add(flare); const flareOrb=new THREE.Mesh(new THREE.SphereGeometry(.14,12,8),new THREE.MeshStandardMaterial({color:0xf0c479,emissive:0xe6813d,emissiveIntensity:3}));scene.add(flareOrb);
function update(dt,time){
  if(!running)return;const forward=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0)+joy.z;const side=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0)+joy.x;const moving=Math.abs(forward)+Math.abs(side)>.05;const speed=(keys.ShiftLeft?5.5:3.4)*dt;
  player.position.x=THREE.MathUtils.clamp(player.position.x+side*speed,-3.75,3.75);player.position.z=THREE.MathUtils.clamp(player.position.z-forward*speed,-218,11);playerBody.position.y=moving?Math.abs(Math.sin(time*10))*.06:0;
  const m=marker();flare.position.set(m.x,1.55,m.z);flareOrb.position.copy(flare.position);flareOrb.position.y+=Math.sin(time*4)*.14;
  const close=player.position.distanceTo(m)<2.2;
  if(phase===1){if(close){hold=Math.min(3,hold+dt);ui.guide.textContent='正在夺回弹药库……';}else{hold=Math.max(0,hold-dt);ui.guide.textContent='前进至金色信号火焰，夺回弹药库。';}if(hold>=3){phase=2;hold=0;ui.objective.textContent='02 · 肃清西侧甬道';ui.guide.textContent='使用准星射击所有敌军。';}}
  else if(phase===2){const left=enemies.filter(e=>e.alive).length;ui.objective.textContent=`02 · 肃清西侧甬道（${left}）`;if(!left){phase=3;hold=0;ui.objective.textContent='03 · 守住最后铁门';ui.guide.textContent='退回铁门的金色信号处，坚持 10 秒。';spawnEnemy(-2,-56);spawnEnemy(2,-68);}}
  else if(close){hold=Math.min(10,hold+dt);ui.guide.textContent=`坚守铁门：${Math.ceil(10-hold)} 秒`;if(hold>=10)finish(true)}
  enemies.filter(e=>e.alive).forEach(e=>{const d=e.g.position.distanceTo(player.position);e.g.lookAt(player.position.x,1.6,player.position.z);e.body.position.y=Math.sin(time*6+e.seed)*.035;if(d>7)e.g.position.lerp(player.position,.055*dt);if(d<38&&time>e.shot&&time>volley){enemyFire(e,time);volley=time+1.45+Math.random()*.7;}});
  for(let i=tracers.length-1;i>=0;i--){const t=tracers[i];t.life-=dt;t.line.material.opacity=Math.max(0,t.life/.22);if(t.life<=0){scene.remove(t.line);tracers.splice(i,1);}}
  sync();
}
function enemyFire(e,time){e.shot=time+1.6+Math.random();const start=e.g.position.clone().add(new THREE.Vector3(0,2.05,0));const hit=Math.random()<.12;const end=player.position.clone().add(new THREE.Vector3((Math.random()-.5)*(hit?.4:5.5),1.25,(Math.random()-.5)*(hit?.4:4.5)));const geo=new THREE.BufferGeometry().setFromPoints([start,end]);const mat=new THREE.LineBasicMaterial({color:hit?0xffb46f:0xf4d383,transparent:true,opacity:1});const line=new THREE.Line(geo,mat);scene.add(line);tracers.push({line,life:.22});if(hit)hurt(6)}
function fire(){if(!running||reloadAt)return;if(ammo<1){reload();return}const t=clock.getElapsedTime();if(t-lastShot<.32)return;lastShot=t;ammo--;raycaster.setFromCamera(new THREE.Vector2(0,0),camera);const targets=enemies.filter(e=>e.alive).flatMap(e=>e.g.children.map(c=>c));const hit=raycaster.intersectObjects(targets,true)[0];if(hit){const e=enemies.find(x=>x.g===hit.object.parent||x.g.children.includes(hit.object)||x.g.getObjectById(hit.object.id));if(e){e.health-=58;ui.status.textContent='命中敌军。';if(e.health<=0){e.alive=false;scene.remove(e.g);ui.status.textContent='敌军被击倒。';}}}else ui.status.textContent='射击落空：让准星对准敌军。';sync();}
function reload(){if(reloadAt||ammo===5||!reserve)return;reloadAt=clock.getElapsedTime()+1.05;ui.status.textContent='正在装填……';}
function cameraFollow(){const look=player.position.clone().add(new THREE.Vector3(0,1.45,-8));if(view==='first'){playerBody.visible=false;camera.position.lerp(player.position.clone().add(new THREE.Vector3(0,1.62,.05)),.35);camera.lookAt(look);}else{playerBody.visible=true;camera.position.lerp(player.position.clone().add(new THREE.Vector3(0,2.8,5.8)),.2);camera.lookAt(look);}}
function render(){const dt=Math.min(.05,clock.getDelta()),time=clock.getElapsedTime();if(reloadAt&&time>reloadAt){const n=Math.min(5-ammo,reserve);ammo+=n;reserve-=n;reloadAt=0;ui.status.textContent='装填完成。';}update(dt,time);cameraFollow();renderer.render(scene,camera);requestAnimationFrame(render)}
function resize(){const w=innerWidth,h=innerHeight;renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
function toggleView(){view=view==='first'?'third':'first';ui.view.textContent=view==='first'?'第一人称':'第三人称';}
function joystick(e){const r=ui.joystick.getBoundingClientRect(),dx=(e.clientX-(r.left+r.width/2))/(r.width*.32),dy=(e.clientY-(r.top+r.height/2))/(r.height*.32),l=Math.hypot(dx,dy)||1;joy={x:THREE.MathUtils.clamp(dx/l,-1,1)*Math.min(l,1),z:THREE.MathUtils.clamp(-dy/l,-1,1)*Math.min(l,1)};ui.stick.style.transform=`translate(${joy.x*26}px,${-joy.z*26}px)`;}
addEventListener('resize',resize);addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='Space'){e.preventDefault();fire()}if(e.code==='KeyR')reload();if(e.code==='KeyV')toggleView()});addEventListener('keyup',e=>keys[e.code]=false);
canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button===0)fire()});ui.start.onclick=()=>{reset();running=true;ui.intro.classList.add('is-hidden');ui.end.classList.add('is-hidden')};ui.restart.onclick=ui.start.onclick;ui.view.onclick=toggleView;ui.fire.onclick=fire;ui.reload.onclick=reload;
ui.joystick.addEventListener('pointerdown',e=>{joyId=e.pointerId;ui.joystick.setPointerCapture(e.pointerId);joystick(e)});ui.joystick.addEventListener('pointermove',e=>{if(e.pointerId===joyId)joystick(e)});ui.joystick.addEventListener('pointerup',()=>{joyId=null;joy={x:0,z:0};ui.stick.style.transform='translate(0,0)'});
makeCorridor();resize();reset();render();
