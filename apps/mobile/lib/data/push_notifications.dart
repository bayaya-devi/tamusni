import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

import '../core/app_config.dart';

bool get firebaseMessagingConfigured => [
  AppConfig.firebaseApiKey,
  AppConfig.firebaseAppId,
  AppConfig.firebaseSenderId,
  AppConfig.firebaseProjectId,
].every((value) => value.isNotEmpty);

Future<void> initializeFirebaseMessaging() async {
  if (!firebaseMessagingConfigured || Firebase.apps.isNotEmpty) return;
  await Firebase.initializeApp(
    options: FirebaseOptions(
      apiKey: AppConfig.firebaseApiKey,
      appId: AppConfig.firebaseAppId,
      messagingSenderId: AppConfig.firebaseSenderId,
      projectId: AppConfig.firebaseProjectId,
    ),
  );
}

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await initializeFirebaseMessaging();
}

String? contentSlugFromPushData(Map<String, dynamic> data) {
  final direct = data['slug']?.toString().trim();
  if (direct != null && RegExp(r'^[a-zA-Z0-9-]{1,180}$').hasMatch(direct)) {
    return direct;
  }
  final path = data['url']?.toString();
  if (path == null || path.isEmpty) return null;
  final uri = Uri.tryParse(path);
  if (uri == null) return null;
  final segments = uri.pathSegments;
  final articleIndex = segments.indexOf('article');
  if (articleIndex < 0 || articleIndex + 1 >= segments.length) return null;
  final slug = segments[articleIndex + 1];
  return RegExp(r'^[a-zA-Z0-9-]{1,180}$').hasMatch(slug) ? slug : null;
}
