// src/ContasAReceberReport.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config.js';
import { toast } from 'react-toastify'; // Importar toast

function ContasAReceberReport() {
  console.log("ContasAReceberReport: Renderizando componente.");

  const [reportData, setReportData] = useState({ items: [], total_geral: "0.00", quantidade_items: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchContasAReceber = useCallback(async () => {
    console.log("ContasAReceberReport: fetchContasAReceber chamado.");
    setLoading(true);
    setError('');

    const token = localStorage.getItem('token');
    if (!token) {
        setError("Autenticação necessária para visualizar relatórios.");
        setLoading(false);
        toast.error("Sessão expirada ou inválida. Faça login.");
        return;
    }
    const authHeaders = { 'Authorization': `Bearer ${token}` };

    try {
      // A API de relatórios pode não ter uma barra final, verifique a definição da rota no backend.
      // Se /api/relatorios/contas-a-receber é o endpoint exato:
      const response = await fetch(`${API_URL}/relatorios/contas-a-receber`, { headers: authHeaders });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ erro: `Erro HTTP: ${response.status}` }));
        console.error("ContasAReceberReport: Erro da API ao buscar relatório:", errorData);
        throw new Error(errorData.erro || `Erro HTTP: ${response.status}`);
      }
      const data = await response.json();
      console.log("ContasAReceberReport: Dados do relatório recebidos:", data);
      setReportData({
        items: data.items || [],
        total_geral: data.total_geral || "0.00",
        quantidade_items: data.quantidade_items || 0
      });
    } catch (err) {
      console.error("ContasAReceberReport: Erro detalhado ao buscar relatório:", err);
      setError(`Erro ao carregar relatório: ${err.message}`);
      if (!err.message.includes("Autenticação")) {
        toast.error(`Erro ao carregar relatório: ${err.message}`);
      }
    } finally {
      setLoading(false);
      console.log("ContasAReceberReport: fetchContasAReceber finalizado.");
    }
  }, []);

  useEffect(() => {
    fetchContasAReceber();
  }, [fetchContasAReceber]);

  if (loading) {
    console.log("ContasAReceberReport: Renderizando estado de carregamento.");
    return (
      <div className="d-flex justify-content-center align-items-center p-4">
        <div className="spinner-border text-primary spinner-border-sm" role="status">
          <span className="visually-hidden">A carregar relatório...</span>
        </div>
        <span className="ms-2 text-muted small">A carregar Contas a Receber...</span>
      </div>
    );
  }

  if (error) {
    console.error("ContasAReceberReport: Renderizando estado de erro:", error);
    return <div className="alert alert-danger small" role="alert">Erro ao carregar relatório: {error}</div>;
  }

  console.log("ContasAReceberReport: Renderizando tabela de relatório ou mensagem de lista vazia.");
  return (
    <div>
      <h6 className="mb-3">Relatório de Contas a Receber</h6>
      {reportData.items.length === 0 ? (
        <p className="text-muted">Nenhuma conta a receber pendente ou vencida no momento.</p>
      ) : (
        <>
          <div className="table-responsive">
            <table className="table table-sm table-striped table-hover">
              <thead className="table-light">
                <tr>
                  <th>Descrição</th>
                  <th>Cliente</th>
                  <th>Caso</th>
                  <th className="text-end">Valor (R$)</th>
                  <th>Vencimento</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {reportData.items.map(item => (
                  <tr key={item.id}>
                    <td>{item.descricao}</td>
                    <td>{item.cliente_nome || '-'}</td>
                    <td>{item.caso_titulo || '-'}</td>
                    <td className="text-end">
                      {typeof item.valor === 'number' || (typeof item.valor === 'string' && !isNaN(parseFloat(item.valor)))
                        ? parseFloat(item.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                        : 'N/A'}
                    </td>
                    <td>{item.data_vencimento ? new Date(item.data_vencimento).toLocaleDateString('pt-BR') : '-'}</td>
                    <td>
                      <span className={`badge ${
                        item.status === 'Pendente' ? 'bg-warning-subtle text-warning-emphasis' :
                        item.status === 'Vencido' ? 'bg-danger-subtle text-danger-emphasis' :
                        item.status === 'Pago' ? 'bg-success-subtle text-success-emphasis' :
                        'bg-light text-dark'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="table-light fw-bold">
                  <td colSpan="3" className="text-end">Total Geral a Receber:</td>
                  <td className="text-end">
                     {typeof reportData.total_geral === 'number' || (typeof reportData.total_geral === 'string' && !isNaN(parseFloat(reportData.total_geral)))
                      ? parseFloat(reportData.total_geral).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                      : 'R$ 0,00'}
                  </td>
                  <td colSpan="2">({reportData.quantidade_items} item(s))</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default ContasAReceberReport;