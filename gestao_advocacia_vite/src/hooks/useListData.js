import { useCallback, useEffect, useState } from 'react'

function useListData({ fetcher, mapData, errorPrefix, onError, refreshKey }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refetch = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const data = await fetcher()
      const mappedItems = mapData ? mapData(data) : data
      setItems(Array.isArray(mappedItems) ? mappedItems : [])
    } catch (err) {
      const message = err?.message || 'Erro desconhecido'
      const fullMessage = `${errorPrefix}: ${message}`
      setError(fullMessage)
      if (typeof onError === 'function') {
        onError(err, fullMessage)
      }
    } finally {
      setLoading(false)
    }
  }, [errorPrefix, fetcher, mapData, onError])

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