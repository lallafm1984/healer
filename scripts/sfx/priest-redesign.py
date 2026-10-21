"""Screen distinct priest sounds, then publish only the complete passing revision.

review: analysis Python (scipy/torch/transformers); publish: audio runtime Python (soundfile).
Generation uses generate-combat.py with priest-redesign.json as the manifest.
"""
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def save(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n', encoding='utf-8', newline='\n')


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write(path,x,sr):
    import wave
    import numpy as np
    with wave.open(str(path),'wb') as f:
        f.setparams((x.shape[1],2,sr,0,'NONE','not compressed'))
        f.writeframes((np.clip(x,-1,32767/32768)*32768).round().astype('<i2').tobytes())


def review(args, specs):
    import numpy as np
    import torch
    from scipy import signal
    from scipy.ndimage import uniform_filter1d, gaussian_filter1d
    from transformers import ClapModel, ClapProcessor
    from combat_quality import read_wav, prepare, db

    torch.set_num_threads(2)
    model = ClapModel.from_pretrained(args.model, local_files_only=True, disable_mmap=True).eval()
    processor = ClapProcessor.from_pretrained(args.model, local_files_only=True)

    def norm(t):
        if not isinstance(t, torch.Tensor): t = t.pooler_output
        return torch.nn.functional.normalize(t, dim=-1)

    def embed(x, sr):
        x = x*min(10**(-24/20)/max(np.sqrt(np.mean(x*x)), 1e-12), .7/max(abs(x).max(), 1e-12))
        y = signal.resample_poly(x.mean(1), 48000//np.gcd(sr,48000), sr//np.gcd(sr,48000)).astype(np.float32)
        return norm(model.get_audio_features(**processor(audio=y,sampling_rate=48000,return_tensors='pt',padding='pad')))

    wrong = ['A person speaking words.', 'A person singing lyrics.',
             'Continuous background music with drums and a beat.',
             'Background room noise and static hiss.', 'Traffic and engine noise.']
    prepared = args.work/'review'; prepared.mkdir(exist_ok=True)
    candidates=[]; selected={}
    with torch.inference_mode():
        ref,sr = read_wav(args.work/'heal-comparison.wav'); reference = embed(ref,sr)
        for spec in specs:
            labels = [spec['match'],'A short fantasy video game sound effect.']+wrong
            text = norm(model.get_text_features(**processor(text=labels,return_tensors='pt',padding=True,truncation=True)))
            passed=[]
            for path in sorted(args.work.glob(spec['name']+'-[0-9][0-9].wav')):
                record={'name':spec['name'],'source':path.name,'reasons':[]}
                try:
                    x,sr=read_wav(path)
                    env=np.sqrt(np.maximum(uniform_filter1d(np.mean(x*x,axis=1),size=round(sr*.02)),0))
                    upper=min(-55,db(env.max())-40)
                    t=np.clip((20*np.log10(np.maximum(env,1e-12))-(upper-12))/12,0,1)
                    x*=gaussian_filter1d(t*t*(3-2*t),sigma=sr*.003)[:,None]
                    mono,metrics,reasons=prepare(x,sr,spec['keep'],spec.get('event_gap',.08))
                    start=round(metrics['onset_seconds']*sr)
                    y=x[start:start+len(mono)].copy()
                    y*=min(10**(spec['rms']/20)/max(np.sqrt(np.mean(y*y)),1e-12),10**(-4/20)/max(abs(y).max(),1e-12))
                    fin=min(len(y),round(sr*.004)); fout=min(len(y)//3,round(sr*.035))
                    y[:fin]*=np.linspace(0,1,fin)[:,None]
                    y[-fout:]*=np.linspace(1,0,fout)[:,None]**2
                    output=prepared/path.name; write(output,y,sr)
                    y,_=read_wav(output)
                    embedding=embed(y,sr); scores=(embedding@text.T)[0].tolist()
                    family=float((embedding@reference.T)[0,0])
                    if scores[0]<.22: reasons.append('low acoustic-description match')
                    if max(scores[2:])>max(scores[:2])+.025: reasons.append('unwanted sound class dominates')
                    if spec['name']!='renew-priest' and family>.80: reasons.append('too similar to retained healing sound')
                    record.update(metrics={**metrics,'seconds':len(y)/sr,'channels':y.shape[1],
                        'rms_db':db(np.sqrt(np.mean(y*y))),'peak_db':db(abs(y).max()),'expander_upper_dbfs':upper},
                        match=spec['match'],descriptors=dict(zip(labels,[round(v,4) for v in scores])),
                        heal_similarity=round(family,4),rank_score=scores[0]-max(scores[2:]),
                        prepared=str(output),sha256=digest(output),reasons=reasons)
                except ValueError as error: record['reasons'].append(str(error))
                record['screening']='reject' if record['reasons'] else 'pass'
                candidates.append(record)
                if not record['reasons']: passed.append(record)
                print(json.dumps({k:record.get(k) for k in ['source','screening','heal_similarity','reasons']},ensure_ascii=False),flush=True)
            if passed: selected[spec['name']]=max(passed,key=lambda c:c['rank_score'])['source']
    report={'method':'Local CLAP acoustic-description match and separation from retained healing audio, plus signal checks; no human listening.',
        'criteria':{'acoustic_match_min':.22,'unwanted_overrun_max':.025,'heal_similarity_max_except_renew':.80,
                    'tail_before_fade_max_db':-18,'phone_band_min_db':-16,'source_clipped_fraction_max':.002},
        'candidates':candidates,'selected':selected,'retry':[s['name'] for s in specs if s['name'] not in selected]}
    save(args.work/'screening.json',report)
    print(json.dumps({'selected':len(selected),'retry':report['retry']}),flush=True)


def publish(args,specs):
    import shutil
    import numpy as np
    import soundfile as sf
    from combat_quality import db
    report=json.loads((args.work/'screening.json').read_text(encoding='utf-8'))
    if report['retry'] or set(report['selected'])!={s['name'] for s in specs}: raise ValueError('Incomplete screening')
    preserved=json.loads((args.work/'preserved.json').read_text(encoding='utf-8-sig'))
    for p in preserved:
        if digest(ROOT/'src/sfx'/(p['name']+'.ogg')).lower()!=p['hash'].lower(): raise ValueError('Retained audio changed: '+p['name'])
    encoded=args.work/'encoded'; encoded.mkdir(exist_ok=False); records=[]
    for spec in specs:
        source=report['selected'][spec['name']]
        chosen=next(c for c in report['candidates'] if c['source']==source)
        if chosen['screening']!='pass': raise ValueError(source)
        x,sr=sf.read(args.work/'review'/source,always_2d=True)
        path=encoded/(spec['name']+'.ogg')
        with sf.SoundFile(path,'w',sr,x.shape[1],format='OGG',subtype='VORBIS',compression_level=.35) as f: f.write(x)
        y,ys=sf.read(path,always_2d=True)
        if x.shape!=y.shape or ys!=sr or not np.isfinite(y).all() or abs(y).max()>=.9: raise ValueError(path)
        records.append({'name':spec['name'],'seconds':len(y)/sr,'channels':y.shape[1],
            'generation':json.loads((args.work/Path(source).with_suffix('.json')).read_text(encoding='utf-8')),
            'screening':chosen,'file':path.name,'sha256':digest(path),'encoded_peak_dbfs':db(abs(y).max())})
    # All validation precedes replacing any game asset.
    for record in records: shutil.copyfile(encoded/record['file'],ROOT/'src/sfx'/record['file'])
    catalog_path=ROOT/'scripts/sfx/priest-theme.json'
    catalog=json.loads(catalog_path.read_text(encoding='utf-8'))
    for s in catalog:
        record=next((r for r in records if r['name']==s['name']),None)
        s['retained']=record is None
        if record:
            spec=next(x for x in specs if x['name']==s['name'])
            for key in ['pitch','trim','strength']: s.pop(key,None)
            s.update(duration=record['seconds'],rms=spec['rms'],description=spec['match'],prompt=spec['prompt'],texture=spec['texture'])
    save(catalog_path,catalog)
    save(ROOT/'scripts/sfx/priest-redesign-review.json',{'paid_api_calls':0,'human_listening':'not performed',
        'preserved':preserved,'screening':report,'sounds':records})
    print(json.dumps({'published':len(records),'preserved':len(preserved)}))


if __name__=='__main__':
    ap=argparse.ArgumentParser(); ap.add_argument('mode',choices=['review','publish'])
    ap.add_argument('--work',type=Path,required=True); ap.add_argument('--model'); args=ap.parse_args()
    specs=json.loads((args.work/'manifest.json').read_text(encoding='utf-8'))
    (review if args.mode=='review' else publish)(args,specs)
