"""Narração com Gemini TTS em poucas chamadas (cota gratuita é pequena).

Cada chamada lê um grupo de cenas; o áudio é cortado nas pausas entre cenas e cada cena
depois é dividida em frases (legendas) por gen_gemini.split_points.
Uso: GEMINI_API_KEY=... python3 gen_groups.py <saida_dir> [voz]
"""
import json
import os
import sys
import time

import numpy as np
import soundfile as sf

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_gemini as g  # noqa: E402

OUT = sys.argv[1]
g.VOICE = sys.argv[2] if len(sys.argv) > 2 else 'Charon'
g.MODEL = 'gemini-2.5-flash-preview-tts'
g.STYLE = ('Say in Brazilian Portuguese, with a deep, confident, firm adult male narrator voice, like a professional TV commercial announcer: '
           'energetic and charismatic but grounded, with a dynamic pace. Pause briefly between paragraphs: ')
SR = g.SR
GROUPS = [['hook', 'problem', 'reveal', 'upx'], ['steps', 'microsoft', 'map', 'camera'],
          ['ai', 'result', 'antifraud', 'ranking', 'profile'], ['admin', 'data', 'impact', 'cost', 'close']]
script = dict(json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'script2.json'))))
os.makedirs(OUT, exist_ok=True)
# cortes conferidos à mão (reconhecimento de fala) quando a detecção de pausas erra; por voz/grupo
CUTS_OVERRIDE = json.loads(os.environ.get('CUTS_OVERRIDE', '{}'))


def gaps_of(x, min_len=0.22):
    hop = int(0.01 * SR)
    e = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2)) for i in range(0, len(x) - hop, hop)])
    quiet = e < max(0.008, np.percentile(e, 25) * 1.3)
    out, i = [], 0
    while i < len(quiet):
        if quiet[i]:
            j = i
            while j < len(quiet) and quiet[j]:
                j += 1
            if (j - i) * 0.01 >= min_len:
                out.append(((i + j) / 2 * 0.01, (j - i) * 0.01))
            i = j
        else:
            i += 1
    return out


for gi, keys in enumerate(GROUPS):
    gpath = f'{OUT}/group{gi}.wav'
    if os.path.exists(gpath):
        x, _ = sf.read(gpath, dtype='float32')
    else:
        text = '\n\n'.join(script[k] for k in keys)
        print('TTS group', gi, flush=True)
        x = g.tts(text)
        sf.write(gpath, x, SR)
        time.sleep(5)
    dur = len(x) / SR
    gaps = gaps_of(x)
    lens = np.cumsum([len(script[k]) for k in keys]) / sum(len(script[k]) for k in keys)
    cuts = []
    for k in range(len(keys) - 1):
        target = lens[k] * dur
        # prefer long pauses near the expected position (scene breaks are paragraph pauses)
        cand = [(abs(c - target) / 2.0 - L * 3, c) for c, L in gaps if (not cuts or c > cuts[-1] + 1.0) and abs(c - target) < 6]
        cuts.append(min(cand)[1] if cand else target)
    cuts = CUTS_OVERRIDE.get(str(gi), cuts)
    bounds = [0.0] + cuts + [dur]
    for i, k in enumerate(keys):
        seg = x[int(bounds[i] * SR): int(bounds[i + 1] * SR)]
        idx = np.where(np.abs(seg) > 0.01)[0]
        seg = seg[max(0, idx[0] - 600): idx[-1] + 2400]
        sf.write(f'{OUT}/seg_{k}.wav', seg, SR)
        print(gi, k, round(len(seg) / SR, 2), flush=True)

# captions per sentence (reuses gen_gemini.main, which reads the seg files instead of calling the API)
g.OUT = OUT
g.main()
