// Arquivo: src/ContasAReceberReport.jsx
// Componente para exibir o relatório de Contas a Receber.

import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config.js';

function ContasAReceberReport() {
    const [reportData, setReportData] = useState({ items: [], total_geral: 0, quantidade_items: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchContasAReceber = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const response = await fetch(`${API_URL}/relatorios/contas-a-receber`);
            if (!response.ok) {
                const resData = await response.json().catch(() => null);
                throw new Error(resData?.erro || `Erro HTTP: ${response.status}`);
            }
            const data = await response.json();
            setReportData(data || { items: [], total_geral: 0, quantidade_items: 0 });
        } catch (err) {
            console.error("Erro ao buscar relatório de contas a receber:", err);
            setError(`Erro ao carregar relatório: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchContasAReceber();
    }, [fetchContasAReceber]);

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center p-4">
                <div className="spinner-border text-primary spinner-border-sm" role="status">
                    <span className="visually-hidden">Carregando relatório...</span>
                </div>
                <span className="ms-2 text-muted small">Carregando Contas a Receber...</span>
            </div>
        );
    }

    if (error) {
        return <div className="alert alert-danger small" role="alert">Erro ao carregar relatório: {error}</div>;
    }

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
                                            {parseFloat(item.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                        <td>{new Date(item.data_vencimento).toLocaleDateString()}</td>
                                        <td><span className={`badge ${item.status === 'Pendente' ? 'bg-warning-subtle text-warning-emphasis' : 'bg-danger-subtle text-danger-emphasis'}`}>{item.status}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="table-light fw-bold">
                                    <td colSpan="3" className="text-end">Total Geral a Receber:</td>
                                    <td className="text-end">
                                        {parseFloat(reportData.total_geral).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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