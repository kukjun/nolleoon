import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:nolleoon_mobile/main.dart';
import 'package:nolleoon_mobile/auth/auth_repository.dart';
import 'package:nolleoon_mobile/data/api_client.dart';
import 'package:nolleoon_mobile/data/avatar_client.dart';
import 'package:nolleoon_mobile/features/profile/photo_source.dart';

import '../../auth_test.dart' as f;
import '../../receipt_fake.dart';
import 'feature_wiring_test.dart' as shell;

class Source implements ProfilePhotoSource {
  late Uint8List original;
  Completer<PhotoInput?>? pending;
  int calls = 0;
  @override
  Future<PhotoInput?> pick() async {
    calls++;
    return pending == null
        ? PhotoInput(Uint8List.fromList(original), 'image/webp')
        : pending!.future;
  }
}

class DelayedBackend extends shell.ShellBackend {
  Completer<AuthSession>? held;
  AuthSession? next;
  @override
  AuthSession get session => next ?? super.session;
  @override
  Future<AuthSession> probe(String token) async =>
      held == null ? super.probe(token) : held!.future;
}

class UploadTransport extends shell.ShellTransport
    implements AvatarBinaryTransport {
  int uploads = 0;
  bool fail = false;
  @override
  Future<AvatarBinaryResponse> sendAvatar(
    AvatarBinaryRequest r,
    CancellationToken c,
  ) async {
    expect(r.method, 'PUT');
    expect(r.uri.path, '/api/native/account/avatar/image');
    expect(r.headers['Authorization'], 'Bearer ${'a' * 43}');
    expect(r.headers.containsKey('Cookie'), false);
    expect(r.headers['Content-Type'], 'image/png');
    expect(r.body!.length, lessThanOrEqualTo(1048576));
    uploads++;
    return AvatarBinaryResponse(
      fail ? 503 : 200,
      'application/json',
      Uint8List.fromList(
        utf8.encode(
          jsonEncode(
            fail
                ? {
                    'error': {'code': 'TEMPORARILY_UNAVAILABLE'},
                  }
                : {
                    'kind': 'image',
                    'presetId': null,
                    'revision': 1,
                    'imageUrl': '/api/native/account/avatar/image?v=1',
                  },
          ),
        ),
      ),
    );
  }
}

Future<void> openPicker(WidgetTester t) async {
  await t.tap(find.text('캐릭터·사진 바꾸기'));
  await t.pumpAndSettle();
  await t.scrollUntilVisible(
    find.text('내 사진 선택'),
    200,
    scrollable: find.byType(Scrollable).first,
  );
  await t.runAsync(() async {
    await t.tap(find.text('내 사진 선택'));
    await Future<void>.delayed(const Duration(milliseconds: 80));
  });
  await t.pumpAndSettle();
}

void main() {
  for (final failure in [false, true]) {
    testWidgets(
      'root injected photo previews before explicit save (failure=$failure)',
      (t) async {
        final source = Source();
        await t.runAsync(() async {
          source.original = await File('assets/avatars/preset-01.webp')
              .readAsBytes();
        });
        final transport = UploadTransport()..fail = failure;
        final auth = AuthRepository(
          identity: f.Provider(),
          backend: shell.ShellBackend(),
          store: f.Store(),
        );
        await t.pumpWidget(
          MyApp(
            auth: auth,
            transport: transport,
            deletionReceiptStore: ReceiptFake(),
            photoSource: source,
          ),
        );
        await t.pumpAndSettle();
        await t.tap(find.text('카카오로 로그인'));
        await t.pumpAndSettle();
        await t.tap(find.text('내 프로필'));
        await t.pumpAndSettle();
        await openPicker(t);
        expect(find.textContaining('중앙을 정사각형'), findsOneWidget);
        expect(transport.uploads, 0);
        await t.scrollUntilVisible(
          find.text('취소'),
          200,
          scrollable: find.byType(Scrollable).first,
        );
        await t.tap(find.text('취소'));
        await t.pumpAndSettle();
        expect(transport.uploads, 0);
        await openPicker(t);
        await t.scrollUntilVisible(
          find.text('선택한 모습 저장'),
          200,
          scrollable: find.byType(Scrollable).first,
        );
        await t.tap(find.text('선택한 모습 저장'));
        await t.pumpAndSettle();
        expect(transport.uploads, 1);
        expect(
          find.text('서버에 저장했어요.'),
          failure ? findsNothing : findsOneWidget,
        );
        await t.pump(const Duration(seconds: 2));
        expect(transport.uploads, 1);
        expect(t.takeException(), isNull);
        await t.pumpWidget(const SizedBox.shrink());
        auth.dispose();
      },
    );
  }
  testWidgets(
    'root rejects invalid late photo after background without upload',
    (t) async {
      final source = Source()..pending = Completer<PhotoInput?>();
      final transport = UploadTransport();
      final auth = AuthRepository(
        identity: f.Provider(),
        backend: shell.ShellBackend(),
        store: f.Store(),
      );
      await t.pumpWidget(
        MyApp(
          auth: auth,
          transport: transport,
          deletionReceiptStore: ReceiptFake(),
          photoSource: source,
        ),
      );
      await t.pumpAndSettle();
      await t.tap(find.text('카카오로 로그인'));
      await t.pumpAndSettle();
      await t.tap(find.text('내 프로필'));
      await t.pumpAndSettle();
      await t.tap(find.text('캐릭터·사진 바꾸기'));
      await t.pumpAndSettle();
      await t.scrollUntilVisible(
        find.text('내 사진 선택'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      await t.tap(find.text('내 사진 선택'));
      await t.pump();
      t.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      await t.pump();
      final old = Uint8List.fromList([1, 2, 3]);
      source.pending!.complete(PhotoInput(old, 'image/png'));
      await t.pump();
      t.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await t.pumpAndSettle();
      expect(old.every((x) => x == 0), true);
      expect(transport.uploads, 0);
      expect(find.textContaining('중앙을 정사각형'), findsNothing);
      await t.pumpWidget(const SizedBox.shrink());
      auth.dispose();
    },
  );
  testWidgets(
    'OS picker handoff resumes once only after same-account fresh auth',
    (t) async {
      final source = Source()..pending = Completer<PhotoInput?>();
      final backend = DelayedBackend();
      final transport = UploadTransport();
      final auth = AuthRepository(
        identity: f.Provider(),
        backend: backend,
        store: f.Store(),
      );
      await t.pumpWidget(
        MyApp(
          auth: auth,
          transport: transport,
          deletionReceiptStore: ReceiptFake(),
          photoSource: source,
        ),
      );
      await t.pumpAndSettle();
      await t.tap(find.text('카카오로 로그인'));
      await t.pumpAndSettle();
      await t.tap(find.text('내 프로필'));
      await t.pumpAndSettle();
      await t.tap(find.text('캐릭터·사진 바꾸기'));
      await t.pumpAndSettle();
      await t.scrollUntilVisible(
        find.text('내 사진 선택'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      await t.tap(find.text('내 사진 선택'));
      await t.pump();
      backend.held = Completer<AuthSession>();
      t.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      await t.pump();
      t.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await t.pump();
      late Uint8List image;
      await t.runAsync(() async {
        image = await File('assets/avatars/preset-01.webp').readAsBytes();
        source.pending!.complete(PhotoInput(image, 'image/webp'));
        await Future<void>.delayed(const Duration(milliseconds: 30));
      });
      await t.pump();
      expect(find.textContaining('중앙을 정사각형'), findsNothing);
      expect(transport.uploads, 0);
      await t.runAsync(() async {
        backend.held!.complete(backend.session);
        await t.pump();
        await t.pump();
        await Future<void>.delayed(const Duration(milliseconds: 100));
      });
      await t.pumpAndSettle();
      await t.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 60)),
      );
      await t.pumpAndSettle();
      await t.scrollUntilVisible(
        find.text('선택한 모습 저장'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.textContaining('중앙을 정사각형'), findsOneWidget);
      expect(source.calls, 1);
      expect(image.every((x) => x == 0), true);
      expect(transport.uploads, 0);
      await t.scrollUntilVisible(
        find.text('선택한 모습 저장'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      await t.tap(find.text('선택한 모습 저장'));
      await t.pumpAndSettle();
      expect(transport.uploads, 1);
      await t.pumpWidget(const SizedBox.shrink());
      auth.dispose();
    },
  );
  testWidgets('different verified account drops the old picker handoff', (
    t,
  ) async {
    final source = Source()..pending = Completer<PhotoInput?>();
    final backend = DelayedBackend();
    final transport = UploadTransport();
    final auth = AuthRepository(
      identity: f.Provider(),
      backend: backend,
      store: f.Store(),
    );
    await t.pumpWidget(
      MyApp(
        auth: auth,
        transport: transport,
        deletionReceiptStore: ReceiptFake(),
        photoSource: source,
      ),
    );
    await t.pumpAndSettle();
    await t.tap(find.text('카카오로 로그인'));
    await t.pumpAndSettle();
    await t.tap(find.text('내 프로필'));
    await t.pumpAndSettle();
    await t.tap(find.text('캐릭터·사진 바꾸기'));
    await t.pumpAndSettle();
    await t.scrollUntilVisible(
      find.text('내 사진 선택'),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await t.tap(find.text('내 사진 선택'));
    await t.pump();
    backend.next = AuthSession(
      token: 'b' * 43,
      expiresAt: DateTime.now().add(const Duration(days: 1)),
      accountId: 'account-b',
      displayName: '다른 합성계정',
    );
    t.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    await t.pump();
    t.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await t.pumpAndSettle();
    final old = Uint8List.fromList([1, 2, 3]);
    source.pending!.complete(PhotoInput(old, 'image/png'));
    await t.pumpAndSettle();
    expect(old.every((x) => x == 0), true);
    expect(source.calls, 1);
    expect(transport.uploads, 0);
    expect(find.text('캐릭터·사진 선택'), findsNothing);
    await t.pumpWidget(const SizedBox.shrink());
    auth.dispose();
  });
}
