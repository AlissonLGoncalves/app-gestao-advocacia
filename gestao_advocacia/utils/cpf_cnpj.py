"""
Utilitários para validação e formatação de CPF/CNPJ
Centraliza lógica duplicada anteriormente em routes/auth.py e contrato_service.py
"""

import re


def extract_digits(value: str | None) -> str:
    """
    Remove todos os caracteres não-dígitos de uma string.
    
    Args:
        value: String com possíveis caracteres especiais
        
    Returns:
        String contendo apenas os dígitos
    """
    return re.sub(r"\D", "", value or "")


def validate_cpf(cpf: str | None) -> bool:
    """
    Valida um CPF verificando dígitos verificadores.
    
    Args:
        cpf: CPF em qualquer formato (com ou sem máscara)
        
    Returns:
        True se CPF é válido, False caso contrário
    """
    digits = extract_digits(cpf)
    
    # CPF deve ter 11 dígitos e não pode ser sequência repetida
    if len(digits) != 11 or digits == digits[0] * 11:
        return False
    
    # Verifica primeiro dígito verificador
    soma_1 = sum(int(digits[i]) * (10 - i) for i in range(9))
    dig_1 = (soma_1 * 10) % 11
    dig_1 = 0 if dig_1 == 10 else dig_1
    
    if dig_1 != int(digits[9]):
        return False
    
    # Verifica segundo dígito verificador
    soma_2 = sum(int(digits[i]) * (11 - i) for i in range(10))
    dig_2 = (soma_2 * 10) % 11
    dig_2 = 0 if dig_2 == 10 else dig_2
    
    return dig_2 == int(digits[10])


def format_cpf(cpf: str | None) -> str | None:
    """
    Formata um CPF para o padrão XXX.XXX.XXX-XX.
    
    Args:
        cpf: CPF em qualquer formato
        
    Returns:
        CPF formatado ou None se não tiver 11 dígitos
    """
    digits = extract_digits(cpf)
    
    if len(digits) != 11:
        return None
    
    return f"{digits[0:3]}.{digits[3:6]}.{digits[6:9]}-{digits[9:11]}"


def validate_cnpj(cnpj: str | None) -> bool:
    """
    Valida um CNPJ verificando dígitos verificadores.
    
    Args:
        cnpj: CNPJ em qualquer formato (com ou sem máscara)
        
    Returns:
        True se CNPJ é válido, False caso contrário
    """
    digits = extract_digits(cnpj)
    
    # CNPJ deve ter 14 dígitos e não pode ser sequência repetida
    if len(digits) != 14 or digits == digits[0] * 14:
        return False
    
    # Verifica primeiro dígito verificador
    soma_1 = sum(
        int(digits[i]) * (6 - (i % 4)) 
        if (i % 4) < 4 else int(digits[i]) * (6 - (i % 4))
        for i in range(12)
    )
    dig_1 = 11 - (soma_1 % 11)
    dig_1 = 0 if dig_1 > 9 else dig_1
    
    if dig_1 != int(digits[12]):
        return False
    
    # Verifica segundo dígito verificador
    soma_2 = sum(
        int(digits[i]) * (7 - (i % 4)) 
        if (i % 4) < 4 else int(digits[i]) * (7 - (i % 4))
        for i in range(13)
    )
    dig_2 = 11 - (soma_2 % 11)
    dig_2 = 0 if dig_2 > 9 else dig_2
    
    return dig_2 == int(digits[13])


def format_cnpj(cnpj: str | None) -> str | None:
    """
    Formata um CNPJ para o padrão XX.XXX.XXX/XXXX-XX.
    
    Args:
        cnpj: CNPJ em qualquer formato
        
    Returns:
        CNPJ formatado ou None se não tiver 14 dígitos
    """
    digits = extract_digits(cnpj)
    
    if len(digits) != 14:
        return None
    
    return f"{digits[0:2]}.{digits[2:5]}.{digits[5:8]}/{digits[8:12]}-{digits[12:14]}"
