import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:nolleoon_mobile/main.dart';
import 'package:nolleoon_mobile/auth/auth_repository.dart';

import '../test/auth_test.dart' as f;
import '../test/receipt_fake.dart';
import '../test/app/features/feature_wiring_test.dart' as shell;

void main() {
  testWidgets('synthetic rendered 390x844 six-stage style evidence', (
    tester,
  ) async {
    final output = Directory(
      Platform.environment['STYLE_EVIDENCE_OUTPUT_DIR'] ??
          '../../artifacts/style-evidence/before/flutter',
    );
    final stages = [
      '00-auth',
      '01-home',
      '02-lobby',
      '03-selection',
      '04-team-ready',
      '05-team-result',
    ];
    if (stages.any((stage) => File('${output.path}/$stage.png').existsSync())) {
      fail('Evidence already exists; choose a fresh STYLE_EVIDENCE_OUTPUT_DIR');
    }
    output.createSync(recursive: true);
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    // Host font stays local; no font redistribution or claim of native typography.
    final bytes = File('/System/Library/Fonts/AppleSDGothicNeo.ttc')
        .readAsBytesSync();
    for (final family in [
      'Roboto',
      '.SF UI Text',
      '.SF UI Display',
      'Apple SD Gothic Neo',
    ]) {
      await (FontLoader(
        family,
      )..addFont(Future.value(ByteData.sublistView(bytes)))).load();
    }
    final icons = File(Platform.environment['STYLE_EVIDENCE_ICON_FONT']!)
        .readAsBytesSync();
    await (FontLoader(
      'MaterialIcons',
    )..addFont(Future.value(ByteData.sublistView(icons)))).load();
    final auth = AuthRepository(
      identity: f.Provider(),
      backend: shell.ShellBackend(),
      store: f.Store(),
    );
    final transport = shell.ShellTransport();
    final key = GlobalKey();
    await tester.pumpWidget(
      RepaintBoundary(
        key: key,
        child: ColoredBox(
          color: const Color(0xffffffff),
          child: MyApp(
            deletionReceiptStore: ReceiptFake(),
            auth: auth,
            transport: transport,
          ),
        ),
      ),
    );
    Future<void> capture(String stage) async {
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      await tester.runAsync(() async {
        final boundary =
            key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
        final image = await boundary.toImage(pixelRatio: 1);
        final png = await image.toByteData(format: ui.ImageByteFormat.png);
        File('${output.path}/$stage.png')
            .writeAsBytesSync(png!.buffer.asUint8List());
        image.dispose();
      });
    }

    Future<void> tap(String text) async {
      await tester.scrollUntilVisible(
        find.text(text),
        150,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.text(text));
      await tester.pumpAndSettle();
    }

    await tester.pumpAndSettle();
    await capture('00-auth');
    await tester.tap(find.text('카카오로 로그인'));
    await tester.pumpAndSettle();
    await capture('01-home');
    await tester.tap(find.text('합성 여행'));
    await tester.pumpAndSettle();
    await capture('02-lobby');
    await tap('새 게임');
    await capture('03-selection');
    await tap('첫 사람');
    await tap('둘째 사람');
    await tap('게임 설정');
    await tester.tap(find.text('설정 적용'));
    await tester.pumpAndSettle();
    await capture('04-team-ready');
    await tap('게임 시작');
    await capture('05-team-result');
    await tester.pumpWidget(const SizedBox.shrink());
    auth.dispose();
  });
}
