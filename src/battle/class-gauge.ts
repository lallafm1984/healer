import { art, cssUrl } from '../art';
import type { HeroKey } from '../data/heroes';
import { gaugeConfig, auraGeometry } from './class-gauge-geometry';
import type { ClassGaugeState } from './class-gauge-state';
import { beaconLabel } from './class-gauge-state';

const polygon = (points: number[][]) => 'polygon(' + points.map(([x,y]) => `${x/1355*100}% ${y/1161*100}%`).join(',') + ')';
const img = (job: HeroKey, layer: string, cls: string) => {
  const e = new Image(); e.src = art(job==='druid'&&['base','fill','ready'].includes(layer)?'ui-class-druid-resource-b2':'ui-class-' + job + '-' + layer); e.alt = ''; e.className = cls; e.draggable = false; return e;
};
const div = (cls: string) => { const e = document.createElement('div'); e.className = cls; return e; };
const span = (cls: string) => { const e = document.createElement('span'); e.className = cls; e.setAttribute('aria-hidden','true'); return e; };
const priestWindow = [[677,183],[716,240],[786,286],[842,341],[875,400],[889,470],[889,586],[858,578],[826,568],[792,565],[756,572],[723,589],[691,620],[677,652],[663,620],[631,590],[597,573],[561,566],[526,568],[491,580],[465,590],[465,470],[476,402],[505,342],[561,286],[636,240]];
let cache = '';
/** Extra resource slots reuse the approved sprite as independently placed UI pieces. */
function resourceVariant(el: HTMLElement, job: HeroKey, max: number): void {
  if(job==='astrologer'){
    const key=String(max);if(el.dataset.variant===key)return;
    el.dataset.variant=key;el.classList.add('has-variant');el.querySelector('.variant-art')?.remove();
    const layer=div('variant-art star-grid');
    const cells=max===4?[[0,2],[50,2],[0,51],[50,51]]:[[25,2],[0,51],[50,51]];
    for(const [x,y] of cells){
      const piece=div('variant-segment star-cell'),source=div('star-source');
      Object.assign(piece.style,{left:x+'%',top:y+'%'});
      for(const kind of ['base','fill','ready']){
        const part=div('variant-'+kind),image=img(job,kind,'');
        if(kind==='fill')Object.assign(image.style,{width:'112%',height:'112%',left:-81/1355*100+'%',top:110/1161*100+'%'});
        if(kind==='ready')Object.assign(image.style,{height:'120%',top:'7.32%'});
        part.append(image);source.append(part);
      }
      piece.append(source);layer.append(piece);
    }
    el.append(layer);return;
  }
  const variant=job==='monk'&&max===7;
  const key=variant?String(max):'default';
  if(el.dataset.variant===key)return;
  el.dataset.variant=key;el.querySelector('.variant-art')?.remove();
  el.classList.toggle('has-variant',variant);
  if(!variant)return;
  const layer=div('variant-art'),c=gaugeConfig.monk;
  if(job==='monk'){
    const clock=img(job,'base','variant-clock');clock.style.clipPath='inset(76% 0 0 0)';layer.append(clock);
  }
  for(let i=0;i<max;i++){
    const piece=div('variant-segment');
    let points=c.masks[1];
    {
      const outer:number[][]=[],inner:number[][]=[];
      for(let a=-84;a<=-40;a+=2){outer.push([677+365*Math.cos(a*Math.PI/180),480+365*Math.sin(a*Math.PI/180)]);inner.unshift([677+253*Math.cos(a*Math.PI/180),480+253*Math.sin(a*Math.PI/180)]);}
      points=outer.concat(inner);piece.style.transformOrigin=677/1355*100+'% '+480/1161*100+'%';piece.style.transform='rotate('+i*360/7+'deg)';
    }
    for(const kind of ['base','fill','ready']){
      const mask=div('variant-'+kind),image=img(job,kind,'');mask.style.clipPath=polygon(points);
      if(kind==='fill'){
        const offset=c.offset;
        Object.assign(image.style,{width:c.scale*100+'%',height:(c.scaleY??c.scale)*100+'%',left:offset[0]/1355*100+'%',top:offset[1]/1161*100+'%'});
      }
      mask.append(image);piece.append(mask);
    }
    layer.append(piece);
  }
  (el.querySelector('.resource-art')??el).append(layer);
}
export function buildClassGauge(host: HTMLElement, controls: HTMLElement, job: HeroKey): void {
  controls.dataset.job = job;
  const b4=art('ui-class-'+job+'-background-b4'), b3=art('ui-class-'+job+'-background-b3');
  const background=b4||b3||art('ui-class-'+job+'-background-b2')||art('ui-class-'+job+'-background');
  controls.style.setProperty('--class-background', cssUrl(background));
  // B4는 사제처럼 전체 배경 비율로 그려 얇은 테두리의 원화 비례를 유지한다.
  if(controls.parentElement)controls.parentElement.dataset.panelVersion=b4?'b4':b3?'b3':art('ui-class-'+job+'-background-b2')?'b2':'original';
  // 축소 모드의 전체 폭 배경은 controls 바깥 프레임에서 그린다.
  controls.parentElement?.style.setProperty('--class-background', cssUrl(background));
  controls.style.setProperty('--class-item-frame', cssUrl(art('ui-class-'+job+'-item-frame')));
  host.replaceChildren(); const el = div('job-gauge'); el.dataset.job = job;
  el.setAttribute('role','progressbar'); el.setAttribute('aria-valuemin','0');
  el.append(img(job,'base','gauge-base'), img(job,'ready','gauge-ready'),span('gauge-number'),span('gauge-extra'));
  host.append(el); cache = '';
  if(job==='paladin'){
    const aura=div('paladin-wave-aura');aura.hidden=true;aura.setAttribute('aria-hidden','true');
    // 같은 원화의 파도 부분만 등록해 투명 윤곽에서 빛이 퍼지게 한다.
    const halo=span('paladin-wave-halo'),cutout=span('paladin-wave-cutout');
    cutout.append(img(job,'base','paladin-wave-source'));halo.append(cutout);aura.append(halo);
    el.prepend(aura);
  }
  if (job === 'priest') {
    const mask=div('fill-mask'), reveal=div('fill-reveal'), fill=img(job,'fill','gauge-fill');
    mask.style.clipPath=polygon(priestWindow);
    Object.assign(fill.style,{width:'86%',height:'86%',left:90.48/1355*100+'%',top:-8.38/1161*100+'%'});
    reveal.append(fill);mask.append(reveal);el.append(mask);
    const ready=el.querySelector<HTMLElement>('.gauge-ready')!;
    Object.assign(ready.style,{width:'112%',height:'90%',left:-135/1355*100+'%',top:-43/1161*100+'%'});
    // 원화의 좌우 투명 공간만 뷰포트에서 제외한다. 채움·발광·숫자는 같은 원화 좌표를 유지한다.
    const canvas=div('priest-art');
    canvas.append(...Array.from(el.childNodes));el.append(canvas);
    // 생성은 게이지를 만들 때 한 번만. 활성화는 기존 is-ready 상태가 소유한다.
    const aura=div('priest-aura');aura.setAttribute('aria-hidden','true');
    aura.append(span('priest-halo'));
    for(let i=0;i<5;i++)aura.append(span('priest-spark'));
    el.prepend(aura);
    return;
  }
  const c=gaugeConfig[job];
  c.masks.forEach((points,index)=>{
    const mask=div('fill-mask'),reveal=div('fill-reveal'),fill=img(job,'fill','gauge-fill');
    mask.style.clipPath=polygon(points);
    Object.assign(fill.style,{width:(c.transforms?.[index]?.sx??c.scale)*100+'%',height:(c.transforms?.[index]?.sy??c.scaleY??c.scale)*100+'%',left:(c.transforms?.[index]?.x??(c.offsets?.[index]??c.offset)[0])/1355*100+'%',top:(c.transforms?.[index]?.y??(c.offsets?.[index]??c.offset)[1])/1161*100+'%'});
    reveal.append(fill);mask.append(reveal);el.append(mask);
  });
  if(job==='paladin'){
    // 새 세로형 방패는 정사각형 원화 비율 그대로. 기존 파도·봉화 하단은 원본을 보존한다.
    el.querySelector<HTMLElement>('.gauge-base')!.style.clipPath='polygon(0 61%,55% 61%,55% 58%,100% 58%,100% 100%,0 100%)';
    el.querySelectorAll('.fill-mask').forEach(e=>e.remove());
    const shield=div('paladin-shield'),base=new Image();base.src=art('ui-class-paladin-shield-b3');base.alt='';base.className='shield-base';shield.append(base);
    const masks=['polygon(19% 24%,47% 14%,47% 40%,25% 53%)','polygon(51% 14%,79% 24%,73% 53%,51% 40%)','polygon(49% 43%,71% 56%,62% 72%,49% 82%,35% 68%,27% 56%)'];
    masks.forEach(points=>{const piece=div('shield-segment'),image=base.cloneNode() as HTMLImageElement;image.className='shield-fill';piece.style.clipPath=points;piece.append(image);shield.append(piece);});
    const ready=base.cloneNode() as HTMLImageElement;ready.className='gauge-ready shield-ready';el.querySelector('.gauge-ready')!.remove();shield.append(ready);el.append(shield);
  }
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
  // 기존 원화의 투명 여백만 제외한다. 프레임·슬롯 좌표는 직업별로 바꾸지 않는다.
  const crop:Partial<Record<HeroKey,[number,number,number,number]>>={paladin:[84,14,443,442],shaman:[85,45,525,420],monk:[100,20,450,440],warder:[90,65,465,435]};
  const bounds=crop[job];
  if(bounds){
    const [l,t,r,b]=bounds,w=107.547,h=130.016,scale=Math.min(w*.96/(r-l),h*.96/(b-t)),canvas=div('resource-art');
    Object.assign(canvas.style,{width:542*scale/w*100+'%',height:464*scale/h*100+'%',left:((w-(r-l)*scale)/2-l*scale)/w*100+'%',top:((h-(b-t)*scale)/2-t*scale)/h*100+'%'});
    canvas.append(...Array.from(el.childNodes));el.append(canvas);
    if(job==='paladin'){
      // 채택 시안의 원화 좌표(봉화 중심375, 하단440). 슬롯 밖 여백에 놓아 원화와 프레임은 유지한다.
      const name=span('paladin-beacon-name');
      name.style.left=((w-(r-l)*scale)/2+(375-l)*scale)+'px';
      name.style.top=`calc(${(h-(b-t)*scale)/2+(440-t)*scale}px + 1.4px / var(--controls-scale, 1) / var(--gauge-scale, 1))`; // 특성 버튼이 없어 자원 그림을 키워도 화면 1.4px
      host.append(name);
    }
  }
  const num=el.querySelector<HTMLElement>('.gauge-number')!;
  num.style.left=c.pos[0]+'%';num.style.top=c.pos[1]+'%';
}

/** Artwork stays fixed; the reveal, numeric data and activation layers follow live combat state. */
export function updateClassGauge(host: HTMLElement, s: ClassGaugeState): void {
  const el=host.firstElementChild as HTMLElement;if(!el)return;
  const signature=JSON.stringify({...s,count:Math.round(s.count*10)/10,remaining:Math.round(s.remaining*10)/10,cooldown:Math.ceil(s.cooldown),percent:Math.round(s.percent*10)/10});if(cache===signature)return;cache=signature;
  const job=el.dataset.job as HeroKey,full=job==='priest'?s.priestAura!=='off':s.percent>=100;
  if(job==='priest')el.dataset.auraStage=s.priestAura;
  if(job==='paladin'){
    el.dataset.waveReady=String(s.paladinWaveReady);
    el.querySelector<HTMLElement>('.paladin-wave-aura')!.hidden=!s.paladinWaveReady;
    el.querySelectorAll<HTMLElement>('.shield-segment').forEach((piece,i)=>piece.hidden=i>=s.count);
    const name=host.querySelector<HTMLElement>('.paladin-beacon-name')!;
    name.textContent=beaconLabel(s.beaconName);name.title=s.beaconName || '봉화 대상 없음';
    name.classList.toggle('is-unassigned',!s.beaconName);
  }
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
