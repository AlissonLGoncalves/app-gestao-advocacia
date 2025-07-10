# Sistema de Gestão para Advocacia

![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=for-the-badge&logo=python)
![Flask](https://img.shields.io/badge/Flask-2.0-000000?style=for-the-badge&logo=flask)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-13-4169E1?style=for-the-badge&logo=postgresql)

Um sistema web completo para gestão de escritórios de advocacia, permitindo o controle de clientes, casos, finanças, documentos e agenda. A aplicação conta com uma API RESTful segura construída em Python com Flask e um frontend moderno e reativo desenvolvido com React (Vite).

---

## Funcionalidades Principais

* **Dashboard Intuitivo:** Visão geral com os próximos eventos e status financeiro.
* **Gestão de Clientes:** Cadastro e gerenciamento completo de clientes.
* **Gestão de Casos:** Crie e associe casos aos clientes, definindo status, tipo e outras informações.
* **Controle Financeiro:** Registre despesas e recebimentos vinculados aos casos.
* **Gerenciador de Documentos:** Faça upload e organize documentos importantes para cada caso.
* **Agenda/Calendário:** Controle de eventos e prazos importantes.
* **Consulta CNJ:** Funcionalidade para buscar atualizações de processos diretamente do serviço do CNJ.
* **API Segura:** Endpoints protegidos com autenticação baseada em Token JWT.

## Tecnologias Utilizadas

#### **Backend**

* **Python 3.11+**
* **Flask:** Microframework web.
* **Flask-RESTX:** Para criação da API RESTful com documentação Swagger automática.
* **Flask-SQLAlchemy:** ORM para interação com o banco de dados.
* **Flask-Migrate:** Para controle de versionamento do schema do banco de dados.
* **Flask-JWT-Extended:** Para implementação da autenticação com JSON Web Tokens.
* **Psycopg2:** Driver para conexão com o PostgreSQL.

#### **Frontend**

* **React 18:** Biblioteca para construção da interface de usuário.
* **Vite:** Ferramenta de build para um desenvolvimento frontend rápido.
* **React Router DOM:** Para gerenciamento de rotas na SPA (Single Page Application).
* **Axios:** Cliente HTTP para comunicação com a API.

## Instalação e Execução

### Pré-requisitos

* Python 3.11+
* Node.js 20+
* PostgreSQL
* Git

### 1. Backend (`gestao_advocacia`)

```bash
# Clone o repositório
git clone [https://github.com/AlissonLGoncalves/app-gestao-advocacia.git](https://github.com/AlissonLGoncalves/app-gestao-advocacia.git)
cd app-gestao-advocacia/gestao_advocacia

# Crie e ative um ambiente virtual
python -m venv .venv
source .venv/bin/activate # No Windows: .venv\Scripts\activate

# Instale as dependências
pip install -r requirements.txt

# Configure as variáveis de ambiente
# Crie um arquivo .env na pasta 'gestao_advocacia' e adicione as seguintes chaves:
# SECRET_KEY='uma-chave-secreta-forte'
# DATABASE_URL='postgresql://usuario:senha@localhost:5432/nome_do_banco'

# Aplique as migrações do banco de dados
flask db upgrade

# Execute o servidor de desenvolvimento
flask run
```

O servidor backend estará rodando em `http://127.0.0.1:5000`.

### 2. Frontend (`gestao_advocacia_vite`)

Abra um novo terminal.

```bash
# Navegue até a pasta do frontend
cd app-gestao-advocacia/gestao_advocacia_vite

# Instale as dependências
npm install

# Execute o servidor de desenvolvimento
npm run dev
```

A aplicação React estará acessível em `http://127.0.0.1:5173` (ou outra porta indicada no terminal).

## Documentação da API

Graças ao Flask-RESTX, a documentação completa da API é gerada automaticamente e pode ser acessada de forma interativa (via Swagger UI) enquanto o backend estiver rodando.

Acesse: **http://127.0.0.1:5000/api/**

## Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

---
---

# Law Practice Management System (English)

A complete web system for managing law practices, allowing control over clients, cases, finances, documents, and schedules. The application features a secure RESTful API built in Python with Flask and a modern, reactive frontend developed with React (Vite).

## Core Features

* **Intuitive Dashboard:** Overview with upcoming events and financial status.
* **Client Management:** Full registration and management of clients.
* **Case Management:** Create and associate cases with clients, defining status, type, and other information.
* **Financial Control:** Record expenses and revenues linked to cases.
* **Document Manager:** Upload and organize important documents for each case.
* **Schedule/Calendar:** Control of important events and deadlines.
* **CNJ Query:** Functionality to fetch case updates directly from the CNJ (National Council of Justice) service.
* **Secure API:** Endpoints protected with JWT Token-based authentication.

## Tech Stack

#### **Backend**

* **Python 3.11+**
* **Flask:** Web microframework.
* **Flask-RESTX:** For creating the RESTful API with automatic Swagger documentation.
* **Flask-SQLAlchemy:** ORM for database interaction.
* **Flask-Migrate:** For database schema version control.
* **Flask-JWT-Extended:** For implementing authentication with JSON Web Tokens.
* **Psycopg2:** Driver for connecting to PostgreSQL.

#### **Frontend**

* **React 18:** Library for building the user interface.
* **Vite:** Build tool for fast frontend development.
* **React Router DOM:** For route management in the SPA (Single Page Application).
* **Axios:** HTTP client for communicating with the API.

## Installation and Setup

### Prerequisites

* Python 3.11+
* Node.js 20+
* PostgreSQL
* Git

### 1. Backend (`gestao_advocacia`)

```bash
# Clone the repository
git clone [https://github.com/AlissonLGoncalves/app-gestao-advocacia.git](https://github.com/AlissonLGoncalves/app-gestao-advocacia.git)
cd app-gestao-advocacia/gestao_advocacia

# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
# Create a .env file in the 'gestao_advocacia' folder and add the following keys:
# SECRET_KEY='a-strong-secret-key'
# DATABASE_URL='postgresql://user:password@localhost:5432/database_name'

# Apply database migrations
flask db upgrade

# Run the development server
flask run
```

The backend server will be running at `http://127.0.0.1:5000`.

### 2. Frontend (`gestao_advocacia_vite`)

Open a new terminal.

```bash
# Navigate to the frontend folder
cd app-gestao-advocacia/gestao_advocacia_vite

# Install dependencies
npm install

# Run the development server
npm run dev
```

The React application will be accessible at `http://127.0.0.1:5173` (or another port indicated in the terminal).

## API Documentation

Thanks to Flask-RESTX, the complete API documentation is automatically generated and can be accessed interactively (via Swagger UI) while the backend is running.

Access it at: **http://127.0.0.1:5000/api/**

## License

This project is licensed under the MIT License. See the `LICENSE` file for more details.
