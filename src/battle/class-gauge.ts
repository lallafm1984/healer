import { art, cssUrl } from '../art';
import type { HeroKey } from '../data/heroes';
import { gaugeConfig, auraGeometry } from './class-gauge-geometry';
import type { ClassGaugeState } from './class-gauge-state';

const polygon = (points: number[][]) => 'polygon(' + points.map(([x,y]) => `${x/1355*100}% ${y/1161*100}%`).join(',') + ')';
const img = (job: HeroKey, layer: string, cls: string) => {
  const e = new Image(); e.src = art('ui-class-' + job + '-' + layer); e.alt = ''; e.className = cls; e.draggable = false; return e;
};
const div = (cls: string) => { const e = document.createElement('div'); e.className = cls; return e; };
const span = (cls: string) => { const e = document.createElement('span'); e.className = cls; e.setAttribute('aria-hidden','true'); return e; };
const priestWindow = [[677,183],[716,240],[786,286],[842,341],[875,400],[889,470],[889,586],[858,578],[826,568],[792,565],[756,572],[723,589],[691,620],[677,652],[663,620],[631,590],[597,573],[561,566],[526,568],[491,580],[465,590],[465,470],[476,402],[505,342],[561,286],[636,240]];
let cache = '';
/** Extra resource slots reuse the approved sprite as independently placed UI pieces. */
function resourceVariant(el: HTMLElement, job: HeroKey, max: number): void {
  const variant=(job==='astrologer'&&max===4)||(job==='monk'&&max===7);
  const key=variant?String(max):'default';
  if(el.dataset.variant===key)return;
  el.dataset.variant=key;el.querySelector('.variant-art')?.remove();
  el.classList.toggle('has-variant',variant);
  if(!variant)return;
  const layer=div('variant-art'),c=gaugeConfig[job as 'monk'|'astrologer'];
  if(job==='monk'){
    const clock=img(job,'base','variant-clock');clock.style.clipPath='inset(76% 0 0 0)';layer.append(clock);
  }
  for(let i=0;i<max;i++){
    const piece=div('variant-segment');
    let points=c.masks[1];
    if(job==='astrologer'){
      piece.style.transformOrigin='0 0';
      piece.style.transform=`translate(${([225,525,825,1125][i]-677*.74)/1355*100}%, ${(585-585*.74)/1161*100}%) scale(.74)`;
    }else{
      const outer:number[][]=[],inner:number[][]=[];
      for(let a=-84;a<=-40;a+=2){outer.push([677+365*Math.cos(a*Math.PI/180),480+365*Math.sin(a*Math.PI/180)]);inner.unshift([677+253*Math.cos(a*Math.PI/180),480+253*Math.sin(a*Math.PI/180)]);}
      points=outer.concat(inner);piece.style.transformOrigin=677/1355*100+'% '+480/1161*100+'%';piece.style.transform='rotate('+i*360/7+'deg)';
    }
    for(const kind of ['base','fill','ready']){
      const mask=div('variant-'+kind),image=img(job,kind,'');mask.style.clipPath=polygon(points);
      if(kind==='fill'){
        const offset=job==='astrologer'?c.offsets![1]:c.offset;
        Object.assign(image.style,{width:c.scale*100+'%',height:(c.scaleY??c.scale)*100+'%',left:offset[0]/1355*100+'%',top:offset[1]/1161*100+'%'});
      }
      mask.append(image);piece.append(mask);
    }
    layer.append(piece);
  }
  el.append(layer);
}
export function buildClassGauge(host: HTMLElement, controls: HTMLElement, job: HeroKey): void {
  controls.dataset.job = job;
  controls.style.setProperty('--class-background', cssUrl(art('ui-class-'+job+'-background')));
  controls.style.setProperty('--class-item-frame', cssUrl(art('ui-class-'+job+'-item-frame')));
  host.replaceChildren(); const el = div('job-gauge'); el.dataset.job = job;
  el.setAttribute('role','progressbar'); el.setAttribute('aria-valuemin','0');
  el.append(img(job,'base','gauge-base'), img(job,'ready','gauge-ready'),span('gauge-number'),span('gauge-extra'));
  host.append(el); cache = '';
  if (job === 'priest') {
    const mask=div('fill-mask'), reveal=div('fill-reveal'), fill=img(job,'fill','gauge-fill');
    mask.style.clipPath=polygon(priestWindow);
    Object.assign(fill.style,{width:'86%',height:'86%',left:90.48/1355*100+'%',top:-8.38/1161*100+'%'});
    reveal.append(fill);mask.append(reveal);el.append(mask);
    const ready=el.querySelector<HTMLElement>('.gauge-ready')!;
    Object.assign(ready.style,{width:'112%',height:'90%',left:-135/1355*100+'%',top:-43/1161*100+'%'});
    return;
  }
  const c=gaugeConfig[job];
  c.masks.forEach((points,index)=>{
    const mask=div('fill-mask'),reveal=div('fill-reveal'),fill=img(job,'fill','gauge-fill');
    mask.style.clipPath=polygon(points);
    Object.assign(fill.style,{width:(c.transforms?.[index]?.sx??c.scale)*100+'%',height:(c.transforms?.[index]?.sy??c.scaleY??c.scale)*100+'%',left:(c.transforms?.[index]?.x??(c.offsets?.[index]??c.offset)[0])/1355*100+'%',top:(c.transforms?.[index]?.y??(c.offsets?.[index]??c.offset)[1])/1161*100+'%'});
    reveal.append(fill);mask.append(reveal);el.append(mask);
  });
  if(job==='shaman'){
    auraGeometry.silhouettes.forEach((points,i)=>{
      const t=auraGeometry.transforms[i],aura=div('totem-aura'),motion=div('aura-motion'),light=img(job,'back-aura','');
      aura.dataset.totem=i===0?'spring':'earth';const [x,y,w,h]=t.clip;
      aura.style.clipPath=polygon([[x,y],[x+w,y],[x+w,y+h],[x,y+h]]);
      motion.style.transformOrigin=t.center[0]/1355*100+'% '+t.center[1]/1161*100+'%';
      Object.assign(light.style,{width:t.sx*100+'%',height:t.sy*100+'%',left:t.x/1355*100+'%',top:t.y/1161*100+'%'});
      motion.append(light);aura.append(motion);
      const front=img(job,'base','totem-foreground');front.style.clipPath=polygon(points);el.append(aura,front);
    });
  }
  if(job==='shaman'||job==='monk'){
    const ready=div('gauge-ready surface-ready');
    el.querySelectorAll<HTMLElement>('.fill-mask').forEach((m,i)=>{
      if(job==='shaman'&&c.groups?.[i]!==0)return;
      const clip=m.cloneNode(true) as HTMLElement;clip.className='ready-surface';
      const light=clip.querySelector('img')!;light.src=art('ui-class-'+job+'-ready');light.className='ready-light';
      if(job==='monk')Object.assign(light.style,{width:'100%',height:'100%',left:'0',top:'0'});
      ready.append(clip);
    });
    el.querySelector('.gauge-ready')!.replaceWith(ready);
  }
  if(job==='warder') [425,678,930].forEach(x=>{
    const target=img(job,'base','target-active');
    target.style.clipPath=polygon([[x,932],[x+25,938],[x+40,951],[x+45,970],[x+40,989],[x+25,1004],[x+52,1017],[x+76,1031],[x+87,1048],[x+78,1061],[x+50,1070],[x,1074],[x-50,1070],[x-78,1061],[x-87,1048],[x-76,1031],[x-52,1017],[x-25,1004],[x-40,989],[x-45,970],[x-40,951],[x-25,938]]);
    el.append(target);
  });
  const num=el.querySelector<HTMLElement>('.gauge-number')!;
  num.style.left=c.pos[0]+'%';num.style.top=c.pos[1]+'%';
}

/** Artwork stays fixed; the reveal, numeric data and activation layers follow live combat state. */
export function updateClassGauge(host: HTMLElement, s: ClassGaugeState): void {
  const el=host.firstElementChild as HTMLElement;if(!el)return;
  const signature=JSON.stringify({...s,count:Math.round(s.count*10)/10,remaining:Math.round(s.remaining*10)/10,cooldown:Math.ceil(s.cooldown),percent:Math.round(s.percent*10)/10});if(cache===signature)return;cache=signature;
  const job=el.dataset.job as HeroKey,full=s.percent>=100;
  resourceVariant(el,job,s.max);
  el.classList.toggle('is-ready',full);el.dataset.ready=String(full);el.dataset.value=String(s.percent);
  el.setAttribute('aria-valuenow',String(Math.min(s.count,s.max)));el.setAttribute('aria-valuemax',String(s.max));
  el.setAttribute('aria-label',s.description);el.setAttribute('aria-valuetext',s.description);host.title=s.description;host.setAttribute('aria-label',s.description);
  el.querySelector<HTMLElement>('.gauge-ready')!.hidden=!full;
  el.querySelector('.gauge-number')!.textContent=job==='priest'?s.count+'%':job==='shaman'?s.remaining.toFixed(1).replace(/\.0$/,''):'';
  el.querySelector('.gauge-extra')!.textContent=job==='shaman'?String(Math.ceil(s.cooldown)):job==='monk'?s.remaining.toFixed(1):'';
  el.querySelectorAll<HTMLElement>('.variant-segment').forEach((piece,i)=>{
    piece.querySelector<HTMLElement>('.variant-fill')!.hidden=i>=s.count;
    piece.querySelector<HTMLElement>('.variant-ready')!.hidden=!full;
  });
  if(job==='shaman'){
    el.querySelector<HTMLElement>('[data-totem=spring]')!.hidden=s.remaining<=0;
    el.querySelector<HTMLElement>('[data-totem=earth]')!.hidden=!s.earth;
  }
  if(job==='warder')el.querySelectorAll<HTMLElement>('.target-active').forEach((e,i)=>e.hidden=i>=Math.ceil(s.targets/Math.max(1,s.targetMax)*3));
  el.querySelectorAll<HTMLElement>('.fill-mask').forEach((m,i)=>{
    const c=job==='priest'?null:gaugeConfig[job];
    const n=job==='priest'?s.percent/100:job==='shaman'?((c!.groups?.[i]??i)===0?(i===0?s.percent/100:s.remaining>0?1:0):s.earth?1:0):Math.max(0,Math.min(1,s.percent/100*c!.masks.length-i));
    m.hidden=n<=0;
    const ys=(job==='priest'?priestWindow:c!.masks[i]).map(v=>v[1]),lo=Math.min(...ys),hi=Math.max(...ys);
    (m.firstElementChild as HTMLElement).style.clipPath=n>=1?'none':`inset(${(hi-(hi-lo)*n)/1161*100}% 0 0 0)`;
  });
}
