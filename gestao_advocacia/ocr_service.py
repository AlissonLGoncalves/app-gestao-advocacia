import re
import io
from pypdf import PdfReader
from docx import Document
import openpyxl
from PIL import Image
import pytesseract

def _extract_biometria_from_text(text):
    """
    Procura através de Regex padrões biométricos como CPF, Nome, Data de Nascimento e RG.
    """
    extracted_data = {
        "cpf": "", "rg": "", "nome_razao_social": "",
        "nome_fantasia": "", "data_nascimento": "", "nome_mae": ""
    }

    # Extração do CPF
    cpf_match = re.search(r'\b(\d{3}\.\d{3}\.\d{3}-\d{2})\b', text)
    if not cpf_match:
        cpf_match = re.search(r'\b(\d{11})\b', text)
        
    if cpf_match:
        extracted_data['cpf'] = cpf_match.group(1)

    # Extração do RG
    rg_match = re.search(r'\b(\d{1,2}\.?\d{3}\.?\d{3}-?[a-zA-Z0-9X]{1,2})\b', text, re.IGNORECASE)
    if rg_match and rg_match.group(1) != extracted_data.get('cpf'):
        candidato_rg = rg_match.group(1)
        raw_rg = re.sub(r'[\.\-]', '', candidato_rg)
        if 7 <= len(raw_rg) <= 9:
            extracted_data['rg'] = candidato_rg

    # Data de Nascimento
    data_match = re.search(r'\b(\d{2}/\d{2}/\d{4})\b', text)
    if data_match:
        dia, mes, ano = data_match.group(1).split('/')
        extracted_data['data_nascimento'] = f"{ano}-{mes}-{dia}"
        
    # Extração Qualitativa (Nome e Mãe)
    linhas = [linha.strip() for linha in text.split('\n') if linha.strip()]
    for i, linha in enumerate(linhas):
        if linha.upper() == "NOME" or linha.upper().startswith("NOME:"):
            if i + 1 < len(linhas):
                extracted_data['nome_razao_social'] = linhas[i+1].title()
            break

    for i, linha in enumerate(linhas):
        if "FILIAÇÃO" in linha.upper() or "FILIACAO" in linha.upper() or "NOME DA MÃE" in linha.upper():
            if i + 1 < len(linhas):
                extracted_data['nome_mae'] = linhas[i+1].title()
            break

    return extracted_data


def extract_client_data_from_file(file_stream, filename):
    """
    Lê o binário carregado do front-end interpretando sua extensão e rotaciona
    para o motor correto de extração.
    """
    try:
        ext = filename.lower().split('.')[-1]
        text = ""

        if ext == 'pdf':
            reader = PdfReader(file_stream)
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        
        elif ext == 'txt':
            text = file_stream.read().decode('utf-8', errors='ignore')

        elif ext == 'docx':
            doc = Document(file_stream)
            for p in doc.paragraphs:
                text += p.text + "\n"

        elif ext in ['xlsx', 'xls']:
            wb = openpyxl.load_workbook(file_stream, data_only=True)
            for sheet in wb.worksheets:
                for row in sheet.iter_rows(values_only=True):
                    for cell in row:
                        if cell is not None:
                            text += str(cell) + " "
                    text += "\n"

        elif ext in ['png', 'jpg', 'jpeg']:
            try:
                img = Image.open(file_stream)
                # Tenta processar em PT-BR primeiro se o language pack estiver instalado.
                try:
                    text = pytesseract.image_to_string(img, lang='por')
                except:
                    # Fallback pro basico inglês.
                    text = pytesseract.image_to_string(img)
            except pytesseract.pytesseract.TesseractNotFoundError:
                return {"error": "O Motor Tesseract-OCR não está instalado no servidor/Windows. Por favor, baixe-o do Google para conseguir ler fotos."}
            except FileNotFoundError:
                return {"error": "O Tesseract-OCR File Not Found. Certifique-se de instalá-lo no Path."}

        else:
            return {"error": f"O formato {ext} não é suportado pelo nosso Motor Biométrico Dinâmico."}

        if not text.strip():
            return {"error": "Nenhum texto legível foi abstraído do documento."}

        return _extract_biometria_from_text(text)

    except Exception as e:
        print(f"[OCR_ERROR_CRITICAL] {filename}: {e}")
        return {"error": f"Falha Oculta na leitura do arquivo: {str(e)}"}
