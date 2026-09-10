// Inicio ("Seu dia") — redesign Stitch 2026-09, TELA 1.
//
// A tela que o advogado abre antes do PJe. Uma pergunta ("o que fazer
// agora?"), uma lista, um botao primario. Nada de KPI, grafico ou coluna.
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'react-toastify'
import { api } from '../api/client.js'
import { tratarItemAgenda } from '../api/itensAgenda.js'
import FilaDoDia from './inicio/FilaDoDia.jsx'
import LinhaDjen from './inicio/LinhaDjen.jsx'
import ProgressoDia from './inicio/ProgressoDia.jsx'
import ResumoSemana from './inicio/ResumoSemana.jsx'
import SequenciaChip from './inicio/SequenciaChip.jsx'
import TudoEmDia from './inicio/TudoEmDia.jsx'
import { montarFila, saudacaoPorHora } from './inicio/montarFila.js'
import './DashboardHome.css'

const obterPrimeiroNome = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    return (user.nome_completo || user.username || '').trim().split(/\s+/)[0]
  } catch {
    return ''
  }
}

function DashboardSkeleton() {
  return (
    <div className="dashboard-home" aria-label="Carregando a tela inicial" aria-busy="true">
      <div className="dh-skeleton dh-skeleton--titulo" />
      <div className="dh-skeleton dh-skeleton--linha" />
      <div className="dh-skeleton dh-skeleton--lista" />
    </div>
  )
}

function DashboardHome() {
  const navigate = useNavigate()
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  // Concluidas nesta sessao: a linha desce riscada sem recarregar tudo.
  const [concluidasLocais, setConcluidasLocais] = useState([])
  const [concluindoChave, setConcluindoChave] = useState(null)

  const carregar = useCallback(async () => {
    setErro('')
    try {
      setDados(await api.get('/dashboard/home'))
    } catch (error) {
      setErro(error.message || 'Não foi possível carregar a tela inicial.')
    }
  }, [])

  useEffect(() => {
    let ativo = true
    api
      .get('/dashboard/home')
      .then((resultado) => {
        if (ativo) setDados(resultado)
      })
      .catch((error) => {
        if (ativo) setErro(error.message || 'Não foi possível carregar a tela inicial.')
      })
    return () => {
      ativo = false
    }
  }, [])

  const fila = useMemo(() => montarFila(dados), [dados])

  const concluir = async (linha) => {
    setConcluindoChave(linha.chave)
    try {
      await tratarItemAgenda(linha.acao.itemId, { acao: 'cumpri' })
      setConcluidasLocais((atuais) => [
        { ...linha, chave: `local-${linha.chave}`, detalhe: 'Prazo cumprido' },
        ...atuais,
      ])
    } catch (error) {
      toast.error(error.message || 'Não foi possível concluir o prazo.')
    } finally {
      setConcluindoChave(null)
    }
  }

  if (!dados && !erro) return <DashboardSkeleton />

  if (!dados && erro) {
    return (
      <div className="dashboard-home">
        <div className="dh-erro" role="alert">
          <strong>Não foi possível montar seu dia.</strong>
          <span>{erro}</span>
          <button type="button" className="dh-btn dh-btn--contorno" onClick={carregar}>
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  const chavesLocais = new Set(concluidasLocais.map((item) => item.chave.replace(/^local-/, '')))
  const pendentes = fila.pendentes.filter((linha) => !chavesLocais.has(linha.chave))
  const concluidas = [...concluidasLocais, ...fila.concluidas]

  const resolvidas = (dados.progresso_hoje?.resolvidas || 0) + concluidasLocais.length
  const total = resolvidas + pendentes.length
  const n = pendentes.length

  const primeiroNome = obterPrimeiroNome()
  const saudacao = saudacaoPorHora(new Date().getHours())
  const resumo = dados.resumo || {}
  const bancoVazio = (resumo.clientes || 0) === 0 && (resumo.casos_ativos || 0) === 0

  return (
    <div className="dashboard-home">
      <header className="dh-topo">
        <div className="dh-topo__texto">
          <h1>{primeiroNome ? `${saudacao}, ${primeiroNome}.` : `${saudacao}.`}</h1>
          <p className="dh-subtitulo">
            {n === 0
              ? 'Nada pendente para hoje.'
              : `Você tem ${n} ${n === 1 ? 'coisa' : 'coisas'} para resolver hoje. Comece pela primeira.`}
          </p>
        </div>
        <SequenciaChip dias={dados.sequencia_dias} />
      </header>

      {n > 0 && <ProgressoDia resolvidas={resolvidas} total={total} />}

      <LinhaDjen
        captura={dados.captura_hoje}
        configurado={Boolean(dados.monitoramento_djen_configurado)}
        onNavegar={navigate}
      />

      {n === 0 && concluidas.length === 0 ? (
        <TudoEmDia bancoVazio={bancoVazio} onNavegar={navigate} />
      ) : (
        <>
          {n === 0 && <TudoEmDia bancoVazio={false} onNavegar={navigate} />}
          <FilaDoDia
            pendentes={pendentes}
            concluidas={concluidas}
            concluindoChave={concluindoChave}
            onNavegar={navigate}
            onConcluir={concluir}
          />
        </>
      )}

      <ResumoSemana semana={dados.semana} onNavegar={navigate} />
    </div>
  )
}

export default DashboardHome
