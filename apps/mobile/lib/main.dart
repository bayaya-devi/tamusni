import 'package:flutter/material.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

import 'data/push_notifications.dart';
import 'ui/tamusni_app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await initializeFirebaseMessaging();
    if (firebaseMessagingConfigured) {
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
    }
  } catch (_) {
    // Push configuration must never prevent public reading from starting.
  }
  runApp(const TamusniApp());
}
