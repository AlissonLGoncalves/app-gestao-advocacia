import { useCallback, useState } from 'react'
import { toast } from 'react-toastify'
import { createCliente, updateCliente } from '../api/clientes.js'

function useClienteForm({ formData, isEditing, clienteParaEditar, onClienteChange, setLoading }) {
  const [validationErrors, setValidationErrors] = useState({})

  const clearValidationErrors = useCallback(() => {
    setValidationErrors({})
  }, [])

  const validateForm = useCallback(() => {
    const errors = {}

    if (!formData.nome_razao_social || !formData.nome_razao_social.trim()) {
      errors.nome_razao_social = 'Nome / Razao Social e obrigatorio.'
    }

    if (!formData.cpf_cnpj || !formData.cpf_cnpj.trim()) {
      errors.cpf_cnpj = 'CPF / CNPJ principal e obrigatorio.'
    } else {
      const numCpfCnpj = formData.cpf_cnpj.replace(/\D/g, '')
      if (formData.tipo_pessoa === 'PF' && numCpfCnpj.length !== 11)
        errors.cpf_cnpj = 'CPF principal deve conter 11 digitos.'
      if (formData.tipo_pessoa === 'PJ' && numCpfCnpj.length !== 14)
        errors.cpf_cnpj = 'CNPJ principal deve conter 14 digitos.'
    }

    if (!formData.tipo_pessoa) errors.tipo_pessoa = 'Tipo de Pessoa e obrigatorio.'

    if (formData.email && !/^\S+@\S+\.\S+$/.test(formData.email)) {
      errors.email = 'Formato de e-mail invalido.'
    }

    if (formData.tipo_pessoa === 'PJ') {
      if (formData.cnpj_secundario && formData.cnpj_secundario.replace(/\D/g, '').length !== 14) {
        errors.cnpj_secundario = 'CNPJ secundario deve conter 14 digitos.'
      }
      if (formData.cnpj_terciario && formData.cnpj_terciario.replace(/\D/g, '').length !== 14) {
        errors.cnpj_terciario = 'CNPJ terciario deve conter 14 digitos.'
      }
      if (formData.cnpj_secundario && formData.cnpj_secundario === formData.cpf_cnpj) {
        errors.cnpj_secundario = 'CNPJ secundario nao pode ser igual ao CNPJ principal.'
      }
      if (formData.cnpj_terciario && formData.cnpj_terciario === formData.cpf_cnpj) {
        errors.cnpj_terciario = 'CNPJ terciario nao pode ser igual ao CNPJ principal.'
      }
      if (
        formData.cnpj_secundario &&
        formData.cnpj_terciario &&
        formData.cnpj_secundario === formData.cnpj_terciario
      ) {
        errors.cnpj_secundario = 'CNPJ secundario e terciario nao podem ser iguais.'
      }
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }, [formData])

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault()
      clearValidationErrors()

      if (!validateForm()) {
        toast.error('Por favor, corrija os erros indicados no formulario.')
        return
      }

      setLoading(true)

      const dadosParaEnviar = {
        ...formData,
        cpf_cnpj: formData.cpf_cnpj.replace(/\D/g, ''),
        data_nascimento: formData.data_nascimento || null,
        cnpj_secundario:
          formData.tipo_pessoa === 'PJ' && formData.cnpj_secundario
            ? formData.cnpj_secundario.replace(/\D/g, '')
            : null,
        descricao_cnpj_secundario:
          formData.tipo_pessoa === 'PJ' ? formData.descricao_cnpj_secundario : null,
        cnpj_terciario:
          formData.tipo_pessoa === 'PJ' && formData.cnpj_terciario
            ? formData.cnpj_terciario.replace(/\D/g, '')
            : null,
        descricao_cnpj_terciario:
          formData.tipo_pessoa === 'PJ' ? formData.descricao_cnpj_terciario : null,
      }

      if (dadosParaEnviar.tipo_pessoa === 'PJ') {
        delete dadosParaEnviar.rg
        delete dadosParaEnviar.orgao_emissor
        delete dadosParaEnviar.data_nascimento
        delete dadosParaEnviar.estado_civil
        delete dadosParaEnviar.profissao
        delete dadosParaEnviar.nacionalidade
      } else {
        delete dadosParaEnviar.nome_fantasia
        delete dadosParaEnviar.nire
        delete dadosParaEnviar.inscricao_estadual
        delete dadosParaEnviar.inscricao_municipal
      }

      try {
        // PR A do diagnostico: captura entidade criada/atualizada pra
        // permitir redirect contextual (lista vs detalhe) no caller.
        const resultado = isEditing
          ? await updateCliente(clienteParaEditar.id, dadosParaEnviar)
          : await createCliente(dadosParaEnviar)

        toast.success(`Cliente ${isEditing ? 'atualizado' : 'adicionado'} com sucesso!`)
        if (typeof onClienteChange === 'function') {
          onClienteChange(resultado, !isEditing)
        }
      } catch (error) {
        toast.error(error.message || 'Erro desconhecido ao salvar o cliente.')
      } finally {
        setLoading(false)
      }
    },
    [
      clearValidationErrors,
      clienteParaEditar,
      formData,
      isEditing,
      onClienteChange,
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

export default useClienteForm
