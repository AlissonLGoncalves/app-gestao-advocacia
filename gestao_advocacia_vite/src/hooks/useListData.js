import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Hook para carregar listas paginadas/filtradas com tratamento de loading,
 * erro e refetch. Compartilhado por CasoList, ClienteList, DespesaList,
 * DocumentoList, RecebimentoList.
 *
 * **Importante:** as callbacks (`fetcher`, `mapData`, `onError`) são
 * armazenadas em refs e NÃO entram nas deps do useCallback. Isso evita
 * loop infinito de refetch quando o caller passa funções inline (que são
 * recriadas a cada render). Era a causa de "loop de loading" descoberto
 * em prod 2026-05-09: 5 páginas (Casos/Clientes/Despesas/Documentos/
 * Recebimentos) ficavam re-fetchando indefinidamente porque seus consumers
 * passam mapData inline (`mapData: (data) => data`).
 */
function useListData({ fetcher, mapData, errorPrefix, onError, refreshKey }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Refs pra callbacks — atualizadas em cada render mas NÃO disparam refetch.
  const fetcherRef = useRef(fetcher)
  const mapDataRef = useRef(mapData)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    fetcherRef.current = fetcher
    mapDataRef.current = mapData
    onErrorRef.current = onError
  })

  const refetch = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const data = await fetcherRef.current()
      const mapped = mapDataRef.current ? mapDataRef.current(data) : data
      setItems(Array.isArray(mapped) ? mapped : [])
    } catch (err) {
      const message = err?.message || 'Erro desconhecido'
      const fullMessage = `${errorPrefix}: ${message}`
      setError(fullMessage)
      if (typeof onErrorRef.current === 'function') {
        onErrorRef.current(err, fullMessage)
      }
    } finally {
      setLoading(false)
    }
  }, [errorPrefix])

  useEffect(() => {
    refetch()
  }, [refetch, refreshKey])

  return {
    items,
    setItems,
    loading,
    error,
    setError,
    refetch,
  }
}

export default useListData
