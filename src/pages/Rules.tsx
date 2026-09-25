import { MATERIAL_INFO, MATERIALS } from '../../supabase/functions/_shared/materials.ts'
import { MAX_PER_BIN_PER_DAY, MAX_PER_DAY } from '../../supabase/functions/_shared/antifraud.ts'
import {
  FIRST_OF_DAY_BONUS,
  FIRST_VISIT_BONUS,
  FULL_VALUE_PER_MATERIAL_PER_DAY,
  HALF_VALUE_PER_MATERIAL_PER_DAY,
  STREAK_MIN_DAYS,
} from '../../supabase/functions/_shared/scoring.ts'

export function Rules() {
  return (
    <div className="screen-scroll">
      <h1 style={{ marginTop: 10 }}>COMO JOGAR</h1>
      <div className="card">
        <ol style={{ paddingLeft: 22, margin: 0 }}>
          <li>Vá até uma lixeira marcada no mapa.</li>
          <li>Toque em DESCARTAR e fotografe o item (de preferência com a lixeira ao fundo).</li>
          <li>A IA identifica o item e o material e diz em qual lixeira ele vai.</li>
          <li>Descarte e ganhe pontos. No fim do mês, o top 3 ganha prêmios!</li>
        </ol>
      </div>
      <div className="card">
        <h2>PONTOS POR MATERIAL</h2>
        <div className="materials">
          {MATERIALS.map((m) => (
            <div key={m}>
              <i style={{ background: MATERIAL_INFO[m].binColor }} />
              {MATERIAL_INFO[m].label}: {MATERIAL_INFO[m].basePoints}
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <h2>BÔNUS</h2>
        <p>★ Lixeira aparecendo na foto: ×1,3</p>
        <p>★ Streak de {STREAK_MIN_DAYS}+ dias seguidos: ×1,2</p>
        <p>★ 1ª visita a uma lixeira: +{FIRST_VISIT_BONUS}</p>
        <p>★ 1º descarte do dia: +{FIRST_OF_DAY_BONUS}</p>
      </div>
      <div className="card">
        <h2>JOGO LIMPO</h2>
        <p>
          Mesmo material no mesmo dia: os {FULL_VALUE_PER_MATERIAL_PER_DAY} primeiros valem 100%, até o{' '}
          {HALF_VALUE_PER_MATERIAL_PER_DAY}º valem 50% e depois 0.
        </p>
        <p>
          Máximo de {MAX_PER_DAY} registros por dia e {MAX_PER_BIN_PER_DAY} por lixeira. Um registro por minuto.
        </p>
        <p>Fotos repetidas, fotos de tela e itens já registrados são recusados automaticamente.</p>
        <p>Antes da premiação, a equipe audita as fotos do top 10. Fraude = desclassificação.</p>
      </div>
    </div>
  )
}
