import json, re, sherpa_onnx, soundfile as sf, numpy as np
name='pt_BR-dii-high'; d=f"vits-piper-{name}"
tts=sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(vits=sherpa_onnx.OfflineTtsVitsModelConfig(model=f"{d}/{name}.onnx",tokens=f"{d}/tokens.txt",data_dir=f"{d}/espeak-ng-data",noise_scale=0.62,noise_scale_w=0.75),num_threads=4)))
DISP=[('Ranki Tréxi','RankTrash'),('Maicrossóft','Microsoft'),('Djêmini','Gemini'),('Gugou','Google'),('rânkin','ranking'),('arroba facens ponto bê érre','@facens.br'),('ó dê ésse doze','ODS 12'),('menos de cinco por cento','menos de 5%'),('top dez','top 10')]
def disp(s):
    for a,b in DISP: s=s.replace(a,b)
    return s
SR=22050; out=[]
for k,t in json.load(open('script.json')):
    sents=[s for s in re.split(r'(?<=[.!?:])\s+',t) if s]
    # keep "X: Y" together unless long
    parts=[]; 
    for s in sents:
        if parts and parts[-1].endswith(':') and len(parts[-1])<40: parts[-1]+=' '+s
        else: parts.append(s)
    audio=[]; caps=[]; pos=0.0
    for s in parts:
        a=tts.generate(s,sid=0,speed=1.0); x=np.array(a.samples,dtype='float32')
        idx=np.where(np.abs(x)>0.012)[0]; x=x[max(0,idx[0]-150):idx[-1]+800]
        caps.append({'t':round(pos,3),'d':round(len(x)/SR,3),'text':disp(s)})
        gap=0.42 if s.endswith(('.','!','?')) else 0.3
        audio.append(x); audio.append(np.zeros(int(gap*SR),dtype='float32')); pos+=len(x)/SR+gap
    y=np.concatenate(audio[:-1]); sf.write(f'seg_{k}.wav',y,SR)
    out.append({'key':k,'dur':round(len(y)/SR,3),'caps':caps}); print(k,round(len(y)/SR,2),len(parts))
json.dump(out,open('narration.json','w'),ensure_ascii=False,indent=1)
print('total',sum(o['dur'] for o in out))
