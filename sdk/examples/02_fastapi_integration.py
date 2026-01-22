"""
Example 2: Production FastAPI Integration

This shows how to integrate Auditi into a production FastAPI backend
that serves an AI assistant. This is how your clients would typically use it.
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import auditi
from openai import OpenAI

# ============================================
# FastAPI App Setup
# ============================================
app = FastAPI(title="AI Assistant API")

# Initialize Auditi ONCE at app startup
auditi.init(
    api_key="your-auditi-api-key",
    base_url="http://localhost:8000"  # Optional custom URL
)


# ============================================
# Request/Response Models
# ============================================
class ChatRequest(BaseModel):
    message: str
    user_id: str
    conversation_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    conversation_id: str


# ============================================
# AI Agent with Auditi Tracing
# ============================================
@auditi.trace_llm(name="openai_gpt4", model="gpt-4")
def call_llm(prompt: str) -> str:
    """Call OpenAI - this span is automatically captured."""
    client = OpenAI()
    response = client.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content


@auditi.trace_tool(name="search_knowledge_base")
def search_knowledge_base(query: str) -> str:
    """Search your knowledge base - this tool call is captured."""
    # Your actual search implementation
    return f"Found relevant info for: {query}"


@auditi.trace_agent(name="AI Assistant")
def process_chat(
    message: str, 
    user_id: str = None, 
    session_id: str = None
) -> str:
    """
    Main agent function - Auditi automatically captures:
    - message → user_input
    - user_id → user tracking
    - session_id → conversation tracking
    - return value → assistant_output
    """
    # Your agent logic with tools and LLM calls
    context = search_knowledge_base(message)
    prompt = f"Context: {context}\n\nUser: {message}"
    response = call_llm(prompt)
    return response


# ============================================
# API Endpoint
# ============================================
@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """
    Your existing API endpoint - just call the traced agent!
    """
    # Generate conversation_id if not provided
    conversation_id = request.conversation_id or f"conv_{request.user_id}_{int(__import__('time').time())}"
    
    try:
        # Call the traced agent - everything is captured automatically!
        response = process_chat(
            message=request.message,           # Captured as user_input
            user_id=request.user_id,           # Captured for user tracking
            session_id=conversation_id         # Captured for conversation tracking
        )
        
        return ChatResponse(
            response=response,
            conversation_id=conversation_id
        )
    except Exception as e:
        # Errors are also captured by Auditi
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# Run with: uvicorn example_fastapi:app --reload
# ============================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
