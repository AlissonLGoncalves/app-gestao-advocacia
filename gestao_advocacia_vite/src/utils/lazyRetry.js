import React from 'react'

// Depois de um deploy no Vercel, os chunks do build antigo somem (hash novo).
// Uma aba aberta antes do deploy tenta baixar o chunk antigo ao navegar,
// recebe 404 e a rota fica em branco (React.lazy sem ErrorBoundary).
// Incidente de 07/09/2026: /onboarding em branco logo apos o cadastro.
//
// lazyRetry: no primeiro erro de carga de chunk, recarrega a pagina uma vez
// (flag em sessionStorage evita loop). Se falhar de novo, propaga o erro.

const FLAG = 'patronus_chunk_reload'

export function isChunkLoadError(err) {
  const msg = String(err?.message || err || '')
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /ChunkLoadError/i.test(msg) ||
    /Loading (CSS )?chunk [\w-]+ failed/i.test(msg)
  )
}

function storage() {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

export function loadWithRetry(importer, { reload = () => window.location.reload() } = {}) {
  return importer().then(
    (mod) => {
      storage()?.removeItem(FLAG)
      return mod
    },
    (err) => {
      const store = storage()
      if (isChunkLoadError(err) && store && !store.getItem(FLAG)) {
        store.setItem(FLAG, '1')
        reload()
        // A pagina esta recarregando; nunca resolve para o Suspense nao piscar erro.
        return new Promise(() => {})
      }
      throw err
    }
  )
}

export function lazyRetry(importer) {
  return React.lazy(() => loadWithRetry(importer))
}
