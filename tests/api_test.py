import unittest

from api.server import CSVRepository, allowed_origin, allowed_retailer_url


class ApiValidationTests(unittest.TestCase):
    def test_csv_repository_contract(self):
        repository = CSVRepository()
        result = repository.search({'name': ['Muga Reserva 750 ml'], 'limit': ['1']})
        self.assertTrue(result['products'])
        report = repository.history(result['products'][0]['id'])
        self.assertIn('statistics', report)
        self.assertEqual(repository.health()['database'], 'csv')

    def test_allows_configured_extension_origin_prefix(self):
        self.assertTrue(allowed_origin("chrome-extension://abcdefghijklmnop"))
        self.assertFalse(allowed_origin("https://evil.example"))

    def test_rejects_non_https_or_unknown_retailer(self):
        self.assertTrue(allowed_retailer_url("https://www.vinoteca.com/example/p"))
        self.assertFalse(allowed_retailer_url("http://www.vinoteca.com/example/p"))
        self.assertFalse(allowed_retailer_url("https://evil.example/example/p"))


if __name__ == "__main__":
    unittest.main()
