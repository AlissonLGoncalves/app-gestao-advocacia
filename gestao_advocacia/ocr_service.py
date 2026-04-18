import json
import os
import re

import openpyxl
import pytesseract
from docx import Document
from PIL import Image
from pypdf import PdfReader


def _extract_biometria_from_text(text):
    """
    Procura através de Regex padrões biométricos como CPF, Nome, Data de Nascimento e RG.
    """
    extracted_data = {
        "cpf": "",
        "rg": "",
        "nome_razao_social": "",
        "nome_fantasia": "",
        "data_nascimento": "",
        "nome_mae": "",
    }

    # Extração do CPF
    cpf_match = re.search(r"\b(\d{3}\.\d{3}\.\d{3}-\d{2})\b", text)
    if not cpf_match:
        cpf_match = re.search(r"\b(\d{11})\b", text)

    if cpf_match:
        extracted_data["cpf"] = cpf_match.group(1)

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
    linhas = [linha.strip() for linha in text.split("\n") if linha.strip()]
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
