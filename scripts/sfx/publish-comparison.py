"""Publish reviewed local candidates as a browser-playable SFX comparison."""
import argparse
import hashlib
import html
import json
from pathlib import Path
import shutil


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("work", type=Path)
    ap.add_argument("output", type=Path)
    args = ap.parse_args()
    root = Path(__file__).resolve().parents[2]
    specs = json.loads((args.work / "medium/manifest.json").read_text(encoding="utf-8"))
    reports = {p: json.loads((args.work / p / "screening.json").read_text(encoding="utf-8"))
               for p in ("small-sfx", "medium")}
    if any(report["retry"] for report in reports.values()):
        raise RuntimeError("Some sound categories still need regeneration")
    args.output.mkdir(parents=True, exist_ok=False)
    records, cards = [], []
    for spec in specs:
        name, label = spec["name"], spec["ko"]
        players = []
        existing = root / "src/sfx" / f"{name}.ogg"
        shutil.copyfile(existing, args.output / f"{name}-current.ogg")
        players.append(f'<div class="take"><h3>현재 게임 음원</h3><audio aria-label="{label} 현재 게임 음원" controls preload="none" src="{name}-current.ogg"></audio></div>')
        for profile, heading in (("small-sfx", "Small SFX · 새 후보"), ("medium", "Medium · 새 후보")):
            report = reports[profile]
            chosen = report["selected"][name]
            entry = next(c for c in report["candidates"] if c["source"] == chosen)
            source = args.work / profile / "review" / chosen
            filename = f"{name}-{profile}.wav"
            shutil.copyfile(source, args.output / filename)
            metadata = json.loads((args.work / profile / Path(chosen).with_suffix(".json")).read_text(encoding="utf-8"))
            records.append({"name": name, "label": label, "profile": profile, "file": filename,
                            "source": chosen, "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                            "generation": metadata, "metrics": entry["metrics"],
                            "semantic": entry["semantic"], "screening": entry["screening"]})
            duration = entry["metrics"]["seconds"]
            players.append(f'<div class="take"><h3>{heading}</h3><audio aria-label="{label} {profile}" controls preload="none" src="{filename}"></audio><span>{duration:.2f}초 · </span><a href="{filename}" download>WAV 저장</a></div>')
        cards.append(f'<section><h2>{html.escape(label)}</h2><div class="takes">{"".join(players)}</div></section>')
    report = {"date": "2026-10-21", "generation": "Agent Audio / local Stable Audio 3 / TFLite CPU",
              "paid_api_calls": 0, "human_listening": "not performed",
              "method": "Signal screening and local CLAP; not a listening or artistic verdict. Initial pairs share prompt/seed. Retries may use revised prompts and seeds; this is not a controlled model benchmark.",
              "attempted": {p: len(r["candidates"]) for p, r in reports.items()},
              "rejected": {p: sum(c.get("screening") != "pass" for c in r["candidates"]) for p, r in reports.items()},
              "candidates": records}
    (args.output / "review.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    document = '''<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>전투 효과음 비교 · 나혼자 힐러</title>
<style>
:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#151b1c;color:#e9ece5}*{box-sizing:border-box}
body{max-width:1120px;margin:0 auto;padding:36px 22px}h1{font-size:28px;margin:12px 0}h2{font-size:20px;margin:0 0 18px;color:#e1c78f}
p{line-height:1.7;color:#bac6c2}section{background:#202b2b;border:1px solid #3e514d;border-radius:14px;padding:24px;margin:22px 0}
.takes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px}h3{font-size:15px;font-weight:600}audio{width:100%;display:block;margin:14px 0}
a{color:#b9d7c6;text-underline-offset:3px}.tag{font-size:13px;color:#e1c78f;letter-spacing:.06em}footer{font-size:13px;line-height:1.8;color:#9caeaa}
@media(max-width:720px){.takes{grid-template-columns:1fr}body{padding:24px 16px}section{padding:20px}}
</style><div class="tag">나혼자 힐러 · 효과음 청음</div><h1>타격, 치유, 보호막</h1>
<p>현재 게임 음원과 새로 만든 두 후보를 차례로 들어보세요. 재생 버튼을 누르면 다른 소리는 멈춥니다.</p>
''' + "\n".join(cards) + '''
<footer>새 후보는 무음·클리핑·잔향과 소리 설명 일치도 검사를 통과했습니다. 직접 청음 평가는 아직 하지 않았습니다.<br>
첫 후보는 같은 프롬프트와 시드로 생성했고, 탈락 후보는 개별 수정했습니다. 이 페이지는 청음 비교용이며 모델 성능의 우열을 확정하지 않습니다.<br>
<a href="review.json">생성·검수 기록</a> · <a href="/">게임으로 돌아가기</a></footer>
<script>document.addEventListener('play',e=>{if(e.target.tagName==='AUDIO')document.querySelectorAll('audio').forEach(a=>{if(a!==e.target){a.pause();a.currentTime=0}})},true)</script>
</html>'''
    (args.output / "index.html").write_text(document, encoding="utf-8", newline="\n")
    print(json.dumps({"output": str(args.output.resolve()), "audio_files": 9, "attempted": report["attempted"], "rejected": report["rejected"]}))


if __name__ == "__main__":
    main()
