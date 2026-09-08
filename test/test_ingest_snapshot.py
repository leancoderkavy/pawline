import io
import json
import unittest
from unittest.mock import patch
import requests
from scripts.ingest import fetch_snapshot, normalize, snapshot_records, validate_snapshot_size, safe_public_url

def response(rows, code=200):
    result=requests.Response()
    result.status_code=code
    result.raw=io.BytesIO(json.dumps(rows).encode())
    result.headers={}
    return result

class SnapshotTests(unittest.TestCase):
    def setUp(self):
        self.source={"id":"s", "url":"https://example.test/feed", "kind":"json", "parser_config":{"mapping":{"external_id":"id","name":"name","species":"species"},"pagination":{"page_size":2,"max_pages":3}}}

    @patch("scripts.ingest.safe_public_url",side_effect=lambda x:x)
    def test_pages_are_complete_and_redirects_disabled(self,_):
        seen=[]
        def fetch(url,**kwargs):
            seen.append(url);self.assertFalse(kwargs["allow_redirects"])
            return response([{"id":"1"},{"id":"2"}] if len(seen)==1 else [{"id":"3"}])
        rows,_=fetch_snapshot(self.source,fetch)
        self.assertEqual(len(rows),3)
        self.assertIn("%24offset=2",seen[1])

    @patch("scripts.ingest.safe_public_url",side_effect=lambda x:x)
    def test_repeated_or_truncated_page_and_redirect_fail(self,_):
        with self.assertRaisesRegex(ValueError,"repeated"):
            fetch_snapshot(self.source,lambda *a,**k:response([{"id":1},{"id":2}]))
        with self.assertRaisesRegex(ValueError,"redirect"):
            fetch_snapshot(self.source,lambda *a,**k:response([],302))
        short={**self.source,"parser_config":{**self.source["parser_config"],"pagination":{"page_size":1,"max_pages":1}}}
        with self.assertRaisesRegex(ValueError,"incomplete"):
            fetch_snapshot(short,lambda *a,**k:response([{"id":1}]))

    def test_drop_and_identity_guards(self):
        with self.assertRaisesRegex(ValueError,"quarantined"):validate_snapshot_size(100,20,self.source)
        validate_snapshot_size(100,75,self.source)
        record={"id":"1","name":"Hopper","species":"Rabbit"}
        self.assertEqual(normalize(record,self.source)["species"],"Rabbit")
        self.assertIsNone(normalize({"name":"Hopper","species":"Rabbit"},self.source))
        with self.assertRaisesRegex(ValueError,"Duplicate"):snapshot_records([record,record],self.source)

    def test_private_urls_and_invalid_json_truncation(self):
        for url in ["http://example.test", "https://user:pass@example.test", "https://example.test:8000/feed"]:
            with self.assertRaises(ValueError):safe_public_url(url)
        pet=normalize({"id":"1","name":"Hopper","species":"Rabbit","big":"a"*100001},self.source)
        self.assertIsInstance(json.loads(pet["raw_payload"]),dict)

if __name__=="__main__":unittest.main()
