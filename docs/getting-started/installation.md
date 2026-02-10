---
sidebar_position: 1
---

# Installation

There are two main components to install: the **Auditi Platform** (Backend & Frontend) and the **Python SDK**.

## System Requirements

- Docker & Docker Compose
- Python 3.8+
- Node.js 18+ (if building frontend manually)

## Using Docker (Recommended)

The easiest way to run Auditi is using Docker Compose.

```bash
# Clone the repository
git clone https://github.com/deduu/auditi.git
cd auditi

# Generate an encryption key for securing LLM API keys
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# Generate a JWT secret for user session tokens
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Create a .env file with both keys
echo "ENCRYPTION_KEY=<paste-encryption-key-here>" > .env
echo "JWT_SECRET=<paste-jwt-secret-here>" >> .env

# Start all services
docker-compose up -d
```

Once running, you can access:
- **Frontend Dashboard**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:8000](http://localhost:8000)
- **API Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)

> **Important:** The `ENCRYPTION_KEY` encrypts LLM connection API keys stored in the database. Without it, a random key is generated on each container start, and previously saved API keys become unrecoverable after a restart. Similarly, `JWT_SECRET` signs user session tokens — without it, an ephemeral key is generated on each start and all users will be logged out on restart. If you switch between Docker and manual setups, use the same keys in both environments (set them as environment variables).

## Manual Installation

### Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the backend
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Run the frontend
npm run dev
```

### SDK

```bash
cd sdk

# Create and activate virtual environment (if not using backend's venv)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install SDK in development mode
pip install -e .
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `ENCRYPTION_KEY` | Fernet key for encrypting LLM API keys | Recommended |
| `JWT_SECRET` | Secret for signing JWT session tokens | Recommended |
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated) | No (defaults to localhost) |
| `DEBUG` | Enable debug mode | No (default: false) |

## Next Steps

After installation, [set up your account and generate an API key](./authentication.md).
