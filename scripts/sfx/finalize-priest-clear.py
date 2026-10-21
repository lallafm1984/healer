"""Publish the reviewed clear priest revision and shorten the complete SFX library.

Run with the installed audio runtime Python (numpy/soundfile). The work directory
must contain before.json, before/*.ogg, reviewed candidates and shortened/*.wav.
All OGGs are decoded and checked before any live file is replaced.
"""
import argparse
import hashlib
import json
import re
import shutil
from pathlib import Path
import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[2]


def save(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n', encoding='utf-8', newline='\n')


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def metrics(path):
    x, sr = sf.read(path, always_2d=True)
    if not np.isfinite(x).all() or abs(x).max() >= .95 or len(x)/sr > 1.5:
        raise ValueError('Invalid signal, peak or duration: '+str(path))
    return dict(seconds=len(x)/sr, channels=x.shape[1], sample_rate=sr,
                rms_dbfs=20*np.log10(max(np.sqrt(np.mean(x*x)), 1e-12)),
                peak_dbfs=20*np.log10(max(abs(x).max(), 1e-12)), sha256=digest(path))


def main(work):
    before = json.loads((work/'before.json').read_text(encoding='utf-8'))
    report = json.loads((work/'screening.json').read_text(encoding='utf-8'))
    specs = json.loads((work/'manifest.json').read_text(encoding='utf-8'))
    if report['retry'] or set(report['selected']) != {s['name'] for s in specs}:
        raise ValueError('Incomplete candidate screening')
    encoded = work/'encoded'; encoded.mkdir(exist_ok=True)
    records = []

    def encode(name, x, sr, method, **details):
        target = encoded/(name+'.ogg')
        with sf.SoundFile(target, 'w', sr, x.shape[1], format='OGG', subtype='VORBIS', compression_level=.35) as f:
            f.write(x)
        m = metrics(target)
        if round(m['seconds']*sr) != len(x) or m['channels'] != x.shape[1]:
            raise ValueError('OGG round-trip mismatch: '+name)
        records.append(dict(name=name, method=method, **m, **details))

    for spec in specs:
        source = report['selected'][spec['name']]
        selected = next(c for c in report['candidates'] if c['source'] == source)
        if selected['screening'] != 'pass':
            raise ValueError('Rejected candidate: '+source)
        x, sr = sf.read(work/'review'/source, always_2d=True)
        encode(spec['name'], x, sr, 'Agent Audio generation and screened mastering', source=source,
               generation=json.loads((work/Path(source).with_suffix('.json')).read_text(encoding='utf-8')))
    for path in sorted((work/'shortened').glob('*.wav')):
        x, sr = sf.read(path, always_2d=True)
        encode(path.stem, x, sr, 'Pitch-preserving shortening, original 40ms attack and full release retained',
               recipe='retime-sfx.py, target 1.45s, phase vocoder 1024/256, 8ms crossfade, 35ms end fade')
    x, sr = sf.read(work/'before/priest-crit.ogg', always_2d=True)
    old_rms = 20*np.log10(np.sqrt(np.mean(x*x)))
    x *= min(10**(-25/20)/np.sqrt(np.mean(x*x)), 10**(-3/20)/abs(x).max())
    encode('priest-crit', x, sr, 'Louder critical-heal accent', before_rms_dbfs=old_rms,
           game_volume_before=.5, game_volume_after=.85)
    changed = {r['name']: r for r in records}
    if len(changed) != len(records):
        raise ValueError('Duplicate publication target')
    all_results = []
    for original in before:
        name = original['name']; live = ROOT/'src/sfx'/(name+'.ogg')
        if digest(live) != original['sha256']:
            raise ValueError('Audio changed since snapshot: '+name)
        path = encoded/live.name if name in changed else live
        all_results.append(dict(name=name, **metrics(path), changed=name in changed))
    for record in records:
        shutil.copyfile(encoded/(record['name']+'.ogg'), ROOT/'src/sfx'/(record['name']+'.ogg'))
    catalog_path = ROOT/'scripts/sfx/priest-theme.json'
    catalog = json.loads(catalog_path.read_text(encoding='utf-8'))
    for cue in catalog:
        if cue['name'] in changed:
            record = changed[cue['name']]
            cue['duration'] = record['seconds']
            cue['rms'] = round(record['rms_dbfs'], 2)
            if record['method'].startswith('Pitch-preserving'):
                cue['shortened'] = True
            spec = next((s for s in specs if s['name'] == cue['name']), None)
            if spec:
                for key in ['pitch', 'trim', 'strength']: cue.pop(key, None)
                cue.update(description=spec['match'], prompt=spec['prompt'], texture=spec['texture'], retained=False)
        if 'prompt' in cue:
            cue['prompt'] = re.sub(r'within (\d+(?:\.\d+)?) seconds',
                lambda m: 'within 1.4 seconds' if float(m[1]) > 1.5 else m[0], cue['prompt'])
        if cue['name'] == 'priest-crit': cue['texture'] = '음량을 높인 선명한 결정 반짝임'
    save(catalog_path, catalog)
    save(ROOT/'scripts/sfx/priest-clear-review.json', dict(
        paid_api_calls=0, human_listening='not performed', max_sfx_seconds=1.5,
        original_files=before, screening=report, changed=records, all_files=all_results))
    print(json.dumps(dict(changed=len(records), audited=len(all_results),
                         max_seconds=max(r['seconds'] for r in all_results)), ensure_ascii=False))


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--work', type=Path, required=True)
    main(ap.parse_args().work)
