import json
import tempfile
import unittest
from pathlib import Path

from spark_jobs.contracts import DEFAULT_SCENARIOS, load_scenarios, parse_symbols


class SparkInputContractTests(unittest.TestCase):
    def test_symbols_are_normalized_and_deduplicated(self):
        self.assertEqual(parse_symbols("aapl, MSFT,AAPL"), ["AAPL", "MSFT"])

    def test_symbols_can_be_loaded_from_file(self):
        with tempfile.TemporaryDirectory() as directory:
            symbols_file = Path(directory) / "symbols.txt"
            symbols_file.write_text("# universe\naapl\nmsft\n")
            self.assertEqual(parse_symbols(symbols_file=symbols_file), ["AAPL", "MSFT"])

    def test_default_stress_scenarios_are_available(self):
        self.assertEqual(load_scenarios(), DEFAULT_SCENARIOS)

    def test_scenario_file_supports_wildcard_and_ticker_overrides(self):
        with tempfile.TemporaryDirectory() as directory:
            scenario_file = Path(directory) / "scenarios.json"
            scenario_file.write_text(json.dumps({"tech_selloff": {"*": -0.1, "aapl": -0.3}}))
            self.assertEqual(
                load_scenarios(scenario_file),
                {"tech_selloff": {"*": -0.1, "AAPL": -0.3}},
            )

    def test_invalid_scenario_shock_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            scenario_file = Path(directory) / "scenarios.json"
            scenario_file.write_text(json.dumps({"bad": {"*": -1.5}}))
            with self.assertRaises(ValueError):
                load_scenarios(scenario_file)


if __name__ == "__main__":
    unittest.main()