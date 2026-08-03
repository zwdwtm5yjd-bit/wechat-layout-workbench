import unittest

from docx_worker import __version__


class PackageTest(unittest.TestCase):
    def test_exposes_version(self) -> None:
        self.assertEqual(__version__, "0.1.0")


if __name__ == "__main__":
    unittest.main()
