import json
from pathlib import Path


DEFAULT_SCENARIOS = {
    "market_correction": {"*": -0.20},
    "severe_bear_market": {"*": -0.35},
    "crash_scenario": {"*": -0.50},
}


def parse_symbols(raw_symbols="", symbols_file=None):
    symbols = [item.strip().upper() for item in raw_symbols.split(",") if item.strip()]
    if symbols_file:
        symbols.extend(
            line.strip().upper()
            for line in Path(symbols_file).read_text().splitlines()
            if line.strip() and not line.lstrip().startswith("#")
        )
    unique_symbols = list(dict.fromkeys(symbols))
    if not unique_symbols:
        raise ValueError("Provide symbols with --tickers or --symbols-file")
    return unique_symbols


def load_scenarios(path=None):
    if path is None:
        return DEFAULT_SCENARIOS.copy()

    scenarios = json.loads(Path(path).read_text())
    if not isinstance(scenarios, dict) or not scenarios:
        raise ValueError("Scenario configuration must be a non-empty JSON object")

    validated = {}
    for name, shocks in scenarios.items():
        if not isinstance(name, str) or not name.strip():
            raise ValueError("Scenario names must be non-empty strings")
        if isinstance(shocks, (int, float)):
            shocks = {"*": shocks}
        if not isinstance(shocks, dict) or not shocks:
            raise ValueError("Each scenario must map tickers to decimal returns")
        validated_shocks = {}
        for ticker, shock in shocks.items():
            if not isinstance(ticker, str) or not ticker.strip():
                raise ValueError("Scenario ticker keys must be non-empty strings")
            if isinstance(shock, bool) or not isinstance(shock, (int, float)):
                raise ValueError("Scenario shocks must be numeric decimal returns")
            if not -1.0 <= shock <= 1.0:
                raise ValueError("Scenario shocks must be between -1.0 and 1.0")
            validated_shocks[ticker.strip().upper()] = float(shock)
        validated[name.strip()] = validated_shocks
    return validated