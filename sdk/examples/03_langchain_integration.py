"""
Example 3: LangChain Integration

This shows how to integrate Auditi with an existing LangChain agent.
"""
import auditi

# Initialize at startup
auditi.init(
    api_key="your-auditi-api-key",
    base_url="https://your-auditi-backend.com"
)


# ============================================
# Option A: Wrap the entire chain
# ============================================
@auditi.trace_agent(name="LangChain RAG Agent")
def run_langchain_agent(
    query: str,
    user_id: str = None,
    session_id: str = None
) -> str:
    """
    Wrap your LangChain execution in @trace_agent.
    The query becomes user_input, return value becomes assistant_output.
    """
    from langchain_openai import ChatOpenAI
    from langchain_core.prompts import ChatPromptTemplate
    from langchain_core.output_parsers import StrOutputParser
    
    llm = ChatOpenAI(model="gpt-4")
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a helpful assistant."),
        ("user", "{input}")
    ])
    chain = prompt | llm | StrOutputParser()
    
    result = chain.invoke({"input": query})
    return result


# ============================================
# Option B: With individual tool tracing
# ============================================
@auditi.trace_tool(name="vector_search")
def vector_search(query: str) -> list:
    """Each tool in your agent can be traced individually."""
    # Your vector DB search
    from langchain_community.vectorstores import FAISS
    # results = vectorstore.similarity_search(query)
    return ["result1", "result2"]


@auditi.trace_llm(name="langchain_llm", model="gpt-4")
def generate_with_context(query: str, context: list) -> str:
    """Trace the LLM call specifically."""
    from langchain_openai import ChatOpenAI
    
    llm = ChatOpenAI(model="gpt-4")
    prompt = f"Context: {context}\n\nQuestion: {query}"
    return llm.invoke(prompt).content


@auditi.trace_agent(name="RAG Pipeline")
def rag_agent(
    question: str,
    user_id: str = None,
    session_id: str = None
) -> str:
    """Full RAG pipeline with individual span tracking."""
    # Each of these creates a span within the trace
    docs = vector_search(question)
    answer = generate_with_context(question, docs)
    return answer


# ============================================
# Usage
# ============================================
if __name__ == "__main__":
    # Simple usage
    answer = rag_agent(
        "What is the capital of France?",
        user_id="user_123",
        session_id="conv_456"
    )
    print(f"Answer: {answer}")
