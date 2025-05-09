// ==================================================
// Conteúdo do arquivo: src/RecebimentoForm.js
// (Refinado com validação e melhor feedback)
// ==================================================
import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config'; 

// Estado inicial para um novo recebimento
const initialRecebimentoState = { 
    caso_id: '', cliente_id: '', data_recebimento: '', data_vencimento: '', 
    descricao: '', categoria: '', valor: '', status: 'Pendente', // Define 'Pendente' como padrão
    forma_pagamento: '', notas: '' 
};

function RecebimentoForm({ recebimentoParaEditar, onRecebimentoChange, onCancel }) {
   const [formData, setFormData] = useState(initialRecebimentoState); 
   const [casos, setCasos] = useState([]); // Lista de casos para o select
   const [loading, setLoading] = useState(false); // Estado de carregamento (submit, busca casos)
   const [formMessage, setFormMessage] = useState({ type: '', text: '' }); // Mensagens de feedback
   const [errors, setErrors] = useState({}); // Estado para erros de validação
   const isEditing = Boolean(recebimentoParaEditar); // Define se está editando ou adicionando

   // Busca casos para preencher o select quando o componente monta
   const fetchCasosParaSelect = useCallback(async () => { 
       try { 
           const response = await fetch(`${API_URL}/casos`); 
           if (!response.ok) throw new Error('Erro ao buscar casos'); 
           const data = await response.json(); 
           setCasos(data); 
       } catch (err) { 
           console.error("Erro buscando casos:", err); 
           setFormMessage({ type: 'error', text: `Aviso: Erro ao carregar lista de casos (${err.message})` }); 
       } 
   }, []); // Sem dependências, executa uma vez

   useEffect(() => { 
       fetchCasosParaSelect(); 
   }, [fetchCasosParaSelect]); 

   // Preenche o formulário se estiver editando um recebimento
   useEffect(() => { 
        if (recebimentoParaEditar) {
            // Formata datas e valor que vêm da API
            const dataRecFormatada = recebimentoParaEditar.data_recebimento ? recebimentoParaEditar.data_recebimento.split('T')[0] : '';
            const dataVencFormatada = recebimentoParaEditar.data_vencimento ? recebimentoParaEditar.data_vencimento.split('T')[0] : '';
            const valorFormatado = recebimentoParaEditar.valor ? parseFloat(recebimentoParaEditar.valor) : '';

            setFormData({
                caso_id: recebimentoParaEditar.caso_id || '', 
                cliente_id: recebimentoParaEditar.cliente_id || '', // Importante ter no recebimento
                data_recebimento: dataRecFormatada,
                data_vencimento: dataVencFormatada,
                descricao: recebimentoParaEditar.descricao || '',
                categoria: recebimentoParaEditar.categoria || '',
                valor: valorFormatado,
                status: recebimentoParaEditar.status || 'Pendente',
                forma_pagamento: recebimentoParaEditar.forma_pagamento || '',
                notas: recebimentoParaEditar.notas || ''
            });
        } else {
            // Reseta para o estado inicial se não estiver editando
            setFormData(initialRecebimentoState);
        }
        setFormMessage({ type: '', text: '' }); // Limpa mensagens ao carregar
        setErrors({}); // Limpa erros ao carregar
   }, [recebimentoParaEditar]); // Re-executa se recebimentoParaEditar mudar

   // Atualiza cliente_id automaticamente quando caso_id muda (apenas ao adicionar)
   useEffect(() => {
       if (!isEditing && formData.caso_id) { 
           const casoSelecionado = casos.find(c => c.id === parseInt(formData.caso_id, 10));
           // Atualiza o cliente_id no estado do formulário se encontrou o caso e ele tem um cliente_id
           if (casoSelecionado && casoSelecionado.cliente_id) {
               setFormData(prev => ({ ...prev, cliente_id: casoSelecionado.cliente_id }));
           } else {
               // Se o caso selecionado não for encontrado ou não tiver cliente_id, limpa
               setFormData(prev => ({ ...prev, cliente_id: '' }));
           }
       }
   }, [formData.caso_id, casos, isEditing]); // Depende de caso_id, casos e isEditing


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
       if (!formData.caso_id) novosErros.caso_id = 'Selecione um caso associado.';
       if (!formData.cliente_id) novosErros.cliente_id = 'Cliente associado não encontrado (verifique o caso selecionado).'; // Validação extra
       if (!formData.data_recebimento) novosErros.data_recebimento = 'Data do recebimento é obrigatória.';
       if (!formData.descricao.trim()) novosErros.descricao = 'Descrição é obrigatória.';
       if (!formData.categoria) novosErros.categoria = 'Categoria é obrigatória.';
       if (formData.valor === '' || isNaN(parseFloat(formData.valor)) || parseFloat(formData.valor) <= 0) {
           novosErros.valor = 'Valor deve ser um número positivo.';
       }
       if (!formData.status) novosErros.status = 'Status é obrigatório.';

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
        // Formata/converte dados antes de enviar
        dadosParaEnviar.valor = dadosParaEnviar.valor ? parseFloat(dadosParaEnviar.valor) : null; 
        dadosParaEnviar.caso_id = parseInt(dadosParaEnviar.caso_id, 10); 
        dadosParaEnviar.cliente_id = parseInt(dadosParaEnviar.cliente_id, 10); 
        // Garante que datas sejam null se vazias, ou no formato correto
        dadosParaEnviar.data_recebimento = dadosParaEnviar.data_recebimento ? dadosParaEnviar.data_recebimento : null;
        dadosParaEnviar.data_vencimento = dadosParaEnviar.data_vencimento ? dadosParaEnviar.data_vencimento : null;

        const url = isEditing ? `${API_URL}/recebimentos/${recebimentoParaEditar.id}` : `${API_URL}/recebimentos`; 
        const method = isEditing ? 'PUT' : 'POST';

        try { 
            const response = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json', }, body: JSON.stringify(dadosParaEnviar), }); 
            const responseData = await response.json(); 
            if (!response.ok) { throw new Error(responseData.erro || `Erro HTTP: ${response.status}`); } 
            
            setFormMessage({ type: 'success', text: `Recebimento ${isEditing ? 'atualizado' : 'adicionado'} com sucesso!` });
            if (!isEditing) { 
                setFormData(initialRecebimentoState); // Limpa form se adicionou
                setErrors({}); // Limpa erros
            } 
            if (onRecebimentoChange) { onRecebimentoChange(); } // Atualiza lista no App
            if(isEditing && onCancel) { 
                setTimeout(() => onCancel(), 1500); // Fecha form após sucesso na edição
            } else if (!isEditing) {
                 setTimeout(() => setFormMessage({ type: '', text: '' }), 2000); // Limpa msg de sucesso após adicionar
            }
        } catch (err) { 
            console.error(`Erro ao ${isEditing ? 'atualizar' : 'adicionar'} recebimento:`, err); 
            setFormMessage({ type: 'error', text: `Erro: ${err.message}` }); 
        } finally { 
            setLoading(false); 
        } 
   };

   // Verifica se o formulário é válido para habilitar botão
   const isFormValid = formData.caso_id && formData.cliente_id && formData.data_recebimento && formData.descricao && formData.categoria && formData.valor && parseFloat(formData.valor) > 0 && formData.status && Object.keys(errors).every(key => !errors[key]);

   // --- Renderização do Formulário JSX ---
  return ( 
     <form onSubmit={handleSubmit} className="mb-6 p-6 bg-white shadow-md rounded-lg border border-gray-200">
      <h2 className="text-xl font-semibold text-gray-700 mb-4">{isEditing ? 'Editar Recebimento' : 'Adicionar Novo Recebimento'}</h2>
       
       {/* Mensagem de Feedback */}
       {formMessage.text && ( <div className={`p-3 mb-4 text-sm rounded-lg ${formMessage.type === 'success' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>{formMessage.text}</div> )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
         {/* Select de Caso */}
         <div className="input-group">
             <label htmlFor="recCasoId" className="block text-sm font-medium text-gray-700">Caso Associado*:</label>
             <select id="recCasoId" name="caso_id" value={formData.caso_id} onChange={handleChange} required 
                     className={`mt-1 block w-full px-3 py-2 border ${errors.caso_id ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${isEditing ? 'bg-gray-100 cursor-not-allowed' : ''}`} 
                     disabled={isEditing}>
                 <option value="">Selecione o caso...</option>
                 {/* Popula com casos buscados */}
                 {casos.map(caso => ( 
                     <option key={caso.id} value={caso.id}>
                         {caso.titulo} (Cliente: {caso.cliente?.nome_razao_social || 'N/A'})
                     </option> 
                 ))}
             </select>
             {errors.caso_id && <p className="mt-1 text-xs text-red-600">{errors.caso_id}</p>}
             {/* Campo Cliente ID escondido, preenchido automaticamente */}
             <input type="hidden" name="cliente_id" value={formData.cliente_id} />
             {errors.cliente_id && <p className="mt-1 text-xs text-red-600">{errors.cliente_id}</p>} 
         </div>
         
         {/* Descrição */}
         <div className="input-group">
             <label htmlFor="recDescricao" className="block text-sm font-medium text-gray-700">Descrição*:</label>
             <input type="text" id="recDescricao" name="descricao" value={formData.descricao} onChange={handleChange} required 
                    className={`mt-1 block w-full px-3 py-2 border ${errors.descricao ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}/>
             {errors.descricao && <p className="mt-1 text-xs text-red-600">{errors.descricao}</p>}
         </div>
         
         {/* Categoria */}
          <div className="input-group">
             <label htmlFor="recCategoria" className="block text-sm font-medium text-gray-700">Categoria*:</label>
             <select id="recCategoria" name="categoria" value={formData.categoria} onChange={handleChange} required 
                     className={`mt-1 block w-full px-3 py-2 border ${errors.categoria ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}>
                 <option value="">Selecione...</option><option value="Honorários Advocatícios">Honorários</option><option value="Consultoria">Consultoria</option><option value="Acordo Judicial">Acordo</option><option value="Ressarcimento">Ressarcimento</option><option value="Outros">Outros</option>
             </select>
             {errors.categoria && <p className="mt-1 text-xs text-red-600">{errors.categoria}</p>}
         </div>
         
         {/* Valor */}
          <div className="input-group">
             <label htmlFor="recValor" className="block text-sm font-medium text-gray-700">Valor (R$)*:</label>
             <input type="number" id="recValor" name="valor" value={formData.valor} onChange={handleChange} step="0.01" placeholder="0.00" required
                    className={`mt-1 block w-full px-3 py-2 border ${errors.valor ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}/>
             {errors.valor && <p className="mt-1 text-xs text-red-600">{errors.valor}</p>}
         </div>
         
         {/* Data Recebimento */}
         <div className="input-group">
             <label htmlFor="recDataRecebimento" className="block text-sm font-medium text-gray-700">Data Recebimento*:</label>
             <input type="date" id="recDataRecebimento" name="data_recebimento" value={formData.data_recebimento} onChange={handleChange} required 
                    className={`mt-1 block w-full px-3 py-2 border ${errors.data_recebimento ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}/>
             {errors.data_recebimento && <p className="mt-1 text-xs text-red-600">{errors.data_recebimento}</p>}
         </div>
         
         {/* Data Vencimento */}
          <div className="input-group">
             <label htmlFor="recDataVencimento" className="block text-sm font-medium text-gray-700">Data Vencimento:</label>
             <input type="date" id="recDataVencimento" name="data_vencimento" value={formData.data_vencimento} onChange={handleChange} 
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
         </div>
         
         {/* Status */}
          <div className="input-group">
             <label htmlFor="recStatus" className="block text-sm font-medium text-gray-700">Status*:</label>
             <select id="recStatus" name="status" value={formData.status} onChange={handleChange} required 
                     className={`mt-1 block w-full px-3 py-2 border ${errors.status ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}>
                 <option value="Pendente">Pendente</option><option value="Pago">Pago</option><option value="Vencido">Vencido</option><option value="Cancelado">Cancelado</option>
             </select>
             {errors.status && <p className="mt-1 text-xs text-red-600">{errors.status}</p>}
         </div>
         
         {/* Forma Pagamento */}
          <div className="input-group">
             <label htmlFor="recFormaPagamento" className="block text-sm font-medium text-gray-700">Forma Pagamento:</label>
             <input type="text" id="recFormaPagamento" name="forma_pagamento" value={formData.forma_pagamento} onChange={handleChange} 
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
         </div>
         
         {/* Notas */}
         <div className="input-group md:col-span-2">
             <label htmlFor="recNotas" className="block text-sm font-medium text-gray-700">Notas:</label>
             <textarea id="recNotas" name="notas" value={formData.notas} onChange={handleChange} rows="2" 
                       className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"></textarea>
         </div>
      </div>

       {/* Botões de Ação */}
       <div className="flex justify-end items-center mt-6 space-x-3">
         {(isEditing || onCancel) && (<button type="button" onClick={onCancel} className="btn btn-secondary">Cancelar</button>)}
        <button 
            type="submit" 
            className={`btn ${isEditing ? 'btn-success' : 'btn-primary'} disabled:opacity-50`} 
            disabled={loading || !isFormValid} // Desabilita se carregando ou inválido
        >
          {loading ? (isEditing ? 'Atualizando...' : 'Adicionando...') : (isEditing ? 'Atualizar Recebimento' : 'Adicionar Recebimento')}
        </button>
      </div>
    </form> 
  );
}
export default RecebimentoForm;