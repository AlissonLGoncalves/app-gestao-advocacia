import json
import os
import re
from io import BytesIO

import openpyxl
import pytesseract
from docx import Document
from PIL import Image
from pypdf import PdfReader

try:
    import pypdfium2
except Exception:  # pragma: no cover
    pypdfium2 = None


def _configure_tesseract_binary():
    env_cmd = os.environ.get("TESSERACT_CMD")
    if env_cmd and os.path.exists(env_cmd):
        pytesseract.pytesseract.tesseract_cmd = env_cmd
        return

    # Fallback Windows: evita depender da atualização do PATH após instalação.
    candidate_paths = [
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        os.path.join(
            os.environ.get("LOCALAPPDATA", ""), "Programs", "Tesseract-OCR", "tesseract.exe"
        ),
    ]
    for candidate in candidate_paths:
        if candidate and os.path.exists(candidate):
            pytesseract.pytesseract.tesseract_cmd = candidate
            return


_configure_tesseract_binary()


def _extract_text_from_pdf_bytes(pdf_bytes, max_pages=10):
    text = ""
    reader = PdfReader(BytesIO(pdf_bytes))
    for page in reader.pages[:max_pages]:
        page_text = page.extract_text()
        if page_text:
            text += page_text + "\n"
    return text


def _looks_like_low_quality_text(text):
    normalized = re.sub(r"\s+", "", text or "")
    if len(normalized) < 120:
        return True

    # Em documentos de cliente, pelo menos um desses padrões costuma existir.
    expected_markers = [
        r"\b\d{3}\.\d{3}\.\d{3}-\d{2}\b",  # CPF formatado
        r"\b\d{11}\b",  # CPF sem máscara
        r"\b\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}\b",  # CNPJ formatado
        r"\b\d{14}\b",  # CNPJ sem máscara
        r"\b(outorgante|cpf|cnpj|rg|procura[cç][aã]o)\b",
    ]
    return not any(re.search(marker, text, re.IGNORECASE) for marker in expected_markers)


def _extract_text_from_pdf_ocr(pdf_bytes, max_pages=5):
    if pypdfium2 is None:
        return ""

    try:
        pdf_doc = pypdfium2.PdfDocument(pdf_bytes)
        text_parts = []

        page_count = min(len(pdf_doc), max_pages)
        for idx in range(page_count):
            page = pdf_doc[idx]
            pil_image = page.render(scale=2.0).to_pil()

            # OCR em PT-BR com fallback para idioma padrão.
            try:
                page_text = pytesseract.image_to_string(pil_image, lang="por")
            except Exception:
                page_text = pytesseract.image_to_string(pil_image)

            if page_text:
                text_parts.append(page_text)

            page.close()

        pdf_doc.close()
        return "\n".join(text_parts)
    except Exception:
        return ""


def _extract_biometria_from_text(text):
    """
    Procura através de Regex padrões biométricos como CPF, Nome, Data de Nascimento e RG.
    """
    extracted_data = {
        "cpf": "",
        "cnpj": "",
        "documento_principal": "",
        "tipo_pessoa_sugerida": "",
        "rg": "",
        "nome_razao_social": "",
        "nome_fantasia": "",
        "data_nascimento": "",
        "nome_mae": "",
        "email": "",
        "telefone": "",
        "cep": "",
        "rua": "",
        "numero": "",
        "bairro": "",
        "cidade": "",
        "estado": "",
        "nacionalidade": "",
        "estado_civil": "",
        "profissao": "",
    }

    def _clean_line(value):
        value = (value or "").strip()
        value = re.sub(r"\s+", " ", value)
        return value.strip(" -:;")

    def _extract_labeled_value(patterns, source_text):
        for pattern in patterns:
            match = re.search(pattern, source_text, re.IGNORECASE)
            if match:
                return _clean_line(match.group(1))
        return ""

    # Extração do CPF
    cpf_match = re.search(r"\b(\d{3}\.\d{3}\.\d{3}-\d{2})\b", text)
    if not cpf_match:
        cpf_match = re.search(r"\b(\d{11})\b", text)

    if cpf_match:
        extracted_data["cpf"] = cpf_match.group(1)

    cnpj_match = re.search(r"\b(\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2})\b", text)
    if not cnpj_match:
        cnpj_match = re.search(r"\b(\d{14})\b", text)
    if cnpj_match:
        extracted_data["cnpj"] = cnpj_match.group(1)

    # Extração do RG
    rg_match = re.search(r"\b(\d{1,2}\.?\d{3}\.?\d{3}-?[a-zA-Z0-9X]{1,2})\b", text, re.IGNORECASE)
    if rg_match and rg_match.group(1) != extracted_data.get("cpf"):
        candidato_rg = rg_match.group(1)
        raw_rg = re.sub(r"[\.\-]", "", candidato_rg)
        if 7 <= len(raw_rg) <= 9:
            extracted_data["rg"] = candidato_rg

    # Data de Nascimento
    data_match = re.search(r"\b(\d{2}/\d{2}/\d{4})\b", text)
    if data_match:
        dia, mes, ano = data_match.group(1).split("/")
        extracted_data["data_nascimento"] = f"{ano}-{mes}-{dia}"

    # Extração Qualitativa (Nome e Mãe)
    nome_outorgante = _extract_labeled_value(
        [
            r"outorgante\s*[:\-]\s*([^\n\r]+)",
            r"nome\s+do\s+outorgante\s*[:\-]\s*([^\n\r]+)",
            r"nome\s*[:\-]\s*([^\n\r]+)",
        ],
        text,
    )
    if nome_outorgante:
        # Evita lixo quando a linha traz vários rótulos concatenados
        nome_outorgante = re.split(
            r"\b(?:outorgad[oa]|cpf|cnpj|rg|nacionalidade|estado\s*civil|profissao|endereco)\b",
            nome_outorgante,
            maxsplit=1,
            flags=re.IGNORECASE,
        )[0].strip(" -:;")
        extracted_data["nome_razao_social"] = nome_outorgante.title()

    linhas = [linha.strip() for linha in text.split("\n") if linha.strip()]
    if not extracted_data["nome_razao_social"]:
        for i, linha in enumerate(linhas):
            if linha.upper() == "NOME" or linha.upper().startswith("NOME:"):
                if i + 1 < len(linhas):
                    extracted_data["nome_razao_social"] = linhas[i + 1].title()
                break

    for i, linha in enumerate(linhas):
        if (
            "FILIAÇÃO" in linha.upper()
            or "FILIACAO" in linha.upper()
            or "NOME DA MÃE" in linha.upper()
        ):
            if i + 1 < len(linhas):
                extracted_data["nome_mae"] = linhas[i + 1].title()
            break

    # Campos comuns em procuração
    extracted_data["email"] = _extract_labeled_value(
        [r"e-?mail\s*[:\-]\s*([^\s,;]+@[^\s,;]+)", r"email\s*[:\-]\s*([^\s,;]+@[^\s,;]+)"],
        text,
    )

    phone_match = re.search(
        r"(?:telefone|celular|fone)\s*[:\-]?\s*(\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4})",
        text,
        re.IGNORECASE,
    )
    if not phone_match:
        phone_match = re.search(r"\b(\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4})\b", text)
    if phone_match:
        extracted_data["telefone"] = _clean_line(phone_match.group(1))

    extracted_data["nacionalidade"] = _extract_labeled_value(
        [r"nacionalidade\s*[:\-]\s*([^\n\r,;]+)"], text
    )
    extracted_data["estado_civil"] = _extract_labeled_value(
        [r"estado\s+civil\s*[:\-]\s*([^\n\r,;]+)"], text
    )
    extracted_data["profissao"] = _extract_labeled_value(
        [r"profiss[aã]o\s*[:\-]\s*([^\n\r,;]+)"], text
    )

    cep_match = re.search(r"\b(\d{5}-?\d{3})\b", text)
    if cep_match:
        extracted_data["cep"] = cep_match.group(1)

    endereco_linha = _extract_labeled_value(
        [r"endere[cç]o\s*[:\-]\s*([^\n\r]+)", r"domiciliad[oa]\s+em\s*([^\n\r]+)"], text
    )
    if endereco_linha:
        extracted_data["rua"] = endereco_linha[:120]

    cidade_uf_match = re.search(
        r"\b([A-Za-zÀ-ÿ\s]{3,})\s*/\s*([A-Z]{2})\b",
        text,
        re.IGNORECASE,
    )
    if cidade_uf_match:
        extracted_data["cidade"] = _clean_line(cidade_uf_match.group(1)).title()
        extracted_data["estado"] = cidade_uf_match.group(2).upper()

    numero_match = re.search(r"(?:n[ºo°]|numero)\s*[:\-]?\s*(\d+[A-Za-z]?)", text, re.IGNORECASE)
    if numero_match:
        extracted_data["numero"] = numero_match.group(1)

    bairro_match = re.search(r"bairro\s*[:\-]?\s*([^\n\r,;]+)", text, re.IGNORECASE)
    if bairro_match:
        extracted_data["bairro"] = _clean_line(bairro_match.group(1)).title()

    cpf_digits = re.sub(r"\D", "", extracted_data.get("cpf") or "")
    cnpj_digits = re.sub(r"\D", "", extracted_data.get("cnpj") or "")

    # Prioriza CNPJ quando identificado com 14 dígitos; caso contrário, usa CPF.
    if len(cnpj_digits) == 14:
        extracted_data["documento_principal"] = extracted_data["cnpj"]
        extracted_data["tipo_pessoa_sugerida"] = "PJ"
    elif len(cpf_digits) == 11:
        extracted_data["documento_principal"] = extracted_data["cpf"]
        extracted_data["tipo_pessoa_sugerida"] = "PF"

    return extracted_data


def extract_client_data_from_file(file_stream, filename):
    """
    Lê o binário carregado do front-end interpretando sua extensão e rotaciona
    para o motor correto de extração.
    """
    try:
        ext = filename.lower().split(".")[-1]
        text = ""

        if ext == "pdf":
            pdf_bytes = file_stream.read()
            file_stream.seek(0)

            text = _extract_text_from_pdf_bytes(pdf_bytes)

            # Fallback profissional para PDF escaneado/imagem quando texto vier fraco.
            if _looks_like_low_quality_text(text):
                ocr_text = _extract_text_from_pdf_ocr(pdf_bytes)
                if ocr_text:
                    text = f"{text}\n{ocr_text}".strip()

        elif ext == "txt":
            text = file_stream.read().decode("utf-8", errors="ignore")

        elif ext == "docx":
            doc = Document(file_stream)
            for p in doc.paragraphs:
                text += p.text + "\n"

        elif ext in ["xlsx", "xls"]:
            wb = openpyxl.load_workbook(file_stream, data_only=True)
            for sheet in wb.worksheets:
                for row in sheet.iter_rows(values_only=True):
                    for cell in row:
                        if cell is not None:
                            text += str(cell) + " "
                    text += "\n"

        elif ext in ["png", "jpg", "jpeg"]:
            try:
                img = Image.open(file_stream)
                # Tenta processar em PT-BR primeiro se o language pack estiver instalado.
                try:
                    text = pytesseract.image_to_string(img, lang="por")
                except Exception:
                    # Fallback pro basico inglês.
                    text = pytesseract.image_to_string(img)
            except pytesseract.pytesseract.TesseractNotFoundError:
                return {
                    "error": "O Motor Tesseract-OCR não está instalado no servidor/Windows. Por favor, baixe-o do Google para conseguir ler fotos."
                }
            except FileNotFoundError:
                return {
                    "error": "O Tesseract-OCR File Not Found. Certifique-se de instalá-lo no Path."
                }

        else:
            return {
                "error": f"O formato {ext} não é suportado pelo nosso Motor Biométrico Dinâmico."
            }

        if not text.strip():
            return {"error": "Nenhum texto legível foi abstraído do documento."}

        return _extract_biometria_from_text(text)

    except Exception as e:
        print(f"[OCR_ERROR_CRITICAL] {filename}: {e}")
        return {"error": f"Falha Oculta na leitura do arquivo: {str(e)}"}


def _extract_case_data_from_text(text):
    """
    Fallback OFFLINE puro usando Expressões Regulares (Regex) Python
    para buscar número de processo, varas e partes em uma petição inicial.
    """
    extracted = {"numero_processo": "", "valor_causa": 0.0, "titulo": ""}

    # Busca Padrão CNJ: xxxxxxx-xx.xxxx.x.xx.xxxx
    cnj_match = re.search(r"\b(\d{7}-\d{2}\.\d{4}\.\d{1}\.\d{2}\.\d{4})\b", text)
    if cnj_match:
        extracted["numero_processo"] = cnj_match.group(1)

    # Busca Valor da Causa
    valor_match = re.search(r"valor da causa.*?R\$\s*([\d\.,]+)", text, re.IGNORECASE)
    if not valor_match:
        valor_match = re.search(r"Dá-se à causa o valor de R\$\s*([\d\.,]+)", text, re.IGNORECASE)

    if valor_match:
        valor_str = valor_match.group(1).replace(".", "").replace(",", ".")
        try:
            extracted["valor_causa"] = float(valor_str)
        except ValueError:
            pass

    # Titulo Genérico pela primeira linha útil ou Autor X Réu
    autor_match = re.search(r"^\s*([A-Z\s]+),\s*já qualificado", text, re.MULTILINE)
    reu_match = re.search(r"em face de\s*([A-Z\s]+)", text, re.IGNORECASE)

    if autor_match and reu_match:
        autor = autor_match.group(1).strip().title()
        reu = reu_match.group(1).strip().title()
        extracted["titulo"] = f"AÇÃO: {autor} X {reu}"
    else:
        # Pega a primeira grande linha centralizada como título possivel
        extracted["titulo"] = "Processo Lançado via Petição Autográfica"

    return extracted


def _extract_case_data_with_gemini(text):
    """
    Motor Suprassumo: Envia o texto da petição para a API do Google Gemini
    buscando um JSON padronizado usando o SDK Oficial google-genai.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None  # Força o fallback pro Regex se não tiver API key

    try:
        from google import genai
        from google.genai import types

        # O cliente coleta a API key automaticamente da var GEMINI_API_KEY
        client = genai.Client()

        prompt = (
            """
Você é um extator de dados jurídicos brasileiro (Legaltech).
Analise o texto desta capa de processo/petição inicial e retorne APENAS um JSON válido. 
Nenhuma outra palavra. Apenas o JSON cru com estas chaves:
- "numero_processo" (string, formato CNJ se achar)
- "valor_causa" (float)
- "titulo" (string, geralmente "AUTOR x REU" ou resumo da ação)
- "resumo_fatos" (string, um parágrafo que resume a tese/fatos do caso para um advogado ler rapidamente)

TEXTO DA PETIÇÃO:
"""
            + text[:15000]
        )  # Limite de texto

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
            ),
        )

        raw_text = response.text.strip()
        # Tratamento de segurança caso o modelo não retorne json puro
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:]
        if raw_text.startswith("```"):
            raw_text = raw_text[3:]
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]

        json_data = json.loads(raw_text.strip())
        return json_data

    except Exception as e:
        print(f"[GEMINI_SDK_ERROR] Ocorreu uma falha no motor AI: {e}")
        return None


def extract_case_data_from_file(file_stream, filename):
    """
    O Orquestrador do Processo: Pega o PDF, tira a máscara de texto e envia
    pro Gemini. Se falhar, usa Regex bruto. Returna os metadados jurídicos.
    """
    try:
        ext = filename.lower().split(".")[-1]
        text = ""

        if ext == "pdf":
            reader = PdfReader(file_stream)
            for page in reader.pages[:10]:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        elif ext == "txt":
            text = file_stream.read().decode("utf-8", errors="ignore")
        elif ext == "docx":
            doc = Document(file_stream)
            for p in doc.paragraphs:
                text += p.text + "\n"
        elif ext in ["png", "jpg", "jpeg"]:
            try:
                img = Image.open(file_stream)
                text = pytesseract.image_to_string(img, lang="por")
            except Exception:
                pass

        if not text.strip():
            return {
                "error": "Nenhum texto legível encontrado no arquivo. Verifique se ele não é um escaneamento rasurado."
            }

        # Tentativa Ouro: Google Gemini
        ai_data = _extract_case_data_with_gemini(text)
        if ai_data and (ai_data.get("numero_processo") or ai_data.get("titulo")):
            ai_data["fonte"] = "AI Gemini"
            return ai_data

        # Fallback Bronze: Regex Nativo
        regex_data = _extract_case_data_from_text(text)
        regex_data["fonte"] = "Regex Offline"
        return regex_data

    except Exception as e:
        print(f"[CASE_OCR_ERROR] {filename}: {e}")
        return {"error": f"Falha na automação judiciária: {str(e)}"}
