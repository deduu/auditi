import sys
import os

# Add sdk to path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

try:
    import auditi
    from auditi.transport import BaseTransport
    from typing import Dict, Any

    class CaptureTransport(BaseTransport):
        def __init__(self):
            self.traces = []
        
        def send_trace(self, trace_data: Dict[str, Any]):
            self.traces.append(trace_data)
            print(f"Captured trace: {trace_data['id']}")

    capture = CaptureTransport()
    auditi.init(transport=capture)
except Exception as e:
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test 1: Global Context
print("Running Test 1: Global Context & Input Extraction...")
auditi.set_context(user_id="user_global", session_id="session_global")

@auditi.trace_agent(name="TestAgent")
def my_agent(query):
    return f"Response to {query}"

my_agent("Hello World")

if not capture.traces:
    print("FAILED: No trace captured")
    sys.exit(1)

trace = capture.traces[-1]
print(f"Trace User ID: {trace.get('user_id')}")
print(f"Trace Session ID: {trace.get('conversation_id')}")
print(f"Trace Input: {trace.get('user_input')}")

assert trace.get('user_id') == "user_global", f"Expected user_global, got {trace.get('user_id')}"
assert trace.get('conversation_id') == "session_global", f"Expected session_global, got {trace.get('conversation_id')}"
assert trace.get('user_input') == "Hello World", f"Expected 'Hello World', got {trace.get('user_input')}"
print("Test 1 Passed")

# Test 2: Model Detection
print("\nRunning Test 2: Model Auto-detection...")
class LLMService:
    def __init__(self):
        self.model = "gpt-4-turbo"

    @auditi.trace_llm() # No model passed
    def generate(self, prompt):
        return "generated text"

service = LLMService()

# Re-run agent to capture span
@auditi.trace_agent()
def agent_with_llm(q):
    return service.generate(q)

agent_with_llm("run 2")
trace2 = capture.traces[-1]
if not trace2.get('spans'):
    print("FAILED: No spans captured")
    sys.exit(1)

span = trace2['spans'][0]
print(f"Span Model: {span.get('model')}")
assert span.get('model') == "gpt-4-turbo", f"Expected gpt-4-turbo, got {span.get('model')}"
print("Test 2 Passed")

print("\nALL TESTS PASSED")
