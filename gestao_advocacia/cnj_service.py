# ==============================================================================
# ARQUIVO: gestao_advocacia/cnj_service.py
# Módulo para encapsular a lógica de comunicação com a API do CNJ (DataJud).
# ==============================================================================
import logging

import requests
from flask import current_app  # Para acessar app.config (configurações e logger)

# Mapeamento de códigos de Tribunal (segmento TR do número do processo) para aliases da API DataJud.
# Este mapeamento é CRUCIAL e deve ser o mais completo e preciso possível.
# Consulte a documentação oficial do DataJud para a lista correta de aliases.
TRIBUNAL_ALIASES_CNJ = {
    # Tribunais Superiores
    "5.00": "api_publica_tst",
    "6.00": "api_publica_tse",
    "3.00": "api_publica_stj",
    "7.00": "api_publica_stm",
    # Justiça Federal (J=4)
    "4.01": "api_publica_trf1",
    "4.02": "api_publica_trf2",
    "4.03": "api_publica_trf3",
    "4.04": "api_publica_trf4",
    "4.05": "api_publica_trf5",
    "4.06": "api_publica_trf6",
    # Justiça do Trabalho (J=5)
    "5.01": "api_publica_trt1",
    "5.02": "api_publica_trt2",
    "5.03": "api_publica_trt3",
    "5.04": "api_publica_trt4",
    "5.05": "api_publica_trt5",
    "5.06": "api_publica_trt6",
    "5.07": "api_publica_trt7",
    "5.08": "api_publica_trt8",
    "5.09": "api_publica_trt9",
    "5.10": "api_publica_trt10",
    "5.11": "api_publica_trt11",
    "5.12": "api_publica_trt12",
    "5.13": "api_publica_trt13",
    "5.14": "api_publica_trt14",
    "5.15": "api_publica_trt15",
    "5.16": "api_publica_trt16",
    "5.17": "api_publica_trt17",
    "5.18": "api_publica_trt18",
    "5.19": "api_publica_trt19",
    "5.20": "api_publica_trt20",
    "5.21": "api_publica_trt21",
    "5.22": "api_publica_trt22",
    "5.23": "api_publica_trt23",
    "5.24": "api_publica_trt24",
    # Justiça Eleitoral (J=6)
    "6.01": "api_publica_tre-ac",
    "6.02": "api_publica_tre-al",
    "6.03": "api_publica_tre-ap",
    "6.04": "api_publica_tre-am",
    "6.05": "api_publica_tre-ba",
    "6.06": "api_publica_tre-ce",
    "6.07": "api_publica_tre-dft",
    "6.08": "api_publica_tre-es",
    "6.09": "api_publica_tre-go",
    "6.10": "api_publica_tre-ma",
    "6.11": "api_publica_tre-mt",
    "6.12": "api_publica_tre-ms",
    "6.13": "api_publica_tre-mg",
    "6.14": "api_publica_tre-pa",
    "6.15": "api_publica_tre-pb",
    "6.16": "api_publica_tre-pr",
    "6.17": "api_publica_tre-pe",
    "6.18": "api_publica_tre-pi",
    "6.19": "api_publica_tre-rj",
    "6.20": "api_publica_tre-rn",
    "6.21": "api_publica_tre-rs",
    "6.22": "api_publica_tre-ro",
    "6.23": "api_publica_tre-rr",
    "6.24": "api_publica_tre-sc",
    "6.25": "api_publica_tre-sp",
    "6.26": "api_publica_tre-se",
    "6.27": "api_publica_tre-to",
    # Justiça Estadual (J=8)
    "8.01": "api_publica_tjac",
    "8.02": "api_publica_tjal",
    "8.03": "api_publica_tjap",
    "8.04": "api_publica_tjam",
    "8.05": "api_publica_tjba",
    "8.06": "api_publica_tjce",
    "8.07": "api_publica_tjdft",
    "8.08": "api_publica_tjes",
    "8.09": "api_publica_tjgo",
    "8.10": "api_publica_tjma",
    "8.11": "api_publica_tjmt",
    "8.12": "api_publica_tjms",
    "8.13": "api_publica_tjmg",
    "8.14": "api_publica_tjpa",
    "8.15": "api_publica_tjpb",
    "8.16": "api_publica_tjpr",
    "8.17": "api_publica_tjpe",
    "8.18": "api_publica_tjpi",
    "8.19": "api_publica_tjrj",
    "8.20": "api_publica_tjrn",
    "8.21": "api_publica_tjrs",
    "8.22": "api_publica_tjro",
    "8.23": "api_publica_tjrr",
    "8.24": "api_publica_tjsc",
    "8.25": "api_publica_tjsp",
    "8.26": "api_publica_tjse",
    "8.27": "api_publica_tjto",
}


def extrair_segmento_tr_processo(numero_processo_completo):
    """
    Extrai o segmento 'TR' (identificador do tribunal) do número do processo CNJ.
    Formato CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO
    Retorna a string do TR (ex: '02') ou None se o formato for inesperado.
    """
    try:
        numero_digitos = "".join(filter(str.isdigit, str(numero_processo_completo or "")))
        if len(numero_digitos) == 20:
            # Formato canonico CNJ em digitos: NNNNNNNDDAAAAJTTOOOO
            # J na posicao 13 e TR nas posicoes 14-15
            return f"{numero_digitos[13]}.{numero_digitos[14:16]}"

        partes = numero_processo_completo.split(".")
        if len(partes) == 5:  # Formato NNNNNNN-DD.AAAA.J.TR.OOOO tem 5 partes
            return f"{partes[2]}.{partes[3]}"  # J e TR (ex: 8.16)
        else:
            # Verifica se current_app está disponível (pode não estar se este módulo for importado fora de um contexto de app)
            if current_app:
                current_app.logger.warning(
                    f"Formato inesperado do número do processo CNJ '{numero_processo_completo}' ao tentar extrair TR (esperava 5 partes, obteve {len(partes)})."
                )
            else:
                print(
                    f"AVISO (cnj_service): Formato inesperado do número do processo CNJ '{numero_processo_completo}' ao tentar extrair TR."
                )
            return None
    except Exception as e:
        if current_app:
            current_app.logger.error(
                f"Erro ao extrair segmento TR de '{numero_processo_completo}': {str(e)}"
            )
        else:
            print(
                f"ERRO (cnj_service): Erro ao extrair segmento TR de '{numero_processo_completo}': {str(e)}"
            )
        return None


def obter_alias_tribunal_por_numero(numero_processo):
    """
    Obtém o alias do tribunal para a API DataJud a partir do número do processo CNJ.
    """
    segmento_tr = extrair_segmento_tr_processo(numero_processo)
    if segmento_tr:
        alias = TRIBUNAL_ALIASES_CNJ.get(segmento_tr)
        if alias:
            return alias
        else:
            if current_app:
                current_app.logger.warning(
                    f"Segmento TR '{segmento_tr}' (do processo '{numero_processo}') não foi encontrado no mapeamento de aliases TRIBUNAL_ALIASES_CNJ."
                )
            else:
                print(
                    f"AVISO (cnj_service): Segmento TR '{segmento_tr}' (do processo '{numero_processo}') não encontrado no mapeamento."
                )
            return None
    return None


def consultar_processo_cnj(numero_processo_formatado_entrada):
    """
    Consulta um processo na API Pública do DataJud do CNJ.
    Utiliza o número do processo formatado (com pontos e traço) para identificar o tribunal,
    mas envia o número normalizado (apenas dígitos) para a API.
    Retorna um tuple: (dados_json_resposta, status_code_http)
    """
    # Acessa config e logger através do current_app. Se current_app não estiver disponível
    # (ex: rodando este script isoladamente sem um app Flask), precisaria de uma alternativa.
    logger = (
        current_app.logger if current_app else logging.getLogger(__name__)
    )  # Fallback para logger padrão
    config = current_app.config if current_app else {}  # Fallback para config vazia

    api_key_config = config.get("CNJ_API_KEY")
    if not api_key_config:
        logger.critical(
            "CRÍTICO: CNJ_API_KEY não está configurada na aplicação. A consulta ao CNJ não pode prosseguir."
        )
        return {
            "erro": "Erro de configuração interna do sistema: A chave da API do CNJ não foi fornecida ao sistema."
        }, 500

    numero_processo_para_api = "".join(filter(str.isdigit, numero_processo_formatado_entrada))

    if len(numero_processo_para_api) != 20:
        logger.warning(
            f"Número de processo '{numero_processo_formatado_entrada}' resultou em '{numero_processo_para_api}' "
            f"({len(numero_processo_para_api)} dígitos) após normalização. Esperava-se 20 dígitos. "
            "A consulta à API do CNJ pode falhar ou retornar dados incorretos."
        )

    alias_tribunal_para_api = obter_alias_tribunal_por_numero(numero_processo_formatado_entrada)
    if not alias_tribunal_para_api:
        logger.error(
            f"Não foi possível determinar o alias do tribunal para o processo '{numero_processo_formatado_entrada}'."
        )
        return {
            "erro": f"Não foi possível identificar o tribunal para o processo '{numero_processo_formatado_entrada}'. Verifique o formato do número e o mapeamento de tribunais."
        }, 400

    url_endpoint_api = f"https://api-publica.datajud.cnj.jus.br/{alias_tribunal_para_api}/_search"

    headers_http = {
        "Authorization": f"APIKey {api_key_config}",
        "Content-Type": "application/json",
        "User-Agent": f"AppGestaoAdvocacia/{config.get('APP_VERSION', '1.0.0')}",
    }

    payload_query_api = {
        "query": {"match": {"numeroProcesso": numero_processo_para_api}},
        "size": 1,
    }

    logger.info(
        f"Preparando para consultar API do CNJ: URL='{url_endpoint_api}', Payload='{str(payload_query_api)[:200]}'"
    )

    try:
        resposta_http = requests.post(
            url_endpoint_api, headers=headers_http, json=payload_query_api, timeout=30
        )
        resposta_http.raise_for_status()

        logger.info(
            f"Resposta da API do CNJ ({resposta_http.status_code}) recebida para o processo '{numero_processo_formatado_entrada}'."
        )
        return resposta_http.json(), resposta_http.status_code

    except requests.exceptions.HTTPError as e_http:
        logger.error(
            f"Erro HTTP ao consultar CNJ para '{numero_processo_formatado_entrada}': Status {e_http.response.status_code}. "
            f"Resposta do servidor CNJ: {e_http.response.text[:500]}"
        )
        status_retorno = (
            e_http.response.status_code
            if e_http.response.status_code in [400, 401, 403, 404, 429, 500, 502, 503, 504]
            else 502
        )
        return {
            "erro": f"Erro {e_http.response.status_code} ao comunicar com o serviço do CNJ.",
            "detalhes_servico_cnj": e_http.response.text,
        }, status_retorno
    except requests.exceptions.ConnectionError as e_conn:
        logger.error(
            f"Erro de conexão ao consultar CNJ para '{numero_processo_formatado_entrada}': {str(e_conn)}"
        )
        return {
            "erro": "Não foi possível conectar ao serviço do CNJ. Verifique sua conexão de rede ou o status do serviço do CNJ."
        }, 503
    except requests.exceptions.Timeout as e_timeout:
        logger.error(
            f"Timeout ao consultar CNJ para '{numero_processo_formatado_entrada}': {str(e_timeout)}"
        )
        return {
            "erro": "O serviço do CNJ demorou muito para responder (timeout). Tente novamente mais tarde."
        }, 504
    except requests.exceptions.RequestException as e_req:
        logger.error(
            f"Erro de requisição (biblioteca requests) ao consultar CNJ para '{numero_processo_formatado_entrada}': {str(e_req)}"
        )
        return {
            "erro": "Ocorreu um erro inesperado na biblioteca de comunicação ao tentar acessar o serviço do CNJ."
        }, 500
    except ValueError as e_json:
        resposta_texto = (
            resposta_http.text if "resposta_http" in locals() else "N/A (resposta não capturada)"
        )
        logger.error(
            f"Erro ao decodificar JSON da resposta do CNJ para '{numero_processo_formatado_entrada}': {str(e_json)}. Resposta bruta (início): {resposta_texto[:200]}"
        )
        return {"erro": "A resposta do serviço do CNJ não estava em formato JSON válido."}, 502
    except Exception as e_geral:
        logger.critical(
            f"Erro GERAL e INESPERADO durante a consulta ao CNJ para '{numero_processo_formatado_entrada}': {str(e_geral)}",
            exc_info=True,
        )
        return {
            "erro": "Ocorreu um erro interno inesperado no sistema ao processar a solicitação para o CNJ."
        }, 500
