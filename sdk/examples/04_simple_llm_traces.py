"""
Example 4: Simple LLM Traces (Standalone)

This shows how to trace simple LLM calls WITHOUT requiring a parent @trace_agent.
Perfect for:
- Single chat completions
- Quick prototypes
- Testing individual LLM calls
- Simple chatbots without complex agent logic

Run: AUDITI_DEBUG=true python 04_simple_llm_traces.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import auditi

# Initialize Auditi
auditi.init(
    api_key="your-auditi-api-key", base_url="http://localhost:8000"  # Your Auditi dashboard backend
)


# ============================================
# STANDALONE LLM CALLS - No @trace_agent needed!
# ============================================


@auditi.trace_llm(standalone=True)
def simple_chat(prompt: str) -> str:
    """
    A simple LLM call that creates its own trace automatically.
    No need for @trace_agent wrapper!
    """
    # Using OpenAI
    try:
        from openai import OpenAI

        client = OpenAI()
        response = client.chat.completions.create(
            model="gpt-4o-mini", messages=[{"role": "user", "content": prompt}]
        )
        return response.choices[0].message.content
    except Exception as e:
        # Fallback for demo without API key
        return f"[Mock Response] Your question was: {prompt}"


@auditi.trace_llm(name="gpt4_completion", standalone=True)
def named_chat(prompt: str, temperature: float = 0.7) -> str:
    """
    A named standalone LLM call with custom parameters.
    """
    try:
        from openai import OpenAI

        client = OpenAI()
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=temperature,
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"[Mock Response] Prompt: {prompt}, Temp: {temperature}"


# ============================================
# INSIDE @trace_agent - Works as a span
# ============================================


@auditi.trace_llm(standalone=True)  # Works both standalone AND as span
def flexible_chat(prompt: str) -> str:
    """
    This decorator works both ways:
    - If called outside @trace_agent: creates standalone trace
    - If called inside @trace_agent: creates a span within that trace
    """
    try:
        from openai import OpenAI

        client = OpenAI()
        response = client.chat.completions.create(
            model="gpt-4o-mini", messages=[{"role": "user", "content": prompt}]
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"[Mock Response] {prompt}"


@auditi.trace_agent(name="Complex Agent")
def complex_agent(query: str) -> str:
    """
    When flexible_chat is called inside an agent, it creates a span.
    """
    # This creates a SPAN within the agent trace
    response = flexible_chat(f"Help me with: {query}")
    return response


# ============================================
# RUN EXAMPLES
# ============================================
if __name__ == "__main__":
    print("=" * 60)
    print("Testing Standalone LLM Traces")
    print("=" * 60)

    # Example 1: Simple standalone call
    print("\n1. Simple standalone LLM call:")
    result = simple_chat("What is 2 + 2?")
    print(f"   Response: {result[:100]}...")

    # Example 2: Named standalone call
    print("\n2. Named standalone LLM call:")
    result = named_chat("Tell me a joke", temperature=0.9)
    print(f"   Response: {result[:100]}...")

    # Example 3: Flexible chat - standalone mode
    print("\n3. Flexible chat (standalone mode):")
    result = flexible_chat("What's the weather like?")
    print(f"   Response: {result[:100]}...")

    # Example 4: Flexible chat - inside agent (creates span)
    print("\n4. Flexible chat inside agent (creates span):")
    result = complex_agent("Write a haiku")
    print(f"   Response: {result[:100]}...")

    print("\n" + "=" * 60)
    print("✓ All examples completed!")
    print("Check your Auditi dashboard to see the traces.")
    print("=" * 60)
