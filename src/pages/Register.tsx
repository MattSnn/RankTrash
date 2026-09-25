import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MAX_ACCEPTED_ACCURACY_M, rankBins } from '../../supabase/functions/_shared/geo.ts'
import { MATERIAL_INFO } from '../../supabase/functions/_shared/materials.ts'
import { Mascot } from '../components/Mascot'
import { Icon } from '../components/PixelArt'
import { api } from '../lib/api'
import { captureFrame, openRearCamera } from '../lib/image'
import { useSession } from '../lib/session'
import { play } from '../lib/sfx'
import type { Bin, RegisterResult } from '../lib/types'
import { useGeolocation } from '../lib/useGeolocation'

type Step = 'camera' | 'preview' | 'scanning' | 'result'

function useCamera(active: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!active) return
    let stream: MediaStream | null = null
    let cancelled = false
    setReady(false)
    setError(null)
    openRearCamera()
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop())
        stream = s
        const video = videoRef.current
        if (video) {
          video.srcObject = s
          video.onloadedmetadata = () => {
            void video.play()
            setReady(true)
          }
        }
      })
      .catch((e: Error) =>
        setError(e.name === 'NotAllowedError' ? 'Permita o acesso à câmera para registrar o descarte.' : e.message || 'Câmera indisponível.'),
      )
    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [active, attempt])

  return { videoRef, error, ready, retry: () => setAttempt((a) => a + 1) }
}

export function Register() {
  const { refreshProfile } = useSession()
  const [params] = useSearchParams()
  const [bins, setBins] = useState<Bin[]>([])
  const [step, setStep] = useState<Step>('camera')
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null)
  const [result, setResult] = useState<RegisterResult | null>(null)
  const [chosenBin, setChosenBin] = useState<string | null>(params.get('bin'))

  const camera = useCamera(step === 'camera')
  const { reading, error: geoError } = useGeolocation(true, api.demo && bins.length ? pickDemoSpot(bins, params.get('bin')) : null)

  useEffect(() => {
    void api.listBins().then(setBins)
  }, [])
  useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo.url)
  }, [photo])

  const ranked = useMemo(() => (reading ? rankBins(bins, reading, reading.accuracy) : []), [bins, reading])
  const inRange = ranked.filter((r) => r.inRange)
  const imprecise = reading != null && reading.accuracy > MAX_ACCEPTED_ACCURACY_M
  const selected = inRange.find((r) => r.bin.id === chosenBin) ?? inRange[0]
  const canSend = !!reading && !imprecise && !!selected

  const shoot = useCallback(async () => {
    const video = camera.videoRef.current
    if (!video) return
    play('shutter')
    const blob = await captureFrame(video)
    setPhoto({ blob, url: URL.createObjectURL(blob) })
    setStep('preview')
  }, [camera.videoRef])

  async function send() {
    if (!photo || !reading || !selected) return
    setStep('scanning')
    play('scan')
    const res = await api.registerDisposal({
      image: photo.blob,
      lat: reading.lat,
      lng: reading.lng,
      accuracy: reading.accuracy,
      binId: selected.bin.id,
    })
    setResult(res)
    setStep('result')
    play(res.status === 'approved' || res.status === 'pending' ? 'success' : 'fail')
    if (res.status === 'approved' || res.status === 'pending') void refreshProfile()
  }

  function restart() {
    setPhoto(null)
    setResult(null)
    setStep('camera')
  }

  let gpsChip: { cls: string; text: string }
  if (geoError) gpsChip = { cls: 'bad', text: geoError }
  else if (!reading) gpsChip = { cls: 'warn', text: 'Buscando GPS...' }
  else if (imprecise) gpsChip = { cls: 'bad', text: `GPS fraco (±${Math.round(reading.accuracy)} m). Vá para um lugar aberto.` }
  else if (!selected)
    gpsChip = {
      cls: 'bad',
      text: ranked[0] ? `Longe de lixeiras: ${ranked[0].bin.name} a ${Math.round(ranked[0].distance)} m` : 'Nenhuma lixeira cadastrada',
    }
  else gpsChip = { cls: 'ok', text: `${selected.bin.name} · ${Math.round(selected.distance)} m (±${Math.round(reading.accuracy)} m)` }

  if (step === 'result' && result) return <ResultView result={result} photoUrl={photo?.url} onAgain={restart} />

  return (
    <div className="camera">
      <div className="camera__view">
        {step === 'camera' ? (
          <>
            <video ref={camera.videoRef} playsInline muted />
            {camera.error && (
              <div className="center-screen" style={{ position: 'absolute', inset: 0 }}>
                <Mascot mood="sad" size={80} />
                <p>{camera.error}</p>
                <button className="btn" onClick={camera.retry}>
                  TENTAR DE NOVO
                </button>
              </div>
            )}
          </>
        ) : (
          photo && <img src={photo.url} alt="Foto do resíduo" />
        )}
        <div className="viewfinder" />
        {step === 'scanning' && <div className="scanline" />}
        <div className="camera__hud">
          <span className={`hud-chip ${gpsChip.cls}`}>
            <Icon name="target" size={14} /> {gpsChip.text}
            {reading?.simulated && ' [simulado]'}
          </span>
          {step === 'camera' && (
            <span className="hud-chip">Mostre o item. Se der, com a lixeira ao fundo: +30%</span>
          )}
        </div>
      </div>
      <div className="camera__controls">
        {inRange.length > 1 && step !== 'scanning' && (
          <div className="chips" role="radiogroup" aria-label="Lixeira">
            {inRange.map((r) => (
              <button
                key={r.bin.id}
                className={`chip ${selected?.bin.id === r.bin.id ? 'active' : ''}`}
                onClick={() => setChosenBin(r.bin.id)}
              >
                {r.bin.name} · {Math.round(r.distance)} m
              </button>
            ))}
          </div>
        )}
        {step === 'camera' && (
          <button className="shutter" onClick={shoot} disabled={!camera.ready} aria-label="Tirar foto">
            <Icon name="camera" size={30} />
          </button>
        )}
        {step === 'preview' && (
          <div className="row">
            <button className="btn btn--ghost" onClick={restart}>
              REFAZER
            </button>
            <span className="spacer" />
            <button className="btn btn--green" onClick={send} disabled={!canSend}>
              ENVIAR
            </button>
          </div>
        )}
        {step === 'scanning' && (
          <div className="row" style={{ justifyContent: 'center' }}>
            <Mascot mood="scan" size={44} />
            <span className="title-font" style={{ fontSize: 10 }}>
              ANALISANDO RESÍDUO...
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function ResultView({ result, photoUrl, onAgain }: { result: RegisterResult; photoUrl?: string; onAgain: () => void }) {
  const ok = result.status === 'approved' || result.status === 'pending'
  return (
    <div className="screen-scroll">
      <div className="result">
        <Mascot mood={ok ? 'happy' : 'sad'} size={96} />
        {ok ? (
          <>
            <h1 style={{ marginTop: 10 }}>{result.status === 'approved' ? 'DESCARTE VALIDADO!' : 'EM REVISÃO'}</h1>
            <div className="points">+{result.points}</div>
            <p className="title-font" style={{ fontSize: 9 }}>
              PONTOS{result.status === 'pending' && ' (APÓS APROVAÇÃO)'}
            </p>
            <div className="card" style={{ textAlign: 'left', marginTop: 14 }}>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                {photoUrl && <img src={photoUrl} alt="" width={72} height={72} style={{ objectFit: 'cover', boxShadow: '0 0 0 3px var(--ink)' }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ fontSize: 22 }}>{result.ai.item_label}</strong>
                  <div className="muted">
                    {MATERIAL_INFO[result.ai.material].label} · {result.bin.name}
                  </div>
                </div>
              </div>
              <div className="bin-hint">
                <span className="bin-swatch" style={{ background: MATERIAL_INFO[result.ai.material].binColor }} />
                <span>
                  Vai na lixeira <b>{result.correctBin}</b>
                </span>
              </div>
              {MATERIAL_INFO[result.ai.material].note && <p className="muted">{MATERIAL_INFO[result.ai.material].note}</p>}
              {result.ai.tip && <p>💡 {result.ai.tip}</p>}
              <table className="breakdown">
                <tbody>
                  {result.breakdown.map((l, i) => (
                    <tr key={i}>
                      <td>{l.label}</td>
                      <td>{l.value}</td>
                    </tr>
                  ))}
                  <tr>
                    <td>
                      <b>Total</b>
                    </td>
                    <td>
                      <b>{result.points}</b>
                    </td>
                  </tr>
                </tbody>
              </table>
              {result.streak >= 2 && (
                <p className="row">
                  <Icon name="flame" size={16} /> Streak de {result.streak} dias!
                </p>
              )}
              {result.message && <p className="muted">{result.message}</p>}
            </div>
          </>
        ) : (
          <>
            <h1 style={{ marginTop: 10 }}>{result.status === 'rejected' ? 'NÃO VALIDADO' : 'OPS!'}</h1>
            <div className="card">
              <p>{result.message}</p>
              {result.status === 'rejected' && result.ai?.item_label && (
                <p className="muted">A IA viu: {result.ai.item_label}</p>
              )}
            </div>
          </>
        )}
        <div className="row" style={{ justifyContent: 'center', gap: 16 }}>
          <button className="btn btn--green" onClick={onAgain}>
            NOVO DESCARTE
          </button>
          <Link className="btn" to="/ranking">
            RANKING
          </Link>
        </div>
      </div>
    </div>
  )
}

/** No modo demo, simula o GPS na lixeira escolhida (ou na primeira). */
const demoSpots = new Map<string, { lat: number; lng: number }>()
function pickDemoSpot(bins: Bin[], binId: string | null) {
  const bin = bins.find((b) => b.id === binId) ?? bins[0]
  if (!demoSpots.has(bin.id)) demoSpots.set(bin.id, { lat: bin.lat + 0.00003, lng: bin.lng + 0.00002 })
  return demoSpots.get(bin.id)!
}
