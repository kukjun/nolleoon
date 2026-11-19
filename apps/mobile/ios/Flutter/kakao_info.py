#!/usr/bin/env python3
"""Generate build-only iOS plist from the SAME Flutter defines; never log values."""
import base64, os, pathlib, plistlib, re, sys

def callback_config(raw):
    selected={}
    for item in raw.split(',') if raw else []:
        try:
            text=base64.b64decode(item,validate=True).decode('utf-8');name,sep,value=text.partition('=')
        except Exception: raise ValueError('Invalid native configuration') from None
        if not sep: raise ValueError('Invalid native configuration')
        if name in ('KAKAO_ADMIN_KEY','KAKAO_REST_API_KEY'): raise ValueError('Forbidden credential type')
        if name in ('KAKAO_NATIVE_APP_KEY','NATIVE_AUTH_PLATFORM_VERIFIED','NATIVE_LOOPBACK_TEST_BUILD','NATIVE_LOOPBACK_ORIGIN','NATIVE_KAKAO_VERIFICATION_BUILD'):
            if name in selected: raise ValueError('Duplicate native configuration')
            selected[name]=value
    test=selected.get('NATIVE_LOOPBACK_TEST_BUILD','false')
    verification=selected.get('NATIVE_KAKAO_VERIFICATION_BUILD','false')
    local=test=='true' or verification=='true'
    origin=selected.get('NATIVE_LOOPBACK_ORIGIN','')
    match=re.fullmatch(r'http://(127\.0\.0\.1|\[::1\]):([0-9]+)',origin)
    if test not in ('true','false') or verification not in ('true','false') or (test=='true' and verification=='true') or (not local and origin) or (local and (not match or not 1<=int(match.group(2))<=65535)):
        raise ValueError('Invalid local test configuration')
    key=selected.get('KAKAO_NATIVE_APP_KEY','');verified=selected.get('NATIVE_AUTH_PLATFORM_VERIFIED','false')
    if verified not in ('true','false') or (key and not re.fullmatch('[a-f0-9]{32}',key)) or (verified=='true' and not key):
        raise ValueError('Invalid native configuration')
    enabled=verified=='true' and bool(key)
    if verification=='true' and not enabled: raise ValueError('Verification requires configured native callback')
    return enabled,'kakao'+key if enabled else 'nolleoon-kakao-disabled'

def render(template,raw,configuration=None,bundle_id=None):
    decoded=[base64.b64decode(item,validate=True).decode('utf-8') for item in raw.split(',')] if raw else []
    test='NATIVE_LOOPBACK_TEST_BUILD=true' in decoded
    verification='NATIVE_KAKAO_VERIFICATION_BUILD=true' in decoded
    if verification and (configuration!='Debug' or bundle_id!='com.kukjun.nolleoon'):
        raise ValueError('Verification requires final debug application identity')
    if test and (configuration!='Debug' or bundle_id!='com.kukjun.nolleoon.localprobe'):
        raise ValueError('Local test build requires separate debug application identity')
    if not test and bundle_id and bundle_id.endswith('.localprobe'):
        raise ValueError('Unexpected local test application identity')
    enabled,scheme=callback_config(raw)
    result=dict(template)
    if 'CFBundleURLTypes' in result or 'LSApplicationQueriesSchemes' in result:
        raise ValueError('Unexpected callback template')
    if enabled:
        result['CFBundleURLTypes']=[{'CFBundleTypeRole':'Editor','CFBundleURLSchemes':[scheme]}]
        result['LSApplicationQueriesSchemes']=['kakaokompassauth']
    return result

if __name__=='__main__':
    try:
        source,output=map(pathlib.Path,sys.argv[1:])
        result=render(plistlib.loads(source.read_bytes()),os.environ.get('DART_DEFINES',''),os.environ.get('CONFIGURATION'),os.environ.get('PRODUCT_BUNDLE_IDENTIFIER'))
        output.parent.mkdir(parents=True,exist_ok=True)
        temporary=output.with_suffix('.tmp')
        temporary.write_bytes(plistlib.dumps(result))
        temporary.replace(output)
    except Exception:
        sys.exit('Native callback configuration is invalid; values were not logged.')
