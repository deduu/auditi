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
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}]
)