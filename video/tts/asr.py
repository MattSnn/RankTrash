import sys, sherpa_onnx, soundfile as sf, numpy as np
d='sherpa-onnx-whisper-small'
r=sherpa_onnx.OfflineRecognizer.from_whisper(encoder=f'{d}/small-encoder.int8.onnx',decoder=f'{d}/small-decoder.int8.onnx',tokens=f'{d}/small-tokens.txt',language='pt',task='transcribe',num_threads=4)
for f in sys.argv[1:]:
    a,sr=sf.read(f,dtype='float32')
    if sr!=16000:
        import math; n=int(len(a)*16000/sr); a=np.interp(np.linspace(0,len(a)-1,n),np.arange(len(a)),a).astype('float32')
    s=r.create_stream(); s.accept_waveform(16000,a); r.decode_stream(s); print(f, '=>', s.result.text)
