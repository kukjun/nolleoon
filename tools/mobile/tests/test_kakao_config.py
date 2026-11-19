import base64, importlib.util, pathlib, unittest
ROOT=pathlib.Path(__file__).resolve().parents[3]
spec=importlib.util.spec_from_file_location('kakao',ROOT/'apps/mobile/ios/Flutter/kakao_info.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def encoded(*items):return ','.join(base64.b64encode(x.encode()).decode() for x in items)
class KakaoConfig(unittest.TestCase):
 def test_default_no_callback_or_queries(self):
  self.assertEqual(m.callback_config(''),(False,'nolleoon-kakao-disabled'))
  self.assertEqual(m.render({'CFBundleIdentifier':'$(PRODUCT_BUNDLE_IDENTIFIER)'},''),{'CFBundleIdentifier':'$(PRODUCT_BUNDLE_IDENTIFIER)'})
 def test_same_native_define_login_only(self):
  defines=encoded('KAKAO_NATIVE_APP_KEY='+'a'*32,'NATIVE_AUTH_PLATFORM_VERIFIED=true')
  enabled,scheme=m.callback_config(defines);self.assertTrue(enabled);self.assertEqual(scheme,'kakao'+'a'*32)
  p=m.render({},defines)
  self.assertEqual(p['LSApplicationQueriesSchemes'],['kakaokompassauth'])
  self.assertEqual(p['CFBundleURLTypes'][0]['CFBundleURLSchemes'],[scheme])
 def test_bad_key_duplicates_and_forbidden_keys_fail_closed(self):
  for raw in [encoded('NATIVE_AUTH_PLATFORM_VERIFIED=true'),encoded('KAKAO_NATIVE_APP_KEY=bad'),encoded('KAKAO_NATIVE_APP_KEY='+'a'*32,'KAKAO_NATIVE_APP_KEY='+'b'*32),encoded('NATIVE_AUTH_PLATFORM_VERIFIED=yes'),encoded('KAKAO_ADMIN_KEY=forbidden'),'!!!']:
   with self.assertRaises(ValueError):m.callback_config(raw)
 def test_key_without_verification_stays_off(self):
  self.assertEqual(m.callback_config(encoded('KAKAO_NATIVE_APP_KEY='+'a'*32)),(False,'nolleoon-kakao-disabled'))
 def test_local_test_requires_debug_separate_bundle_and_explicit_loopback(self):
  raw=encoded('NATIVE_LOOPBACK_TEST_BUILD=true','NATIVE_LOOPBACK_ORIGIN=http://127.0.0.1:4190')
  self.assertEqual(m.render({},raw,'Debug','com.example.nolleoonMobile.localprobe'),{})
  for configuration,bundle in [('Release','com.example.nolleoonMobile.localprobe'),('Debug','com.example.nolleoonMobile')]:
   with self.assertRaises(ValueError):m.render({},raw,configuration,bundle)
  for bad in [encoded('NATIVE_LOOPBACK_TEST_BUILD=true'),encoded('NATIVE_LOOPBACK_ORIGIN=http://127.0.0.1:4190'),encoded('NATIVE_LOOPBACK_TEST_BUILD=true','NATIVE_LOOPBACK_ORIGIN=https://evil.test:443')]:
   with self.assertRaises(ValueError):m.callback_config(bad)
if __name__=='__main__':unittest.main()
