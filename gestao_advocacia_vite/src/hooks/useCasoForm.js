import { useCallback, useState } from 'react'
import { toast } from 'react-toastify'
import { API_URL } from '../config.js'

function useCasoForm({
  formData,
  isEditing,
  casoParaEditar,
  onCasoChange,
  criarEvento,
  eventoData,
  setLoading,
}) {
  const [validationErrors, setValidationErrors] = useState({})

  const clearValidationErrors = useCallback(() => setValidationErrors({}), [])

  const validateForm = useCallback(() => {
    const errors = {}
    if (!formData.titulo?.trim()) errors.titulo = 'Titulo do caso e obrigatorio.'
    if (!formData.cliente_id) errors.cliente_id = 'Cliente e obrigatorio.'
    if (!formData.status?.trim()) errors.status = 'Status e obrigatorio.'

    if (
      formData.valor_causa &&
      (isNaN(parseFloat(formData.valor_causa)) || parseFloat(formData.valor_causa) < 0)
    ) {
      errors.valor_causa = 'Valor da causa deve ser um numero positivo.'
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }, [formData])

  const criarEventoAgenda = useCallback(
    async (casoId, token) => {
      if (!eventoData.titulo || !eventoData.data_hora) return

      const payload = {
        titulo: eventoData.titulo,
        data_hora_inicio: eventoData.data_hora,
        tipo_evento: eventoData.tipo,
        notas: eventoData.notas,
        caso_id: casoId,
        cliente_id: formData.cliente_id ? parseInt(formData.cliente_id, 10) : null,
      }

      try {
        const resp = await fetch(`${API_URL}/agenda/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        })

        if (resp.ok) toast.success('Evento criado na agenda!')
        else toast.warning('Caso salvo, mas falha ao criar evento na agenda.')
      } catch {
        toast.warning('Caso salvo, mas falha ao criar evento na agenda.')
      }
    },
    [eventoData, formData.cliente_id]
  )

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault()
      clearValidationErrors()

      if (!validateForm()) {
        toast.error('Corrija os erros indicados.')
        return
      }

      setLoading(true)

      const dadosParaEnviar = {
        ...formData,
        valor_causa: formData.valor_causa ? parseFloat(formData.valor_causa) : null,
        data_distribuicao: formData.data_distribuicao || null,
        cliente_id: parseInt(formData.cliente_id, 10),
      }

      try {
        const url = isEditing ? `${API_URL}/casos/${casoParaEditar.id}` : `${API_URL}/casos`
        const method = isEditing ? 'PUT' : 'POST'
        const token = localStorage.getItem('token')
        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(dadosParaEnviar),
        })

        const responseData = await response.json()
        if (!response.ok)
          throw new Error(responseData.erro || `Falha ao salvar caso. Status: ${response.status}`)

        toast.success(`Caso ${isEditing ? 'atualizado' : 'adicionado'} com sucesso!`)
        if (criarEvento && !isEditing) await criarEventoAgenda(responseData.id, token)
        if (typeof onCasoChange === 'function') onCasoChange()
      } catch (error) {
        toast.error(error.message || 'Erro desconhecido ao salvar o caso.')
      } finally {
        setLoading(false)
      }
    },
    [
      casoParaEditar,
      clearValidationErrors,
      criarEvento,
      criarEventoAgenda,
      formData,
      isEditing,
      onCasoChange,
      setLoading,
      validateForm,
    ]
  )

  return {
    validationErrors,
    setValidationErrors,
    clearValidationErrors,
    handleSubmit,
  }
}

export default useCasoForm
