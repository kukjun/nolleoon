import importlib.util, pathlib, tempfile, unittest
from types import SimpleNamespace
from unittest.mock import patch
path=pathlib.Path(__file__).resolve().parents[1]/'run-receipt-probe.py'
spec=importlib.util.spec_from_file_location('probe',path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class DriverTests(unittest.TestCase):
 def test_six_fresh_processes_one_install_no_devicewide_clear(self):
  calls=[];state={'pid':100,'step':''}
  def adb(_,serial,*args):
   self.assertEqual(serial,'emulator-5554');calls.append(args)
   if args==('shell','getprop','ro.kernel.qemu'):return '1'
   if args==('emu','avd','name'):return 'nolleoon_receipt_probe_api36\nOK'
   if args[:4]==('shell','pm','list','packages'):return ''
   if args[:3]==('shell','am','start'):
    state['pid']+=1;state['step']=args[-1].split('/')[2];return ''
   if args[:2]==('shell','pidof'):return str(state['pid'])
   if args[0]=='logcat':return 'RECEIPT_PROBE '+state['step']+' PASS'
   return ''
  def process(args,**kwargs):
   return SimpleNamespace(stdout=f"package: name='{m.PACKAGE}'\napplication-debuggable" if args[0]=='aapt' else '')
  with tempfile.NamedTemporaryFile() as apk,patch('builtins.print'),patch.object(m,'run',side_effect=adb),patch.object(m.subprocess,'run',side_effect=process),patch('sys.argv',['probe','--adb','adb','--aapt','aapt','--serial','emulator-5554','--apk',apk.name]):m.main()
  self.assertEqual(sum(x[0]=='install' for x in calls),1)
  self.assertEqual(sum(x[:3]==('shell','am','start') for x in calls),6)
  self.assertFalse(any('clear' in x for x in calls))
  self.assertEqual(len({x[-1].split('/')[-1] for x in calls if x[:3]==('shell','am','start')}),1)
 def test_physical_serial_rejected_before_any_adb(self):
  with patch.object(m,'run') as adb,patch('sys.argv',['probe','--adb','adb','--aapt','aapt','--serial','physical','--apk','unused']):
   with self.assertRaises(ValueError):m.main()
   adb.assert_not_called()
 def test_existing_install_is_not_read_or_reused(self):
  calls=[]
  def adb(_,serial,*args):
   calls.append(args)
   return '1' if args[0]=='shell' and args[1]=='getprop' else ('nolleoon_receipt_probe_api36\nOK' if args[0]=='emu' else 'package:'+m.PACKAGE)
  with tempfile.NamedTemporaryFile() as apk,patch.object(m,'run',side_effect=adb),patch('sys.argv',['probe','--adb','adb','--aapt','aapt','--serial','emulator-5554','--apk',apk.name]):
   with self.assertRaises(ValueError):m.main()
  self.assertFalse(any(x[0]=='install' or 'start' in x for x in calls))
if __name__=='__main__':unittest.main()
