import 'package:material_ui/material_ui.dart';

import 'theme.dart';

void main() => runApp(const MyApp());

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: '놀러온',
    debugShowCheckedModeBanner: false,
    theme: buildAppTheme(),
    home: const PreparationScreen(),
  );
}

class PreparationScreen extends StatelessWidget {
  const PreparationScreen({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('놀러온')),
    body: SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 560),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Semantics(
                  header: true,
                  child: Text(
                    '앱을 준비하고 있어요',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  '로그인과 여행방·게임 연결은 아직 준비 중이에요.',
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
                const SizedBox(height: 16),
                const Text('이 개발 화면은 계정을 만들거나 기존 웹 기록을 변경하지 않아요.'),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}
