// ==================================================
// Conteúdo do arquivo: src/CasoForm.js
// (Refinado com validação e melhor feedback)
// ==================================================
import React, { useState, useEffect, useCallback } from 'react'; 
import { API_URL } from './config'; 

// Estado inicial para um novo caso
const initialCasoState = { 
    cliente_id: '', titulo: '', numero_processo: '', status: 'Ativo', 
    parte_contraria: '', adv_parte_contraria: '', tipo_acao: '', vara_juizo: '', 
    comarca: '', instancia: '', valor_causa: '', data_distribuicao: '', notas_caso: '' 
};

function CasoForm({ casoParaEditar, onCasoChange, onCancel }) {
  const [formData, setFormData] = useState(initialCasoState); 
  const [clientes, setClientes] = useState([]); // Lista de clientes para o select
  const [loading, setLoading] = useState(false); // Estado de carregamento (submit, busca clientes)
  const [formMessage, setFormMessage] = useState({ type: '', text: '' }); // Mensagens de feedback
  const [errors, setErrors] = useState({}); // Estado para erros de validação
  const isEditing = Boolean(casoParaEditar); // Define se está editando ou adicionando

  // Busca clientes para preencher o select quando o componente monta
  const fetchClientesParaSelect = useCallback(async () => { 
    // Não precisa de setLoading aqui, pois é em background
    try { 
        const response = await fetch(`${API_URL}/clientes`); 
        if (!response.ok) throw new Error('Erro ao buscar clientes'); 
        const data = await response.json(); 
        setClientes(data); 
    } catch (err) { 
        console.error("Erro buscando clientes:", err); 
        // Mostra erro não crítico, o formulário ainda funciona sem a lista completa
        setFormMessage({ type: 'error', text: `Aviso: Erro ao carregar lista de clientes (${err.message})` }); 
    } 
  }, []); // Sem dependências, executa uma vez

  useEffect(() => { 
    fetchClientesParaSelect(); 
  }, [fetchClientesParaSelect]); 

  // Preenche o formulário se estiver editando um caso
  useEffect(() => { 
    if (casoParaEditar) { 
        // Formata valor e data que vêm da API
        const valorCausaFormatado = casoParaEditar.valor_causa ? parseFloat(casoParaEditar.valor_causa) : ''; 
        const dataDistFormatada = casoParaEditar.data_distribuicao ? casoParaEditar.data_distribuicao.split('T')[0] : ''; 
        
        setFormData({ 
            cliente_id: casoParaEditar.cliente_id || '', 
            titulo: casoParaEditar.titulo || '', 
            numero_processo: casoParaEditar.numero_processo || '', 
            status: casoParaEditar.status || 'Ativo', 
            parte_contraria: casoParaEditar.parte_contraria || '', 
            adv_parte_contraria: casoParaEditar.adv_parte_contraria || '', 
            tipo_acao: casoParaEditar.tipo_acao || '', 
            vara_juizo: casoParaEditar.vara_juizo || '', 
            comarca: casoParaEditar.comarca || '', 
            instancia: casoParaEditar.instancia || '', 
            valor_causa: valorCausaFormatado, 
            data_distribuicao: dataDistFormatada, 
            notas_caso: casoParaEditar.notas_caso || '' 
        }); 
    } else { 
        // Se não está editando, reseta para o estado inicial
        setFormData(initialCasoState); 
    } 
    setFormMessage({ type: '', text: '' }); // Limpa mensagens ao carregar
    setErrors({}); // Limpa erros ao carregar
  }, [casoParaEditar]); // Re-executa se casoParaEditar mudar

  // Atualiza o estado do formulário e limpa erros/mensagens
  const handleChange = (e) => { 
    const { name, value } = e.target; 
    // Limpa erro específico do campo ao digitar
    if (errors[name]) {
        setErrors(prev => ({ ...prev, [name]: null }));
    }
    setFormData(prev => ({ ...prev, [name]: value })); 
    setFormMessage({ type: '', text: '' }); // Limpa mensagem geral
  };

  // Valida o formulário antes do envio
  const validarFormulario = () => {
      const novosErros = {};
      if (!formData.cliente_id) novosErros.cliente_id = 'Selecione um cliente.';
      if (!formData.titulo.trim()) novosErros.titulo = 'Título/Nome do Caso é obrigatório.';
      if (!formData.status) novosErros.status = 'Status é obrigatório.';
      if (formData.valor_causa && isNaN(parseFloat(formData.valor_causa))) {
          novosErros.valor_causa = 'Valor da causa deve ser um número.';
      }
      // Adicionar mais validações se necessário (ex: formato número processo)

      setErrors(novosErros);
      return Object.keys(novosErros).length === 0; // Retorna true se sem erros
  };


  // Envia o formulário para a API (cria ou atualiza)
  const handleSubmit = async (e) => { 
     e.preventDefault(); 
     
     // Valida antes de enviar
     if (!validarFormulario()) {
         setFormMessage({ type: 'error', text: 'Por favor, corrija os erros no formulário.' });
         return;
     }

     setLoading(true); 
     setFormMessage({ type: '', text: '' }); 
     
     const dadosParaEnviar = { ...formData }; 
     // Formata dados antes de enviar
     dadosParaEnviar.valor_causa = dadosParaEnviar.valor_causa ? parseFloat(dadosParaEnviar.valor_causa) : null; 
     dadosParaEnviar.cliente_id = parseInt(dadosParaEnviar.cliente_id, 10);
     // Garante que data_distribuicao seja null se vazia, ou no formato correto
     dadosParaEnviar.data_distribuicao = dadosParaEnviar.data_distribuicao ? dadosParaEnviar.data_distribuicao : null; 

     const url = isEditing ? `${API_URL}/casos/${casoParaEditar.id}` : `${API_URL}/casos`; 
     const method = isEditing ? 'PUT' : 'POST';

     try { 
         const response = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json', }, body: JSON.stringify(dadosParaEnviar), }); 
         const responseData = await response.json(); 
         if (!response.ok) { throw new Error(responseData.erro || `Erro HTTP: ${response.status}`); } 
         
         setFormMessage({ type: 'success', text: `Caso ${isEditing ? 'atualizado' : 'adicionado'} com sucesso!` });
         if (!isEditing) { 
             setFormData(initialCasoState); // Limpa form se adicionou
             setErrors({}); // Limpa erros
         } 
         if (onCasoChange) { onCasoChange(); } // Atualiza lista no App
         if(isEditing && onCancel) { 
             setTimeout(() => onCancel(), 1500); // Fecha form após sucesso na edição
         } else if (!isEditing) {
             setTimeout(() => setFormMessage({ type: '', text: '' }), 2000); // Limpa msg de sucesso após adicionar
         }
     } catch (err) { 
         console.error(`Erro ao ${isEditing ? 'atualizar' : 'adicionar'} caso:`, err); 
         setFormMessage({ type: 'error', text: `Erro: ${err.message}` }); 
     } finally { 
         setLoading(false); 
     } 
  };

  // Verifica se o formulário é válido para habilitar botão
  const isFormValid = formData.cliente_id && formData.titulo && formData.status && Object.keys(errors).every(key => !errors[key]);

  // --- Renderização do Formulário JSX ---
  return ( 
    <form onSubmit={handleSubmit} className="mb-6 p-6 bg-white shadow-md rounded-lg border border-gray-200">
      <h2 className="text-xl font-semibold text-gray-700 mb-4">{isEditing ? 'Editar Caso' : 'Adicionar Novo Caso'}</h2>
       
       {/* Mensagem de Feedback */}
       {formMessage.text && ( 
           <div className={`p-3 mb-4 text-sm rounded-lg ${formMessage.type === 'success' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
               {formMessage.text}
           </div> 
       )}
      
      {/* Linha 1: Cliente e Título */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
         <div className="input-group">
            <label htmlFor="casoClienteId" className="block text-sm font-medium text-gray-700">Cliente*:</label>
            <select id="casoClienteId" name="cliente_id" value={formData.cliente_id} onChange={handleChange} required 
                    className={`mt-1 block w-full px-3 py-2 border ${errors.cliente_id ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${isEditing ? 'bg-gray-100 cursor-not-allowed' : ''}`} 
                    disabled={isEditing}>
                <option value="">Selecione o cliente...</option>
                {/* Popula o select com a lista de clientes buscada */}
                {clientes.map(cliente => ( 
                    <option key={cliente.id} value={cliente.id}>
                        {cliente.nome_razao_social} ({cliente.cpf_cnpj})
                    </option> 
                ))}
            </select>
            {errors.cliente_id && <p className="mt-1 text-xs text-red-600">{errors.cliente_id}</p>}
         </div>
         <div className="input-group">
            <label htmlFor="casoTitulo" className="block text-sm font-medium text-gray-700">Título/Nome do Caso*:</label>
            <input type="text" id="casoTitulo" name="titulo" value={formData.titulo} onChange={handleChange} required 
                   className={`mt-1 block w-full px-3 py-2 border ${errors.titulo ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}/>
            {errors.titulo && <p className="mt-1 text-xs text-red-600">{errors.titulo}</p>}
         </div>
      </div>

      {/* Linha 2: Nº Processo e Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
         <div className="input-group">
            <label htmlFor="casoNumeroProcesso" className="block text-sm font-medium text-gray-700">Nº Processo (CNJ):</label>
            <input type="text" id="casoNumeroProcesso" name="numero_processo" value={formData.numero_processo} onChange={handleChange} 
                   className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
         </div>
         <div className="input-group">
            <label htmlFor="casoStatus" className="block text-sm font-medium text-gray-700">Status*:</label>
            <select id="casoStatus" name="status" value={formData.status} onChange={handleChange} required 
                    className={`mt-1 block w-full px-3 py-2 border ${errors.status ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}>
                <option value="Ativo">Ativo</option> <option value="Suspenso">Suspenso</option> <option value="Arquivado Provisoriamente">Arquivado Prov.</option>
                <option value="Encerrado com Êxito">Encerrado c/ Êxito</option> <option value="Encerrado sem Êxito">Encerrado s/ Êxito</option> <option value="Outro">Outro</option>
            </select>
             {errors.status && <p className="mt-1 text-xs text-red-600">{errors.status}</p>}
         </div>
      </div>

       {/* Linha 3: Parte Contrária e Adv. Contrário */}
       <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="input-group">
                <label htmlFor="casoParteContraria" className="block text-sm font-medium text-gray-700">Parte Contrária:</label>
                <input type="text" id="casoParteContraria" name="parte_contraria" value={formData.parte_contraria} onChange={handleChange} 
                       className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
            </div>
             <div className="input-group">
                <label htmlFor="casoAdvParteContraria" className="block text-sm font-medium text-gray-700">Adv. Parte Contrária:</label>
                <input type="text" id="casoAdvParteContraria" name="adv_parte_contraria" value={formData.adv_parte_contraria} onChange={handleChange} 
                       className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
            </div>
       </div>

        {/* Linha 4: Tipo Ação, Vara, Comarca, Instância */}
       <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="input-group">
                <label htmlFor="casoTipoAcao" className="block text-sm font-medium text-gray-700">Tipo Ação:</label>
                <input type="text" id="casoTipoAcao" name="tipo_acao" value={formData.tipo_acao} onChange={handleChange} 
                       className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
            </div>
            <div className="input-group">
                <label htmlFor="casoVaraJuizo" className="block text-sm font-medium text-gray-700">Vara/Juízo:</label>
                <input type="text" id="casoVaraJuizo" name="vara_juizo" value={formData.vara_juizo} onChange={handleChange} 
                       className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
            </div>
             <div className="input-group">
                <label htmlFor="casoComarca" className="block text-sm font-medium text-gray-700">Comarca:</label>
                <input type="text" id="casoComarca" name="comarca" value={formData.comarca} onChange={handleChange} 
                       className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
            </div>
             <div className="input-group">
                <label htmlFor="casoInstancia" className="block text-sm font-medium text-gray-700">Instância:</label>
                <input type="text" id="casoInstancia" name="instancia" value={formData.instancia} onChange={handleChange} 
                       className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
            </div>
       </div>

        {/* Linha 5: Valor Causa e Data Distribuição */}
       <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="input-group">
                <label htmlFor="casoValorCausa" className="block text-sm font-medium text-gray-700">Valor da Causa (R$):</label>
                <input type="number" id="casoValorCausa" name="valor_causa" value={formData.valor_causa} onChange={handleChange} step="0.01" placeholder="0.00"
                       className={`mt-1 block w-full px-3 py-2 border ${errors.valor_causa ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}/>
                 {errors.valor_causa && <p className="mt-1 text-xs text-red-600">{errors.valor_causa}</p>}
            </div>
             <div className="input-group">
                <label htmlFor="casoDataDistribuicao" className="block text-sm font-medium text-gray-700">Data Distribuição:</label>
                <input type="date" id="casoDataDistribuicao" name="data_distribuicao" value={formData.data_distribuicao} onChange={handleChange} 
                       className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
            </div>
       </div>

       {/* Notas */}
       <div className="input-group">
           <label htmlFor="casoNotas" className="block text-sm font-medium text-gray-700">Notas do Caso:</label>
           <textarea id="casoNotas" name="notas_caso" value={formData.notas_caso} onChange={handleChange} rows="4" 
                     className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"></textarea>
       </div>
      
      {/* Botões de Ação */}
      <div className="flex justify-end items-center mt-6 space-x-3">
         {(isEditing || onCancel) && (<button type="button" onClick={onCancel} className="btn btn-secondary">Cancelar</button>)}
        <button 
            type="submit" 
            className={`btn ${isEditing ? 'btn-success' : 'btn-primary'} disabled:opacity-50`} 
            disabled={loading || !isFormValid} // Desabilita se carregando ou inválido
        >
          {loading ? (isEditing ? 'Atualizando...' : 'Adicionando...') : (isEditing ? 'Atualizar Caso' : 'Adicionar Caso')}
        </button>
      </div>
    </form> 
  );
}
export default CasoForm;