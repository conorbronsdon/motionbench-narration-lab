"""No live API calls: invalid input must not spend; errors must not retain secrets."""
import argparse
from contextlib import redirect_stdout
from decimal import Decimal
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('generate', Path(__file__).resolve().parents[1]/'tools/generate.py')
generate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generate)

class GenerationControls(unittest.TestCase):
    def args(self, root, brief, execute=True):
        source = root/'brief.json'
        source.write_text(json.dumps(brief), encoding='utf-8')
        return argparse.Namespace(brief=source, out=root/'new-output', execute=execute,
            repair_html=None, failures=None, max_tokens=1024, max_cost_usd=Decimal('.05'),
            model='deepseek-v4.1-flash-fast')

    def test_invalid_contract_does_not_create_output_or_contact_provider(self):
        for brief in [{'reads':'not-an-array','formats':[{}]}, {'reads':[{}],'formats':{}}, {'reads':[],'formats':[{}]}]:
            with self.subTest(brief=brief), tempfile.TemporaryDirectory() as tmp, patch.object(generate.urllib.request,'build_opener') as network:
                args=self.args(Path(tmp),brief)
                with self.assertRaises(ValueError): generate.run(args)
                network.assert_not_called()
                self.assertFalse(Path(args.out).exists())

    def test_valid_dry_run_does_not_require_key_or_contact_provider(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(generate.urllib.request,'build_opener') as network, redirect_stdout(io.StringIO()):
            args=self.args(Path(tmp),{'reads':[{}],'formats':[{}]},execute=False)
            with patch.dict(os.environ, {}, clear=True): self.assertEqual(generate.run(args),0)
            network.assert_not_called()
            self.assertFalse(Path(args.out).exists())

    def test_provider_exception_does_not_leak_headers_or_exception_message(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(generate.urllib.request,'build_opener') as network, redirect_stdout(io.StringIO()) as output:
            args=self.args(Path(tmp),{'reads':[{}],'formats':[{}]})
            network.return_value.open.side_effect=OSError('transport-message-canary')
            with patch.dict(os.environ, {'CORALBRICKS_API_KEY':'test-key-canary'}):
                self.assertEqual(generate.run(args),1)
            serialized=(Path(args.out)/'usage.json').read_text()+output.getvalue()
            self.assertNotIn('transport-message-canary',serialized)
            self.assertNotIn('test-key-canary',serialized)
            self.assertEqual(json.loads((Path(args.out)/'usage.json').read_text())['error_type'],'OSError')

if __name__ == '__main__': unittest.main()
