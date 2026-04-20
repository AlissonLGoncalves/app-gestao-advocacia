"""Testes para validar_upload: verifica que o mime real e tamanho sao validados corretamente."""

import io
import struct

from upload_validator import MAX_UPLOAD_BYTES, validar_upload


def _make_file_storage(content: bytes, filename: str = "test.bin"):
    """Cria um objeto simulando werkzeug FileStorage com stream e filename."""

    class FakeFileStorage:
        def __init__(self, data, name):
            self.stream = io.BytesIO(data)
            self.filename = name

    return FakeFileStorage(content, filename)


def _pdf_bytes():
    return b"%PDF-1.4\n%..." + b"\x00" * 100


def _jpg_bytes():
    return b"\xff\xd8\xff\xe0" + b"\x00" * 200


def _png_bytes():
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr_data = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
    chunk = struct.pack(">I", len(ihdr_data)) + b"IHDR" + ihdr_data + b"\x00\x00\x00\x00"
    return sig + chunk


class TestValidarUpload:
    def test_pdf_valido_aceito(self):
        fs = _make_file_storage(_pdf_bytes(), "documento.pdf")
        ok, msg = validar_upload(fs)
        assert ok, f"Esperado aceito, recebeu: {msg}"
        assert msg is None

    def test_jpg_valido_aceito(self):
        fs = _make_file_storage(_jpg_bytes(), "foto.jpg")
        ok, msg = validar_upload(fs)
        assert ok, f"Esperado aceito, recebeu: {msg}"

    def test_png_valido_aceito(self):
        fs = _make_file_storage(_png_bytes(), "imagem.png")
        ok, msg = validar_upload(fs)
        assert ok, f"Esperado aceito, recebeu: {msg}"

    def test_txt_renomeado_pdf_rejeitado(self):
        """Arquivo com conteudo texto mas extensao .pdf deve ser rejeitado."""
        conteudo = b"hello world this is plain text content"
        fs = _make_file_storage(conteudo, "malicioso.pdf")
        ok, msg = validar_upload(fs)
        assert not ok
        assert msg is not None
        assert "permitido" in msg.lower()

    def test_php_renomeado_pdf_rejeitado(self):
        """Arquivo PHP com extensao .pdf deve ser rejeitado."""
        conteudo = b"<?php echo 1; ?>"
        fs = _make_file_storage(conteudo, "shell.pdf")
        ok, msg = validar_upload(fs)
        assert not ok

    def test_arquivo_acima_10mb_rejeitado(self):
        """Arquivo maior que 10 MB deve ser rejeitado independente do mime."""
        conteudo = b"%PDF-1.4\n" + b"A" * (MAX_UPLOAD_BYTES + 1)
        fs = _make_file_storage(conteudo, "enorme.pdf")
        ok, msg = validar_upload(fs)
        assert not ok
        assert "grande" in msg.lower() or "10" in msg

    def test_arquivo_vazio_rejeitado(self):
        fs = _make_file_storage(b"", "vazio.pdf")
        ok, msg = validar_upload(fs)
        assert not ok
        assert msg is not None

    def test_stream_reposicionado_apos_validacao(self):
        """Apos validar_upload, o stream deve estar no inicio para poder ser salvo."""
        fs = _make_file_storage(_pdf_bytes(), "test.pdf")
        validar_upload(fs)
        pos = fs.stream.tell()
        assert pos == 0
