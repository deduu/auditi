"""
CORRECTED: Production FastAPI Integration

This shows the PROPER way to use Auditi with agentic workflows.
The key: trace_tool and trace_llm must be called INSIDE a @trace_agent function.
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, Any
import auditi
import os
from openai import OpenAI

app = FastAPI(title="AI Assistant API")

# Initialize Auditi at startup
auditi.init(
    api_key="your-auditi-api-key",
    base_url="http://localhost:8000"
)


class ChatRequest(BaseModel):
    message: str
    user_id: str
    conversation_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    conversation_id: str


# ============================================
# IMPORTANT: These decorators create SPANS, not separate traces
# They only work when called inside a @trace_agent function
# ============================================

@auditi.trace_llm(name="openai_chat")
def call_llm(prompt: str, model: str) -> Any:
    """
    LLM call - creates a SPAN in the current trace.
    RETURNS the full response object so Auditi can extract usage metrics.
    """
    client = OpenAI()
    api_key = os.getenv("OPENAI_API_KEY")
    masked_key = api_key if api_key else None
    print("OPENAI_API_KEY:", masked_key)
    print("Base URL:", client.base_url)
    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}]
    )
    
    return response


@auditi.trace_tool(name="search_kb")
def search_knowledge_base(query: str) -> str:
    """
    Tool call - creates a SPAN in the current trace.
    
    When called inside process_chat(), this becomes a span with:
    - span_type: "tool"
    - inputs: {"query": "..."}
    - outputs: "Search results..."
    """
    # Your actual search implementation
    results = f"Found: FAQ about {query}, Documentation section 3.2"
    return results


@auditi.trace_tool(name="fetch_user_context")
def fetch_user_context(user_id: str) -> dict:
    """
    Another tool - also creates a span.
    """
    # Simulate fetching user preferences, history, etc.
    return {
        "preferences": "technical explanations",
        "subscription": "premium",
        "last_topic": "API integration"
    }


# ============================================
# CORRECT: All tools/LLMs called inside @trace_agent
# This creates ONE trace with multiple spans
# ============================================

@auditi.trace_agent(name="Customer Support Agent")
def process_chat(
    message: str, 
    user_id: str = None, 
    session_id: str = None
) -> str:
    """
    Main agent function - creates ONE trace that captures:
    
    TRACE:
      - user_input: message
      - user_id: user_id
      - conversation_id: session_id
      - assistant_output: [return value]
      - spans: [
          {type: "tool", name: "fetch_user_context", ...},
          {type: "tool", name: "search_kb", ...},
          {type: "llm", name: "openai_chat", ...}
        ]
    
    The evaluation will see ALL spans and the final output.
    """
    
    # Step 1: Fetch user context (creates tool span)
    user_context = fetch_user_context(user_id)
    
    # Step 2: Search knowledge base (creates tool span)
    kb_results = search_knowledge_base(message)
    
    # Step 3: Generate response with LLM (creates llm span)
    prompt = f"""You are a helpful assistant.

User Context: {user_context}
Knowledge Base Results: {kb_results}

User Question: {message}

Provide a helpful response:"""
    
    response_obj = call_llm(prompt, model="gpt-4o")
    content = response_obj.choices[0].message.content
    
    # This return value becomes trace.assistant_output
    return content


# ============================================
# Example: Multi-turn conversation with reflection
# ============================================

@auditi.trace_agent(name="Advanced Agent with Reflection")
def process_chat_with_reflection(
    message: str,
    user_id: str = None,
    session_id: str = None
) -> str:
    """
    This shows a more complex agentic pattern:
    1. Search
    2. Generate initial response
    3. Reflect on response quality
    4. Refine if needed
    
    All steps are captured as spans in ONE trace.
    """
    
    # Search
    kb_results = search_knowledge_base(message)
    
    # Initial generation
    initial_prompt = f"User: {message}\nContext: {kb_results}\nRespond helpfully:"
    initial_response_obj = call_llm(initial_prompt)
    initial_response = initial_response_obj.choices[0].message.content
    
    # Reflection (another LLM call)
    reflection_prompt = f"""Review this response for accuracy and completeness:
    
User Question: {message}
Response: {initial_response}

Is this response good? Reply with GOOD or NEEDS_IMPROVEMENT and explain why."""
    
    reflection_obj = call_llm(reflection_prompt, model="gpt-4")
    reflection = reflection_obj.choices[0].message.content
    
    # Refine if needed
    if "NEEDS_IMPROVEMENT" in reflection:
        refinement_prompt = f"""Improve this response:
        
Original: {initial_response}
Issue: {reflection}
User Question: {message}

Provide improved response:"""
        final_response_obj = call_llm(refinement_prompt)
        final_response = final_response_obj.choices[0].message.content
    else:
        final_response = initial_response
    
    return final_response


# ============================================
# API Endpoints
# ============================================

@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """
    Standard chat endpoint.
    
    Creates ONE trace with multiple spans (tool calls + LLM calls).
    """
    conversation_id = request.conversation_id or f"conv_{request.user_id}_{int(__import__('time').time())}"
    
    try:
        # This creates ONE trace with ALL the spans inside
        response = process_chat(
            message=request.message,
            user_id=request.user_id,
            session_id=conversation_id
        )
        
        return ChatResponse(
            response=response,
            conversation_id=conversation_id
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat/advanced", response_model=ChatResponse)
async def advanced_chat_endpoint(request: ChatRequest):
    """
    Advanced chat with reflection.
    
    Also creates ONE trace, but with more spans (search + 2-3 LLM calls).
    """
    conversation_id = request.conversation_id or f"conv_{request.user_id}_{int(__import__('time').time())}"
    
    try:
        response = process_chat_with_reflection(
            message=request.message,
            user_id=request.user_id,
            session_id=conversation_id
        )
        
        return ChatResponse(
            response=response,
            conversation_id=conversation_id
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# What gets sent to Auditi backend:
# ============================================
"""
ONE Trace object:
{
  "id": "uuid-1234",
  "user_id": "user_123",
  "conversation_id": "conv_456",
  "user_input": "How do I integrate your API?",
  "assistant_output": "Here's how to integrate...",
  "spans": [
    {
      "id": "span-1",
      "name": "fetch_user_context",
      "span_type": "tool",
      "inputs": {"user_id": "user_123"},
      "outputs": "{preferences: ...}",
      "start_time": "...",
      "end_time": "..."
    },
    {
      "id": "span-2", 
      "name": "search_kb",
      "span_type": "tool",
      "inputs": {"query": "How do I integrate your API?"},
      "outputs": "Found: FAQ about API integration...",
      "start_time": "...",
      "end_time": "..."
    },
    {
      "id": "span-3",
      "name": "openai_chat",
      "span_type": "llm",
      "model": "gpt-4",
      "inputs": {"prompt": "You are a helpful assistant..."},
      "outputs": "Here's how to integrate...",
      "tokens": 523,
      "cost": 0.01569,
      "start_time": "...",
      "end_time": "..."
    }
  ],
  "total_tokens": 523,
  "cost": 0.01569
}

The evaluator will then assess:
- Did the agent use appropriate tools? (Yes, fetched context and searched KB)
- Was the LLM call effective? (Yes, generated helpful response)
- Is the final output good? (Evaluated based on user query + final response)
"""

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)