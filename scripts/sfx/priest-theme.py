"""Prepare reference variations, review and export the priest sound family.

setup/review use the analysis Python (torch/torchaudio/scipy/CLAP).
encode uses the Stable Audio runtime Python (soundfile).
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import wave

ROOT = Path(__file__).resolve().parents[2]
INITIAL_REVIEW = Path(__file__).with_name('priest-theme-review.json')
THEME = ('Fantasy priest healing sound effect. Warm midrange choir-like synthetic harmonics, '
         'breathy airy shimmer, rounded onset, soft natural decay, spacious stereo. '
         'One isolated event. No intelligible voice, lyrics, music, drums, bell strikes, '
         'harp plucks, harsh buzz or background ambience.')


def write(path, x, sr):
    import numpy as np
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), 'wb') as f:
        f.setparams((x.shape[1], 2, sr, 0, 'NONE', 'not compressed'))
        f.writeframes((np.clip(x, -1, 32767/32768)*32768).round().astype('<i2').tobytes())


def setup(args, specs):
    import numpy as np
    import torch
    import torchaudio.functional as AF
    from scipy import signal
    from combat_quality import read_wav
    torch.set_num_threads(2)
    x, sr = read_wav(args.reference)
    args.work.mkdir(parents=True, exist_ok=True)
    manifest = []
    for i, s in enumerate(specs):
        if args.names and s['name'] not in args.names: continue
        if args.trim is not None: s={**s,'trim':args.trim}
        ref = args.work / 'references' / (s['name']+'.wav')
        if ref.exists():
            raise FileExistsError(ref)
        # Retain the useful swell and full quiet tail, then change pitch and time
        # independently. A phase vocoder avoids speeding up every short spell.
        y = x[round(s['trim']*sr):round(2.30*sr)].copy()
        ratio = 2**(s['pitch']/12)
        desired = round(s['duration']*sr)
        stretched_len = round(desired*ratio)
        tensor = torch.tensor(y.T, dtype=torch.float32)
        window = torch.hann_window(1024)
        z = torch.stft(tensor, 1024, hop_length=256, window=window, return_complex=True)
        phase = torch.linspace(0, np.pi*256, z.shape[-2])[..., None]
        z = AF.phase_vocoder(z, len(y)/stretched_len, phase)
        y = torch.istft(z, 1024, hop_length=256, window=window, length=stretched_len).numpy().T
        y = signal.resample(y, desired, axis=0)
        fin = min(round(sr*.012), len(y)//4)
        y[:fin] *= np.linspace(0, 1, fin)[:, None]
        y[-round(sr*.08):] *= np.linspace(1, 0, round(sr*.08))[:, None]
        y *= min(10**(-24/20)/np.sqrt(np.mean(y*y)), .6/abs(y).max())
        seconds = max(1.2, s['duration']+.20)
        y = np.pad(y, ((0, round(seconds*sr)-len(y)), (0, 0)))
        write(ref, y, sr)
        ref.with_suffix('.json').write_text(json.dumps({'source':str(args.reference),
            'source_sha256':hashlib.sha256(args.reference.read_bytes()).hexdigest(),'recipe':s},ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
        manifest.append({'name':s['name']+'-01', 'reference':str(ref.resolve()),
                         'prompt':s['description']+' '+THEME+f" The complete sound fades to silence within {s['duration']} seconds.",
                         'strength':s['strength'], 'seed':2026102200+i,
                         'seconds':seconds, 'steps':4})
    (args.work/'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8', newline='\n')
    print(json.dumps({'references':len(manifest), 'manifest':str(args.work/'manifest.json')}))


def review(args, specs):
    import numpy as np
    from scipy import signal
    from scipy.ndimage import gaussian_filter1d, uniform_filter1d
    import torch
    from transformers import ClapModel, ClapProcessor
    from combat_quality import read_wav, db
    torch.set_num_threads(2)
    model=ClapModel.from_pretrained(args.model,local_files_only=True,disable_mmap=True).eval()
    processor=ClapProcessor.from_pretrained(args.model,local_files_only=True)
    labels=['A warm airy magical healing spell with shimmering choir-like synthetic harmonics.',
            'A soft rising magical whoosh with a smooth resonant shimmering decay.',
            'A person speaking words.', 'A person singing lyrics.',
            'Continuous music with drums and rhythm.', 'Harsh distorted electrical buzzing.']
    def normalize(t):
        if not isinstance(t,torch.Tensor): t=t.pooler_output
        return torch.nn.functional.normalize(t,dim=-1)
    def embed(x,sr):
        # Compare timbre at a common level. Quiet cast/relay accents are mixed
        # 4-5 dB below spells; CLAP otherwise changes its labels with gain alone.
        gain=min(10**(-24/20)/max(np.sqrt(np.mean(x*x)),1e-12),.7/max(abs(x).max(),1e-12))
        x=x*gain
        y=x.mean(1).astype(np.float32)
        y=signal.resample_poly(y,48000//np.gcd(sr,48000),sr//np.gcd(sr,48000))
        return normalize(model.get_audio_features(**processor(audio=y,sampling_rate=48000,return_tensors='pt',padding='pad')))
    reports=[]; selected={}; (args.work/'review').mkdir(exist_ok=True)
    with torch.inference_mode():
        texts=normalize(model.get_text_features(**processor(text=labels,return_tensors='pt',padding=True,truncation=True)))
        for s in specs:
            ref,rs=read_wav(args.work/'references'/(s['name']+'.wav'))
            re=embed(ref,rs)
            passed=[]
            for path in sorted(args.work.glob(s['name']+'-[0-9][0-9].wav')):
                x,sr=read_wav(path)
                if not len(x) or not np.isfinite(x).all(): raise ValueError(path)
                # Remove only the codec floor; leave the audible swell and tail.
                env=np.sqrt(np.maximum(uniform_filter1d(np.mean(x*x,axis=1),size=round(sr*.02)),0))
                upper=min(-50,db(env.max())-37)
                t=np.clip((20*np.log10(np.maximum(env,1e-12))-(upper-14))/14,0,1)
                x*=gaussian_filter1d(t*t*(3-2*t),sigma=sr*.005)[:,None]
                end=round(s['duration']*sr)
                y=x[:end].copy()
                tail=db(np.sqrt(np.mean(y[-round(sr*.05):]**2))/max(env.max(),1e-12))
                gain=min(10**(s['rms']/20)/max(np.sqrt(np.mean(y*y)),1e-12),10**(-4/20)/max(abs(y).max(),1e-12))
                y*=gain
                y[:round(sr*.008)]*=np.linspace(0,1,round(sr*.008))[:,None]
                y[-round(sr*.06):]*=np.linspace(1,0,round(sr*.06))[:,None]
                output=args.work/'review'/path.name
                write(output,y,sr)
                y,_=read_wav(output)
                emb=embed(y,sr); similarity=float((emb@re.T)[0,0]); scores=(emb@texts.T)[0].tolist()
                rms=db(np.sqrt(np.mean(y*y))); peak=db(abs(y).max())
                reasons=[]
                if similarity<.65: reasons.append('reference family similarity below .65')
                if max(scores[:2])<.35: reasons.append('insufficient airy harmonic texture')
                if max(scores[2:])>max(scores[:2])-.08: reasons.append('unwanted sound class too strong')
                if tail>-28: reasons.append('audible tail would be cut')
                if rms<-34: reasons.append('near silence or excessive crest factor')
                if peak>-3.5 or np.mean(abs(y)>=.999)>.002: reasons.append('insufficient headroom')
                record={'name':s['name'],'source':path.name,'seconds':len(y)/sr,'sample_rate':sr,'channels':y.shape[1],
                        'reference_similarity':round(similarity,4),'descriptors':dict(zip(labels,[round(v,4) for v in scores])),
                        'rms_dbfs':round(rms,2),'peak_dbfs':round(peak,2),'tail_before_fade_db':round(tail,2),
                        'expander_upper_dbfs':round(upper,2),'gain_db':round(db(gain),2),
                        'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),
                        'reasons':reasons,'screening':'reject' if reasons else 'pass'}
                reports.append(record)
                if not reasons: passed.append(record)
                print(json.dumps({k:record[k] for k in ['name','source','reference_similarity','tail_before_fade_db','screening','reasons']},ensure_ascii=False),flush=True)
            if passed: selected[s['name']]=max(passed,key=lambda c:c['reference_similarity'])['source']
    report={'method':'Local CLAP at common -24dBFS RMS (headroom limited) + signal screening; no human listening. Listening files keep their intended mix levels.',
            'criteria':{'reference_similarity_min':.65,'theme_match_min':.35,'unwanted_margin':.08,'tail_before_fade_max_db':-28},
            'candidates':reports,'selected':selected,'retry':[s['name'] for s in specs if s['name'] not in selected]}
    (args.work/'screening.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')


def encode(args,specs):
    import numpy as np
    import soundfile as sf
    report=json.loads((args.work/'screening.json').read_text(encoding='utf-8'))
    if report['retry']: raise ValueError('Some priest cues still need regeneration')
    out=args.work/'encoded';out.mkdir(exist_ok=False)
    records=[]
    for s in specs:
        chosen=report['selected'][s['name']]
        x,sr=sf.read(args.work/'review'/chosen,always_2d=True)
        path=out/(s['name']+'.ogg')
        with sf.SoundFile(path,'w',sr,x.shape[1],format='OGG',subtype='VORBIS',compression_level=.35) as f: f.write(x)
        y,ys=sf.read(path,always_2d=True)
        if y.shape!=x.shape or ys!=sr or not np.isfinite(y).all() or abs(y).max()>=.9: raise ValueError(path)
        records.append({'spec':s,'generation':json.loads((args.work/Path(chosen).with_suffix('.json')).read_text(encoding='utf-8')),
                        'screening':next(c for c in report['candidates'] if c['source']==chosen),
                        'file':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
                        'decoded_peak':float(abs(y).max())})
    (out/'review.json').write_text(json.dumps({'paid_api_calls':0,'human_listening':'not performed',
        'method':report['method'],'criteria':report['criteria'],
        'candidate_screening':report['candidates'],'cues':records},ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    print(json.dumps({'encoded':len(records),'output':str(out)}))


def derive(args,specs):
    """Use accepted motifs for quiet feedback instead of repeatedly generating vowels."""
    import numpy as np
    from scipy import signal
    from combat_quality import read_wav
    spec_by_name={s['name']:s for s in specs}
    recipes=[('priest-purify-05','priest-ready-01',1.1,True),
             ('priest-crit-06','priest-ready-01',1,False),
             ('priest-relay-hop-06','priest-relay-01',1,False)]
    report=json.loads((args.work/'screening.json').read_text(encoding='utf-8'))
    for name,parent,ratio,processed in recipes:
        dest=args.work/(name+'.wav')
        if dest.exists(): raise FileExistsError(dest)
        if not any(c['source']==parent+'.wav' and c['screening']=='pass' for c in report['candidates']):
            raise ValueError('Parent must pass review first: '+parent)
        source=args.work/('review' if processed else '')/(parent+'.wav')
        spec=spec_by_name[name.rsplit('-',1)[0]]
        if processed:
            x,sr=read_wav(source)
            x=signal.resample(x,round(len(x)/ratio),axis=0)
            x=np.pad(x,((0,round(sr*.2)),(0,0)))
            write(dest,x,sr)
        else: shutil.copyfile(source,dest)
        meta={'generator':'Sound-design variation of an accepted Agent Audio take; no additional model call',
              'parent_generation':json.loads((args.work/(parent+'.json')).read_text(encoding='utf-8')),
              'processing':{'source':str(source),'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
                            'playback_ratio':ratio,'duration':spec['duration'],'target_rms_dbfs':spec['rms']}}
        dest.with_suffix('.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('mode', choices=['setup', 'review', 'derive', 'encode'])
    ap.add_argument('--work', type=Path, required=True)
    ap.add_argument('--reference', type=Path)
    ap.add_argument('--model')
    ap.add_argument('--names', nargs='*')
    ap.add_argument('--trim', type=float)
    args=ap.parse_args()
    # This is the original reference-based pipeline. The live catalog now also
    # contains independently redesigned sounds, whose recipe is priest-redesign.py.
    initial=json.loads(INITIAL_REVIEW.read_text(encoding='utf-8'))
    specs=[c['spec'] for c in initial['cues'] if c['spec']['name']!='priest-cast']
    if args.mode=='setup': setup(args, specs)
    elif args.mode=='review': review(args, specs)
    elif args.mode=='derive': derive(args,specs)
    else: encode(args,specs)


if __name__=='__main__': main()
