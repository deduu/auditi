import auditi, os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()  # Load environment variables from .env file

# Initialize and auto-instrument all LLM libraries
auditi.init(api_key= os.getenv("AUDITI_API_KEY"),user_id="user_xxx")
auditi.instrument()

# Your existing code works unchanged!
client = OpenAI(base_url=os.getenv("OPENAI_API_BASE_URL"), api_key=os.getenv("OPENAI_API_KEY"))
# response = client.chat.completions.create(
#     model="Kimi-K2-Thinking",
#     messages=[{"role": "user", "content": "How to create skills in claude code and then register as slash command? For example, skills for finetuning can be called /finetune"}],
# )
# print(response)

stream = client.responses.create(
    model="gpt-4o",
    input="How to learn programming GPU kernels?",
    stream=True,
)

for event in stream:
    if hasattr(event, 'delta') and event.delta:
        print(event.delta, end="", flush=True)

# print(response.output_text)