# FastAPI Backend for AI Agent Monitor

## Setup & Running

### 1. Install Python Dependencies
```bash
pip install -r requirements.txt
```

### 2. Start the Backend
```bash
# Option 1: Direct run
python backend.py

# Option 2: Using uvicorn with auto-reload
uvicorn backend:app --reload --host 0.0.0.0 --port 3000
```

The backend will be available at: **http://localhost:3000**

### 3. API Documentation
Once running, view interactive docs at:
- Swagger UI: http://localhost:3000/docs
- ReDoc: http://localhost:3000/redoc

## Running Frontend & Backend Together

**Terminal 1: Backend**
```bash
cd Audit
python backend.py
```

**Terminal 2: Frontend**
```bash
cd Audit
npm run dev
```

Then open: **http://localhost:5174**

## Integration with Your Real Backend

Each endpoint in `backend.py` has a `TODO` comment showing where to replace mock data:

### Example: Replace Mock Conversations

**Current (Mock Data):**
```python
@app.get("/api/conversations")
async def get_conversations(skip: int = 0, limit: int = 100):
    return MOCK_CONVERSATIONS[skip : skip + limit]
```

**Replace with (Real Database):**
```python
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

@app.get("/api/conversations")
async def get_conversations(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    # Query your database
    result = await db.execute(
        select(Conversation).offset(skip).limit(limit)
    )
    return result.scalars().all()
```

## API Endpoints

| Method | Endpoint | Mock Data | Notes |
|--------|----------|-----------|-------|
| GET | `/api/health` | ✓ | Health check |
| GET | `/api/metrics` | ✓ | Dashboard metrics |
| GET | `/api/conversations` | ✓ | List conversations |
| GET | `/api/conversations/{id}` | ✓ | Conversation details |
| GET | `/api/evaluations` | ✓ | Evaluation data |
| GET | `/api/failure-modes` | ✓ | Failure analysis |
| GET | `/api/failure-modes/trends` | ✓ | Failure trends |
| GET | `/api/models` | ✓ | Available models |
| GET | `/api/actions` | ✓ | Recommended actions |
| PATCH | `/api/actions/{id}` | ✓ | Update action status |

## Frontend Configuration

The frontend is already configured to call `http://localhost:3000/api`

To change the API URL, edit [src/services/api.js](src/services/api.js#L2):
```javascript
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:3000/api";
```

## Adding Database

Replace mock endpoints with database queries:

```python
from sqlalchemy import create_engine, Column, Integer, String, DateTime
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker

# Setup
DATABASE_URL = "sqlite+aiosqlite:///./test.db"
engine = create_async_engine(DATABASE_URL, echo=True)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()

# Models
class Conversation(Base):
    __tablename__ = "conversations"
    id = Column(Integer, primary_key=True)
    timestamp = Column(DateTime)
    user_id = Column(String)
    # ... more fields

# Use in endpoints
@app.get("/api/conversations")
async def get_conversations(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Conversation))
    return result.scalars().all()
```

## Testing API

```bash
# Test health endpoint
curl http://localhost:3000/api/health

# Get conversations
curl http://localhost:3000/api/conversations

# Get specific conversation
curl http://localhost:3000/api/conversations/1
```
