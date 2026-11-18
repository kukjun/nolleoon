import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:nolleoon_mobile/main.dart';
import 'package:nolleoon_mobile/auth/auth_repository.dart';

import '../test/auth_test.dart' as fakes;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('native shell starts without production API or authentication', (
    tester,
  ) async {
    final auth = AuthRepository(
      identity: fakes.Provider()..enabled = false,
      backend: fakes.Backend(),
      store: fakes.Store(),
    );
    addTearDown(auth.dispose);
    await tester.pumpWidget(MyApp(auth: auth));
    await tester.pumpAndSettle();
    expect(find.text('놀러온'), findsOneWidget);
    expect(find.textContaining('아직 카카오 로그인을'), findsOneWidget);
  });
}
