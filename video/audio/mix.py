"""RankTrash pitch: synthesizes the soundtrack (original music + 8-bit SFX) and mixes it with the narration.

Usage: python3 audio/mix.py <timeline.json> <narration_dir> <out.wav>
timeline.json comes from dump.mjs (scene times + SFX cues); narration_dir holds seg_<key>.wav.
"""
import json
import sys

import numpy as np
import soundfile as sf
from scipy.signal import butter, lfilter, resample_poly, sosfilt

SR = 48000
tl = json.load(open(sys.argv[1]))
NDIR = sys.argv[2]
OUT = sys.argv[3]
T = tl['total'] + 0.5
n = int(T * SR)
rng = np.random.default_rng(4)


def t_arr(d):
    return np.arange(int(d * SR)) / SR


def lp(x, f, order=2):
    return sosfilt(butter(order, f, 'low', fs=SR, output='sos'), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, 'high', fs=SR, output='sos'), x)


def env_adsr(L, a=0.005, d=0.1, s=0.6, r=0.1):
    e = np.ones(L) * s
    A, D, R = int(a * SR), int(d * SR), int(r * SR)
    A = min(A, L); e[:A] = np.linspace(0, 1, A)
    D = min(D, L - A); e[A:A + D] = np.linspace(1, s, D)
    R = min(R, L); e[L - R:] *= np.linspace(1, 0, R)
    return e


def add(buf, x, t0, g=1.0):
    i = int(t0 * SR)
    if i < 0:
        x = x[-i:]; i = 0
    j = min(len(buf), i + len(x))
    if j > i:
        buf[i:j] += x[: j - i] * g


def saw(f, tt):
    return 2 * ((f * tt) % 1) - 1


def sq(f, tt, duty=0.5):
    return np.where((f * tt) % 1 < duty, 1.0, -1.0)


def tri(f, tt):
    return 2 * np.abs(2 * ((f * tt) % 1) - 1) - 1


# ------------------------------------------------------------------ music
BPM = 124
BEAT = 60 / BPM
BAR = BEAT * 4
midi = lambda m: 440 * 2 ** ((m - 69) / 12)
CHORDS = [[50, 57, 62, 66, 69], [45, 52, 61, 64, 69], [47, 54, 62, 66, 71], [43, 50, 59, 62, 67]]  # D A Bm G
scenes = {s['key']: s for s in tl['scenes']}
S = lambda k: scenes[k]['start']
E_ = lambda k: scenes[k]['end']
DROP = S('reveal') + max(0.0, min(3.5, (S('upx') - S('reveal')) - 4.4))  # ~ logo slam
# snap the drop to the nearest bar so the groove lands on it
DROP = round(DROP / BAR) * BAR
END = tl['total']
SEC = {
    'kick': [(S('hook'), S('reveal') - 2 * BAR), (DROP, S('impact')), (S('cost'), END - 1.5)],
    'half': [(S('impact'), S('cost'))],
    'snare': [(DROP, S('impact')), (S('cost'), END - 1.5)],
    'hat': [(S('hook'), S('reveal') - BAR), (DROP, END - 1.5)],
    'bass': [(S('hook'), S('reveal') - BAR), (DROP, END - 1.5)],
    'lead': [(DROP, DROP + 8 * BAR), (S('result'), S('result') + 4 * BAR), (S('cost'), END - 1.5)],
    'arp': [(0, END)],
}
act = lambda name, t: any(a <= t < b for a, b in SEC[name])
# 2-bar lead phrases (16th steps, None = rest), notes as midi
LEAD = [
    [74, None, 78, None, 81, None, 78, 81, 83, None, 81, None, 78, None, 76, None,  73, None, 76, None, 81, None, 76, 78, 76, None, 73, None, 69, None, None, None],
    [71, None, 74, None, 78, None, 74, 78, 79, None, 78, None, 74, None, 71, None,  74, None, 79, None, 83, None, 81, 79, 78, None, 76, None, 74, None, None, None],
]
pad = np.zeros(n); bass = np.zeros(n); arp = np.zeros(n); drums = np.zeros(n); lead = np.zeros(n); kickenv = np.zeros(n)
nbars = int(T / BAR) + 1
for b in range(nbars):
    t0 = b * BAR
    ch = CHORDS[b % 4]
    L = int(BAR * SR) + int(0.3 * SR); tt = np.arange(L) / SR
    x = sum(saw(midi(m) * (1 + d), tt) for m in ch[1:] for d in (-0.004, 0.0037)) / 8
    add(pad, x * env_adsr(L, a=0.25, d=0.4, s=0.8, r=0.4), t0)
    for k in range(8):
        tb0 = t0 + k * BEAT / 2
        if not act('bass', tb0):
            continue
        Lb = int(BEAT / 2 * SR * 0.85); tb = np.arange(Lb) / SR
        f = midi(ch[0] - 12 + (12 if k % 2 else 0))
        add(bass, (np.sin(2 * np.pi * f * tb) + 0.4 * sq(f, tb, 0.25)) * env_adsr(Lb, 0.003, 0.07, 0.5, 0.04), tb0)
    pattern = [1, 2, 3, 4, 3, 2, 1, 2, 1, 2, 3, 4, 3, 4, 2, 3]
    for k in range(16):
        ts = t0 + k * BEAT / 4
        La = int(BEAT / 4 * SR * 0.8); ta = np.arange(La) / SR
        add(arp, sq(midi(ch[pattern[k]] + 12), ta, 0.25) * env_adsr(La, 0.002, 0.05, 0.35, 0.03), ts)
    ph = LEAD[(b // 2) % 2][(b % 2) * 16:(b % 2) * 16 + 16]
    for k, m in enumerate(ph):
        ts = t0 + k * BEAT / 4
        if m is None or not act('lead', ts):
            continue
        dur = BEAT / 4 * (2 if k + 1 < 16 and ph[k + 1] is None else 1) * 0.9
        Ll = int(dur * SR); tl_ = np.arange(Ll) / SR
        vib = 1 + 0.004 * np.sin(2 * np.pi * 6 * tl_) * (tl_ > 0.08)
        add(lead, (sq(midi(m) * vib, tl_, 0.5) * 0.6 + tri(midi(m), tl_) * 0.4) * env_adsr(Ll, 0.004, 0.08, 0.6, 0.04), ts)
    for k in range(4):
        tk = t0 + k * BEAT
        full = act('kick', tk + 0.001); half = act('half', tk + 0.001) and k in (0,)
        if full or half:
            Lk = int(0.32 * SR); tq = np.arange(Lk) / SR
            f = 48 + 120 * np.exp(-tq * 30)
            add(drums, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tq * 10), tk, 1.0)
            add(kickenv, np.exp(-np.arange(int(0.3 * SR)) / SR * 9), tk)
        if act('snare', tk + 0.001) and k in (1, 3):
            Ls = int(0.2 * SR)
            nz = hp(rng.standard_normal(Ls), 1500) * np.exp(-np.arange(Ls) / SR * 20)
            tone = np.sin(2 * np.pi * 200 * np.arange(Ls) / SR) * np.exp(-np.arange(Ls) / SR * 30)
            add(drums, nz * 0.5 + tone * 0.3, tk, 0.85)
        if act('hat', tk + 0.001):
            for h in (0.5,) if not act('snare', tk + 0.001) else (0.25, 0.5, 0.75):
                Lh = int(0.05 * SR)
                add(drums, hp(rng.standard_normal(Lh), 7500) * np.exp(-np.arange(Lh) / SR * 80), tk + h * BEAT, 0.3 if h != 0.5 else 0.4)
tt = np.arange(n) / SR
curve = lambda pts: np.interp(tt, *zip(*pts))
pump = 1 - 0.45 * np.clip(kickenv, 0, 1)
pad = lp(pad, 2600)
arp = lp(arp, 5200)
pad_g = curve([(0, 0.5), (2.8, 0.7), (S('reveal') - 2 * BAR, 0.6), (DROP, 0.8), (S('impact'), 0.8), (S('impact') + 1, 1.0), (S('cost'), 0.8), (END - 3, 0.8), (END, 0)])
arp_g = curve([(0, 0.55), (2.8, 0.35), (DROP - 0.01, 0.2), (DROP, 0.45), (S('impact'), 0.45), (S('impact') + 1, 0.55), (END - 2, 0.4), (END, 0)])
music = pad * pad_g * pump * 0.30 + lp(bass, 1800) * pump * 0.40 + arp * arp_g * 0.12 + drums * 0.55 + lp(lead, 6000) * 0.11
# riser + impact into the drop, and a short riser in the intro
for t_end, d in ((DROP, 2 * BAR), (2.8, 2.0)):
    Lr = int(d * SR); tr = np.arange(Lr) / SR
    sweep = np.sin(2 * np.pi * np.cumsum(200 + 1400 * (tr / d) ** 2) / SR) * 0.08
    add(music, (lp(hp(rng.standard_normal(Lr), 400), 7000) * 0.22 + sweep) * (tr / d) ** 2, t_end - d)
Lc = int(1.5 * SR); tc = np.arange(Lc) / SR
add(music, lp(rng.standard_normal(Lc), 5000) * np.exp(-tc * 3) * 0.35, DROP)
# final chord ring-out
Lf = int(3 * SR); tf_ = np.arange(Lf) / SR
add(music, sum(sq(midi(m), tf_, 0.25) for m in (62, 66, 69, 74)) / 4 * np.exp(-tf_ * 1.2) * 0.25, END - 3)
# ------------------------------------------------------------------ SFX
def sfx(name):
    if name == 'whoosh':
        L = int(0.85 * SR); t = np.arange(L) / SR
        x = rng.standard_normal(L)
        e = np.sin(np.pi * np.clip(t / 0.85, 0, 1)) ** 2
        lo = lp(x, 900); hi = hp(lp(x, 5000), 1500)
        mix = lo * (1 - t / 0.85) + hi * (t / 0.85)
        return mix * e * 0.5
    if name == 'swish':
        L = int(0.35 * SR); t = np.arange(L) / SR
        return hp(lp(rng.standard_normal(L), 6000), 1200) * np.sin(np.pi * t / 0.35) ** 2 * 0.25
    if name == 'pop':
        L = int(0.12 * SR); t = np.arange(L) / SR
        f = 500 + 900 * np.exp(-t * 40)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 30) * 0.5
    if name == 'blip':
        L = int(0.09 * SR); t = np.arange(L) / SR
        return (sq(1320, t, 0.5) * (t < 0.04) + sq(1760, t, 0.5) * (t >= 0.04)) * np.exp(-t * 20) * 0.16
    if name == 'tap':
        L = int(0.05 * SR); t = np.arange(L) / SR
        return lp(rng.standard_normal(L), 3000) * np.exp(-t * 120) * 0.6 + np.sin(2 * np.pi * 900 * t) * np.exp(-t * 90) * 0.3
    if name == 'key':
        L = int(0.03 * SR); t = np.arange(L) / SR
        return hp(rng.standard_normal(L), 2500) * np.exp(-t * 200) * 0.5
    if name == 'thud':
        L = int(0.5 * SR); t = np.arange(L) / SR
        f = 45 + 90 * np.exp(-t * 20)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7) * 0.9
    if name == 'coin':  # classic two-note coin
        L = int(0.45 * SR); t = np.arange(L) / SR
        f = np.where(t < 0.07, midi(83), midi(88))
        return sq(f, t, 0.5) * np.exp(-np.clip(t - 0.07, 0, None) * 7) * 0.18
    if name == 'success':
        out = np.zeros(int(0.7 * SR))
        for i, m in enumerate([74, 78, 81, 86]):
            L = int(0.16 * SR); t = np.arange(L) / SR
            x = sq(midi(m), t, 0.25) * np.exp(-t * 12) * 0.14
            j = int(i * 0.09 * SR); out[j:j + L] += x[: len(out) - j]
        return out
    if name == 'powerup':
        L = int(0.6 * SR); t = np.arange(L) / SR
        f = midi(62) * 2 ** (t * 3.0)
        return sq(f, t, 0.25) * (1 - t / 0.6) * 0.12 * (np.sin(2 * np.pi * 30 * t) > -0.3)
    if name == 'sparkle':
        out = np.zeros(int(1.0 * SR))
        for i in range(8):
            L = int(0.25 * SR); t = np.arange(L) / SR
            x = np.sin(2 * np.pi * midi(88 + (i * 5) % 12) * t) * np.exp(-t * 18) * 0.12
            j = int(i * 0.07 * SR); out[j:j + L] += x[: len(out) - j]
        return out
    if name == 'error':
        L = int(0.45 * SR); t = np.arange(L) / SR
        f = np.where(t < 0.18, 220, 165)
        return lp(sq(f, t, 0.5), 2500) * np.exp(-t * 4) * 0.2 * (t < 0.42)
    if name == 'question':
        out = np.zeros(int(0.5 * SR))
        for i, m in enumerate([76, 79]):
            L = int(0.2 * SR); t = np.arange(L) / SR
            x = tri(midi(m), t) * np.exp(-t * 9) * 0.25
            j = int(i * 0.14 * SR); out[j:j + L] += x
        return out
    if name == 'scratch':
        L = int(0.4 * SR); t = np.arange(L) / SR
        return lp(rng.standard_normal(L), 1800) * np.exp(-t * 6) * 0.35
    if name == 'shutter':
        L = int(0.18 * SR); t = np.arange(L) / SR
        x = hp(rng.standard_normal(L), 1500)
        return x * (np.exp(-t * 80) + 0.6 * np.exp(-np.clip(t - 0.07, 0, None) * 90) * (t > 0.07)) * 0.55
    if name == 'scan':
        L = int(1.6 * SR); t = np.arange(L) / SR
        f = 600 + 300 * np.sin(2 * np.pi * 1.2 * t)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.035 * np.sin(np.pi * t / 1.6)
    if name == 'radar':
        L = int(0.6 * SR); t = np.arange(L) / SR
        return np.sin(2 * np.pi * 1400 * t) * np.exp(-t * 9) * 0.12
    if name == 'countdown':
        out = np.zeros(int(1.3 * SR))
        for i in range(12):
            L = int(0.04 * SR); t = np.arange(L) / SR
            x = sq(midi(84 - i), t, 0.5) * 0.06
            j = int(i * 0.1 * SR); out[j:j + L] += x
        return out
    if name == 'boing':
        L = int(0.3 * SR); t = np.arange(L) / SR
        f = 300 + 250 * np.sin(2 * np.pi * 9 * t) * np.exp(-t * 6)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 8) * 0.35
    if name == 'fall':
        L = int(0.6 * SR); t = np.arange(L) / SR
        f = 1400 * np.exp(-t * 3) + 200
        return sq(f, t, 0.5) * 0.07 * (1 - t / 0.6)
    if name == 'splat':
        L = int(0.5 * SR); t = np.arange(L) / SR
        return lp(rng.standard_normal(L), 1200) * np.exp(-t * 9) * 0.8 + np.sin(2 * np.pi * 80 * t) * np.exp(-t * 12) * 0.6
    if name == 'slam':
        L = int(0.35 * SR); t = np.arange(L) / SR
        f = 60 + 140 * np.exp(-t * 30)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 12) * 0.8 + hp(rng.standard_normal(L), 2000) * np.exp(-t * 40) * 0.3
    if name == 'stamp':
        L = int(0.4 * SR); t = np.arange(L) / SR
        return lp(rng.standard_normal(L), 2500) * np.exp(-t * 25) * 0.9 + np.sin(2 * np.pi * 110 * t) * np.exp(-t * 15) * 0.6
    if name == 'impact':
        L = int(1.2 * SR); t = np.arange(L) / SR
        f = 40 + 90 * np.exp(-t * 12)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 3.5) * 0.9 + lp(rng.standard_normal(L), 4000) * np.exp(-t * 6) * 0.35
    if name == 'jump':
        L = int(0.18 * SR); t = np.arange(L) / SR
        f = 300 * 2 ** (t * 12)
        return sq(f, t, 0.5) * np.exp(-t * 10) * 0.1
    if name == 'zoom':
        L = int(0.4 * SR); t = np.arange(L) / SR
        return hp(lp(rng.standard_normal(L), 6000), 600) * np.sin(np.pi * t / 0.4) ** 2 * 0.3
    if name == 'detect':
        out = np.zeros(int(0.3 * SR))
        for i, m in enumerate([88, 93]):
            L = int(0.1 * SR); t = np.arange(L) / SR
            j = int(i * 0.08 * SR); out[j:j + L] += np.sin(2 * np.pi * midi(m) * t) * np.exp(-t * 25) * 0.25
        return out
    if name == 'coins':
        out = np.zeros(int(1.0 * SR))
        for i in range(7):
            L = int(0.2 * SR); t = np.arange(L) / SR
            f = np.where(t < 0.04, midi(86 + i % 3), midi(91 + i % 3))
            j = int(i * 0.09 * SR); out[j:j + L] += sq(f, t, 0.5) * np.exp(-t * 14) * 0.08
        return out
    if name == 'levelup':
        out = np.zeros(int(1.0 * SR))
        for i, m in enumerate([67, 71, 74, 79, 83, 86]):
            L = int(0.18 * SR); t = np.arange(L) / SR
            j = int(i * 0.07 * SR); out[j:j + L] += sq(midi(m), t, 0.25) * np.exp(-t * 8) * 0.12
        return out
    raise ValueError(name)


fx = np.zeros(n)
for c in tl['cues']:
    add(fx, sfx(c['name']), c['t'], c['gain'])

# ------------------------------------------------------------------ voice
voice = np.zeros(n)
for s in tl['scenes']:
    if s['narr'] is None:
        continue
    x, sr = sf.read(f"{NDIR}/seg_{s['key']}.wav", dtype='float64')
    x = resample_poly(x, SR, sr) if sr != SR else x
    add(voice, x, s['narr'])
# voice polish: low cut, gentle presence lift, soft compression
voice = hp(voice, 90)
pres = hp(lp(voice, 5000), 2000)
voice = voice + pres * 0.25
env = np.abs(voice)
env = lfilter([1 - np.exp(-1 / (0.01 * SR))], [1, -np.exp(-1 / (0.01 * SR))], env)
thr = 0.12
gain = np.where(env > thr, (thr + (env - thr) / 3) / np.maximum(env, 1e-9), 1.0)
voice = voice * gain
voice = voice / (np.max(np.abs(voice)) + 1e-9) * 0.82

# ducking: music dips under the voice
venv = lfilter([1 - np.exp(-1 / (0.12 * SR))], [1, -np.exp(-1 / (0.12 * SR))], (np.abs(voice) > 0.02).astype(float))
duck = 1 - 0.55 * np.clip(venv * 1.6, 0, 1)
music = music / (np.max(np.abs(music)) + 1e-9) * 0.42 * duck

# stereo: slight width for arp/pad via Haas on music, SFX center
d = int(0.012 * SR)
mL = music
mR = np.concatenate([np.zeros(d), music[:-d]]) * 0.92 + music * 0.08
L = voice + mL + fx * 0.8
R = voice + mR + fx * 0.8
st = np.stack([L, R], 1)
st = st / max(1.0, np.max(np.abs(st)) / 0.98)
sf.write(OUT, st.astype(np.float32), SR, subtype='FLOAT')
print('wrote', OUT, st.shape[0] / SR, 's')
