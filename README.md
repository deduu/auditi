# AI Agent Monitor

A standardized (frontend-first) dashboard for monitoring, evaluating, and improving AI Agents.

![Dashboard Preview](https://via.placeholder.com/800x400?text=AI+Agent+Monitor+Preview)

## 🚀 Overview

This dashboard provides a unified interface to visualize the performance of your AI agents. It is designed to be **backend-agnostic**, meaning you can plug it into *any* AI system (Python, Node, Go, LangChain, etc.) simply by implementing the standard API protocol.

### Key Features
- **📊 Real-time Metrics**: Track pass rates, latency, and conversation volume.
- **💬 Conversation Inspector**: Drill down into full session logs with turn-by-turn analysis.
- **🎯 Failure Analysis**: Identify top failure modes (Hallucination, Timeout, etc.).
- **⚡ Model Performance**: Compare accuracy and cost across different LLMs (GPT-4, Claude, etc.).
- **✅ Recommended Actions**: Get prioritized suggestions to improve your agent.

---

## 🛠️ Getting Started

### Prerequisites
- Node.js (v18+)
- Python 3.10+ (Optional, only for the reference backend)

### 1. Installation
Clone the repository and install frontend dependencies:
```bash
git clone https://github.com/deduu/auditi
cd auditi
npm install
```

### 2. Run Locally (with Reference Backend)
We provide a Python `FastAPI` backend that generates mock data so you can explore the UI immediately.

**Terminal 1 (Frontend):**
```bash
npm run dev
# Running on http://localhost:5173
```

**Terminal 2 (Reference Backend):**
```bash
# Create/Activate virtual env (optional but recommended)
py backend.py
# Running on http://localhost:3000
```
*Note: The frontend is configured to look for the backend at `http://localhost:3000/api/v1` by default.*

---

## 🔌 Integration Guide

**Want to use this dashboard with your REAL AI Agent?**

You do not need to rewrite your agent. You only need to expose a few API endpoints that this dashboard can consume.

1.  **Read the Specification**: See [API_SPEC.md](./API_SPEC.md) for the JSON contract.
2.  **Implement Routes**: Add endpoints like `/metrics`, `/conversations`, and `/evaluations` to your agent's backend.
3.  **Configure Frontend**:
    Create a `.env` file in the root directory:
    ```env
    VITE_API_BASE_URL=http://your-production-api.com/api/v1
    ```
4.  **Build**:
    ```bash
    npm run build
    # Deploy the 'dist' folder to any static host (Vercel, S3, Netlify)
    ```

For detailed instructions, see the **[Integration Guide](./INTEGRATION_GUIDE.md)**.

---

## 📂 Project Structure

```
├── src/
│   ├── components/      # Reusable UI components
│   ├── pages/           # Dashboard views (Evaluations, Models, etc.)
│   ├── services/        # API client (api.js)
│   └── App.jsx          # Main routing logic
├── backend.py           # Reference FastAPI backend (Simulator)
├── API_SPEC.md          # Protocol definition
├── INTEGRATION_GUIDE.md # How to connect your agent
└── README.md            # This file
```

## 🤝 Contributing
Contributions are welcome! Please open an issue or submit a PR for any new features or bug fixes.

## 📄 License
MIT