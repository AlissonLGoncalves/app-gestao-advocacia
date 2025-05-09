
// ==================================================
// Conteúdo do arquivo: src/DespesaForm.js
// (Refinado com validação e melhor feedback)
// ==================================================
import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config'; 

// Estado inicial para uma nova despesa
const initialDespesaState = { 
    caso_id: '', data_despesa: '', data_vencimento: '', descricao: '', 
    categoria: '', valor: '', status: 'A Pagar', // Define 'A Pagar' como padrão
    forma_pagamento: '', notas: '' 
};

function DespesaForm({ despesaParaEditar, onDespesaChange, onCancel }) {
   const [formData, setFormData] = useState(initialDespesaState); 
   const [casos, setCasos] = useState([]); // Lista de casos para o select (opcional)
   const [loading, setLoading] = useState(false); // Estado de carregamento
   const [formMessage, setFormMessage] = useState({ type: '', text: '' }); // Mensagens de feedback
   const [errors, setErrors] = useState({}); // Estado para erros de validação
   const isEditing = Boolean(despesaParaEditar); // Define se está editando

   // Busca casos para preencher o select (opcional)
   const fetchCasosParaSelect = useCallback(async () => { 
       try { 
           const response = await fetch(`${API_URL}/casos`); 
           if (!response.ok) throw new Error('Erro ao buscar casos'); 
           const data = await response.json(); 
           setCasos(data); 
       } catch (err) { 
           console.error("Erro buscando casos:", err); 
           // Não mostra erro crítico, caso_id é opcional
       } 
   }, []); // Sem dependências

   useEffect(() => { 
       fetchCasosParaSelect(); 
   }, [fetchCasosParaSelect]); 

   // Preenche o formulário se estiver editando uma despesa
   useEffect(() => { 
        if (despesaParaEditar) {
            // Formata datas e valor
            const dataDespFormatada = despesaParaEditar.data_despesa ? despesaParaEditar.data_despesa.split('T')[0] : '';
            const dataVencFormatada = despesaParaEditar.data_vencimento ? despesaParaEditar.data_vencimento.split('T')[0] : '';
            const valorFormatado = despesaParaEditar.valor ? parseFloat(despesaParaEditar.valor) : '';

            setFormData({
                caso_id: despesaParaEditar.caso_id || '', // Permite string vazia se for null
                data_despesa: dataDespFormatada,
                data_vencimento: dataVencFormatada,
                descricao: despesaParaEditar.descricao || '',
                categoria: despesaParaEditar.categoria || '',
                valor: valorFormatado,
                status: despesaParaEditar.status || 'A Pagar',
                forma_pagamento: despesaParaEditar.forma_pagamento || '',
                notas: despesaParaEditar.notas || ''
            });
        } else {
            // Reseta se não estiver editando
            setFormData(initialDespesaState);
        }
        setFormMessage({ type: '', text: '' }); // Limpa mensagens
        setErrors({}); // Limpa erros
   }, [despesaParaEditar]); // Re-executa se despesaParaEditar mudar

   // Atualiza estado do formulário e limpa erros/mensagens
   const handleChange = (e) => { 
        const { name, value } = e.target; 
        // Limpa erro específico
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }
        setFormData(prev => ({ ...prev, [name]: value })); 
        setFormMessage({ type: '', text: '' }); // Limpa mensagem geral
   };

   // Valida o formulário
   const validarFormulario = () => {
       const novosErros = {};
       if (!formData.data_despesa) novosErros.data_despesa = 'Data da despesa é obrigatória.';
       if (!formData.descricao.trim()) novosErros.descricao = 'Descrição é obrigatória.';
       if (!formData.categoria.trim()) novosErros.categoria = 'Categoria é obrigatória.';
       if (formData.valor === '' || isNaN(parseFloat(formData.valor)) || parseFloat(formData.valor) <= 0) {
           novosErros.valor = 'Valor deve ser um número positivo.';
       }
       if (!formData.status) novosErros.status = 'Status é obrigatório.';

       setErrors(novosErros);
       return Object.keys(novosErros).length === 0;
   };

   // Envia o formulário para a API
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
        // Formata/converte dados
        dadosParaEnviar.valor = dadosParaEnviar.valor ? parseFloat(dadosParaEnviar.valor) : null; 
        dadosParaEnviar.caso_id = dadosParaEnviar.caso_id ? parseInt(dadosParaEnviar.caso_id, 10) : null; 
        dadosParaEnviar.data_despesa = dadosParaEnviar.data_despesa ? dadosParaEnviar.data_despesa : null;
        dadosParaEnviar.data_vencimento = dadosParaEnviar.data_vencimento ? dadosParaEnviar.data_vencimento : null;

        const url = isEditing ? `${API_URL}/despesas/${despesaParaEditar.id}` : `${API_URL}/despesas`; 
        const method = isEditing ? 'PUT' : 'POST';

        try { 
            const response = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json', }, body: JSON.stringify(dadosParaEnviar), }); 
            const responseData = await response.json(); 
            if (!response.ok) { throw new Error(responseData.erro || `Erro HTTP: ${response.status}`); } 
            
            setFormMessage({ type: 'success', text: `Despesa ${isEditing ? 'atualizada' : 'adicionada'} com sucesso!` });
            if (!isEditing) { 
                setFormData(initialDespesaState); // Limpa form se adicionou
                setErrors({}); // Limpa erros
            } 
            if (onDespesaChange) { onDespesaChange(); } // Atualiza lista no App
            if(isEditing && onCancel) { 
                setTimeout(() => onCancel(), 1500); // Fecha form após sucesso
            } else if (!isEditing) {
                 setTimeout(() => setFormMessage({ type: '', text: '' }), 2000); // Limpa msg sucesso
            }
        } catch (err) { 
            console.error(`Erro ao ${isEditing ? 'atualizar' : 'adicionar'} despesa:`, err); 
            setFormMessage({ type: 'error', text: `Erro: ${err.message}` }); 
        } finally { 
            setLoading(false); 
        } 
   };

   // Verifica se o formulário é válido para habilitar botão
   const isFormValid = formData.data_despesa && formData.descricao && formData.categoria && formData.valor && parseFloat(formData.valor) > 0 && formData.status && Object.keys(errors).every(key => !errors[key]);

   // --- Renderização do Formulário JSX ---
  return ( 
     <form onSubmit={handleSubmit} className="mb-6 p-6 bg-white shadow-md rounded-lg border border-gray-200">
      <h2 className="text-xl font-semibold text-gray-700 mb-4">{isEditing ? 'Editar Despesa' : 'Adicionar Nova Despesa'}</h2>
       {/* Mensagem de Feedback */}
       {formMessage.text && ( <div className={`p-3 mb-4 text-sm rounded-lg ${formMessage.type === 'success' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>{formMessage.text}</div> )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
         {/* Caso Associado */}
         <div className="input-group">
             <label htmlFor="despCasoId" className="block text-sm font-medium text-gray-700">Caso Associado (Opcional):</label>
             <select id="despCasoId" name="caso_id" value={formData.caso_id} onChange={handleChange} 
                     className={`mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}>
                 <option value="">Nenhum (Despesa Geral)</option>
                 {casos.map(caso => ( <option key={caso.id} value={caso.id}>{caso.titulo} (Cliente: {caso.cliente?.nome_razao_social || 'N/A'})</option> ))}
             </select>
         </div>
         {/* Descrição */}
          <div className="input-group">
             <label htmlFor="despDescricao" className="block text-sm font-medium text-gray-700">Descrição*:</label>
             <input type="text" id="despDescricao" name="descricao" value={formData.descricao} onChange={handleChange} required 
                    className={`mt-1 block w-full px-3 py-2 border ${errors.descricao ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}/>
             {errors.descricao && <p className="mt-1 text-xs text-red-600">{errors.descricao}</p>}
         </div>
         {/* Categoria */}
          <div className="input-group">
             <label htmlFor="despCategoria" className="block text-sm font-medium text-gray-700">Categoria*:</label>
             <input type="text" id="despCategoria" name="categoria" value={formData.categoria} onChange={handleChange} required list="categorias-despesa" 
                    className={`mt-1 block w-full px-3 py-2 border ${errors.categoria ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}/>
             <datalist id="categorias-despesa"><option value="Custas Processuais"/><option value="Cópias e Impressões"/><option value="Deslocamento/Viagem"/><option value="Correspondente"/><option value="Software/Assinaturas"/><option value="Aluguel Escritório"/><option value="Contas (Luz, Água, Net)"/><option value="Material Escritório"/><option value="Outros"/></datalist>
             {errors.categoria && <p className="mt-1 text-xs text-red-600">{errors.categoria}</p>}
         </div>
         {/* Valor */}
          <div className="input-group">
             <label htmlFor="despValor" className="block text-sm font-medium text-gray-700">Valor (R$)*:</label>
             <input type="number" id="despValor" name="valor" value={formData.valor} onChange={handleChange} step="0.01" placeholder="0.00" required
                    className={`mt-1 block w-full px-3 py-2 border ${errors.valor ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}/>
             {errors.valor && <p className="mt-1 text-xs text-red-600">{errors.valor}</p>}
         </div>
         {/* Data Despesa */}
         <div className="input-group">
             <label htmlFor="despDataDespesa" className="block text-sm font-medium text-gray-700">Data Despesa*:</label>
             <input type="date" id="despDataDespesa" name="data_despesa" value={formData.data_despesa} onChange={handleChange} required 
                    className={`mt-1 block w-full px-3 py-2 border ${errors.data_despesa ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}/>
             {errors.data_despesa && <p className="mt-1 text-xs text-red-600">{errors.data_despesa}</p>}
         </div>
         {/* Data Vencimento */}
          <div className="input-group">
             <label htmlFor="despDataVencimento" className="block text-sm font-medium text-gray-700">Data Vencimento:</label>
             <input type="date" id="despDataVencimento" name="data_vencimento" value={formData.data_vencimento} onChange={handleChange} 
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
         </div>
         {/* Status */}
          <div className="input-group">
             <label htmlFor="despStatus" className="block text-sm font-medium text-gray-700">Status*:</label>
             <select id="despStatus" name="status" value={formData.status} onChange={handleChange} required 
                     className={`mt-1 block w-full px-3 py-2 border ${errors.status ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}>
                 <option value="A Pagar">A Pagar</option><option value="Paga">Paga</option><option value="Vencida">Vencida</option><option value="Cancelada">Cancelada</option>
             </select>
             {errors.status && <p className="mt-1 text-xs text-red-600">{errors.status}</p>}
         </div>
         {/* Forma Pagamento */}
          <div className="input-group">
             <label htmlFor="despFormaPagamento" className="block text-sm font-medium text-gray-700">Forma Pagamento:</label>
             <input type="text" id="despFormaPagamento" name="forma_pagamento" value={formData.forma_pagamento} onChange={handleChange} 
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
         </div>
         {/* Notas */}
         <div className="input-group md:col-span-2">
             <label htmlFor="despNotas" className="block text-sm font-medium text-gray-700">Notas:</label>
             <textarea id="despNotas" name="notas" value={formData.notas} onChange={handleChange} rows="2" 
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
          {loading ? (isEditing ? 'Atualizando...' : 'Adicionando...') : (isEditing ? 'Atualizar Despesa' : 'Adicionar Despesa')}
        </button>
      </div>
    </form> 
  );
}
export default DespesaForm;


