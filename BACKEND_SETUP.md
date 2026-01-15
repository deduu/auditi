# AI Agent Monitor - Backend Setup

## Quick Start

### 1. Install Backend Dependencies
```bash
cd Audit
npm install --save-exact express cors
```

### 2. Run the Backend Server
```bash
# Terminal 1: Start the backend (runs on port 3000)
node backend_server.js

# OR with auto-reload:
node --watch backend_server.js
```

### 3. Run the Frontend Dev Server
```bash
# Terminal 2: Start the frontend (runs on port 5174)
npm run dev
```

### 4. Access the App
Open your browser to: **http://localhost:5174**

The frontend will automatically connect to the backend at `http://localhost:3000/api`

## Backend Endpoints

The backend provides these mock endpoints:

- `GET /api/metrics` - Dashboard metrics
- `GET /api/conversations` - List all conversations
- `GET /api/conversations/:id` - Get specific conversation details
- `GET /api/evaluations` - Evaluation data
- `GET /api/failure-modes` - Failure mode analysis
- `GET /api/failure-modes/trends` - Failure trends over time
- `GET /api/models` - Available AI models
- `GET /api/actions` - Recommended actions
- `PATCH /api/actions/:id` - Update action status
- `GET /api/health` - Health check

## Integration Notes

The frontend is configured to:
- Call `http://localhost:3000/api` for all backend requests
- Fall back to mock data if the backend is unavailable
- Use CORS-enabled requests

To modify the backend API URL, edit [src/services/api.js](src/services/api.js) line 1-2.

## Database Integration

To connect to a real database:
1. Replace mock data in `backend_server.js` with database queries
2. Add your database connection (PostgreSQL, MongoDB, etc.)
3. The frontend will automatically use the real data
