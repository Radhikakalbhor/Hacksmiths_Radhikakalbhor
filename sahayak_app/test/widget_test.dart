import 'package:flutter_test/flutter_test.dart';
import 'package:sahayak_app/main.dart';

void main() {
  testWidgets('SahayakApp renders splash screen smoke test', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const SahayakApp());

    // Verify that the splash screen shows the title 'Sahayak'.
    expect(find.text('Sahayak'), findsOneWidget);
    expect(find.text('Aapka Bharosemand Sahayak'), findsOneWidget);
  });
}
