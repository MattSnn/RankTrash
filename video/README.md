# Vídeo pitch do RankTrash

Vídeo de apresentação (1920×1080, 30 fps, ~4 min) com motion design, telas reais do app (modo demo) e narração por IA em português.

O MP4 final não fica no git (é grande). Para gerar de novo:

| Etapa | Pasta | Comando |
|---|---|---|
| 1. Telas do app | `capture/` | com `npm run dev:demo` rodando: `node camshot.mjs`, gerar `cam.y4m` com ffmpeg a partir de `camscene.png` e `node capture.mjs` (salva em `frames/`) |
| 2. Narração | `tts/` | `python3 gen2.py` (voz neural `pt_BR-dii-high`, Piper via sherpa-onnx, offline). O roteiro fica em `script.json` |
| 3. Animação | raiz | `node render.mjs preview 10 60` para conferir quadros e `node render.mjs frames 0 7392 <pasta>` para renderizar tudo |
| 4. Áudio | `audio/` | `node dump.mjs` e depois `python3 audio/mix.py out/timeline.json <pasta_da_narração> mix.wav` (trilha e efeitos sintetizados, sem direitos de terceiros) |
| 5. MP4 | raiz | `ffmpeg -framerate 30 -i <pasta>/%05d.jpg -i mix.wav -c:v libx264 -crf 19 -pix_fmt yuv420p -c:a aac -b:a 192k out/RankTrash-pitch.mp4` |

* `comp.js` é a linha do tempo: cada cena é uma função do tempo (`window.seek(t)`), o que deixa a renderização determinística quadro a quadro.
* O roteiro fica em `tts/script.json`. Algumas palavras estão escritas como se falam (ex.: "Ranki Tréxi", "Djêmini") para a voz pronunciar certo. As legendas usam a grafia normal.
* O mapa nas telas usa um traçado ilustrativo do campus, porque o servidor de mapas não estava acessível no ambiente de gravação.
* Os números da cena "Dados" são ilustrativos (estão marcados assim no vídeo).
* A voz `pt_BR-dii-high` usa licença CC BY-NC-SA 4.0 (uso não comercial, ok para fins acadêmicos).
