#!/usr/bin/env python3
"""Synthetic-only storage probe on a NEW dedicated emulator."""
import argparse, pathlib, re, subprocess, sys, time
PACKAGE = 'com.kukjun.nolleoon.receiptprobe'
ACTIVITY = 'com.kukjun.nolleoon.MainActivity'
STEPS = ('seed', 'check-pending', 'confirm', 'check-confirmed', 'clear', 'check-clear')
def run(adb, serial, *args):
    return subprocess.run([adb, '-s', serial, *args], check=True, text=True,
                          capture_output=True, timeout=30).stdout.strip()
def main():
    p = argparse.ArgumentParser(description=__doc__)
    for arg in ('adb', 'serial', 'apk', 'aapt'): p.add_argument('--'+arg, required=True)
    a = p.parse_args()
    if not re.fullmatch(r'emulator-[0-9]+', a.serial): raise ValueError('Explicit emulator required')
    if not pathlib.Path(a.apk).is_file(): raise ValueError('Probe APK required')
    if run(a.adb,a.serial,'shell','getprop','ro.kernel.qemu') != '1': raise ValueError('Not emulator')
    avd=run(a.adb,a.serial,'emu','avd','name').splitlines()[0]
    if not re.fullmatch(r'nolleoon_receipt_probe_api[0-9]+',avd): raise ValueError('Dedicated AVD required')
    if run(a.adb,a.serial,'shell','pm','list','packages',PACKAGE): raise ValueError('Use a new AVD, package exists')
    badging=subprocess.run([a.aapt,'dump','badging',a.apk],check=True,text=True,capture_output=True,timeout=30).stdout
    if f"package: name='{PACKAGE}'" not in badging or 'application-debuggable' not in badging:
        raise ValueError('Wrong package or non-debug APK')
    run(a.adb,a.serial,'install',a.apk)
    expiry=int(time.time()*1000)+30*86400000-60000
    try:
        previous_pid=None
        for step in STEPS:
            run(a.adb,a.serial,'shell','am','start','-W','-n',f'{PACKAGE}/{ACTIVITY}','--es','route',f'/receipt-probe/{step}/{expiry}')
            pid=run(a.adb,a.serial,'shell','pidof',PACKAGE)
            if not re.fullmatch(r'[0-9]+',pid) or pid==previous_pid: raise RuntimeError('Fresh process not observed')
            deadline=time.monotonic()+90
            while True:
                output=run(a.adb,a.serial,'logcat','-d','--pid',pid,'-s','flutter:I','*:S')
                # Never print logcat contents or storage values.
                if f'RECEIPT_PROBE {step} FAIL' in output: raise RuntimeError('Stage failed')
                if f'RECEIPT_PROBE {step} PASS' in output: break
                if time.monotonic()>=deadline: raise RuntimeError('No acknowledgement')
                time.sleep(.25)
            print(f'{step}: PASS (process {pid})',flush=True)
            run(a.adb,a.serial,'shell','am','force-stop',PACKAGE)
            remaining=subprocess.run([a.adb,'-s',a.serial,'shell','pidof',PACKAGE],text=True,capture_output=True,timeout=10)
            if remaining.stdout.strip(): raise RuntimeError('Process remained')
            previous_pid=pid
        print('Six stages passed; no reinstall/clear-data between stages.')
    finally:
        run(a.adb,a.serial,'shell','am','force-stop',PACKAGE)
if __name__=='__main__':
    try: main()
    except Exception:
        print('Receipt probe stopped: prerequisites or verification failed. No success claimed.',file=sys.stderr)
        sys.exit(1)
