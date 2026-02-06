"""
Bug #1: Missing pricing module — SDK cannot be imported.

Reproduce: `import auditi` raises ModuleNotFoundError for auditi.pricing
Fix: Create sdk/auditi/pricing.py with the required exports.
"""
import subprocess
import sys
import os

PRICING_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "auditi", "pricing.py"
)


def test_pricing_file_exists():
    """pricing.py must exist for the SDK to be importable."""
    assert os.path.exists(PRICING_PATH), (
        f"auditi/pricing.py does not exist at {PRICING_PATH}"
    )


def test_sdk_importable():
    """The SDK must be importable without errors."""
    result = subprocess.run(
        [sys.executable, "-c", "import auditi; print('OK')"],
        capture_output=True,
        text=True,
        cwd=os.path.join(os.path.dirname(__file__), "..", ".."),
    )
    assert result.returncode == 0, (
        f"import auditi failed:\n{result.stderr}"
    )
    assert "OK" in result.stdout


def test_pricing_exports():
    """pricing.py must export get_pricing_manager and configure_pricing."""
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "from auditi.pricing import get_pricing_manager, configure_pricing; "
            "pm = get_pricing_manager(); "
            "assert hasattr(pm, 'set_base_url'); "
            "assert hasattr(pm, 'get_pricing'); "
            "print('OK')",
        ],
        capture_output=True,
        text=True,
        cwd=os.path.join(os.path.dirname(__file__), "..", ".."),
    )
    assert result.returncode == 0, (
        f"pricing exports broken:\n{result.stderr}"
    )
    assert "OK" in result.stdout
