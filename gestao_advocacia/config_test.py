# config_test.py
import os
basedir = os.path.abspath(os.path.dirname(__file__))

class ConfigTest:
        TESTING = True # Habilita o modo de teste no Flask
        SQLALCHEMY_DATABASE_URI = os.environ.get('TEST_DATABASE_URL') or \
            'sqlite:///' + os.path.join(basedir, 'app_test.db') # Banco de dados SQLite para testes
        SQLALCHEMY_TRACK_MODIFICATIONS = False
        SECRET_KEY = os.environ.get('SECRET_KEY') or 'uma-chave-secreta-muito-secreta-para-testes'
        
        # Configurações de Upload (podem ser as mesmas ou diferentes para testes)
        UPLOAD_FOLDER = os.path.join(basedir, 'uploads_test')
        MAX_CONTENT_LENGTH = 16 * 1024 * 1024
        
        # Outras configurações que sua aplicação possa precisar para testes
        # Por exemplo, se você usa alguma API externa, pode querer usar chaves de teste
        