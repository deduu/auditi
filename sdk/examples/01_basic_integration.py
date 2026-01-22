"""
Example 1: Basic Integration with an Existing Chatbot

This shows how to integrate Auditi with a simple customer support chatbot
that already exists. Minimal code changes required.
"""
from openai import OpenAI
import auditi

# ============================================
# BEFORE (Existing Agent - No Auditi)
# ============================================
# def customer_support_agent(user_message: str) -> str:
#     client = OpenAI()
#     response = client.chat.completions.create(
#         model="gpt-4",
#         messages=[{"role": "user", "content": user_message}]
#     )
#     return response.choices[0].message.content


# ============================================
# AFTER (With Auditi - Just add decorators!)
# ============================================

# Step 1: Initialize once at app startup
auditi.init(
    api_key="your-auditi-api-key",
    base_url="http://localhost:8000"  # Your Auditi dashboard backend
)

# Step 2: Add @trace_agent to your main agent function
@auditi.trace_agent(name="Customer Support Bot")
def customer_support_agent(user_message: str, user_id: str = None, session_id: str = None) -> str:
    """
    Your existing agent - just add the decorator!
    
    Args:
        user_message: The user's message (automatically captured by Auditi)
        user_id: Optional user identifier (automatically captured)
        session_id: Optional conversation ID (automatically captured)
    """
    response = call_openai(user_message)
    return response

# Step 3: Optionally add @trace_llm to track LLM calls
@auditi.trace_llm()
def call_openai(prompt: str) -> str:
    client = OpenAI()
    response = client.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content


# ============================================
# Usage - Your existing code stays the same!
# ============================================
if __name__ == "__main__":
    # Example 1: Simple call
    result = customer_support_agent("What are your business hours?")
    print(f"Response: {result}")
    
    # Example 2: With user tracking
    result = customer_support_agent(
        "Apa pengertian WAP?",
        user_id="user_12345",
        session_id="conv_abc123"
    )
    print(f"Response: {result}")
