# ==============================================================================
# ARQUIVO: gestao_advocacia/tasks.py
# Contém a lógica para a tarefa agendada de verificação de processos no CNJ.
# ==============================================================================
from flask import current_app
from datetime import datetime, timedelta
import time
import logging 

# Importar o serviço CNJ no nível do módulo é seguro, 
# pois cnj_service.py não importa de tasks.py, evitando ciclo.
# Assume que cnj_service.py está no mesmo diretório que tasks.py.
from cnj_service import consultar_processo_cnj

# NÃO importe db, Caso, MovimentacaoCNJ de 'app' aqui no topo para evitar importação circular.
# Eles serão importados dentro da função do job, quando o contexto da app estiver ativo.

def job_verificar_processos_cnj():
    """
    Tarefa agendada para verificar atualizações de processos no CNJ.
    Esta função é chamada pelo APScheduler.
    """
    # Importa db e modelos DENTRO da função para evitar importação circular
    # e garantir que o contexto da aplicação Flask esteja disponível.
    # Flask-APScheduler geralmente cuida de executar o job com um contexto de app.
    try:
        # Assume que app.py (onde db, Caso, MovimentacaoCNJ são definidos/inicializados)
        # está no mesmo diretório que tasks.py.
        # Se app.py está em um nível acima, o import seria 'from ..app import ...'
        # mas dado o erro original, é mais provável que estejam no mesmo nível
        # ou que a estrutura do projeto precise ser ajustada para ser um pacote.
        # Para execução direta de app.py, a importação direta 'from app import ...' é usada.
        from app import db, Caso, MovimentacaoCNJ 
    except ImportError as e:
        # Log crítico se a importação falhar em tempo de execução do job.
        logger = logging.getLogger(__name__) # Fallback logger
        # Tenta usar o logger da app se o current_app já estiver disponível (pode não estar se o erro for muito cedo)
        if current_app: 
            logger = current_app.logger
        logger.critical(f"JOB CNJ: Falha crítica ao importar db/modelos de 'app' dentro do job: {e}. O job não pode continuar. Verifique a estrutura do projeto e os caminhos de importação.")
        return

    logger = current_app.logger # Usa o logger da aplicação Flask

    if not current_app.config.get('CNJ_JOB_ENABLED', False):
        logger.info(f"JOB CNJ [{datetime.now(tz=current_app.config.get('SCHEDULER_TIMEZONE'))}]: Job está DESABILITADO nas configurações. Pulando execução.")
        return

    logger.info(f"JOB CNJ [{datetime.now(tz=current_app.config.get('SCHEDULER_TIMEZONE'))}]: Iniciando verificação de processos no CNJ...")
    
    try:
        intervalo_verificacao_dias = current_app.config.get('CNJ_JOB_VERIFICATION_INTERVAL_DAYS', 1)
        limite_tempo_verificacao = datetime.utcnow() - timedelta(days=intervalo_verificacao_dias)
        
        max_casos_por_execucao = current_app.config.get('CNJ_JOB_MAX_CASES_PER_RUN', 10)
        delay_entre_requisicoes = current_app.config.get('CNJ_JOB_REQUEST_DELAY_SECONDS', 5)

        # É crucial que esta query seja executada dentro de um contexto de aplicação.
        # Se o job for chamado fora de um contexto, isso falhará.
        # Flask-APScheduler deve lidar com isso.
        with current_app.app_context():
            casos_para_verificar = Caso.query.filter(
                Caso.numero_processo.isnot(None),
                Caso.numero_processo != '',
                db.or_(Caso.data_ultima_verificacao_cnj.is_(None), Caso.data_ultima_verificacao_cnj < limite_tempo_verificacao)
            ).order_by(Caso.data_ultima_verificacao_cnj.asc().nulls_first()).limit(max_casos_por_execucao).all()

        logger.info(f"JOB CNJ: Encontrados {len(casos_para_verificar)} casos para verificação (limite: {max_casos_por_execucao}).")

        if not casos_para_verificar:
            logger.info("JOB CNJ: Nenhum caso elegível para verificação no momento.")
            return

        for caso_item in casos_para_verificar:
            logger.info(f"JOB CNJ: Verificando caso ID {caso_item.id}, processo '{caso_item.numero_processo}'")
            try:
                # Garante que as operações de banco de dados para cada caso sejam feitas no contexto da app
                with current_app.app_context():
                    dados_cnj_raw, status_code = consultar_processo_cnj(caso_item.numero_processo)

                    if status_code < 400: # Sucesso na consulta
                        hits = dados_cnj_raw.get("hits", {}).get("hits", [])
                        if hits:
                            source_data = hits[0].get('_source', {})
                            movimentos_api = source_data.get('movimentos', []) 
                            
                            if not isinstance(movimentos_api, list): movimentos_api = []

                            novas_movs_job_count = 0
                            data_mov_recente_job = None
                            desc_mov_recente_job = ""

                            movimentos_api.sort(key=lambda m: m.get('dataHora', '1900-01-01T00:00:00Z'), reverse=True)

                            for mov_json_job in movimentos_api:
                                data_mov_str_job = mov_json_job.get('dataHora')
                                if not data_mov_str_job: continue
                                
                                try:
                                    data_mov_obj_job = datetime.fromisoformat(data_mov_str_job.replace('Z', '+00:00'))
                                except ValueError:
                                    logger.warning(f"JOB CNJ: Formato de 'dataHora' ('{data_mov_str_job}') inválido para caso {caso_item.id}. Movimento ignorado.")
                                    continue
                                
                                desc_parts_job = []
                                mov_nacional = mov_json_job.get('movimentoNacional')
                                if mov_nacional and isinstance(mov_nacional, dict) and mov_nacional.get('descricao'):
                                    desc_parts_job.append(mov_nacional['descricao'])
                                
                                mov_local = mov_json_job.get('movimentoLocal')
                                if not desc_parts_job and mov_local and isinstance(mov_local, dict) and mov_local.get('descricao'):
                                     desc_parts_job.append(mov_local['descricao'])

                                complementos_job = mov_json_job.get('complementos', [])
                                if isinstance(complementos_job, list):
                                    for c_job in complementos_job:
                                        if isinstance(c_job, dict) and c_job.get('descricao'):
                                            desc_parts_job.append(c_job['descricao'])
                                
                                descricao_db_job = " | ".join(filter(None, desc_parts_job))
                                if not descricao_db_job: 
                                    descricao_db_job = mov_json_job.get('descricao') or str(mov_json_job.get('codigoNacional', {}).get('codigo', 'Movimento'))

                                mov_existente_job = MovimentacaoCNJ.query.filter_by(
                                    caso_id=caso_item.id,
                                    data_movimentacao=data_mov_obj_job
                                ).filter(MovimentacaoCNJ.descricao.startswith(descricao_db_job[:150])).first()

                                if not mov_existente_job:
                                    nova_mov_db_job = MovimentacaoCNJ(
                                        caso_id=caso_item.id,
                                        data_movimentacao=data_mov_obj_job,
                                        descricao=descricao_db_job,
                                        dados_integra_cnj=mov_json_job
                                    )
                                    db.session.add(nova_mov_db_job)
                                    novas_movs_job_count += 1
                                    if data_mov_recente_job is None or data_mov_obj_job > data_mov_recente_job:
                                        data_mov_recente_job = data_mov_obj_job
                                        desc_mov_recente_job = descricao_db_job
                            
                            if novas_movs_job_count > 0 and data_mov_recente_job:
                                caso_item.status = desc_mov_recente_job[:255]
                                caso_item.data_atualizacao = data_mov_recente_job
                            
                            logger.info(f"JOB CNJ: Caso {caso_item.id} processado, {novas_movs_job_count} nova(s) movimentação(ões) registrada(s).")
                        else:
                            logger.info(f"JOB CNJ: Nenhuma informação (hit) encontrada no CNJ para caso {caso_item.id} (processo {caso_item.numero_processo}).")
                    
                    elif status_code >= 400:
                        logger.error(f"JOB CNJ: Erro ao consultar CNJ para caso {caso_item.id}. Status: {status_code}, Erro: {dados_cnj_raw.get('erro')}")
                    
                    caso_item.data_ultima_verificacao_cnj = datetime.utcnow()
                    db.session.commit()

            except Exception as e_job_item_proc:
                logger.error(f"JOB CNJ: Exceção ao processar caso ID {caso_item.id} (processo '{caso_item.numero_processo}'): {str(e_job_item_proc)}", exc_info=True)
                db.session.rollback()
                try:
                    # Re-attach e atualiza data_ultima_verificacao_cnj mesmo em erro
                    # Garante que o contexto da app esteja ativo para esta operação de DB.
                    with current_app.app_context():
                        caso_item_reattached = db.session.get(Caso, caso_item.id) 
                        if caso_item_reattached:
                            caso_item_reattached.data_ultima_verificacao_cnj = datetime.utcnow()
                            db.session.commit()
                        else: 
                            logger.error(f"JOB CNJ: Não foi possível re-attachar caso ID {caso_item.id} para atualizar data_ultima_verificacao_cnj após erro.")
                except Exception as e_commit_on_error:
                     logger.error(f"JOB CNJ: Falha crítica ao tentar atualizar data_ultima_verificacao_cnj APÓS ERRO para caso {caso_item.id}: {str(e_commit_on_error)}")
                     db.session.rollback()
            
            time.sleep(delay_entre_requisicoes)

        logger.info(f"JOB CNJ [{datetime.now(tz=current_app.config.get('SCHEDULER_TIMEZONE'))}]: Verificação de processos concluída.")

    except Exception as e_job_geral:
        logger.critical(f"JOB CNJ [{datetime.now(tz=current_app.config.get('SCHEDULER_TIMEZONE'))}]: Erro CRÍTICO durante a execução do job: {str(e_job_geral)}", exc_info=True)

