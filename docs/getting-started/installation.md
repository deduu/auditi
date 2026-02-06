---
sidebar_position: 1
---

# Installation

There are two main components to install: the **Auditi Platform** (Backend & Frontend) and the **Python SDK**.

## System Requirements

- Docker & Docker Compose
- Python 3.8+
- Node.js 18+ (if building frontend manually)

## 1. Hosting the Platform

The easiest way to run Auditi is using Docker Compose.

```bash
# Clone the repository
git clone https://github.com/deduu/auditi.git
cd auditi

# Start all services
docker-compose up -d
```

Once running, you can access:
- **Frontend Dashboard**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:8000](http://localhost:8000)
- **API Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)

## 2. Installing the SDK

Install the SDK in your Python environment where your agent code runs.

```bash
pip install auditi-sdk
```

*Note: During development, you can install from source:*

```bash
cd sdk
pip install -e .
```
