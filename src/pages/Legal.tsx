import { PublicShell } from '../components/PublicShell'

/** /privacidade e /termos: públicas (a tela de permissões da Microsoft aponta para cá). */
export function Legal() {
  return (
    <PublicShell>
      <div className="legal">
        <h1 style={{ marginTop: 10 }}>PRIVACIDADE</h1>
        <div className="card">
          <p>
            O RankTrash é um projeto acadêmico (UPX) da campanha <b>Lixo Zero da Facens</b>. Ele não é um produto
            comercial e não vende nem compartilha dados.
          </p>
          <h2>O QUE COLETAMOS</h2>
          <ul>
            <li>
              <b>Da conta Microsoft:</b> só nome e e-mail @facens.br, para identificar você e mostrar seu nome no
              ranking. Sua senha fica com a Microsoft e nunca passa pelo RankTrash.
            </li>
            <li>
              <b>Do descarte:</b> a foto do resíduo, a localização no momento do registro (para confirmar que você está
              numa lixeira do campus), o item e o material identificados e os pontos.
            </li>
            <li>
              <b>Do perfil:</b> nome de exibição (editável) e curso.
            </li>
          </ul>
          <h2>COMO USAMOS</h2>
          <ul>
            <li>As fotos são analisadas por IA (Google Gemini) para identificar o item e o material.</li>
            <li>A localização é usada só na hora do registro, não acompanhamos você pelo campus.</li>
            <li>No ranking aparecem só nome de exibição, curso e pontos.</li>
            <li>As fotos são apagadas após 60 dias. Antes da premiação, a equipe pode revisar as fotos do top 10.</li>
          </ul>
          <h2>SEUS DIREITOS (LGPD)</h2>
          <p>
            Você pode pedir para ver, corrigir ou apagar seus dados a qualquer momento, falando com a organização da
            campanha Lixo Zero da Facens.
          </p>
        </div>

        <h1 id="termos">TERMOS DE USO</h1>
        <div className="card">
          <ul>
            <li>Uso exclusivo de alunos e colaboradores da Facens durante a campanha Lixo Zero.</li>
            <li>Registre só descartes reais, feitos por você, na lixeira indicada.</li>
            <li>Fotos repetidas, de tela ou manipuladas são recusadas. Fraude leva à desclassificação do ranking.</li>
            <li>Os prêmios mensais seguem o regulamento divulgado pela organização da campanha.</li>
            <li>O app é oferecido como está, sem garantia de disponibilidade, por ser um projeto acadêmico.</li>
          </ul>
        </div>
        <p className="muted" style={{ textAlign: 'center' }}>
          <a href="/">Voltar ao RankTrash</a>
        </p>
      </div>
    </PublicShell>
  )
}
