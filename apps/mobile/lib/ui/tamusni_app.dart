import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';

import '../core/app_config.dart';
import '../state/app_controller.dart';
import 'auth_screen.dart';
import 'intro_screen.dart';
import 'main_shell.dart';

class TamusniApp extends StatefulWidget {
  const TamusniApp({super.key});
  @override
  State<TamusniApp> createState() => _TamusniAppState();
}

class _TamusniAppState extends State<TamusniApp> {
  late final AppController controller;
  late final AppLinks _appLinks;
  StreamSubscription<Uri>? _linkSubscription;
  final _navigatorKey = GlobalKey<NavigatorState>();
  final _messengerKey = GlobalKey<ScaffoldMessengerState>();

  @override
  void initState() {
    super.initState();
    controller = AppController();
    controller.addListener(_handlePushEvents);
    unawaited(controller.initialize());
    _appLinks = AppLinks();
    unawaited(_appLinks.getInitialLink().then(_handleLink));
    _linkSubscription = _appLinks.uriLinkStream.listen(_handleLink);
  }

  void _handlePushEvents() {
    final slug = controller.takePendingPushSlug();
    if (slug != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _navigatorKey.currentState?.push(
          MaterialPageRoute(
            builder: (_) => ArticlePage(controller: controller, slug: slug),
          ),
        );
      });
    }
    final message = controller.takeForegroundPush();
    if (message != null) {
      final title = '${message['title'] ?? 'TAMUSNI'}';
      final body = '${message['body'] ?? ''}';
      final targetSlug = message['slug']?.toString();
      _messengerKey.currentState?.showSnackBar(
        SnackBar(
          content: Text(body.isEmpty ? title : '$title\n$body'),
          action: targetSlug == null
              ? null
              : SnackBarAction(
                  label: 'Lire',
                  onPressed: () => _navigatorKey.currentState?.push(
                    MaterialPageRoute(
                      builder: (_) =>
                          ArticlePage(controller: controller, slug: targetSlug),
                    ),
                  ),
                ),
        ),
      );
    }
  }

  void _handleLink(Uri? uri) {
    if (uri == null || !mounted) return;
    if (uri.host == 'oauth-callback' || uri.host == 'auth') {
      unawaited(controller.completeOAuth(uri));
    } else if (uri.host == 'password-reset' || uri.host == 'reset') {
      controller.receiveResetToken(
        uri.queryParameters['token'] ??
            Uri.splitQueryString(uri.fragment)['token'],
      );
    }
  }

  @override
  void dispose() {
    _linkSubscription?.cancel();
    controller.removeListener(_handlePushEvents);
    controller.dispose();
    super.dispose();
  }

  ThemeData _theme(bool dark) {
    final base = dark
        ? ThemeData.dark(useMaterial3: true)
        : ThemeData.light(useMaterial3: true);
    final background = dark ? TamusniPalette.night : TamusniPalette.white;
    final surface = dark ? TamusniPalette.surfaceDark : Colors.white;
    return base.copyWith(
      scaffoldBackgroundColor: background,
      colorScheme: (dark
          ? const ColorScheme.dark(
              primary: TamusniPalette.blue,
              secondary: TamusniPalette.silver,
              surface: TamusniPalette.surfaceDark,
              onSurface: TamusniPalette.white,
            )
          : const ColorScheme.light(
              primary: TamusniPalette.blue,
              secondary: TamusniPalette.silver,
              surface: Colors.white,
              onSurface: TamusniPalette.night,
            )),
      appBarTheme: AppBarTheme(
        backgroundColor: background.withValues(alpha: .92),
        foregroundColor: dark ? TamusniPalette.white : TamusniPalette.night,
        elevation: 0,
        centerTitle: false,
      ),
      cardTheme: CardThemeData(
        color: surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: BorderSide(
            color: dark ? Colors.white12 : TamusniPalette.border,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: dark ? TamusniPalette.surfaceDark : Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(13),
          borderSide: BorderSide(
            color: dark ? Colors.white24 : TamusniPalette.border,
          ),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(13),
          borderSide: BorderSide(
            color: dark ? Colors.white24 : TamusniPalette.border,
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(13),
          borderSide: const BorderSide(color: TamusniPalette.blue, width: 1.5),
        ),
      ),
      textTheme: base.textTheme.apply(fontFamily: 'sans-serif'),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: surface.withValues(alpha: .96),
        indicatorColor: TamusniPalette.blue.withValues(alpha: .13),
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => TextStyle(
            fontSize: 11,
            fontWeight: states.contains(WidgetState.selected)
                ? FontWeight.w600
                : FontWeight.w400,
          ),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: controller,
    builder: (context, _) => MaterialApp(
      navigatorKey: _navigatorKey,
      scaffoldMessengerKey: _messengerKey,
      title: 'TAMUSNI',
      debugShowCheckedModeBanner: false,
      theme: _theme(false),
      darkTheme: _theme(true),
      themeMode: controller.themeMode,
      locale: Locale(controller.locale),
      supportedLocales: AppConfig.supportedLocales,
      builder: (context, child) => Directionality(
        textDirection: controller.locale == 'ar'
            ? TextDirection.rtl
            : TextDirection.ltr,
        child: child ?? const SizedBox.shrink(),
      ),
      home: !controller.ready
          ? const _StartupScreen()
          : controller.resetToken != null
          ? ResetPasswordScreen(controller: controller)
          : controller.authenticated
          ? MainShell(controller: controller)
          : controller.introPending
          ? IntroScreen(controller: controller)
          : MainShell(controller: controller),
    ),
  );
}

class _StartupScreen extends StatelessWidget {
  const _StartupScreen();
  @override
  Widget build(BuildContext context) => const Scaffold(
    body: Center(child: CircularProgressIndicator(strokeWidth: 2.4)),
  );
}
