// src/ContasAPagarReport.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config.js'; // Ajuste o caminho se config.js não estiver em src/

function ContasAPagarReport() {
  console.log("ContasAPagarReport: Renderizando componente.");

  const [reportData, setReportData] = useState({ items: [], total_geral: "0.00", quantidade_items: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchContasAPagar = useCallback(async () => {
    console.log("ContasAPagarReport: fetchContasAPagar chamado.");
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/relatorios/contas-a-pagar`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ erro: `Erro HTTP: ${response.status}` }));
        console.error("ContasAPagarReport: Erro da API ao buscar relatório:", errorData);
        throw new Error(errorData.erro || `Erro HTTP: ${response.status}`);
      }
      const data = await response.json();
      console.log("ContasAPagarReport: Dados do relatório recebidos:", data);
      // Garante que os valores padrão sejam usados se a API não retornar a estrutura esperada
      setReportData({
        items: data.items || [],
        total_geral: data.total_geral || "0.00",
        quantidade_items: data.quantidade_items || 0
      });
    } catch (err) {
      console.error("ContasAPagarReport: Erro detalhado ao buscar relatório:", err);
      setError(`Erro ao carregar relatório de contas a pagar: ${err.message}`);
    } finally {
      setLoading(false);
      console.log("ContasAPagarReport: fetchContasAPagar finalizado.");
    }
  }, []); // API_URL como dependência se vier de contexto/props

  useEffect(() => {
    fetchContasAPagar();
  }, [fetchContasAPagar]);

  if (loading) {
    console.log("ContasAPagarReport: Renderizando estado de carregamento.");
    return (
      <div className="d-flex justify-content-center align-items-center p-4">
        <div className="spinner-border text-primary spinner-border-sm" role="status">
          <span className="visually-hidden">A carregar relatório...</span>
        </div>
        <span className="ms-2 text-muted small">A carregar Contas a Pagar...</span>
      </div>
    );
  }

  if (error) {
    console.error("ContasAPagarReport: Renderizando estado de erro:", error);
    return <div className="alert alert-danger small" role="alert">Erro ao carregar relatório: {error}</div>;
  }

  console.log("ContasAPagarReport: Renderizando tabela de relatório ou mensagem de lista vazia.");
  return (
    <div>
      <h6 className="mb-3">Relatório de Contas a Pagar</h6>
      {reportData.items.length === 0 ? (
        <p className="text-muted">Nenhuma conta a pagar pendente ou vencida no momento.</p>
      ) : (
        <>
          <div className="table-responsive">
            <table className="table table-sm table-striped table-hover">
              <thead className="table-light">
                <tr>
                  <th>Descrição</th>
                  <th>Caso Associado</th>
                  <th className="text-end">Valor (R$)</th>
                  <th>Vencimento</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {reportData.items.map(item => (
                  <tr key={item.id}>
                    <td>{item.descricao}</td>
                    <td>{item.caso_titulo || 'Despesa Geral'}</td>
                    <td className="text-end">
                      {/* Garante que o valor é um número antes de formatar */}
                      {typeof item.valor === 'number' || (typeof item.valor === 'string' && !isNaN(parseFloat(item.valor)))
                        ? parseFloat(item.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                        : 'N/A'}
                    </td>
                    <td>{item.data_vencimento ? new Date(item.data_vencimento).toLocaleDateString('pt-BR') : '-'}</td>
                    <td>
                      <span className={`badge ${
                        item.status === 'A Pagar' ? 'bg-warning-subtle text-warning-emphasis' :
                        item.status === 'Vencida' ? 'bg-danger-subtle text-danger-emphasis' :
                        item.status === 'Paga' ? 'bg-success-subtle text-success-emphasis' : // Adicionado para consistência
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
                  <td colSpan="2" className="text-end">Total Geral a Pagar:</td>
                  <td className="text-end">
                    {/* Garante que total_geral é um número antes de formatar */}
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

export default ContasAPagarReport;
