"""
Example 5: Embedding and Retrieval Traces

This shows how to trace embedding operations and vector DB retrievals.
These decorators are ALWAYS standalone by default since embeddings and
retrievals are typically independent operations.

Run: AUDITI_DEBUG=true python 05_embedding_traces.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import auditi

# Initialize Auditi
auditi.init(api_key="your-auditi-api-key", base_url="http://localhost:8000")


# ============================================
# EMBEDDING TRACES - Always standalone by default
# ============================================


@auditi.trace_embedding()
def embed_single_text(text: str):
    """
    Trace a single text embedding.
    Creates a standalone trace automatically.
    """
    try:
        from openai import OpenAI

        client = OpenAI()
        response = client.embeddings.create(input=text, model="text-embedding-3-small")
        return response.data[0].embedding
    except Exception as e:
        # Mock embedding for demo
        return [0.1, 0.2, 0.3, 0.4, 0.5]  # Fake 5-dim vector


@auditi.trace_embedding(name="batch_embedder", model="text-embedding-3-small")
def embed_batch(texts: list) -> list:
    """
    Trace batch embedding operations.
    """
    try:
        from openai import OpenAI

        client = OpenAI()
        response = client.embeddings.create(input=texts, model="text-embedding-3-small")
        return [item.embedding for item in response.data]
    except Exception as e:
        # Mock embeddings for demo
        return [[0.1 * i, 0.2 * i] for i in range(len(texts))]


# ============================================
# RETRIEVAL TRACES - For vector DB searches
# ============================================


@auditi.trace_retrieval(name="vector_search")
def search_docs(query: str, top_k: int = 5) -> list:
    """
    Trace a vector DB similarity search.
    Creates a standalone trace automatically.
    """
    # Mock vector search results
    # In production, this would call Pinecone, Weaviate, Chroma, etc.
    mock_results = [
        {"id": "doc1", "score": 0.95, "text": f"Result 1 for: {query}"},
        {"id": "doc2", "score": 0.87, "text": f"Result 2 for: {query}"},
        {"id": "doc3", "score": 0.82, "text": f"Result 3 for: {query}"},
    ]
    return mock_results[:top_k]


@auditi.trace_retrieval()
def hybrid_search(query: str) -> dict:
    """
    Trace a hybrid search (keyword + semantic).
    """
    # Mock hybrid search
    return {
        "semantic_results": [
            {"id": "s1", "score": 0.92, "text": "Semantic match 1"},
        ],
        "keyword_results": [
            {"id": "k1", "score": 0.88, "text": "Keyword match 1"},
        ],
        "combined_results": [
            {"id": "c1", "score": 0.95, "text": "Combined best match"},
        ],
    }


# ============================================
# COMBINED RAG FLOW - Embedding + Retrieval + LLM
# ============================================


@auditi.trace_agent(name="RAG Pipeline")
def rag_query(question: str) -> str:
    """
    A full RAG pipeline that uses embeddings, retrieval, and LLM calls.
    Each step creates a span within the parent trace.
    """
    # Step 1: Embed the question
    query_embedding = embed_single_text(question)

    # Step 2: Search for relevant docs
    docs = search_docs(question, top_k=3)

    # Step 3: Generate answer with context
    context = "\n".join([d["text"] for d in docs])
    answer = generate_answer(question, context)

    return answer


@auditi.trace_llm()
def generate_answer(question: str, context: str) -> str:
    """
    Generate answer using retrieved context.
    """
    prompt = f"Context:\n{context}\n\nQuestion: {question}\nAnswer:"
    try:
        from openai import OpenAI

        client = OpenAI()
        response = client.chat.completions.create(
            model="gpt-4o-mini", messages=[{"role": "user", "content": prompt}]
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"[Mock Answer] Based on the context: {context[:50]}..."


# ============================================
# RUN EXAMPLES
# ============================================
if __name__ == "__main__":
    print("=" * 60)
    print("Testing Embedding and Retrieval Traces")
    print("=" * 60)

    # Example 1: Single embedding (standalone)
    print("\n1. Single text embedding (standalone trace):")
    vec = embed_single_text("Hello, world!")
    print(f"   Embedding dims: {len(vec)}, First 3 values: {vec[:3]}")

    # Example 2: Batch embedding (standalone)
    print("\n2. Batch embeddings (standalone trace):")
    texts = ["Document 1", "Document 2", "Document 3"]
    vecs = embed_batch(texts)
    print(f"   Generated {len(vecs)} embeddings")

    # Example 3: Vector search (standalone)
    print("\n3. Vector search (standalone trace):")
    results = search_docs("What is machine learning?")
    print(f"   Found {len(results)} results")
    for r in results:
        print(f"     - {r['id']}: score={r['score']:.2f}")

    # Example 4: Hybrid search (standalone)
    print("\n4. Hybrid search (standalone trace):")
    results = hybrid_search("neural networks")
    print(f"   Semantic: {len(results['semantic_results'])}")
    print(f"   Keyword: {len(results['keyword_results'])}")
    print(f"   Combined: {len(results['combined_results'])}")

    # Example 5: Full RAG pipeline (agent trace with spans)
    print("\n5. Full RAG pipeline (agent trace with nested spans):")
    answer = rag_query("What is Python?")
    print(f"   Answer: {answer[:100]}...")

    print("\n" + "=" * 60)
    print("✓ All examples completed!")
    print("Check your Auditi dashboard to see the traces.")
    print("=" * 60)
