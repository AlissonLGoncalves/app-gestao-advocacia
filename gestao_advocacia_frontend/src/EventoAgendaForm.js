// ==================================================
// Conteúdo do arquivo: src/EventoAgendaForm.js
// (Refinado com validação e melhor feedback)
// ==================================================
import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config'; 

// Estado inicial para um novo evento
const initialEventoState = { 
    caso_id: '', tipo_evento: 'Prazo', // Define 'Prazo' como padrão
    titulo: '', descricao: '', data_inicio: '', data_fim: '', 
    local: '', concluido: false 
};

function EventoAgendaForm({ eventoParaEditar, onEventoChange, onCancel }) {
   const [formData, setFormData] = useState(initialEventoState); 
   const [casos, setCasos] = useState([]); // Lista de casos para o select (opcional)
   const [loading, setLoading] = useState(false); // Estado de carregamento
   const [formMessage, setFormMessage] = useState({ type: '', text: '' }); // Mensagens de feedback
   const [errors, setErrors] = useState({}); // Estado para erros de validação
   const isEditing = Boolean(eventoParaEditar); // Define se está editando

   // Busca casos para preencher o select (opcional)
   const fetchCasosParaSelect = useCallback(async () => { 
       try { 
           const response = await fetch(`${API_URL}/casos`); 
           if (!response.ok) throw new Error('Erro ao buscar casos'); 
           const data = await response.json(); 
           setCasos(data); 
       } catch (err) { 
           console.error("Erro buscando casos:", err); 
           // Não mostra erro crítico
       } 
   }, []); // Sem dependências

   useEffect(() => { 
       fetchCasosParaSelect(); 
   }, [fetchCasosParaSelect]); 

   // Função para formatar data/hora ISO para o input datetime-local
   const formatToDateTimeLocal = (isoString) => {
        if (!isoString) return '';
        try {
            const date = new Date(isoString);
            // Ajusta para o fuso horário local antes de formatar
            const offset = date.getTimezoneOffset() * 60000;
            const localDate = new Date(date.getTime() - offset);
            return localDate.toISOString().slice(0, 16); // Formato YYYY-MM-DDTHH:mm
        } catch { return ''; }
    };

   // Preenche o formulário se estiver editando um evento
   useEffect(() => { 
        if (eventoParaEditar) {
            setFormData({
                caso_id: eventoParaEditar.caso_id || '', 
                tipo_evento: eventoParaEditar.tipo_evento || 'Prazo',
                titulo: eventoParaEditar.titulo || '',
                descricao: eventoParaEditar.descricao || '',
                data_inicio: formatToDateTimeLocal(eventoParaEditar.data_inicio), // Formata para input
                data_fim: formatToDateTimeLocal(eventoParaEditar.data_fim), // Formata para input
                local: eventoParaEditar.local || '',
                concluido: eventoParaEditar.concluido || false
            });
        } else {
            setFormData(initialEventoState); // Reseta se não estiver editando
        }
        setFormMessage({ type: '', text: '' }); // Limpa mensagens
        setErrors({}); // Limpa erros
   }, [eventoParaEditar]); // Re-executa se eventoParaEditar mudar

   // Atualiza estado do formulário e limpa erros/mensagens
   const handleChange = (e) => { 
        const { name, value, type, checked } = e.target; 
        // Limpa erro específico
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }
        setFormData(prev => ({ 
            ...prev, 
            [name]: type === 'checkbox' ? checked : value // Trata checkbox para 'concluido'
        })); 
        setFormMessage({ type: '', text: '' }); // Limpa mensagem geral
   };

   // Valida o formulário
   const validarFormulario = () => {
       const novosErros = {};
       if (!formData.tipo_evento) novosErros.tipo_evento = 'Tipo de evento é obrigatório.';
       if (!formData.titulo.trim()) novosErros.titulo = 'Título é obrigatório.';
       if (!formData.data_inicio) {
           novosErros.data_inicio = 'Data Início / Fatal é obrigatória.';
       } else {
           // Validação opcional: Data Fim não pode ser anterior à Data Início
           if (formData.data_fim && formData.data_inicio > formData.data_fim) {
               novosErros.data_fim = 'Data Fim não pode ser anterior à Data Início.';
           }
       }
       
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
        // Converte caso_id para inteiro ou null
        dadosParaEnviar.caso_id = dadosParaEnviar.caso_id ? parseInt(dadosParaEnviar.caso_id, 10) : null; 
        // Converte datetime-local de volta para ISO string (idealmente UTC) para enviar à API
        dadosParaEnviar.data_inicio = dadosParaEnviar.data_inicio ? new Date(dadosParaEnviar.data_inicio).toISOString() : null;
        dadosParaEnviar.data_fim = dadosParaEnviar.data_fim ? new Date(dadosParaEnviar.data_fim).toISOString() : null;

        const url = isEditing ? `${API_URL}/eventos/${eventoParaEditar.id}` : `${API_URL}/eventos`; 
        const method = isEditing ? 'PUT' : 'POST';

        try { 
            const response = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json', }, body: JSON.stringify(dadosParaEnviar), }); 
            const responseData = await response.json(); 
            if (!response.ok) { throw new Error(responseData.erro || `Erro HTTP: ${response.status}`); } 
            
            setFormMessage({ type: 'success', text: `Evento/Prazo ${isEditing ? 'atualizado' : 'adicionado'} com sucesso!` });
            if (!isEditing) { 
                setFormData(initialEventoState); // Limpa form
                setErrors({}); // Limpa erros
            } 
            if (onEventoChange) { onEventoChange(); } // Atualiza lista no App
            if(isEditing && onCancel) { 
                setTimeout(() => onCancel(), 1500); // Fecha form
            } else if (!isEditing) {
                 setTimeout(() => setFormMessage({ type: '', text: '' }), 2000); // Limpa msg
            }
        } catch (err) { 
            console.error(`Erro ao ${isEditing ? 'atualizar' : 'adicionar'} evento:`, err); 
            setFormMessage({ type: 'error', text: `Erro: ${err.message}` }); 
        } finally { 
            setLoading(false); 
        } 
   };

   // Verifica se o formulário é válido para habilitar botão
   const isFormValid = formData.tipo_evento && formData.titulo && formData.data_inicio && Object.keys(errors).every(key => !errors[key]);

   // --- Renderização do Formulário JSX ---
  return ( 
     <form onSubmit={handleSubmit} className="mb-6 p-6 bg-white shadow-md rounded-lg border border-gray-200">
      <h2 className="text-xl font-semibold text-gray-700 mb-4">{isEditing ? 'Editar Evento/Prazo' : 'Adicionar Novo Evento/Prazo'}</h2>
       {/* Mensagem de Feedback */}
       {formMessage.text && ( <div className={`p-3 mb-4 text-sm rounded-lg ${formMessage.type === 'success' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>{formMessage.text}</div> )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
         {/* Tipo de Evento */}
         <div className="input-group">
             <label htmlFor="evtTipo" className="block text-sm font-medium text-gray-700">Tipo*:</label>
             <select id="evtTipo" name="tipo_evento" value={formData.tipo_evento} onChange={handleChange} required 
                     className={`mt-1 block w-full px-3 py-2 border ${errors.tipo_evento ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}>
                 <option value="Prazo">Prazo</option><option value="Compromisso">Compromisso</option>
             </select>
             {errors.tipo_evento && <p className="mt-1 text-xs text-red-600">{errors.tipo_evento}</p>}
         </div>
         {/* Caso Associado */}
          <div className="input-group">
             <label htmlFor="evtCasoId" className="block text-sm font-medium text-gray-700">Caso Associado (Opcional):</label>
             <select id="evtCasoId" name="caso_id" value={formData.caso_id} onChange={handleChange} 
                     className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                 <option value="">Nenhum</option>
                 {casos.map(caso => ( <option key={caso.id} value={caso.id}>{caso.titulo} (Cliente: {caso.cliente?.nome_razao_social || 'N/A'})</option> ))}
             </select>
         </div>
         {/* Título */}
         <div className="input-group md:col-span-2">
             <label htmlFor="evtTitulo" className="block text-sm font-medium text-gray-700">Título*:</label>
             <input type="text" id="evtTitulo" name="titulo" value={formData.titulo} onChange={handleChange} required 
                    className={`mt-1 block w-full px-3 py-2 border ${errors.titulo ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}/>
             {errors.titulo && <p className="mt-1 text-xs text-red-600">{errors.titulo}</p>}
         </div>
         {/* Data Início / Fatal */}
         <div className="input-group">
             <label htmlFor="evtDataInicio" className="block text-sm font-medium text-gray-700">Data Início / Fatal*:</label>
             <input type="datetime-local" id="evtDataInicio" name="data_inicio" value={formData.data_inicio} onChange={handleChange} required 
                    className={`mt-1 block w-full px-3 py-2 border ${errors.data_inicio ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}/>
             {errors.data_inicio && <p className="mt-1 text-xs text-red-600">{errors.data_inicio}</p>}
         </div>
         {/* Data Fim */}
          <div className="input-group">
             <label htmlFor="evtDataFim" className="block text-sm font-medium text-gray-700">Data Fim (Compromisso):</label>
             <input type="datetime-local" id="evtDataFim" name="data_fim" value={formData.data_fim} onChange={handleChange} 
                    className={`mt-1 block w-full px-3 py-2 border ${errors.data_fim ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}/>
              {errors.data_fim && <p className="mt-1 text-xs text-red-600">{errors.data_fim}</p>}
         </div>
         {/* Local */}
         <div className="input-group md:col-span-2">
             <label htmlFor="evtLocal" className="block text-sm font-medium text-gray-700">Local (Compromisso):</label>
             <input type="text" id="evtLocal" name="local" value={formData.local} onChange={handleChange} 
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
         </div>
         {/* Descrição */}
        <div className="input-group md:col-span-2">
             <label htmlFor="evtDescricao" className="block text-sm font-medium text-gray-700">Descrição/Notas:</label>
             <textarea id="evtDescricao" name="descricao" value={formData.descricao} onChange={handleChange} rows="3" 
                       className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"></textarea>
         </div>
         {/* Concluído */}
          <div className="input-group flex items-center md:col-span-2">
             <input type="checkbox" id="evtConcluido" name="concluido" checked={formData.concluido} onChange={handleChange} 
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded mr-2" />
             <label htmlFor="evtConcluido" className="text-sm font-medium text-gray-700">Concluído?</label>
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
          {loading ? (isEditing ? 'Atualizando...' : 'Adicionando...') : (isEditing ? 'Atualizar Evento' : 'Adicionar Evento')}
        </button>
      </div>
    </form> 
  );
}
export default EventoAgendaForm;
