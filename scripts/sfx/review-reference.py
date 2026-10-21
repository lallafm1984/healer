"""Compare generated healing candidates to a local reference using CLAP/signals."""
import argparse
import json
from pathlib import Path
import numpy as np
from scipy import signal
import torch
from transformers import ClapModel, ClapProcessor
from combat_quality import read_wav, db


def features(path):
    x, sr = read_wav(path)
    if not np.isfinite(x).all():
        raise ValueError("Non-finite audio")
    y = x.mean(1).astype(np.float32)
    block = round(sr * .01)
    env = np.array([np.sqrt(np.mean(x[i:i+block]**2)) for i in range(0,len(x),block)])
    env100 = np.interp(np.linspace(0,1,100),np.linspace(0,1,len(env)),env)
    f, _, z = signal.stft(y,fs=sr,nperseg=2048,noverlap=1536)
    power = (abs(z)**2).sum(1)
    energy = np.cumsum((x*x).mean(1)); energy /= max(energy[-1],1e-12)
    return x, sr, env100, {
        "seconds": len(x)/sr, "channels": x.shape[1], "sample_rate": sr,
        "peak_dbfs": db(abs(x).max()), "rms_dbfs": db(np.sqrt(np.mean(x*x))),
        "peak_time_seconds": float(env.argmax()*.01),
        "centroid_hz": float((f*power).sum()/max(power.sum(),1e-12)),
        "high_frequency_energy": float(power[f>7000].sum()/max(power.sum(),1e-12)),
        "clipped_fraction": float(np.mean(abs(x)>=.999)),
        "tail_db_relative": db(np.sqrt(np.mean(x[-round(sr*.1):]**2))/max(env.max(),1e-12)),
        "energy_95_seconds": float(np.searchsorted(energy,.95)/sr),
    }


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("reference",type=Path)
    ap.add_argument("candidates",type=Path,nargs="+")
    ap.add_argument("--model",required=True)
    ap.add_argument("--report",type=Path,required=True)
    args=ap.parse_args()
    labels=["A rising airy magical whoosh followed by a bright crystalline shimmer.",
            "A warm sustained angelic choir-like synthesizer chord, ethereal and reverberant.",
            "A shimmering magical spell with a breathy synthetic texture and warm harmonics.",
            "A person speaking intelligible words.","A person singing lyrics.",
            "Continuous music with melody, drums and rhythm.",
            "A harsh electrical buzz or noisy distorted sound."]
    torch.set_num_threads(2)
    model=ClapModel.from_pretrained(args.model,local_files_only=True,disable_mmap=True).eval()
    processor=ClapProcessor.from_pretrained(args.model,local_files_only=True)
    with torch.inference_mode():
        text=model.get_text_features(**processor(text=labels,return_tensors="pt",padding=True,truncation=True))
        if not isinstance(text,torch.Tensor): text=text.pooler_output
        text=torch.nn.functional.normalize(text,dim=-1)
        def embedding(x,sr):
            y=x.mean(1).astype(np.float32)
            if sr != 48000: y=signal.resample_poly(y,48000//np.gcd(sr,48000),sr//np.gcd(sr,48000))
            result=model.get_audio_features(**processor(audio=y,sampling_rate=48000,return_tensors="pt",padding="pad"))
            if not isinstance(result,torch.Tensor): result=result.pooler_output
            return torch.nn.functional.normalize(result,dim=-1)
        rx,rs,renv,rmetrics=features(args.reference)
        remb=embedding(rx,rs)
        candidates=[]
        for path in args.candidates:
            x,sr,env,metrics=features(path)
            emb=embedding(x,sr)
            similarity=float((emb@remb.T)[0,0])
            scores=(emb@text.T)[0].tolist()
            correlation=float(np.corrcoef(env,renv)[0,1])
            reasons=[]
            if similarity < .65: reasons.append("reference timbre similarity below target")
            if max(scores[:3]) < .45: reasons.append("insufficient airy healing texture")
            if max(scores[3:]) > max(scores[:3]) - .1: reasons.append("unwanted sound class too strong")
            if correlation < .65: reasons.append("swell and decay shape differs from reference")
            if metrics["tail_db_relative"] > -25: reasons.append("unfinished tail")
            if metrics["clipped_fraction"] > .002: reasons.append("clipped audio")
            if metrics["high_frequency_energy"] > .1: reasons.append("excess harsh high frequencies")
            if metrics["rms_dbfs"] < -50: reasons.append("near silence")
            record={"file":str(path),"reference_similarity":round(similarity,4),
                    "envelope_correlation":round(correlation,4),"metrics":metrics,
                    "descriptors":dict(zip(labels,[round(s,4) for s in scores])),
                    "reasons":reasons,"screening":"reject" if reasons else "pass"}
            candidates.append(record)
            print(json.dumps(record,ensure_ascii=False),flush=True)
    passed=[c for c in candidates if c["screening"]=="pass"]
    result={"method":"Local CLAP reference similarity + signal comparison; not human listening or proof of artistic equivalence",
            "reference":str(args.reference),"reference_metrics":rmetrics,"candidates":candidates,
            "selected":max(passed,key=lambda c:c["reference_similarity"])["file"] if passed else None,
            "human_listening":"not performed"}
    args.report.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8",newline="\n")


if __name__=="__main__":
    main()
