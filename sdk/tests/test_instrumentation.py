import pytest
import sys
import importlib
from unittest.mock import MagicMock, patch
import auditi


class MockOpenAIHeader:
    def __init__(self, content):
        self.content = content


class MockOpenAIChoice:
    def __init__(self, content):
        self.message = MockOpenAIHeader(content)


class MockOpenAIResponse:
    def __init__(self, content):
        self.choices = [MockOpenAIChoice(content)]
        self.model = "gpt-4"
        self.usage = {"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30}


def test_instrumentation_patches_openai():
    """Test that OpenAI instrumentation patches correctly."""
    # Setup mock OpenAI response
    mock_create = MagicMock(return_value=MockOpenAIResponse("Hello world"))
    mock_async_create = MagicMock()

    # Configure mocks to return False for _is_auditi_patched check
    mock_create._is_auditi_patched = False
    mock_async_create._is_auditi_patched = False

    # Create mock Completions classes
    class MockCompletions:
        create = mock_create

    class MockAsyncCompletions:
        create = mock_async_create

    # Create mock module structure
    mock_openai = MagicMock()
    mock_openai.OpenAI = MagicMock()
    mock_openai.AsyncOpenAI = MagicMock()

    mock_completions_module = MagicMock()
    mock_completions_module.Completions = MockCompletions
    mock_completions_module.AsyncCompletions = MockAsyncCompletions

    # Inject mock modules into sys.modules
    with patch.dict(
        sys.modules,
        {
            "openai": mock_openai,
            "openai.resources": MagicMock(),
            "openai.resources.chat": MagicMock(),
            "openai.resources.chat.completions": mock_completions_module,
        },
    ):
        # Reload the instrumentation module to pick up the mocked modules
        import auditi.instrumentation
        importlib.reload(auditi.instrumentation)
        from auditi.instrumentation import instrument

        # Run instrumentation
        instrument(openai=True, anthropic=False, google=False)

        # Verify it was patched (the new create should have the _is_auditi_patched attribute)
        assert MockCompletions.create != mock_create
        assert getattr(MockCompletions.create, "_is_auditi_patched", False) == True

        # Setup auditi client mock
        mock_client = MagicMock()
        with patch("auditi.decorators.get_client", return_value=mock_client):
            # Create a dummy self
            dummy_self = MagicMock()

            # Call the patched method
            response = MockCompletions.create(dummy_self, model="gpt-4", messages=[])

            # Verify result passed through
            assert response.choices[0].message.content == "Hello world"

            # Verify client trace started (send_trace called)
            mock_client.transport.send_trace.assert_called()

            # Verify original create called
            mock_create.assert_called()


class MockGeminiCandidate:
    def __init__(self, text):
        self.text = text


class MockGeminiResponse:
    def __init__(self, text):
        self.text = text
        self.candidates = [MockGeminiCandidate(text)]
        self.usage_metadata = {
            "prompt_token_count": 10,
            "candidates_token_count": 20,
            "total_token_count": 30,
        }


def test_instrumentation_patches_google():
    """Test that Google Generative AI instrumentation patches correctly."""
    mock_generate = MagicMock(return_value=MockGeminiResponse("Hello from Gemini"))
    mock_generate_async = MagicMock()

    # Configure mocks to return False for _is_auditi_patched check
    mock_generate._is_auditi_patched = False
    mock_generate_async._is_auditi_patched = False

    # Create mock GenerativeModel class
    class MockGenerativeModel:
        generate_content = mock_generate
        generate_content_async = mock_generate_async

    # Create mock module structure
    mock_google = MagicMock()
    mock_genai = MagicMock()
    mock_genai.GenerativeModel = MockGenerativeModel

    # Inject mock modules into sys.modules
    with patch.dict(
        sys.modules,
        {
            "google": mock_google,
            "google.generativeai": mock_genai,
        },
    ):
        # Reload the instrumentation module to pick up the mocked modules
        import auditi.instrumentation
        importlib.reload(auditi.instrumentation)
        from auditi.instrumentation import instrument

        # Run instrumentation
        instrument(openai=False, anthropic=False, google=True)

        # Verify it was patched
        assert MockGenerativeModel.generate_content != mock_generate
        assert getattr(MockGenerativeModel.generate_content, "_is_auditi_patched", False) == True

        # Setup auditi client mock
        mock_client = MagicMock()
        with patch("auditi.decorators.get_client", return_value=mock_client):
            # Create a dummy self
            dummy_self = MagicMock()

            # Call the patched method
            response = MockGenerativeModel.generate_content(dummy_self, "Hello")

            # Verify result passed through
            assert response.text == "Hello from Gemini"

            # Verify client trace started
            mock_client.transport.send_trace.assert_called()

            # Verify original generate called
            mock_generate.assert_called()
