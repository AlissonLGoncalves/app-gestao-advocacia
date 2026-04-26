import React, { useEffect, useState } from 'react'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts'
import { api } from '../api/client.js'

const PALETA = ['#2563eb', '#16a34a', '#dc2626', '#f59e0b', '#9333ea', '#0891b2', '#65a30d']

const formatarMoeda = (v) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(v ?? 0)

const formatarMesCurto = (yyyymm) => {
  if (!yyyymm) return ''
  const [, mes] = yyyymm.split('-')
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return nomes[Number(mes) - 1] || yyyymm
}

const formatarDiaCurto = (iso) => {
  if (!iso) return ''
  const d = new Date(`${iso}T00:00:00`)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function CardChart({ titulo, subtitulo, loading, error, vazio, children }) {
  return (
    <div className="card shadow-sm border-0 h-100">
      <div className="card-body p-3">
        <h6 className="fw-bold mb-1" style={{ fontFamily: 'var(--font-heading)' }}>
          {titulo}
        </h6>
        {subtitulo && (
          <p className="text-muted small mb-3" style={{ fontSize: '0.75rem' }}>
            {subtitulo}
          </p>
        )}
        {loading && <p className="text-muted text-center py-4 small mb-0">Carregando…</p>}
        {error && <p className="text-danger text-center py-4 small mb-0">{error}</p>}
        {!loading && !error && vazio && (
          <p className="text-muted text-center py-4 small fst-italic mb-0">{vazio}</p>
        )}
        {!loading && !error && !vazio && (
          <div style={{ width: '100%', height: 240 }}>{children}</div>
        )}
      </div>
    </div>
  )
}

function useChartData(path) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    api
      .get(path)
      .then((data) => {
        if (active) setItems(data?.items ?? [])
      })
      .catch((e) => {
        if (active) setError(e?.message || 'Erro ao carregar')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [path])

  return { items, loading, error }
}

export default function DashboardCharts() {
  const casosStatus = useChartData('/dashboard/charts/casos-por-status')
  const casosArea = useChartData('/dashboard/charts/casos-por-area')
  const financeiro = useChartData('/dashboard/charts/financeiro-mensal')
  const publicacoes = useChartData('/dashboard/charts/publicacoes-por-dia')

  const totalPublicacoes = publicacoes.items.reduce((acc, it) => acc + (it.quantidade || 0), 0)
  const semFinanceiro = financeiro.items.every((it) => it.receita === 0 && it.despesa === 0)

  return (
    <div className="row g-3">
      <div className="col-12 col-lg-6">
        <CardChart
          titulo="Casos por status"
          subtitulo="Distribuição atual da carteira"
          loading={casosStatus.loading}
          error={casosStatus.error}
          vazio={casosStatus.items.length === 0 ? 'Sem casos cadastrados ainda.' : null}
        >
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={casosStatus.items}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={(entry) => `${entry.label} (${entry.value})`}
              >
                {casosStatus.items.map((_, idx) => (
                  <Cell key={idx} fill={PALETA[idx % PALETA.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
            </PieChart>
          </ResponsiveContainer>
        </CardChart>
      </div>

      <div className="col-12 col-lg-6">
        <CardChart
          titulo="Casos por área do direito"
          subtitulo="Especialização da banca"
          loading={casosArea.loading}
          error={casosArea.error}
          vazio={casosArea.items.length === 0 ? 'Sem casos cadastrados ainda.' : null}
        >
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={casosArea.items}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={(entry) => `${entry.label} (${entry.value})`}
              >
                {casosArea.items.map((_, idx) => (
                  <Cell key={idx} fill={PALETA[(idx + 2) % PALETA.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
            </PieChart>
          </ResponsiveContainer>
        </CardChart>
      </div>

      <div className="col-12">
        <CardChart
          titulo="Receita × despesa (últimos 12 meses)"
          subtitulo="Apenas valores marcados como recebidos/pagos"
          loading={financeiro.loading}
          error={financeiro.error}
          vazio={semFinanceiro ? 'Sem movimentações financeiras nos últimos 12 meses.' : null}
        >
          <ResponsiveContainer>
            <BarChart data={financeiro.items}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="mes" tickFormatter={formatarMesCurto} fontSize={11} />
              <YAxis tickFormatter={formatarMoeda} fontSize={11} width={70} />
              <Tooltip
                formatter={(v) => formatarMoeda(v)}
                labelFormatter={(label) => formatarMesCurto(label)}
              />
              <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
              <Bar dataKey="receita" name="Receita" fill="#16a34a" radius={[4, 4, 0, 0]} />
              <Bar dataKey="despesa" name="Despesa" fill="#dc2626" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardChart>
      </div>

      <div className="col-12">
        <CardChart
          titulo="Publicações DJEN por dia (últimos 30 dias)"
          subtitulo={`Total no período: ${totalPublicacoes}`}
          loading={publicacoes.loading}
          error={publicacoes.error}
          vazio={
            totalPublicacoes === 0 ? 'Nenhuma publicação capturada nos últimos 30 dias.' : null
          }
        >
          <ResponsiveContainer>
            <LineChart data={publicacoes.items}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="data" tickFormatter={formatarDiaCurto} fontSize={11} interval={3} />
              <YAxis allowDecimals={false} fontSize={11} width={30} />
              <Tooltip labelFormatter={(label) => formatarDiaCurto(label)} />
              <Line
                type="monotone"
                dataKey="quantidade"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardChart>
      </div>
    </div>
  )
}
