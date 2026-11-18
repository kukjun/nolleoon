import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('single handler, explicit internet and both backup modes exclude credential preferences', () {
    final manifest = File('android/app/src/main/AndroidManifest.xml')
        .readAsStringSync();
    expect(manifest, contains('android.permission.INTERNET'));
    expect(manifest, contains('android:allowBackup="false"'));
    expect(
      manifest,
      contains('android:dataExtractionRules="@xml/data_extraction_rules"'),
    );
    expect(manifest, contains('android:fullBackupContent="@xml/backup_rules"'));
    expect(
      manifest,
      contains('flutter_deeplinking_enabled" android:value="false"'),
    );
    expect(manifest, isNot(contains('android:autoVerify')));
    final rules = File('android/app/src/main/res/xml/data_extraction_rules.xml')
        .readAsStringSync();
    for (final mode in ['cloud-backup', 'device-transfer']) {
      final block = RegExp('<$mode>([\\s\\S]*?)</$mode>')
          .firstMatch(rules)!
          .group(1)!;
      expect(block, contains('<exclude domain="sharedpref" path="." />'));
      expect(
        block,
        contains('<exclude domain="device_sharedpref" path="." />'),
      );
    }
    expect(
      File('android/app/src/main/res/xml/backup_rules.xml').readAsStringSync(),
      contains('<exclude domain="sharedpref" path="." />'),
    );
    final plist = File('ios/Runner/Info.plist').readAsStringSync();
    expect(plist, contains('<key>FlutterDeepLinkingEnabled</key>'));
    expect(plist, isNot(contains('NSAllowsArbitraryLoads')));
  });
}
