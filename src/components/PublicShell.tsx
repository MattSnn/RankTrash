import type { ReactNode } from 'react'

/** Moldura das telas sem login (login, /entrar, privacidade). */
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <div className="bezel" style={{ marginBottom: 16 }}>
        <main className="screen">
          <div className="screen-scroll">{children}</div>
        </main>
      </div>
    </div>
  )
}
