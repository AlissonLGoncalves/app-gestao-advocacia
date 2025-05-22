// gestao_advocacia_vite/src/pages/CasoDetalhePage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom'; // Adicionado Link

// Componente auxiliar para exibir mensagens de status (loading, error, success)
const StatusDisplay = ({ isLoading, error, successMessage, className = '' }) => {
    if (isLoading) return <p className={`text-sm text-blue-600 animate-pulse ${className}`}>Processando...</p>;
    if (error) return <p className={`text-sm text-red-600 font-semibold ${className}`}>Erro: {error}</p>;
    if (successMessage) return <p className={`text-sm text-green-600 font-semibold ${className}`}>{successMessage}</p>;
    return null;
};

function CasoDetalhePage() {
    const { casoId } = useParams(); // Obtém o ID do caso da URL (ex: /casos/123)
    const navigate = useNavigate();
    
    const [caso, setCaso] = useState(null);
    const [movimentacoesCNJ, setMovimentacoesCNJ] = useState([]);
    
    const [isLoadingCaso, setIsLoadingCaso] = useState(true);
    const [isLoadingMovimentacoes, setIsLoadingMovimentacoes] = useState(false); // Para carregamento específico de movimentações
    const [isLoadingAtualizacaoCNJ, setIsLoadingAtualizacaoCNJ] = useState(false);
    
    const [fetchError, setFetchError] = useState(''); // Erro geral ao buscar dados iniciais
    const [atualizacaoCNJError, setAtualizacaoCNJError] = useState('');
    const [atualizacaoCNJSuccess, setAtualizacaoCNJSuccess] = useState('');

    const token = localStorage.getItem('token');

    // Função para formatar datas de forma legível (ajuste o formato como preferir)
    const formatarDataLegivel = (dataISO) => {
        if (!dataISO) return 'Não disponível';
        try {
            return new Date(dataISO).toLocaleString('pt-BR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit' // Removido segundos para brevidade
            });
        } catch (e) {
            console.warn("Erro ao formatar data:", dataISO, e);
            return dataISO; // Retorna a string original se a formatação falhar
        }
    };

    // Função para buscar os detalhes do caso e suas movimentações CNJ
    const carregarDadosDoCaso = useCallback(async () => {
        if (!token) {
            navigate('/login');
            return;
        }
        
        setIsLoadingCaso(true);
        setIsLoadingMovimentacoes(true); // Inicia carregando ambos
        setFetchError('');
        setAtualizacaoCNJError(''); // Limpa erros anteriores
        setAtualizacaoCNJSuccess(''); // Limpa sucessos anteriores

        try {
            // Busca detalhes do caso
            const resCaso = await fetch(`/api/casos/${casoId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!resCaso.ok) {
                const errDataCaso = await resCaso.json().catch(() => ({ message: `Erro HTTP ${resCaso.status} ao buscar caso.` }));
                throw new Error(errDataCaso.message || `Erro ao buscar detalhes do caso: ${resCaso.statusText}`);
            }
            const dataCaso = await resCaso.json();
            setCaso(dataCaso);
            setIsLoadingCaso(false); // Terminou de carregar caso

            // Busca movimentações CNJ após carregar o caso
            const resMovCNJ = await fetch(`/api/casos/${casoId}/movimentacoes-cnj`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!resMovCNJ.ok) {
                const errDataMov = await resMovCNJ.json().catch(() => ({ message: `Erro HTTP ${resMovCNJ.status} ao buscar movimentações.` }));
                throw new Error(errDataMov.message || `Erro ao buscar movimentações do CNJ: ${resMovCNJ.statusText}`);
            }
            const dataMovCNJ = await resMovCNJ.json();
            setMovimentacoesCNJ(dataMovCNJ);
            
        } catch (err) {
            console.error("Erro ao buscar dados do caso ou movimentações:", err);
            setFetchError(err.message);
        } finally {
            setIsLoadingCaso(false); // Garante que ambos os loadings terminem
            setIsLoadingMovimentacoes(false);
        }
    }, [casoId, token, navigate]);

    useEffect(() => {
        carregarDadosDoCaso();
    }, [carregarDadosDoCaso]); // Executa ao montar e se carregarDadosDoCaso mudar (o que não deve, devido ao useCallback com deps fixas)

    // Função para lidar com o clique no botão de atualização via CNJ
    const handleAtualizarViaCNJ = async () => {
        if (!token || !caso || !caso.numero_processo) {
            setAtualizacaoCNJError("Não é possível atualizar: Token de acesso, dados do caso ou número do processo estão ausentes.");
            return;
        }
        
        setIsLoadingAtualizacaoCNJ(true);
        setAtualizacaoCNJError('');
        setAtualizacaoCNJSuccess('');

        try {
            const response = await fetch(`/api/casos/${caso.id}/atualizar-cnj`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json' // Embora o corpo seja vazio, é uma boa prática
                }
            });
            const dataResposta = await response.json(); 
            
            if (!response.ok) {
                throw new Error(dataResposta.message || dataResposta.details || `Erro ${response.status} ao tentar atualizar informações do CNJ.`);
            }
            
            setAtualizacaoCNJSuccess(dataResposta.message || "Informações do caso atualizadas com sucesso a partir do CNJ!");
            // Re-buscar todos os dados (detalhes do caso e suas movimentações) para refletir as atualizações na tela.
            await carregarDadosDoCaso(); 
        } catch (err) {
            console.error("Erro durante a atualização via CNJ:", err);
            setAtualizacaoCNJError(err.message);
        } finally {
            setIsLoadingAtualizacaoCNJ(false);
        }
    };

    if (isLoadingCaso && !caso) { // Mostra carregando apenas se o caso ainda não foi carregado nenhuma vez
        return (
            <div className="flex justify-center items-center h-screen">
                <p className="text-xl font-semibold text-gray-700">Carregando detalhes do caso...</p>
                {/* Você pode adicionar um spinner aqui */}
            </div>
        );
    }

    if (fetchError && !caso) { // Mostra erro apenas se o caso não pôde ser carregado
        return (
            <div className="container mx-auto p-6 text-center">
                <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-md shadow-md">
                    <p className="font-bold text-lg">Erro ao carregar dados do caso:</p>
                    <p>{fetchError}</p>
                    <button onClick={() => navigate('/casos')} className="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                        Voltar para Lista de Casos
                    </button>
                </div>
            </div>
        );
    }
    
    if (!caso) { // Se, após tentativas, o caso ainda for nulo (ex: 404 do backend)
        return (
             <div className="container mx-auto p-6 text-center">
                <p className="text-xl text-gray-600">Caso não encontrado ou não acessível.</p>
                <button onClick={() => navigate('/casos')} className="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                    Voltar para Lista de Casos
                </button>
            </div>
        );
    }

    // Renderização principal da página de detalhes do caso
    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen">
            <div className="bg-white shadow-xl rounded-lg p-6 mb-8">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b border-gray-200 pb-4">
                    <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">
                        Detalhes do Caso: <span className="text-indigo-600">{caso.nome_caso}</span>
                    </h2>
                    <Link 
                        to={`/casos/editar/${caso.id}`} // Supondo que você tenha uma rota de edição
                        className="mt-3 sm:mt-0 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 px-4 rounded-md shadow-sm transition duration-150 ease-in-out"
                    >
                        Editar Caso
                    </Link>
                </div>

                {/* Exibe erro geral de fetch, se houver, mesmo que o caso tenha sido carregado parcialmente antes */}
                {fetchError && <div className="mb-4 p-3 bg-red-50 border border-red-300 text-red-600 rounded-md"><p>{fetchError}</p></div>}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mb-8">
                    <div className="bg-white border border-gray-200 p-4 rounded-md shadow-sm">
                        <h3 className="text-lg font-semibold text-gray-700 mb-3 border-b pb-2">Informações Gerais</h3>
                        <p className="text-sm text-gray-600"><strong>Número do Processo:</strong> <span className="text-gray-800">{caso.numero_processo || 'Não informado'}</span></p>
                        <p className="text-sm text-gray-600"><strong>Status (Sistema):</strong> <span className="text-gray-800">{caso.status || 'Não definido'}</span></p>
                        <p className="text-sm text-gray-600"><strong>Cliente:</strong> <span className="text-gray-800">{caso.nome_cliente || `ID ${caso.cliente_id}`}</span></p>
                        <p className="text-sm text-gray-600"><strong>Descrição:</strong></p>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap break-words bg-gray-50 p-2 rounded-sm">{caso.descricao || 'Nenhuma descrição fornecida.'}</p>
                    </div>

                    <div className="bg-white border border-gray-200 p-4 rounded-md shadow-sm">
                        <h3 className="text-lg font-semibold text-gray-700 mb-3 border-b pb-2">Datas e Sincronização CNJ</h3>
                        <p className="text-sm text-gray-600"><strong>Criado em:</strong> <span className="text-gray-800">{formatarDataLegivel(caso.data_criacao)}</span></p>
                        <p className="text-sm text-gray-600"><strong>Última Atualização (Sistema):</strong> <span className="text-gray-800">{formatarDataLegivel(caso.data_atualizacao)}</span></p>
                        <p className="text-sm text-gray-600"><strong>Última Verificação CNJ:</strong> <span className="text-gray-800">{formatarDataLegivel(caso.data_ultima_verificacao_cnj)}</span></p>
                        
                        {caso.numero_processo ? (
                            <button 
                                onClick={handleAtualizarViaCNJ} 
                                disabled={isLoadingAtualizacaoCNJ || isLoadingCaso} // Desabilita se estiver carregando qualquer coisa importante
                                className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 disabled:bg-indigo-300 transition duration-150 ease-in-out"
                            >
                                {isLoadingAtualizacaoCNJ ? 'Verificando CNJ...' : 'Verificar Atualizações no CNJ'}
                            </button>
                        ) : (
                            <p className="mt-4 text-xs text-gray-500 italic">Número do processo não cadastrado. Consulta ao CNJ indisponível.</p>
                        )}
                        <StatusDisplay 
                            isLoading={isLoadingAtualizacaoCNJ} 
                            error={atualizacaoCNJError} 
                            successMessage={atualizacaoCNJSuccess} 
                            className="mt-2 text-center"
                        />
                    </div>
                </div>
            </div>
            
            <div className="bg-white shadow-xl rounded-lg p-6">
                <h3 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-5 border-b pb-3">
                    Histórico de Movimentações do CNJ ({movimentacoesCNJ.length})
                </h3>
                {isLoadingMovimentacoes ? (
                    <p className="text-gray-600 text-center py-4">Carregando movimentações...</p>
                ) : movimentacoesCNJ.length > 0 ? (
                    <div className="space-y-4 max-h-96 overflow-y-auto pr-2"> {/* Scroll para muitas movimentações */}
                        {movimentacoesCNJ.map(mov => (
                            <div key={mov.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200 shadow-sm hover:border-indigo-300 transition-colors">
                                <p className="font-medium text-indigo-700">
                                    Data da Movimentação: {formatarDataLegivel(mov.data_movimentacao)}
                                </p>
                                <p className="text-sm text-gray-700 mt-1.5 whitespace-pre-wrap break-words">
                                    <strong>Descrição:</strong> {mov.descricao}
                                </p>
                                <p className="text-xs text-gray-500 mt-2.5">
                                    Registrado no sistema em: {formatarDataLegivel(mov.data_registro_sistema)}
                                </p>
                                {/* Opcional: Detalhes do JSON original, se útil para o usuário (pode ser muito técnico) */}
                                {/* <details className="mt-2 text-xs">
                                    <summary className="cursor-pointer text-gray-600 hover:text-gray-800">Ver dados integrais (JSON)</summary>
                                    <pre className="mt-1 bg-gray-100 p-2 rounded-sm text-gray-700 overflow-x-auto text-[10px] leading-tight">
                                        {JSON.stringify(mov.dados_integra_cnj, null, 2)}
                                    </pre>
                                </details>
                                */}
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-500 italic text-center py-4">Nenhuma movimentação do CNJ registrada para este caso no sistema.</p>
                )}
            </div>

            <div className="mt-8 text-center">
                <button 
                    onClick={() => navigate('/casos')} 
                    className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-6 rounded-md shadow-sm transition duration-150 ease-in-out"
                >
                    Voltar para Lista de Casos
                </button>
            </div>
        </div>
    );
}

export default CasoDetalhePage;

