// gestao_advocacia_vite/src/pages/CasoDetalhePage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { API_URL } from '../config.js'; // Importa API_URL
import { toast } from 'react-toastify'; // Para notificações

// Componente auxiliar para exibir mensagens de status (loading, error, success)
const StatusDisplay = ({ isLoading, error, successMessage, className = '' }) => {
    if (isLoading) return <p className={`text-sm text-blue-600 animate-pulse ${className}`}>Processando...</p>;
    if (error) return <p className={`text-sm text-red-600 font-semibold ${className}`}>Erro: {error}</p>;
    if (successMessage) return <p className={`text-sm text-green-600 font-semibold ${className}`}>{successMessage}</p>;
    return null;
};

function CasoDetalhePage() {
    const { casoId } = useParams();
    const navigate = useNavigate();
    
    const [caso, setCaso] = useState(null);
    const [movimentacoesCNJ, setMovimentacoesCNJ] = useState([]);
    
    const [isLoadingCaso, setIsLoadingCaso] = useState(true);
    const [isLoadingMovimentacoes, setIsLoadingMovimentacoes] = useState(false);
    const [isLoadingAtualizacaoCNJ, setIsLoadingAtualizacaoCNJ] = useState(false);
    
    const [fetchError, setFetchError] = useState('');
    const [atualizacaoCNJError, setAtualizacaoCNJError] = useState('');
    const [atualizacaoCNJSuccess, setAtualizacaoCNJSuccess] = useState('');

    const formatarDataLegivel = (dataISO) => {
        if (!dataISO) return 'Não disponível';
        try {
            return new Date(dataISO).toLocaleString('pt-BR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        } catch (e) {
            console.warn("Erro ao formatar data:", dataISO, e);
            return dataISO;
        }
    };

    const carregarDadosDoCaso = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            toast.error("Autenticação necessária. Redirecionando para login...");
            navigate('/login'); // Idealmente, você teria uma rota de login
            return;
        }
        const authHeaders = { 'Authorization': `Bearer ${token}` };
        
        setIsLoadingCaso(true);
        setIsLoadingMovimentacoes(true);
        setFetchError('');
        setAtualizacaoCNJError('');
        setAtualizacaoCNJSuccess('');

        try {
            // No backend, a rota para um caso específico é /api/casos/<id>, sem barra no final.
            const resCaso = await fetch(`${API_URL}/casos/${casoId}`, { headers: authHeaders });
            if (!resCaso.ok) {
                const errDataCaso = await resCaso.json().catch(() => ({ message: `Erro HTTP ${resCaso.status} ao buscar caso.` }));
                throw new Error(errDataCaso.message || `Erro ao buscar detalhes do caso: ${resCaso.statusText}`);
            }
            const dataCaso = await resCaso.json();
            setCaso(dataCaso);
            setIsLoadingCaso(false);

            // No backend, a rota para movimentações de um caso é /api/casos/<id>/movimentacoes-cnj
            const resMovCNJ = await fetch(`${API_URL}/casos/${casoId}/movimentacoes-cnj`, { headers: authHeaders });
            if (!resMovCNJ.ok) {
                const errDataMov = await resMovCNJ.json().catch(() => ({ message: `Erro HTTP ${resMovCNJ.status} ao buscar movimentações.` }));
                throw new Error(errDataMov.message || `Erro ao buscar movimentações do CNJ: ${resMovCNJ.statusText}`);
            }
            const dataMovCNJ = await resMovCNJ.json();
            setMovimentacoesCNJ(dataMovCNJ);
            
        } catch (err) {
            console.error("Erro ao buscar dados do caso ou movimentações:", err);
            setFetchError(err.message);
            toast.error(`Erro ao carregar dados: ${err.message}`);
        } finally {
            setIsLoadingCaso(false);
            setIsLoadingMovimentacoes(false);
        }
    }, [casoId, navigate]); // API_URL não precisa ser dependência se importado diretamente

    useEffect(() => {
        carregarDadosDoCaso();
    }, [carregarDadosDoCaso]);

    const handleAtualizarViaCNJ = async () => {
        const token = localStorage.getItem('token');
        if (!token || !caso || !caso.numero_processo) {
            setAtualizacaoCNJError("Não é possível atualizar: Token, dados do caso ou número do processo ausentes.");
            toast.warn("Dados insuficientes para atualização via CNJ.");
            return;
        }
        
        setIsLoadingAtualizacaoCNJ(true);
        setAtualizacaoCNJError('');
        setAtualizacaoCNJSuccess('');
        const authHeaders = { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        try {
            // No backend, a rota é /api/casos/<id>/atualizar-cnj
            const response = await fetch(`${API_URL}/casos/${caso.id}/atualizar-cnj`, {
                method: 'POST',
                headers: authHeaders
            });
            const dataResposta = await response.json(); 
            
            if (!response.ok) {
                throw new Error(dataResposta.message || dataResposta.details || `Erro ${response.status} ao tentar atualizar via CNJ.`);
            }
            
            setAtualizacaoCNJSuccess(dataResposta.message || "Informações do caso atualizadas com sucesso a partir do CNJ!");
            toast.success(dataResposta.message || "Atualização CNJ bem-sucedida!");
            await carregarDadosDoCaso(); 
        } catch (err) {
            console.error("Erro durante a atualização via CNJ:", err);
            setAtualizacaoCNJError(err.message);
            toast.error(`Erro na atualização CNJ: ${err.message}`);
        } finally {
            setIsLoadingAtualizacaoCNJ(false);
        }
    };

    if (isLoadingCaso && !caso) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '70vh' }}>
                <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
                    <span className="visually-hidden">A carregar...</span>
                </div>
                <p className="ms-3 text-muted fs-5">Carregando detalhes do caso...</p>
            </div>
        );
    }

    if (fetchError && !caso) {
        return (
            <div className="container my-5">
                <div className="alert alert-danger text-center">
                    <h4 className="alert-heading">Erro ao Carregar Dados</h4>
                    <p>{fetchError}</p>
                    <button onClick={() => navigate('/casos')} className="btn btn-primary mt-3">
                        Voltar para Lista de Casos
                    </button>
                </div>
            </div>
        );
    }
    
    if (!caso) {
        return (
             <div className="container my-5 text-center">
                <p className="fs-5 text-muted">Caso não encontrado ou não acessível.</p>
                <button onClick={() => navigate('/casos')} className="btn btn-primary mt-3">
                    Voltar para Lista de Casos
                </button>
            </div>
        );
    }

    return (
        <div className="container-fluid p-md-4 p-lg-5"> {/* Tailwind usa mx-auto, Bootstrap usa container ou container-fluid */}
            <div className="card shadow-lg mb-4">
                <div className="card-header bg-light py-3">
                    <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center">
                        <h5 className="card-title mb-2 mb-sm-0 text-primary">
                            Detalhes do Caso: <span className="fw-bold">{caso.nome_caso}</span>
                        </h5>
                        <Link 
                            to={`/casos/editar/${caso.id}`}
                            className="btn btn-sm btn-outline-secondary"
                        >
                            Editar Caso
                        </Link>
                    </div>
                </div>

                <div className="card-body p-4">
                    {fetchError && <div className="alert alert-warning small mb-3"><p>{fetchError}</p></div>}

                    <div className="row g-4 mb-4">
                        <div className="col-md-6">
                            <div className="border p-3 rounded h-100">
                                <h6 className="text-secondary border-bottom pb-2 mb-3">Informações Gerais</h6>
                                <p className="small mb-1"><strong>Número do Processo:</strong> <span className="text-dark">{caso.numero_processo || 'Não informado'}</span></p>
                                <p className="small mb-1"><strong>Status (Sistema):</strong> <span className="text-dark">{caso.status || 'Não definido'}</span></p>
                                <p className="small mb-1"><strong>Cliente:</strong> <span className="text-dark">{caso.nome_cliente || `ID ${caso.cliente_id}`}</span></p>
                                <p className="small mb-1"><strong>Descrição:</strong></p>
                                <p className="small text-dark bg-light p-2 rounded" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{caso.descricao || 'Nenhuma descrição fornecida.'}</p>
                            </div>
                        </div>

                        <div className="col-md-6">
                            <div className="border p-3 rounded h-100">
                                <h6 className="text-secondary border-bottom pb-2 mb-3">Datas e Sincronização CNJ</h6>
                                <p className="small mb-1"><strong>Criado em:</strong> <span className="text-dark">{formatarDataLegivel(caso.data_criacao)}</span></p>
                                <p className="small mb-1"><strong>Última Atualização (Sistema):</strong> <span className="text-dark">{formatarDataLegivel(caso.data_atualizacao)}</span></p>
                                <p className="small mb-2"><strong>Última Verificação CNJ:</strong> <span className="text-dark">{formatarDataLegivel(caso.data_ultima_verificacao_cnj)}</span></p>
                                
                                {caso.numero_processo ? (
                                    <button 
                                        onClick={handleAtualizarViaCNJ} 
                                        disabled={isLoadingAtualizacaoCNJ || isLoadingCaso}
                                        className="btn btn-sm btn-primary w-100 mt-2"
                                    >
                                        {isLoadingAtualizacaoCNJ ? 
                                            <><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Verificando CNJ...</> 
                                            : 'Verificar Atualizações no CNJ'}
                                    </button>
                                ) : (
                                    <p className="mt-2 text-xs text-muted fst-italic">Número do processo não cadastrado. Consulta ao CNJ indisponível.</p>
                                )}
                                <StatusDisplay 
                                    isLoading={isLoadingAtualizacaoCNJ} 
                                    error={atualizacaoCNJError} 
                                    successMessage={atualizacaoCNJSuccess} 
                                    className="mt-2 text-center small"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="card shadow-lg">
                <div className="card-header bg-light py-3">
                    <h5 className="card-title mb-0 text-primary">
                        Histórico de Movimentações do CNJ ({movimentacoesCNJ.length})
                    </h5>
                </div>
                <div className="card-body p-3" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {isLoadingMovimentacoes ? (
                        <p className="text-muted text-center py-3">Carregando movimentações...</p>
                    ) : movimentacoesCNJ.length > 0 ? (
                        <ul className="list-group list-group-flush">
                            {movimentacoesCNJ.map(mov => (
                                <li key={mov.id} className="list-group-item px-0 py-2">
                                    <p className="fw-medium text-dark small mb-1">
                                        Data: {formatarDataLegivel(mov.data_movimentacao)}
                                    </p>
                                    <p className="text-muted small mb-1" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                        {mov.descricao}
                                    </p>
                                    <p className="text-black-50" style={{fontSize: '0.7rem'}}>
                                        Registrado no sistema em: {formatarDataLegivel(mov.data_registro_sistema)}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-muted fst-italic text-center py-3">Nenhuma movimentação do CNJ registrada para este caso no sistema.</p>
                    )}
                </div>
            </div>

            <div className="mt-4 text-center">
                <button 
                    onClick={() => navigate('/casos')} 
                    className="btn btn-secondary"
                >
                    Voltar para Lista de Casos
                </button>
            </div>
        </div>
    );
}

export default CasoDetalhePage;