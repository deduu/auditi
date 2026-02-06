import auditi, os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()  # Load environment variables from .env file

# Initialize and auto-instrument all LLM libraries
auditi.init()
auditi.instrument()

# Your existing code works unchanged!
client = OpenAI(base_url=os.getenv("OPENAI_API_BASE_URL"), api_key=os.getenv("OPENAI_API_KEY"))
response = client.chat.completions.create(
    model="Kimi-K2-Thinking",
    messages=[{"role": "user", "content": "How to create skills in claude code and then register as slash command? For example, skills for finetuning can be called /finetune"}],
)
print(response)