import { useCallback, useState } from 'react'
import { toast } from 'react-toastify'
import { API_URL } from '../config.js'
import { createCaso, updateCaso } from '../api/casos.js'

// Mapping local — duplicado de EventoAgendaSection.jsx pra evitar dependência cíclica
const TIPO_IA_PARA_AGENDA = {
  audiencia: 'Audiência',
  prazo_contestacao: 'Prazo',
  prazo_impugnacao: 'Prazo',
  prazo_replica: 'Prazo',
  prazo_treplica: 'Prazo',
  prazo_recurso: 'Prazo',
  prazo_embargos: 'Prazo',
  prazo_alegacoes_finais: 'Prazo',
  prazo_cumprimento: 'Prazo',
  pericia: 'Perícia',
  sustentacao_oral: 'Audiência',
  outro: 'Outro',
}

function useCasoForm({
  formData,
  isEditing,
  casoParaEditar,
  onCasoChange,
  criarEvento,
  eventoData,
  eventosIA = [],
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
      const cliente_id = formData.cliente_id ? parseInt(formData.cliente_id, 10) : null
      let totalCriados = 0
      let totalFalha = 0

      // 1) Eventos sugeridos pela IA (se o user marcou algum)
      const eventosIaSelecionados = (eventosIA || []).filter((ev) => ev.selecionado && ev.data)
      for (const ev of eventosIaSelecionados) {
        const dataHora = ev.hora ? `${ev.data}T${ev.hora}` : `${ev.data}T09:00`
        const notasParts = []
        if (ev.local) notasParts.push(`Local: ${ev.local}`)
        if (ev.modalidade && ev.modalidade !== 'prazo_so')
          notasParts.push(`Modalidade: ${ev.modalidade}`)
        if (ev.link) notasParts.push(`Link: ${ev.link}`)
        if (ev.base_legal) notasParts.push(`Base legal: ${ev.base_legal}`)
        if (ev.observacao) notasParts.push(ev.observacao)

        const payload = {
          titulo: ev.titulo,
          data_hora_inicio: dataHora,
          tipo_evento: TIPO_IA_PARA_AGENDA[ev.tipo] || 'Outro',
          notas: notasParts.join('\n'),
          caso_id: casoId,
          cliente_id,
        }

        try {
          const resp = await fetch(`${API_URL}/agenda/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(payload),
          })
          if (resp.ok) totalCriados += 1
          else totalFalha += 1
        } catch {
          totalFalha += 1
        }
      }

      // 2) Evento manual (formulário detalhado), se preenchido
      if (eventoData.titulo && eventoData.data_hora) {
        const payload = {
          titulo: eventoData.titulo,
          data_hora_inicio: eventoData.data_hora,
          tipo_evento: eventoData.tipo,
          notas: eventoData.notas,
          caso_id: casoId,
          cliente_id,
        }
        try {
          const resp = await fetch(`${API_URL}/agenda/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(payload),
          })
          if (resp.ok) totalCriados += 1
          else totalFalha += 1
        } catch {
          totalFalha += 1
        }
      }

      if (totalCriados > 0) {
        toast.success(
          totalCriados === 1
            ? 'Evento criado na agenda!'
            : `${totalCriados} eventos criados na agenda!`
        )
      }
      if (totalFalha > 0) {
        toast.warning(`Caso salvo, mas ${totalFalha} evento(s) não foi(ram) criado(s) na agenda.`)
      }
    },
    [eventoData, eventosIA, formData.cliente_id]
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
        const token = localStorage.getItem('token')
        const responseData = isEditing
          ? await updateCaso(casoParaEditar.id, dadosParaEnviar)
          : await createCaso(dadosParaEnviar)

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
