"""Validacao de uploads: verifica o mime real do arquivo (magic bytes), nao apenas a extensao.

Tipos permitidos:
- application/pdf
- image/jpeg
- image/png
- application/vnd.openxmlformats-officedocument.wordprocessingml.document (.docx)

Tamanho maximo: 10 MB por arquivo.
"""

import magic

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB

ALLOWED_MIME = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    # Markdown e texto puro: usado pelo fluxo de "texto extraido" (PR #129)
    # quando o auto-preenchimento magico le um PDF e persiste o conteudo
    # como .md leve (~50 KB) vinculado ao Caso. Seguro: texto puro sem
    # script/macro.
    "text/markdown",
    "text/plain",
    "text/x-markdown",
}


def validar_upload(file_storage) -> tuple[bool, str | None]:
    """Valida o mime real e o tamanho de um FileStorage.

    Le os primeiros 2048 bytes para detectar o mime via libmagic,
    depois reposiciona o stream para o inicio.

    Retorna (True, None) se valido ou (False, mensagem) se invalido.
    """
    # Leitura do cabecalho para detectar mime real
    header = file_storage.stream.read(2048)
    file_storage.stream.seek(0)

    if not header:
        return False, "Arquivo vazio ou ilegivel."

    mime = magic.from_buffer(header, mime=True)
    if mime not in ALLOWED_MIME:
        return (
            False,
            f"Tipo de arquivo nao permitido (detectado: {mime}). "
            "Tipos aceitos: PDF, JPEG, PNG, DOCX.",
        )

    # Verificacao de tamanho total
    file_storage.stream.seek(0, 2)  # seek ate o final
    size = file_storage.stream.tell()
    file_storage.stream.seek(0)

    if size > MAX_UPLOAD_BYTES:
        mb = size / (1024 * 1024)
        return False, f"Arquivo muito grande ({mb:.1f} MB). Limite: 10 MB."

    return True, None
