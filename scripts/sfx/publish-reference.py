"""Publish reviewed priest-healing variations for local listening comparison."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil

import numpy as np
import soundfile as sf


def waveform(path):
    x, _ = sf.read(path, always_2d=True)
    envelope = np.array([np.sqrt(np.mean(a*a)) for a in np.array_split(x, 100)])
    heights = 2 + 54*envelope/max(envelope.max(), 1e-9)
    bars = "".join(f'<rect x="{i*4}" y="{32-h/2:.2f}" width="2" height="{h:.2f}" rx="1"/>'
                   for i, h in enumerate(heights))
    return '<svg aria-hidden="true" viewBox="0 0 400 64">'+bars+'</svg>'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("work", type=Path)
    ap.add_argument("output", type=Path)
    ap.add_argument("--original", required=True, type=Path)
    args = ap.parse_args()
    root = Path(__file__).resolve().parents[2]
    finished = args.work / "finished"
    screening = json.loads((finished / "screening.json").read_text(encoding="utf-8"))
    if len(screening["candidates"]) != 2 or any(c["screening"] != "pass" for c in screening["candidates"]):
        raise ValueError("Both mastered takes must pass screening before publication")
    args.output.mkdir(parents=True, exist_ok=False)
    preview = args.work / "reference-preview.wav"
    # Vite serves the ignored workspace copy in dev. The user's reference is
    # deliberately absent from public/, Git and the production build.
    reference_url = "/" + preview.resolve().relative_to(root).as_posix()
    cards = [f'''<article><span class="eyebrow">REFERENCE</span><h2>참고 음원</h2>
<p>사용자가 제공한 원본 · 비교용 음량 조정</p>{waveform(preview)}
<audio aria-label="참고 음원" controls preload="metadata" src="{reference_url}"></audio>
<div class="meta">2.53초 · 스테레오</div></article>''']
    takes = []
    for stem, source, label, description in [
        ("heal-priest-close", "priest-g", "원본에 가까운 변주", "부드럽게 솟아올랐다가 흩어지는 질감"),
        ("heal-priest-holy", "priest-f", "사제 치유 변주", "원본의 흐름을 유지하며 화음에 변화")]:
        wav = args.output / (stem+".wav")
        shutil.copyfile(finished / wav.name, wav)
        x, rate = sf.read(wav, always_2d=True)
        ogg = wav.with_suffix(".ogg")
        with sf.SoundFile(ogg, "w", rate, x.shape[1], format="OGG", subtype="VORBIS", compression_level=.35) as f:
            f.write(x)
        decoded, decoded_rate = sf.read(ogg, always_2d=True)
        if decoded_rate != rate or decoded.shape != x.shape or not np.isfinite(decoded).all() or abs(decoded).max() >= .99:
            raise ValueError("Encoded OGG failed decode/headroom check")
        metadata = json.loads((args.work / (source+".json")).read_text(encoding="utf-8"))
        processing = json.loads((finished / (stem+".json")).read_text(encoding="utf-8"))
        takes.append({"name": stem, "generation": metadata, "processing": processing,
                      "ogg_sha256": hashlib.sha256(ogg.read_bytes()).hexdigest(),
                      "ogg_decoded_peak": float(abs(decoded).max())})
        cards.append(f'''<article class="new"><span class="eyebrow">NEW VARIATION</span><h2>{label}</h2>
<p>{description}</p>{waveform(wav)}
<audio aria-label="{label}" controls preload="metadata" src="{wav.name}"></audio>
<div class="meta">2.60초 · 스테레오 <span><a href="{wav.name}" download>WAV</a> / <a href="{ogg.name}" download>OGG</a></span></div></article>''')
    report = {"date": "2026-10-21", "method": "Agent Audio installed Stable Audio 3 Medium audio-to-audio + local mastering",
              "paid_api_calls": 0, "reference_uploaded": False,
              "original": {"name": args.original.name, "sha256": hashlib.sha256(args.original.read_bytes()).hexdigest()},
              "reference_analysis": json.loads((args.work / "reference-analysis.json").read_text(encoding="utf-8")),
              "raw_screening": json.loads((args.work / "screening.json").read_text(encoding="utf-8")),
              "finished_screening": screening, "takes": takes,
              "human_listening": "not performed", "game_integration": "Listening candidates; current game audio unchanged"}
    (args.output / "review.json").write_text(json.dumps(report, ensure_ascii=False, indent=2)+"\n", encoding="utf-8", newline="\n")
    document = '''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>사제 치유 · 원본과 비교</title><style>
:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#101918;color:#ecf0e9}*{box-sizing:border-box}
body{max-width:1180px;margin:auto;padding:44px 24px}header{padding:0 0 28px;border-bottom:1px solid #34423d}
.eyebrow{font-size:11px;letter-spacing:.15em;color:#bba77c;font-weight:700}h1{font-size:34px;letter-spacing:-.04em;margin:12px 0}
p{color:#aebfb6;line-height:1.75;margin:10px 0}header p{max-width:680px}h2{font-size:20px;letter-spacing:-.025em;margin:12px 0}
.toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:26px 0}button{cursor:pointer;border:1px solid #647364;background:#1b2c26;color:#eaf2e8;padding:12px 18px;border-radius:8px;font:inherit;font-size:14px}button:first-child{background:#d7c391;color:#1b241c;border-color:#d7c391;font-weight:700}button:hover{filter:brightness(1.12)}
#status{font-size:13px;color:#aebfb6;margin-left:10px}.cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}
article{border:1px solid #3c4942;border-radius:14px;padding:24px 20px;background:#192320}.new{background:#1b2b25;border-color:#536650}
article p{font-size:13px;min-height:46px}svg{display:block;width:100%;height:82px;fill:#96aa99;margin:20px 0}.new svg{fill:#d4c58e}
audio{width:100%;height:44px}.meta{font-size:12px;color:#aebfb6;margin-top:16px}.meta span{float:right}a{color:#d8c792;text-underline-offset:4px}
.notes{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:28px;padding:10px 2px}.notes p{font-size:13px;margin:5px 0}.notes strong{color:#e2e9de;font-size:14px}
footer{border-top:1px solid #34423d;margin-top:26px;padding-top:18px;color:#9aac9e;font-size:12px;line-height:1.8}
@media(max-width:850px){.cards{grid-template-columns:1fr}.notes{grid-template-columns:1fr;gap:18px}body{padding:28px 18px}h1{font-size:29px}article p{min-height:0}svg{height:60px;margin:10px 0}#status{width:100%;margin:5px 0}}
</style></head><body><header><div class="eyebrow">나혼자 힐러 · SOUND STUDY 01</div><h1>사제의 치유</h1>
<p>공기처럼 피어오르는 소리, 따뜻하게 겹치는 화음, 부드러운 잔향.<br>참고 음원의 흐름을 따라 만든 두 가지 변주를 비교해 보세요.</p></header>
<div class="toolbar"><button id="sequence">순서대로 듣기</button><button id="stop">모두 정지</button><span id="status" role="status">참고 음원 → 가까운 변주 → 사제 치유 변주</span></div>
<main class="cards">'''+"\n".join(cards)+'''</main>
<div class="notes"><div><strong>원본에서 살린 특징</strong><p>약 0.9초에 가장 크게 부풀어 오르는 흐름과, 중저음에 모인 부드러운 합성음 질감을 참조했습니다.</p></div>
<div><strong>비교할 때</strong><p>세 음원의 평균 음량을 맞췄습니다. 새 음원의 조용한 끝부분을 정리했고, 스테레오의 공간감은 유지했습니다.</p></div></div>
<footer>Agent Audio · Stable Audio 3 Medium · 로컬 생성 · 유료 API 호출 없음<br>
8개 생성 후 2개를 다듬어 신호·CLAP 검사를 통과했습니다. 직접 청음 평가는 하지 않았으며, 현재 게임에 적용하기 전 비교용 후보입니다.<br>
참고 음원은 이 PC의 개발 서버에서만 재생됩니다. <a href="review.json">생성·검수 기록</a> · <a href="/">게임으로 돌아가기</a></footer>
<script>
const players=[...document.querySelectorAll('audio')],status=document.querySelector('#status');let sequential=false,index=0;
function stop(){sequential=false;players.forEach(a=>{a.pause();a.currentTime=0})}
async function play(a){try{await a.play()}catch{sequential=false;status.textContent='재생할 수 없습니다. 파일과 개발 서버를 확인해 주세요.'}}
players.forEach(a=>{a.addEventListener('play',()=>{if(sequential&&a!==players[index])sequential=false;players.forEach(b=>{if(b!==a){b.pause();b.currentTime=0}});status.textContent=a.getAttribute('aria-label')+' 재생 중'});
a.addEventListener('ended',()=>{if(sequential&&a===players[index]&&++index<players.length){play(players[index])}else{sequential=false;status.textContent='재생 완료'}});
a.addEventListener('error',()=>{sequential=false;status.textContent=a.getAttribute('aria-label')+' 파일을 불러오지 못했습니다.'})});
document.querySelector('#sequence').addEventListener('click',()=>{stop();index=0;sequential=true;play(players[0])});
document.querySelector('#stop').addEventListener('click',()=>{stop();status.textContent='정지됨'});
</script></body></html>'''
    (args.output / "index.html").write_text(document, encoding="utf-8", newline="\n")
    print(json.dumps({"output": str(args.output.resolve()), "takes": len(takes), "reference_url": reference_url}))


if __name__ == "__main__":
    main()
