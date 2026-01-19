import sys
import os
from uuid import uuid4
import time

# Add root to path so we can import sdk
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sdk import trace_agent, trace_llm, trace_tool, BaseEvaluator, EvaluationResult, TraceInput, init

# Initialize with local backend
init(base_url="http://localhost:3000/api")

class SimpleEvaluator(BaseEvaluator):
    def evaluate(self, trace: TraceInput) -> EvaluationResult:
        # Simple logic: if 'error' in output, fail it
        if "error" in trace.assistant_output.lower():
            return EvaluationResult(
                status="fail",
                score=2.0,
                reason="Agent returned an error message",
                failure_mode="Technical Error",
                recommended_action="Check logs and retry"
            )
        return EvaluationResult(
            status="pass",
            score=9.0,
            reason="Response looks good and tools were called correctly",
            recommended_action="None"
        )

@trace_tool(name="search_database")
def search_db(query: str):
    print(f"Searching DB for: {query}")
    time.sleep(0.5)
    return f"Results for {query}: [Record 1, Record 2]"

@trace_llm(name="generate_response", model="gpt-4o")
def call_llm(prompt: str):
    print("Calling LLM...")
    time.sleep(1)
    return "Based on the database, you have 2 records found."

@trace_agent(user_id="user_test_1", evaluator=SimpleEvaluator())
def my_agent(query: str, session_id: str = None):
    print(f"Agent received query: {query}")
    
    # Tool call
    results = search_db(query)
    
    # LLM call
    response = call_llm(f"User asked: {query}. Data found: {results}")
    
    return response

if __name__ == "__main__":
    # Ensure backend is running before running this
    session_id = str(uuid4())
    print(f"Starting agent session: {session_id}")
    
    try:
        result = my_agent("Tell me about my recent records", session_id=session_id)
        print(f"Agent Response: {result}")
    except Exception as e:
        print(f"Agent failed: {e}")
