/* Ashlight — original, asset-free isometric world renderer. */
export const MAP_SIZE = 18;
const COLORS = { ink:'#142726', moss:'#495b45', sage:'#8b9b72', light:'#c9d2ae', teal:'#82c5b0', gold:'#e7b978' };
const trees = {
  base:[[1,2],[2,2],[1,5],[2,8],[2,13],[3,15],[5,16],[8,16],[14,2],[15,3],[16,5],[16,9],[15,12],[16,15],[13,16],[11,1],[7,1],[4,2]],
  ruins:[[1,2],[2,3],[1,8],[2,13],[3,16],[7,16],[15,15],[16,12],[16,7],[15,2],[12,1],[7,1]],
  forest:[[1,1],[2,2],[4,1],[5,3],[7,2],[10,1],[12,2],[15,1],[16,3],[1,5],[3,6],[5,5],[13,5],[16,6],[1,9],[3,10],[14,9],[16,11],[2,13],[4,14],[1,16],[7,15],[10,16],[13,14],[15,15],[16,17]]
};
const furniture = {base:[{x:5,y:5,type:'bed'},{x:11,y:5,type:'shelf'},{x:12,y:5,type:'table'}],ruins:[{x:5,y:5,type:'bed'},{x:12,y:5,type:'shelf'},{x:5,y:10,type:'table'}],forest:[]};
const hash = (x,y,s=0) => { const n=Math.sin(x*127.1+y*311.7+s*47.3)*43758.5453;return n-Math.floor(n); };
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const validZone = z => ['base','ruins','forest'].includes(z)?z:'base';
export function terrain(zone,x,y) {
  zone=validZone(zone);x=Math.round(x);y=Math.round(y);
  if(x<0||y<0||x>=18||y>=18)return 'wall';
  if(trees[zone].some(p=>p[0]===x&&p[1]===y))return 'tree';
  if(furniture[zone].some(p=>p.x===x&&p.y===y))return 'wall';
  if(zone==='base') {
    if((y===4&&x>=4&&x<=13&&x!==8&&x!==9)||(x===4&&y>=5&&y<=10&&y!==8&&y!==10))return 'wall';
    if(x>=4&&x<=13&&y>=4&&y<=10)return 'floor';
  }
  if(zone==='ruins') {
    if((y===4&&x>=4&&x<=13&&x!==8&&x!==9)||(x===4&&y>=5&&y<=12&&y!==8&&y!==10)||(x===13&&y>=4&&y<=6)||(y===12&&x>=5&&x<=7))return 'wall';
    if(x>=4&&x<=13&&y>=4&&y<=12)return 'floor';
  }
  return 'ground';
}
function camera(w,h,view={}) {
  const s=Math.max(.2,Math.min((w-48)/1152,(h-65)/632))*(view.zoom||1);
  return {s,tw:64*s,th:32*s,ox:w/2+(view.panX||0),oy:h*.52-272*s+(view.panY||0)};
}
export function tileToScreen(x,y,width,height,view={}) {const c=camera(width,height,view);return {x:c.ox+(x-y)*c.tw/2,y:c.oy+(x+y)*c.th/2};}
export function screenToTile(sx,sy,width,height,view={}) {const c=camera(width,height,view),dx=(sx-c.ox)/c.tw,dy=(sy-c.oy)/c.th;return{x:Math.floor(dy+dx+.5),y:Math.floor(dy-dx+.5)};}
function polygon(ctx,p,fill,stroke,lw=1) {ctx.beginPath();p.forEach((v,i)=>i?ctx.lineTo(...v):ctx.moveTo(...v));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke();}}
function line(ctx,p,color,width=1) {ctx.beginPath();p.forEach((v,i)=>i?ctx.lineTo(...v):ctx.moveTo(...v));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();}
function oval(ctx,x,y,rx,ry,color) {ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
function box(ctx,x,y,w,d,h,colors=['#849074','#4b6354','#617866']) {
  polygon(ctx,[[x,y-h-d/2],[x+w/2,y-h],[x,y-h+d/2],[x-w/2,y-h]],colors[0]);
  polygon(ctx,[[x-w/2,y-h],[x,y-h+d/2],[x,y+d/2],[x-w/2,y]],colors[1]);
  polygon(ctx,[[x,y-h+d/2],[x+w/2,y-h],[x+w/2,y],[x,y+d/2]],colors[2]);
}
function shadow(ctx,x,y,w=24,h=10) {oval(ctx,x+9,y+4,w,h,'#081b1b42');}
function diamond(ctx,x,y,w,h,fill,stroke) {polygon(ctx,[[x,y-h/2],[x+w/2,y],[x,y+h/2],[x-w/2,y]],fill,stroke);}
function conifer(ctx,x,y,seed,time) {
  const h=70+seed*31, sway=Math.sin(time*.0007+seed*9)*1.15;
  shadow(ctx,x,y,27,11);box(ctx,x,y,6,4,29,['#776149','#4c4937','#6c5740']);
  for(let i=0;i<3;i++) {
    const top=y-h+i*18,half=25-i*5,base=top+34;
    polygon(ctx,[[x+sway,top],[x+half,base],[x,base+8],[x-half,base]],['#3d6651','#496f53','#5b7a57'][i]);
    polygon(ctx,[[x+sway,top],[x,base+8],[x-half,base]],['#244c43','#335c47','#3e644d'][i]);
    polygon(ctx,[[x+sway,top],[x+half,base],[x+3,base-4]],['#66825c','#729164','#86a073'][i]);
    line(ctx,[[x+sway,top+2],[x+half*.62,base-9]],'#b9bf7b30',1);
  }
}
function rock(ctx,x,y,size=12,seed=0) {
  shadow(ctx,x,y,size*.9,4);
  polygon(ctx,[[x-size,y],[x-size*.8,y-size*.55],[x+size*.15,y-size*.85],[x+size,y-size*.25],[x+size*.85,y+2],[x,y+5]],'#58675b');
  polygon(ctx,[[x-size*.8,y-size*.55],[x+size*.15,y-size*.85],[x+size*.3,y-2],[x-size,y]],'#85907a');
  polygon(ctx,[[x+size*.15,y-size*.85],[x+size,y-size*.25],[x+size*.3,y-2]],'#a0a38a');
}
function plant(ctx,x,y,seed=0) {for(let i=0;i<4;i++){let d=(i-1.5)*3;line(ctx,[[x,y],[x+d*1.5,y-4-seed*6],[x+d*2,y-3-seed*4]],i%2?'#718562':'#536f52',1.2);}}
function wall(ctx,x,y,axis,zone,seed) {
  let ht=zone==='ruins'?29+seed*16:47;
  const a=axis==='x'?[30,15]:[-30,15],t=4;
  polygon(ctx,[[x-a[0]/2,y-a[1]/2],[x+a[0]/2,y+a[1]/2],[x+a[0]/2,y+a[1]/2-ht],[x-a[0]/2,y-a[1]/2-ht]],zone==='ruins'?'#53635b':'#527367');
  polygon(ctx,[[x-a[0]/2,y-a[1]/2-ht],[x+a[0]/2,y+a[1]/2-ht],[x+a[0]/2+t,y+a[1]/2-ht-t/2],[x-a[0]/2+t,y-a[1]/2-ht-t/2]],'#94a493');
  polygon(ctx,[[x+a[0]/2,y+a[1]/2],[x+a[0]/2+t,y+a[1]/2-t/2],[x+a[0]/2+t,y+a[1]/2-ht-t/2],[x+a[0]/2,y+a[1]/2-ht]],'#344f47');
  for(let i=1;i<=3;i++){let q=i/4;line(ctx,[[x-a[0]/2+a[0]*q,y-a[1]/2+a[1]*q-ht+3],[x-a[0]/2+a[0]*q,y-a[1]/2+a[1]*q-3]],'#c0d3b21b',2);}
  line(ctx,[[x-a[0]/2,y-a[1]/2-4],[x+a[0]/2,y+a[1]/2-4]],'#263f35',3);
  if(seed>.65&&zone==='ruins')line(ctx,[[x-3,y-ht],[x+2,y-ht*.7],[x-5,y-ht*.4]],'#243f38',1);
}
function bed(ctx,x,y) {
  shadow(ctx,x,y,26,10);box(ctx,x,y,37,24,7,['#715e43','#4c4836','#615238']);
  box(ctx,x,y-6,33,21,7,['#859381','#637767','#607664']);
  polygon(ctx,[[x-16,y-12],[x,y-20],[x+16,y-12],[x,y-4]],'#8eab9a');
  polygon(ctx,[[x-10,y-15],[x-3,y-18],[x+5,y-14],[x-2,y-11]],'#c1c5a8');
  line(ctx,[[x-18,y-15],[x-18,y+3]],'#354c41',3);line(ctx,[[x+18,y-15],[x+18,y+3]],'#354c41',3);
}
function shelf(ctx,x,y) {
  shadow(ctx,x,y);box(ctx,x,y,29,15,44,['#8a8060','#4b5241','#696951']);
  for(let i=0;i<3;i++){let yy=y-32+i*12;polygon(ctx,[[x+2,yy],[x+13,yy-5],[x+13,yy+2],[x+2,yy+8]],'#2e4036');line(ctx,[[x+2,yy+8],[x+13,yy+2]],'#a49a70',1);}
  box(ctx,x+7,y-22,6,4,8,['#bbb183','#867c57','#a99b6e']);box(ctx,x+8,y-9,6,4,5,['#95a5a0','#59746c','#6c8c78']);
}
function table(ctx,x,y,zone) {
  shadow(ctx,x,y);line(ctx,[[x-17,y-13],[x-17,y+5]],'#4d4834',3);line(ctx,[[x+17,y-13],[x+17,y+5]],'#4d4834',3);line(ctx,[[x,y-4],[x,y+13]],'#635439',3);
  box(ctx,x,y-12,41,22,4,['#bba077','#786846','#998058']);
  box(ctx,x-3,y-19,10,6,3,['#ddd2a7','#bdb18b','#c4bd9e']);line(ctx,[[x+5,y-20],[x+12,y-23]],'#35473b',3);
  box(ctx,x+10,y-19,5,4,8,['#b8c3a0','#63867b','#8fa492']);
}
function crate(ctx,x,y,kind,empty,highlight,time) {
  const metal=/locker|cabinet|wardrobe|shelf|衣|櫃|醫|醫療/.test(kind);
  shadow(ctx,x,y,21,8);const height=metal?29:18;
  const colors=empty?['#656d59','#424f42','#536151']:metal?['#87a393','#47695f','#638678']:['#b59864','#75623f','#947b4f'];
  box(ctx,x,y,29,19,height,colors);
  if(metal){line(ctx,[[x+1,y-height+10],[x+1,y+8]],'#334e46',1);line(ctx,[[x+7,y-height+11],[x+7,y-height+18]],'#c5cfaf',2);}
  else{
    polygon(ctx,[[x-11,y-height+2],[x-7,y-height+4],[x-7,y+4],[x-11,y+2]],'#524d35');
    polygon(ctx,[[x+6,y-height+6],[x+10,y-height+3],[x+10,y+3],[x+6,y+6]],'#62553a');
    line(ctx,[[x-11,y-height+1],[x+4,y-height-6]],'#d3b57a',1);box(ctx,x+1,y-6,5,3,5,['#d8c787','#9b8a5a','#bca565']);
  }
  if(!empty){
    ctx.save();ctx.globalAlpha=.72+.2*Math.sin(time*.003+x);ctx.shadowColor='#f0d09a';ctx.shadowBlur=7;
    polygon(ctx,[[x,y-height-10],[x+3,y-height-6],[x,y-height-2],[x-3,y-height-6]],'#e8c582');ctx.restore();
  }
  if(highlight)label(ctx,x,y-height-24,'E  搜刮','#e8d8b3');
}
function flame(ctx,x,y,time,large=false) {
  let f=Math.sin(time*.013)*2,sz=large?1.4:1;
  ctx.save();ctx.translate(x,y);ctx.scale(sz,sz);
  const glow=ctx.createRadialGradient(0,-7,0,0,-7,70);glow.addColorStop(0,'#eeb3673d');glow.addColorStop(1,'#edb16e00');ctx.fillStyle=glow;ctx.fillRect(-70,-77,140,140);
  for(let i=0;i<6;i++){let a=i*Math.PI/3;rock(ctx,Math.cos(a)*13,Math.sin(a)*5,5);}
  line(ctx,[[-10,2],[10,-3]],'#795534',5);line(ctx,[[-8,-4],[9,3]],'#a47a44',4);
  polygon(ctx,[[-8,0],[-9,-9],[f-3,-20],[0,-12],[4+f,-27],[9,-12],[8,-3],[1,2]],'#df8b46');
  polygon(ctx,[[-5,0],[-3,-9],[2+f,-18],[5,-6],[3,1]],'#f4c17b');
  polygon(ctx,[[-2,0],[0,-9],[3,-2]],'#f9e4af');
  for(let i=0;i<3;i++){const z=(time*.025+i*19)%50;oval(ctx,Math.sin(z*.12+i)*6,-z-8,1,1.7,`rgba(238,192,115,${1-z/50})`);}
  ctx.restore();
}
function beacon(ctx,x,y,time) {
  shadow(ctx,x,y,29,10);box(ctx,x,y,43,26,8,['#95a295','#485f59','#687d6c']);
  box(ctx,x,y-7,16,11,33,['#b6b599','#596f65','#829486']);
  line(ctx,[[x,y-38],[x,y-76]],'#b8c6a9',2);line(ctx,[[x-18,y-58],[x+18,y-58]],'#9ea887',2);
  line(ctx,[[x-12,y-62],[x-12,y-53]],'#d6c88f',2);line(ctx,[[x+12,y-62],[x+12,y-53]],'#d6c88f',2);
  const glow=ctx.createRadialGradient(x,y-76,0,x,y-76,27);glow.addColorStop(0,'#d8edb97a');glow.addColorStop(1,'#b8dfae00');ctx.fillStyle=glow;ctx.fillRect(x-28,y-104,56,56);
  oval(ctx,x,y-76,3,3,'#ddedbd');
  ctx.strokeStyle='#b9d5a938';ctx.lineWidth=1;let r=8+(time*.015)%20;ctx.beginPath();ctx.ellipse(x,y-75,r,r*.42,0,Math.PI,Math.PI*2);ctx.stroke();
}
function building(ctx,x,y,type,time) {
  type=String(type||'').toLowerCase();
  if(/fire|camp|篝火|營火/.test(type))return flame(ctx,x,y,time);
  if(/bed|sleep|床/.test(type))return bed(ctx,x,y);
  if(/bench|table|工作|製作/.test(type))return table(ctx,x,y);
  if(/beacon|radio|信標|無線/.test(type))return beacon(ctx,x,y,time);
  if(/water|collector|集水|水/.test(type)){
    shadow(ctx,x,y);box(ctx,x,y,28,19,23,['#71918b','#395f56','#5b7f6c']);
    polygon(ctx,[[x,y-39],[x+21,y-25],[x,y-13],[x-21,y-25]],'#93b4a0');
    polygon(ctx,[[x,y-33],[x+15,y-24],[x,y-17],[x-15,y-24]],'#537d77');oval(ctx,x,y-23,7,3,'#91c9b4');return;
  }
  if(/barricade|路障/.test(type)){shadow(ctx,x,y,25,8);for(let i=-1;i<=1;i++){const bx=x+i*13,by=y+i*6;line(ctx,[[bx-5,by+2],[bx+5,by-27]],'#8e7851',5);line(ctx,[[bx+5,by+2],[bx-5,by-24]],'#b09562',4);}line(ctx,[[x-22,y-20],[x+22,y+1]],'#d1b27b',4);return;}
  if(/wall|牆/.test(type))return wall(ctx,x,y,'x','base',.5);
  crate(ctx,x,y,type,false,false,time);
}
function label(ctx,x,y,text,color='#e4d8b6') {
  ctx.save();ctx.font='600 10px "Noto Sans TC",sans-serif';const w=ctx.measureText(text).width+15;
  ctx.fillStyle='#132a27df';ctx.strokeStyle='#8da78866';ctx.lineWidth=.75;ctx.beginPath();ctx.roundRect(x-w/2,y-9,w,19,4);ctx.fill();ctx.stroke();ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,x,y+.5);ctx.restore();
}
let anim={zone:null,x:8,y:9,tx:8,ty:9,last:0,move:0,dir:1};
function survivor(ctx,x,y,time,moving,dir,hp) {
  shadow(ctx,x,y,14,5);const step=Math.sin(time*.014)*moving*5,bob=Math.abs(Math.sin(time*.014))*moving*1.5;
  ctx.save();ctx.translate(x,y-bob);ctx.scale(dir<0?-1:1,1);
  // Boots, articulated trousers, rust jacket, utility pack and lamp.
  line(ctx,[[-3,-18],[-5+step*.5,-10],[-5+step,0]],'#273b3a',5);
  line(ctx,[[4,-18],[5-step*.5,-10],[5-step,0]],'#3e5148',5);
  line(ctx,[[-5+step,0],[-1+step,1]],'#182c29',4);line(ctx,[[5-step,0],[9-step,1]],'#223a32',4);
  polygon(ctx,[[-8,-35],[5,-37],[10,-27],[7,-18],[-7,-17],[-11,-25]],'#ad704e');
  polygon(ctx,[[0,-36],[6,-37],[10,-26],[7,-18],[0,-18]],'#c1875b');
  polygon(ctx,[[-10,-34],[-3,-32],[-2,-18],[-11,-19],[-14,-25]],'#425b4c');
  line(ctx,[[-10,-31],[-11,-23],[-4,-20]],'#607760',3);
  line(ctx,[[5,-33],[11,-26-step*.3],[10+step*.6,-20]],'#c0875f',4);
  oval(ctx,10+step*.6,-19,2.5,2.5,'#dbc29b');
  line(ctx,[[-3,-20],[7,-20]],'#705b3c',2);box(ctx,8,-19,4,3,6,['#e0c994','#967b4d','#bd9f69']);
  oval(ctx,0,-40,6.4,7,'#cbb28c');
  polygon(ctx,[[-6,-40],[-7,-46],[-3,-49],[3,-48],[7,-44],[6,-39],[3,-43]],'#293b31');
  polygon(ctx,[[3,-42],[8,-40],[5,-38],[3,-38]],'#dfc69c');
  line(ctx,[[-5,-35],[1,-33],[6,-35]],'#d0aa71',2);
  ctx.restore();
}
function enemy(ctx,x,y,time,hp,seed) {
  shadow(ctx,x,y,13,5);const step=Math.sin(time*.006+seed*4)*2;
  line(ctx,[[-3+x,y-15],[-6+x,y+step],[x-2,y+step]],'#2d3b35',4);line(ctx,[[x+4,y-15],[x+6,y-step],[x+10,y-step]],'#35443c',4);
  polygon(ctx,[[x-7,y-32],[x+5,y-34],[x+10,y-20],[x+5,y-13],[x-7,y-15],[x-10,y-24]],'#606854');
  line(ctx,[[x+6,y-29],[x+13,y-24],[x+10,y-20]],'#8c9578',3);oval(ctx,x,y-38,6,7,'#9ba38b');
  polygon(ctx,[[x-6,y-38],[x-5,y-45],[x+2,y-45],[x+5,y-42]],'#4b5947');
  line(ctx,[[x+1,y-39],[x+4,y-38]],'#d79e75',2);
  ctx.fillStyle='#263f36';ctx.fillRect(x-13,y-53,26,3);ctx.fillStyle='#bd7864';ctx.fillRect(x-13,y-53,26*clamp(hp/28,0,1),3);
}
function drawGround(ctx,x,y,gx,gy,zone) {
  let t=terrain(zone,gx,gy),n=hash(gx,gy),floor=(zone==='base'&&gx>=4&&gx<=13&&gy>=4&&gy<=10)||(zone==='ruins'&&gx>=4&&gx<=13&&gy>=4&&gy<=12);
  if(floor) {
    const colors=zone==='base'?['#77795b','#737558','#7c7d60','#7e8062']:['#737e6b','#7b8270','#6e7969','#858875'];
    diamond(ctx,x,y,64,32,colors[Math.floor(n*4)],'#394b3d55');
    if(zone==='base') {
      for(let j=-1;j<=1;j++){let q=j*8;line(ctx,[[x-16+q,y-8-q*.5],[x+16+q,y+8-q*.5]],'#b5ad792b',.8);}
      line(ctx,[[x,y-16],[x-32,y]],'#344c3b48',.9);
      if(n>.7)line(ctx,[[x-8,y-2],[x+4,y+4]],'#5d664724',2);
    } else if(n>.64)line(ctx,[[x-12,y-5],[x-3,y-1],[x-6,y+5],[x+7,y+8]],'#3d514440',.8);
  } else {
    const path=(Math.abs(gx-gy)<1.7||Math.abs(gx-8)<1.5||Math.abs(gy-11)<.9),colors=path?['#7e8060','#828362','#898766','#787e5c']:zone==='forest'?['#4c684f','#526e52','#586d52','#54674d']:['#607353','#657956','#6c7c57','#6b7754'];
    diamond(ctx,x,y,64,32,colors[Math.floor(n*4)],'#87947509');
    for(let i=0;i<3;i++) {
      const dx=(hash(gx,gy,i+4)-.5)*37,dy=(hash(gx,gy,i+8)-.5)*12;
      if(n>.35)line(ctx,[[x+dx,y+dy],[x+dx+2,y+dy-.5]],i%2?'#bac08c28':'#3e594526',1);
    }
    if(!path&&t==='ground'&&n>.45)plant(ctx,x+8,y+2,n);
  }
  if(gx===17)polygon(ctx,[[x,y+16],[x+32,y],[x+32,y+8],[x,y+24]],'#344939');
  if(gy===17)polygon(ctx,[[x-32,y],[x,y+16],[x,y+24],[x-32,y+8]],'#2b4035');
}
export function render(ctx,state,width,height,view={}) {
  if(!ctx||!state)return;
  const time=typeof performance!=='undefined'?performance.now():Date.now(),zone=validZone(state.zone),c=camera(width,height,view);
  ctx.save();ctx.clearRect(0,0,width,height);
  const bg=ctx.createLinearGradient(0,0,width,height);bg.addColorStop(0,'#193431');bg.addColorStop(.55,'#203f35');bg.addColorStop(1,'#142d2a');ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);
  const mist=ctx.createRadialGradient(width*.48,height*.45,10,width*.48,height*.45,width*.6);mist.addColorStop(0,'#8eaa6c13');mist.addColorStop(1,'#0b242433');ctx.fillStyle=mist;ctx.fillRect(0,0,width,height);
  // Quiet contour lines place the floating cutaway in its wider landscape.
  ctx.lineWidth=.7;for(let k=0;k<6;k++){ctx.strokeStyle='#80a4880c';ctx.beginPath();ctx.ellipse(width*.52,height*.55,width*.24+k*49,height*.12+k*25,-.08,0,Math.PI*2);ctx.stroke();}
  ctx.translate(c.ox,c.oy);ctx.scale(c.s,c.s);
  const point=(x,y)=>[(x-y)*32,(x+y)*16];
  const b=point(8.5,8.5);oval(ctx,b[0]+18,b[1]+26,530,240,'#081c1c4d');
  for(let depth=0;depth<35;depth++)for(let x=0;x<18;x++){const y=depth-x;if(y<0||y>=18)continue;const p=point(x,y);drawGround(ctx,p[0],p[1],x,y,zone);}
  // Ground-level clues: scattered paving, old papers and wildflowers.
  for(let y=1;y<17;y++)for(let x=1;x<17;x++) {
    let n=hash(x,y,23),p=point(x,y);if(terrain(zone,x,y)!=='ground')continue;
    if(n>.95)rock(ctx,p[0]+13,p[1]+3,5+n*3,n);
    if(n>.77&&n<.83){oval(ctx,p[0]-8,p[1],1.1,1.3,'#d5bb754f');oval(ctx,p[0]-4,p[1]-2,1,1.1,'#cbd59970');}
  }
  if(zone==='ruins')for(let i=0;i<15;i++){const x=5+hash(i,1)*7,y=5+hash(i,2)*6,p=point(x,y);polygon(ctx,[[p[0]-5,p[1]-2],[p[0]+3,p[1]-5],[p[0]+7,p[1]],[p[0]-2,p[1]+3]],'#c6c2a664');}
  if(zone==='base'){
    // A woven shelter mat and entrance stepping stones.
    const p=point(8,7);diamond(ctx,p[0],p[1],151,73,'#546e5f','#9aaa7855');diamond(ctx,p[0],p[1],127,58,null,'#9dab7945');diamond(ctx,p[0],p[1],44,22,'#81917330');
    for(let i=0;i<4;i++){const q=point(8.2+i*.33,10.8+i*.65);diamond(ctx,q[0],q[1],29,13,'#a1a184','#d0c29a35');}
  }
  const hover=view.hover||state.hover, target=state.target||state.moveTarget||state.destination;
  if(hover&&hover.x>=0&&hover.y>=0&&hover.x<18&&hover.y<18){const p=point(hover.x,hover.y),ok=!['tree','wall'].includes(terrain(zone,hover.x,hover.y));diamond(ctx,p[0],p[1],63,31,ok?'#d9eabf16':'#d7937420',ok?'#d6e8b9a0':'#cc947a88');}
  if(target&&Number.isFinite(target.x)&&Number.isFinite(target.y)){const p=point(target.x,target.y);diamond(ctx,p[0],p[1],29,14,null,'#d6dfada0');}
  const pl=state.player||{x:8,y:9,hp:100},px=Number.isFinite(pl.renderX)?pl.renderX:pl.x,py=Number.isFinite(pl.renderY)?pl.renderY:pl.y;
  if(anim.zone!==zone||Math.abs(anim.x-px)+Math.abs(anim.y-py)>7){anim.x=px;anim.y=py;anim.zone=zone;anim.last=time;}
  const dt=Math.min(60,time-anim.last||16);anim.last=time;const dist=Math.hypot(px-anim.x,py-anim.y);anim.move=clamp(dist*3,0,1);if(dist>.015){anim.dir=px-py>anim.x-anim.y?1:-1;anim.x+=(px-anim.x)*Math.min(1,dt*.012);anim.y+=(py-anim.y)*Math.min(1,dt*.012);}else{anim.x=px;anim.y=py;}
  const pp=point(anim.x,anim.y);
  oval(ctx,pp[0],pp[1]+1,18,8,'#d8eac014');ctx.strokeStyle='#d4dfad99';ctx.lineWidth=1.2;ctx.beginPath();ctx.ellipse(pp[0],pp[1]+1,18,8,0,0,Math.PI*2);ctx.stroke();
  const objects=[];
  for(let y=0;y<18;y++)for(let x=0;x<18;x++){
    const t=terrain(zone,x,y),f=furniture[zone].find(o=>o.x===x&&o.y===y);
    if(t==='tree')objects.push({x,y,z:0,kind:'tree'});
    else if(f)objects.push({...f,z:.1,kind:'furniture'});
    else if(t==='wall')objects.push({x,y,z:0,kind:'wall'});
  }
  let containers=state.containers||[];containers=containers.filter(o=>!o.zone||o.zone===zone);
  const nearest=containers.filter(o=>Math.abs(o.x-pl.x)+Math.abs(o.y-pl.y)<=1).sort((a,b)=>Math.hypot(a.x-pl.x,a.y-pl.y)-Math.hypot(b.x-pl.x,b.y-pl.y))[0];
  containers.forEach(o=>objects.push({...o,z:.2,kind:'crate'}));
  (state.buildings||[]).filter(o=>!o.zone||o.zone===zone).forEach(o=>objects.push({...o,z:.15,kind:'building'}));
  (state.enemies||[]).filter(o=>o.hp>0&&(!o.zone||o.zone===zone)).forEach(o=>objects.push({...o,z:.4,kind:'enemy'}));
  objects.push({x:anim.x,y:anim.y,z:.5,kind:'player'});
  objects.sort((a,b)=>(a.x+a.y+a.z)-(b.x+b.y+b.z));
  for(const o of objects){const p=point(o.x,o.y),seed=hash(o.x,o.y);ctx.save();
    if(o.kind==='tree'){if(Math.abs(o.x-anim.x)<1.5&&Math.abs(o.y-anim.y)<1.5&&o.x+o.y>anim.x+anim.y)ctx.globalAlpha=.5;conifer(ctx,p[0],p[1],seed,time);}
    else if(o.kind==='wall')wall(ctx,p[0],p[1],o.y===4||o.y===12?'x':'y',zone,seed);
    else if(o.kind==='furniture'){if(o.type==='bed')bed(ctx,...p);else if(o.type==='shelf')shelf(ctx,...p);else table(ctx,...p,zone);}
    else if(o.kind==='crate'){const values=Object.values(o.items||{}),empty=o.looted||o.empty||values.every(v=>(typeof v==='number'?v:v.qty||0)<=0);crate(ctx,p[0],p[1],o.name||o.type||'',empty,nearest?.id===o.id,time);}
    else if(o.kind==='building')building(ctx,p[0],p[1],o.type,time);
    else if(o.kind==='enemy')enemy(ctx,p[0],p[1],time,o.hp,seed);
    else if(o.kind==='player')survivor(ctx,p[0],p[1],time,anim.move,anim.dir,pl.hp);
    ctx.restore();
  }
  // Drifting motes and subtle sun shafts keep the scene alive when standing still.
  ctx.save();ctx.globalCompositeOperation='screen';
  for(let i=0;i<17;i++){const xx=-480+hash(i,8)*950+Math.sin(time*.00012+i)*13,yy=30+((hash(i,9)*570-time*.003)%570+570)%570;oval(ctx,xx,yy,.7+(i%3)*.25,.9,`rgba(217,214,165,${.15+.15*Math.sin(time*.001+i)})`);}
  ctx.restore();
  const night=!!state.waveActive;
  if(night){ctx.fillStyle='#092b4550';ctx.fillRect(-width/c.s,-height/c.s,width*2/c.s,height*2/c.s);}
  ctx.restore();
  const edge=ctx.createRadialGradient(width/2,height*.5,Math.min(width,height)*.27,width/2,height*.5,Math.max(width,height)*.65);edge.addColorStop(0,'#0d292500');edge.addColorStop(1,'#08221f73');ctx.fillStyle=edge;ctx.fillRect(0,0,width,height);
  return {player:tileToScreen(anim.x,anim.y,width,height,view),scale:c.s};
}
