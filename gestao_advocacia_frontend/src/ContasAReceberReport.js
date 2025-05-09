// ==================================================
// Conteúdo do arquivo: src/ContasAReceberReport.js
// (Sem alterações)
// ==================================================
import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config';
function ContasAReceberReport() {
    const [contas, setContas] = useState([]); const [totalGeral, setTotalGeral] = useState(0); const [loading, setLoading] = useState(true); const [error, setError] = useState(null);
    const formatarMoeda = (valor) => valor ? parseFloat(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';
    const formatarData = (data) => data ? new Date(data + 'T00:00:00').toLocaleDateString('pt-BR') : '-';
    const fetchContasAReceber = useCallback(async () => { /* ... */ }, []);
    useEffect(() => { fetchContasAReceber(); }, [fetchContasAReceber]);
    if (loading) return <div className="text-center p-4"><div className="loading-spinner inline-block mr-2"></div>Carregando relatório...</div>;
    if (error) return <div className="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg" role="alert"><span className="font-medium">Erro!</span> {error}</div>;
    return ( <div className="bg-white p-6 rounded-lg shadow border border-gray-200"> {/* ... JSX do relatório ... */} </div> );
}
export default ContasAReceberReport;