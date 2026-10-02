"""Narração com Gemini TTS: um áudio por cena + tempo de cada frase (legendas).

Uso: GEMINI_API_KEY=... python3 gen_gemini.py <saida_dir> [voz] [modelo]
A chave vem só do ambiente; nunca é gravada em arquivo.
"""
import base64
import json
import os
import re
import sys
import time
import urllib.request

import numpy as np
import soundfile as sf

OUT = sys.argv[1]
VOICE = sys.argv[2] if len(sys.argv) > 2 else 'Puck'
MODEL = sys.argv[3] if len(sys.argv) > 3 else 'gemini-2.5-pro-preview-tts'
KEY = os.environ['GEMINI_API_KEY']
SR = 24000
HERE = os.path.dirname(os.path.abspath(__file__))
os.makedirs(OUT, exist_ok=True)

STYLE = (
    'Você é a voz de um vídeo de apresentação de um app universitário, gravado por um locutor brasileiro profissional. '
    'Leia em português do Brasil, com energia, carisma e um sorriso na voz, ritmo dinâmico e natural de vídeo de lançamento, '
    'com pausas expressivas nas reticências e ênfase nas palavras importantes. Pronuncie "RankTrash" em inglês (rénk-trésh), '
    '"Gemini" como djêmini e "UPX" como u-pê-xis. Leia exatamente o texto, sem acrescentar nada:\n\n'
)

DISP = [('arroba facens ponto bê érre', '@facens.br'), ('ranktrash ponto eco ponto bê érre', 'ranktrash.eco.br'),
        ('top dez', 'top 10'), ('menos de cinco por cento', 'menos de 5%'), ('Mais quinze pontos', 'Mais 15 pontos')]


def disp(s):
    for a, b in DISP:
        s = s.replace(a, b)
    return s


def tts(text):
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent'
    body = {
        'contents': [{'parts': [{'text': STYLE + text}]}],
        'generationConfig': {'responseModalities': ['AUDIO'], 'speechConfig': {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': VOICE}}}},
    }
    for attempt in range(8):
        try:
            req = urllib.request.Request(url, json.dumps(body).encode(), {'Content-Type': 'application/json', 'x-goog-api-key': KEY})
            r = json.load(urllib.request.urlopen(req, timeout=180))
            data = r['candidates'][0]['content']['parts'][0]['inlineData']['data']
            return np.frombuffer(base64.b64decode(data), dtype='<i2').astype(np.float32) / 32768
        except urllib.error.HTTPError as e:
            msg = e.read().decode()[:300]
            print('  HTTP', e.code, msg, flush=True)
            if e.code in (429, 500, 503):
                time.sleep(20 * (attempt + 1)); continue
            raise
        except Exception as e:  # resposta sem áudio, timeout…
            print('  retry', e, flush=True); time.sleep(10)
    raise RuntimeError('TTS falhou')


def sentences(t):
    return [s for s in re.split(r'(?<=[.!?:])\s+', t) if s]


def split_points(x, n):
    """Escolhe n-1 pausas para separar as frases (casando com a proporção de caracteres)."""
    hop = int(0.01 * SR)
    e = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2)) for i in range(0, len(x) - hop, hop)])
    thr = max(0.01, np.percentile(e, 30) * 1.2)
    quiet = e < thr
    gaps, i = [], 0
    while i < len(quiet):
        if quiet[i]:
            j = i
            while j < len(quiet) and quiet[j]:
                j += 1
            if j - i >= 12:
                gaps.append(((i + j) / 2 * hop / SR, (j - i) * hop / SR))
            i = j
        else:
            i += 1
    return gaps


def main():
    script = json.load(open(os.path.join(HERE, 'script2.json')))
    out = []
    for key, text in script:
        path = f'{OUT}/seg_{key}.wav'
        if os.path.exists(path):
            x, _ = sf.read(path, dtype='float32')
        else:
            print('TTS', key, flush=True)
            x = tts(text)
            idx = np.where(np.abs(x) > 0.01)[0]
            x = x[max(0, idx[0] - 600): idx[-1] + 2400]
            sf.write(path, x, SR)
        parts = sentences(text)
        merged = []
        for s in parts:
            if merged and (len(merged[-1]) < 22 or len(s) < 12):
                merged[-1] += ' ' + s
            else:
                merged.append(s)
        dur = len(x) / SR
        gaps = split_points(x, len(merged))
        lens = np.cumsum([len(s) for s in merged]) / sum(len(s) for s in merged)
        cuts, used = [], set()
        for k in range(len(merged) - 1):
            target = lens[k] * dur
            cand = [(abs(g[0] - target) - g[1] * 2, gi) for gi, g in enumerate(gaps) if gi not in used and (not cuts or g[0] > cuts[-1] + 0.4)]
            if cand:
                _, gi = min(cand); used.add(gi); cuts.append(gaps[gi][0])
            else:
                cuts.append(target)
        bounds = [0.0] + cuts + [dur]
        caps = [{'t': round(bounds[i], 3), 'd': round(bounds[i + 1] - bounds[i] - 0.05, 3), 'text': disp(s)} for i, s in enumerate(merged)]
        out.append({'key': key, 'dur': round(dur, 3), 'caps': caps})
        print(key, round(dur, 2), [c['t'] for c in caps], flush=True)
    json.dump(out, open(f'{OUT}/narration.json', 'w'), ensure_ascii=False, indent=1)
    print('total', sum(o['dur'] for o in out))


if __name__ == '__main__':
    main()
