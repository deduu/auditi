# Integration Guide: How to use the AI Agent Monitor

This dashboard is designed to be **backend-agnostic**. You can use it to monitor any AI agent system (Python, Node.js, Go, etc.) by implementing the standardized API Protocol.

## Quick Start

### 1. Build the Frontend
The frontend is a static React application. You can build it once and deploy it anywhere.
```bash
npm install
npm run build
# The 'dist' folder now contains the dashboard
```

### 2. Configure the API URL
The dashboard looks for the API Base URL in one of two places:
1. **Environment Variable**: `VITE_API_BASE_URL` (at build time)
2. **Runtime Protocol**: By default, it looks for `/api/v1` on the same host serving the dashboard.

### 3. Implement the API
Create a backend service (or add routes to your existing agent backend) that implements the [API Specification](./API_SPEC.md).

For example, if you are using specialized evaluation tools (like LangSmith or Ragas), you would create an adapter:
1. **`GET /conversations`**: Query your LangSmith runs.
2. **`GET /evaluations`**: Aggregate your Ragas scores.
3. **`GET /failure-modes`**: Group your error logs by category.

### 4. Deploy
Serve the `dist` folder using Nginx, S3, or Vercel.
Ensure your backend API allows CORS if it's on a different domain.

## Developer Workflow
1. Run your agent backend locally on port `3000`.
2. Run the dashboard with `npm run dev`.
3. Set `VITE_API_BASE_URL=http://localhost:3000/api/v1` in your `.env`.
4. The dashboard will now live-stream your local agent's performance.
