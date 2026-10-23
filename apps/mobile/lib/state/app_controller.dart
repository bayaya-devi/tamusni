import 'dart:async';
import 'dart:convert';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:share_plus/share_plus.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

import '../core/app_config.dart';
import '../core/content_item.dart';
import '../data/api_client.dart';
import '../data/local_store.dart';
import '../data/push_notifications.dart';
import '../data/tamusni_repository.dart';

class AppController extends ChangeNotifier {
  AppController() : _secure = const FlutterSecureStorage() {
    api = ApiClient(_secure);
    local = LocalStore();
    repository = TamusniRepository(api, local);
    _connectivitySubscription = Connectivity().onConnectivityChanged.listen((
      values,
    ) {
      final online = values.any((value) => value != ConnectivityResult.none);
      if (online != isOnline) {
        isOnline = online;
        if (online && user != null) unawaited(sync());
        notifyListeners();
      }
    });
  }

  final FlutterSecureStorage _secure;
  late final ApiClient api;
  late final LocalStore local;
  late final TamusniRepository repository;
  StreamSubscription<List<ConnectivityResult>>? _connectivitySubscription;
  StreamSubscription<String>? _pushTokenSubscription;
  StreamSubscription<RemoteMessage>? _foregroundMessageSubscription;
  StreamSubscription<RemoteMessage>? _openedMessageSubscription;

  bool ready = false;
  bool introPending = false;
  bool isOnline = true;
  bool busy = false;
  String locale = 'fr';
  ThemeMode themeMode = ThemeMode.system;
  Map<String, dynamic>? user;
  String? error;
  String? pendingEmail;
  bool mfaPending = false;
  String? resetToken;
  List<ContentItem> feed = [];
  List<ContentItem> searchResults = [];
  List<ContentItem> saved = [];
  List<ContentItem> history = [];
  List<Map<String, dynamic>> notifications = [];
  Map<String, dynamic>? adminOverview;
  List<Map<String, dynamic>> submissions = [];
  List<Map<String, dynamic>> adminUsers = [];
  bool pushEnabled = false;
  String? pendingPushSlug;
  Map<String, dynamic>? pendingPushTarget;
  Map<String, dynamic>? foregroundPush;

  String get role => '${user?['role'] ?? 'USER'}'.toUpperCase();
  String get displayName => '${user?['name'] ?? ''}';
  bool get authenticated => user != null;

  Future<void> initialize() async {
    locale = await _secure.read(key: 'tamusni.locale') ?? 'fr';
    pushEnabled = await _secure.read(key: 'tamusni.push_enabled') == '1';
    themeMode = switch (await _secure.read(key: 'tamusni.theme')) {
      'light' => ThemeMode.light,
      'dark' => ThemeMode.dark,
      _ => ThemeMode.system,
    };
    await local.database;
    introPending = (await local.getState('intro_seen')) != '1';
    final hasCookie = await api.hasSessionCookie();
    try {
      final response = await api.get('/api/auth/session');
      if (response['authenticated'] == true && response['user'] is Map) {
        user = Map<String, dynamic>.from(response['user'] as Map);
        await _saveUser();
        introPending = false;
        await refreshHome();
        if (pushEnabled) unawaited(_registerPushIfPermitted());
      } else {
        await api.clearSession();
      }
      isOnline = true;
    } catch (_) {
      isOnline = false;
      if (hasCookie) {
        final cached = await _secure.read(key: 'tamusni.cached_user');
        if (cached != null) {
          user = Map<String, dynamic>.from(jsonDecode(cached) as Map);
          feed = await local.cachedContent();
          saved = await local.favorites();
          history = await local.history();
          introPending = false;
        }
      }
    }
    ready = true;
    notifyListeners();
  }

  Future<void> finishIntro() async {
    introPending = false;
    await local.setState('intro_seen', '1');
    notifyListeners();
  }

  Future<void> _saveUser() async {
    if (user != null) {
      await _secure.write(key: 'tamusni.cached_user', value: jsonEncode(user));
    }
  }

  Future<Map<String, dynamic>> config() => api.get('/api/config');

  Future<void> login(
    String email,
    String password,
  ) async {
    await _run(() async {
      final response = await api.post(
        '/api/auth/login',
        data: {
          'email': email.trim(),
          'password': password,
        },
      );
      if (response['mfaRequired'] == true) {
        mfaPending = true;
        pendingEmail = email.trim();
        return;
      }
      await _completeLogin();
    });
  }

  Future<void> verifyMfa(String code) async {
    await _run(() async {
      await api.post('/api/auth/mfa-login', data: {'code': code});
      mfaPending = false;
      await _completeLogin();
    });
  }

  Future<void> register({
    required String firstName,
    required String lastName,
    required String email,
    required String password,
    required List<String> topics,
    required bool termsAccepted,
    required bool sponsoredInApp,
    required bool sponsoredEmail,
    required String turnstileToken,
  }) async {
    await _run(() async {
      await api.post(
        '/api/auth/register',
        data: {
          'firstName': firstName.trim(),
          'lastName': lastName.trim(),
          'email': email.trim(),
          'password': password,
          'preferredTopics': topics,
          'termsAccepted': termsAccepted,
          'sponsoredInApp': sponsoredInApp,
          'sponsoredEmail': sponsoredEmail,
          'locale': locale,
          'turnstileToken': turnstileToken,
        },
      );
      pendingEmail = email.trim();
    });
  }

  Future<void> verifyEmail(String code) async {
    await _run(() async {
      await api.post(
        '/api/auth/verify-email',
        data: {'email': pendingEmail, 'code': code.trim(), 'locale': locale},
      );
      await _completeLogin();
      pendingEmail = null;
    });
  }

  Future<void> resendVerification(String token) async {
    await _run(
      () async => api.post(
        '/api/auth/resend-verification',
        data: {
          'email': pendingEmail,
          'locale': locale,
          'turnstileToken': token,
        },
      ),
    );
  }

  Future<void> forgotPassword(String email, String token) async {
    await _run(
      () async => api.post(
        '/api/auth/forgot-password',
        data: {
          'email': email.trim(),
          'locale': locale,
          'client': 'mobile',
          'turnstileToken': token,
        },
      ),
    );
  }

  Future<void> resetPassword(
    String token,
    String password,
    String confirmation,
  ) async {
    await _run(
      () async => api.post(
        '/api/auth/reset-password',
        data: {
          'token': token,
          'password': password,
          'passwordConfirmation': confirmation,
          'locale': locale,
        },
      ),
    );
    resetToken = null;
    notifyListeners();
  }

  Future<void> completeOAuth(Uri uri) async {
    final values = <String, String>{};
    if (uri.fragment.isNotEmpty) {
      values.addAll(Uri.splitQueryString(uri.fragment));
    }
    values.addAll(uri.queryParameters);
    final token = values['access_token'];
    if (token == null || token.isEmpty) {
      error = values['error_description'] ?? 'Connexion Google interrompue.';
      notifyListeners();
      return;
    }
    await _run(() async {
      await api.post('/api/auth/oauth-session', data: {'accessToken': token});
      await _completeLogin();
    });
  }

  Future<void> _completeLogin() async {
    final response = await api.get('/api/auth/session');
    user = Map<String, dynamic>.from(response['user'] as Map);
    introPending = false;
    await local.setState('intro_seen', '1');
    await _saveUser();
    await refreshHome();
    if (pushEnabled) unawaited(_registerPushIfPermitted());
  }

  Future<void> logout() async {
    final pushToken = await _secure.read(key: 'tamusni.push_token');
    if (pushToken != null) {
      try {
        await api.delete('/api/push/devices', data: {'token': pushToken});
      } catch (_) {}
      await _secure.delete(key: 'tamusni.push_token');
    }
    try {
      await api.post('/api/auth/logout');
    } catch (_) {}
    await api.clearSession();
    await _secure.delete(key: 'tamusni.cached_user');
    await local.clearPrivateData();
    await _stopPushListeners();
    user = null;
    saved = [];
    history = [];
    notifications = [];
    notifyListeners();
  }

  Future<void> refreshHome() async {
    final cached = await local.cachedContent();
    if (cached.isNotEmpty) feed = cached;
    try {
      feed = await repository.feed(locale: locale);
      isOnline = true;
      await repository.flushPending();
    } catch (_) {
      isOnline = false;
      if (feed.isEmpty) feed = await local.cachedContent();
    }
    await refreshAccountData(silent: true);
    notifyListeners();
  }

  Future<ContentItem> openArticle(String slug) async {
    ContentItem? item;
    try {
      item = await repository.article(slug, locale);
      final view = await repository.markViewed(slug, progress: 0);
      item = item.copyWith(
        views: int.tryParse('${view['views'] ?? item.views}') ?? item.views,
        likes: int.tryParse('${view['likes'] ?? item.likes}') ?? item.likes,
      );
      isOnline = true;
    } catch (_) {
      isOnline = false;
      item = await local.contentBySlug(slug);
    }
    if (item == null) {
      throw const ApiException(
        'Ce contenu n’est pas disponible hors ligne.',
        null,
      );
    }
    await local.saveContent(item);
    await local.saveHistory(item);
    if (authenticated) history = await local.history();
    notifyListeners();
    return item;
  }

  Future<List<ContentItem>> search(String query) async {
    if (query.trim().isEmpty) return const [];
    try {
      searchResults = await repository.search(query, locale: locale);
      isOnline = true;
    } catch (_) {
      isOnline = false;
      searchResults = await local.cachedContent(query: query);
    }
    notifyListeners();
    return searchResults;
  }

  Future<void> toggleFavorite(ContentItem item) async {
    if (!authenticated) {
      throw const ApiException(
        'Connectez-vous pour enregistrer des favoris.',
        401,
      );
    }
    final exists = saved.any((value) => value.id == item.id);
    if (exists) {
      saved.removeWhere((value) => value.id == item.id);
    } else {
      saved.insert(0, item);
    }
    if (isOnline) {
      try {
        if (exists) {
          await repository.removeFavorite(item.id);
          await local.setFavorite(item, false);
        } else {
          await repository.saveFavorite(item);
          await local.setFavorite(item, true);
        }
      } catch (e) {
        if (e is ApiException && e.statusCode != null && e.statusCode! < 500) {
          rethrow;
        }
        await local.setFavorite(
          item,
          !exists,
          pending: exists ? 'delete' : 'save',
        );
      }
    } else {
      await local.setFavorite(
        item,
        !exists,
        pending: exists ? 'delete' : 'save',
      );
    }
    notifyListeners();
  }

  Future<Map<String, dynamic>> toggleLike(ContentItem item) async {
    if (!authenticated) {
      throw const ApiException('Connectez-vous pour aimer un contenu.', 401);
    }
    try {
      final response = await repository.toggleLike(item.slug);
      isOnline = true;
      notifyListeners();
      return response;
    } catch (e) {
      if (e is ApiException && e.statusCode != null && e.statusCode! < 500) {
        rethrow;
      }
      await local.savePendingLike(item.slug, true);
      isOnline = false;
      notifyListeners();
      return {'ok': true, 'offline': true};
    }
  }

  Future<ContentItem> download(ContentItem item) async =>
      repository.download(item, locale);
  Future<void> removeDownload(String slug) => repository.removeDownload(slug);

  Future<void> share(ContentItem item) async => SharePlus.instance.share(
    ShareParams(
      text: '${item.title}\nhttps://tamusni.science/article/${item.slug}/',
      subject: item.title,
    ),
  );

  Future<void> refreshAccountData({bool silent = false}) async {
    if (user == null) return;
    try {
      final favoritesResponse = await repository.favorites();
      final accountResponse = await api.get('/api/account');
      final notificationsResponse = await api.get('/api/notifications');
      saved = favoritesResponse
          .map((row) => ContentItem.fromJson(row))
          .toList();
      history = (accountResponse['history'] as List? ?? const [])
          .whereType<Map>()
          .map((row) => ContentItem.fromJson(Map<String, dynamic>.from(row)))
          .toList();
      notifications = (notificationsResponse['items'] as List? ?? const [])
          .whereType<Map>()
          .map((row) => Map<String, dynamic>.from(row))
          .toList();
    } catch (_) {
      saved = await local.favorites();
      history = await local.history();
    }
    if (!silent) notifyListeners();
  }

  Future<Map<String, dynamic>> account() => api.get('/api/account');
  Future<Map<String, dynamic>> updateProfile(Map<String, dynamic> value) =>
      api.patch('/api/account', data: value);
  Future<bool> getNewsletterStatus() async {
    final result = await api.get('/api/newsletter');
    return result['subscribed'] == true;
  }

  Future<void> setNewsletter(bool subscribe) async {
    if (subscribe) {
      await api.post('/api/newsletter', data: {'locale': locale});
    } else {
      await api.patch('/api/newsletter', data: {'action': 'unsubscribe'});
    }
  }

  Future<void> changePassword(
    String current,
    String next,
    String confirmation,
  ) async {
    await api.patch(
      '/api/account',
      data: {
        'action': 'password',
        'currentPassword': current,
        'newPassword': next,
        'passwordConfirmation': confirmation,
      },
    );
  }

  Future<void> requestAccountDeletion(String password) async {
    await api.patch(
      '/api/account',
      data: {
        'action': 'request-deletion',
        'password': password,
        'confirmDeletion': true,
      },
    );
  }

  Future<void> confirmAccountDeletion(String code) async {
    await api.delete('/api/account', data: {'code': code});
    await logout();
  }

  void receiveResetToken(String? token) {
    resetToken = token;
    notifyListeners();
  }

  Future<void> enablePush() async {
    if (!authenticated) {
      throw const ApiException(
        'Connectez-vous pour activer les notifications.',
        401,
      );
    }
    if (!firebaseMessagingConfigured) {
      throw const ApiException(
        'Les paramètres Firebase de TAMUSNI ne sont pas encore configurés.',
        null,
      );
    }
    await initializeFirebaseMessaging();
    final permission = await FirebaseMessaging.instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    if (permission.authorizationStatus != AuthorizationStatus.authorized &&
        permission.authorizationStatus != AuthorizationStatus.provisional) {
      throw const ApiException(
        'Les notifications sont désactivées dans les réglages Android.',
        null,
      );
    }
    final token = await FirebaseMessaging.instance.getToken();
    if (token == null || token.isEmpty) {
      throw const ApiException(
        'Impossible d’enregistrer cet appareil auprès du service push.',
        null,
      );
    }
    await _registerPushToken(token);
    pushEnabled = true;
    await _secure.write(key: 'tamusni.push_enabled', value: '1');
    _startPushListeners();
    notifyListeners();
  }

  Future<void> disablePush() async {
    final token = await _secure.read(key: 'tamusni.push_token');
    if (token != null && token.isNotEmpty && authenticated) {
      await api.delete('/api/push/devices', data: {'token': token});
    }
    if (firebaseMessagingConfigured && Firebase.apps.isNotEmpty) {
      await FirebaseMessaging.instance.deleteToken();
    }
    await _secure.delete(key: 'tamusni.push_token');
    await _secure.write(key: 'tamusni.push_enabled', value: '0');
    pushEnabled = false;
    await _stopPushListeners();
    notifyListeners();
  }

  Future<void> _registerPushIfPermitted() async {
    try {
      if (!firebaseMessagingConfigured) return;
      await initializeFirebaseMessaging();
      final settings = await FirebaseMessaging.instance
          .getNotificationSettings();
      if (settings.authorizationStatus != AuthorizationStatus.authorized &&
          settings.authorizationStatus != AuthorizationStatus.provisional) {
        return;
      }
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null && token.isNotEmpty) {
        await _registerPushToken(token);
        _startPushListeners();
      }
    } catch (_) {
      // Reading and account sign-in remain usable if push services are offline.
    }
  }

  Future<void> _registerPushToken(String token) async {
    final previous = await _secure.read(key: 'tamusni.push_token');
    if (previous != null && previous != token && authenticated) {
      try {
        await api.delete('/api/push/devices', data: {'token': previous});
      } catch (_) {}
    }
    await api.post(
      '/api/push/devices',
      data: {'token': token, 'platform': 'android'},
    );
    await _secure.write(key: 'tamusni.push_token', value: token);
  }

  void _startPushListeners() {
    _pushTokenSubscription ??= FirebaseMessaging.instance.onTokenRefresh.listen(
      (token) => unawaited(_safelyRegisterPushToken(token)),
    );
    _foregroundMessageSubscription ??= FirebaseMessaging.onMessage.listen((
      message,
    ) {
      foregroundPush = {
        'title':
            message.notification?.title ?? message.data['title'] ?? 'TAMUSNI',
        'body': message.notification?.body ?? message.data['body'] ?? '',
        'slug': contentSlugFromPushData(message.data),
        'type': message.data['type'],
        'status': message.data['status'],
      };
      notifyListeners();
    });
    _openedMessageSubscription ??= FirebaseMessaging.onMessageOpenedApp.listen(
      _handleOpenedPush,
    );
    unawaited(
      FirebaseMessaging.instance.getInitialMessage().then((message) {
        if (message != null) _handleOpenedPush(message);
      }),
    );
  }

  Future<void> _safelyRegisterPushToken(String token) async {
    if (!authenticated || !pushEnabled) return;
    try {
      await _registerPushToken(token);
    } catch (_) {
      // A later token refresh or sign-in retries registration.
    }
  }

  void _handleOpenedPush(RemoteMessage message) {
    pendingPushSlug = contentSlugFromPushData(message.data);
    pendingPushTarget = Map<String, dynamic>.from(message.data);
    notifyListeners();
  }

  String? takePendingPushSlug() {
    final slug = pendingPushSlug;
    pendingPushSlug = null;
    return slug;
  }

  Map<String, dynamic>? takePendingPushTarget() {
    final target = pendingPushTarget;
    pendingPushTarget = null;
    return target;
  }

  Map<String, dynamic>? takeForegroundPush() {
    final message = foregroundPush;
    foregroundPush = null;
    return message;
  }

  Future<void> _stopPushListeners() async {
    await _pushTokenSubscription?.cancel();
    await _foregroundMessageSubscription?.cancel();
    await _openedMessageSubscription?.cancel();
    _pushTokenSubscription = null;
    _foregroundMessageSubscription = null;
    _openedMessageSubscription = null;
  }

  Future<void> setLocale(String value) async {
    if (!['fr', 'ar', 'en', 'es', 'pt'].contains(value)) return;
    locale = value;
    await _secure.write(key: 'tamusni.locale', value: value);
    if (user != null) {
      try {
        final accountData = await api.get('/api/account');
        final profile = Map<String, dynamic>.from(
          accountData['profile'] as Map,
        );
        await updateProfile({
          'name': profile['name'],
          'email': profile['email'],
          'preferredTopics': (accountData['topics'] as List? ?? const [])
              .whereType<Map>()
              .map((topic) => '${topic['topic']}')
              .toList(),
          'language': value,
          'theme': _themeValue,
          'notifications': profile['notifications_enabled'] != 0,
        });
      } catch (_) {}
      await refreshHome();
    }
    notifyListeners();
  }

  String get _themeValue => switch (themeMode) {
    ThemeMode.light => 'light',
    ThemeMode.dark => 'dark',
    _ => 'auto',
  };

  Future<void> setTheme(ThemeMode value) async {
    themeMode = value;
    await _secure.write(
      key: 'tamusni.theme',
      value: switch (value) {
        ThemeMode.light => 'light',
        ThemeMode.dark => 'dark',
        _ => 'auto',
      },
    );
    notifyListeners();
  }

  Future<Map<String, dynamic>> loadContributorSubmissions() async {
    final localDrafts = await local.contributorDrafts();
    if (!isOnline) {
      submissions = localDrafts;
      notifyListeners();
      return {'items': submissions, 'offline': true};
    }
    final response = await api.get('/api/contributor/submissions');
    final remoteItems = (response['items'] as List? ?? const [])
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e));
    submissions = [...localDrafts, ...remoteItems];
    notifyListeners();
    return response;
  }

  Future<Map<String, dynamic>> loadContributorSubmission(String id) async {
    if (id.startsWith('local-')) {
      final drafts = await local.contributorDrafts();
      return drafts.firstWhere((draft) => draft['id'] == id);
    }
    final response = await api.get(
      '/api/contributor/submissions',
      query: {'id': id},
    );
    final item = Map<String, dynamic>.from(response['item'] as Map);
    item['sources'] = response['sources'] ?? const [];
    return item;
  }

  Future<Map<String, dynamic>> saveSubmission(
    Map<String, dynamic> value,
  ) async {
    final existingId = '${value['id'] ?? ''}';
    final localId = existingId.startsWith('local-')
        ? existingId
        : 'local-${DateTime.now().microsecondsSinceEpoch}';
    if (!isOnline) {
      await local.saveContributorDraft(localId, {...value, 'id': localId});
      await loadContributorSubmissions();
      if (value['action'] == 'submit') {
        throw const ApiException(
          'Brouillon conservé sur cet appareil. Reconnectez-vous pour le soumettre à la rédaction.',
          null,
        );
      }
      return {'ok': true, 'id': localId, 'status': 'draft', 'offline': true};
    }
    final request = Map<String, dynamic>.from(value);
    if (existingId.startsWith('local-')) request.remove('id');
    final response = await api.post(
      '/api/contributor/submissions',
      data: request,
    );
    if (existingId.startsWith('local-')) {
      await local.deleteContributorDraft(existingId);
    }
    await loadContributorSubmissions();
    return response;
  }

  Future<Map<String, dynamic>> uploadCover(String jpegBase64) => api.post(
    '/api/contributor/upload',
    data: {'data': 'data:image/jpeg;base64,$jpegBase64'},
  );

  Future<Map<String, dynamic>> loadAdminOverview() async {
    adminOverview = await api.get('/api/admin/overview');
    notifyListeners();
    return adminOverview!;
  }

  Future<void> loadAdminSubmissions() async {
    final response = await api.get('/api/admin/submissions');
    submissions = (response['items'] as List? ?? const [])
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
    notifyListeners();
  }

  Future<Map<String, dynamic>> reviewSubmission(
    String id, {
    required bool approve,
    String reason = '',
  }) async {
    final response = await api.post(
      '/api/admin/submissions',
      data: {
        'id': id,
        'action': approve ? 'approve' : 'reject',
        if (!approve) 'reason': reason,
      },
    );
    await loadAdminSubmissions();
    return response;
  }

  Future<void> loadAdminUsers() async {
    final response = await api.get('/api/admin/users');
    adminUsers = (response['items'] as List? ?? const [])
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
    notifyListeners();
  }

  Future<void> setUserRole(String id, String role) async {
    await api.patch('/api/admin/users', data: {'id': id, 'role': role});
    await loadAdminUsers();
  }

  Future<void> setUserBanned(String id, bool banned) async {
    await api.patch(
      '/api/admin/users',
      data: {'id': id, 'action': banned ? 'ban' : 'unban'},
    );
    await loadAdminUsers();
  }

  Future<Map<String, dynamic>> getAdminUserDetails(String id) =>
      api.get('/api/admin/users', query: {'id': id});

  Future<void> createAdminUser(Map<String, dynamic> value) async {
    await api.post('/api/admin/users', data: value);
    await loadAdminUsers();
  }

  Future<void> deleteAdminUser(String id) async {
    await api.delete('/api/admin/users', data: {'id': id});
    await loadAdminUsers();
  }

  Future<void> notificationRead(String id, bool read) async {
    await api.patch(
      '/api/notifications',
      data: {'id': id, 'action': read ? 'read' : 'unread'},
    );
    await refreshAccountData();
  }

  Future<void> deleteNotification(String id) async {
    await api.delete('/api/notifications', data: {'id': id});
    await refreshAccountData();
  }

  Future<void> loadAdminNotifications() async {
    final response = await api.get('/api/admin/notifications');
    notifications = (response['items'] as List? ?? const [])
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList();
    notifyListeners();
  }

  Future<void> updateAdminNotification(String id, {required bool read}) async {
    await api.patch(
      '/api/admin/notifications',
      data: {'id': id, 'action': read ? 'read' : 'unread'},
    );
    await loadAdminNotifications();
  }

  Future<void> deleteAdminNotification(String id) async {
    await api.delete('/api/admin/notifications', data: {'id': id});
    await loadAdminNotifications();
  }

  Future<void> loadAdminContent() async {
    final response = await api.get('/api/admin/content');
    adminContent = (response['items'] as List? ?? const [])
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList();
    notifyListeners();
  }

  List<Map<String, dynamic>> adminContent = [];

  Future<void> saveAdminContent(
    Map<String, dynamic> value, {
    String? id,
  }) async {
    if (id == null) {
      await api.post('/api/admin/content', data: value);
    } else {
      await api.patch(
        '/api/admin/content',
        data: {...value, 'id': id, 'action': 'update'},
      );
    }
    await loadAdminContent();
  }

  Future<void> deleteAdminContent(String id) async {
    await api.delete('/api/admin/content', data: {'id': id});
    await loadAdminContent();
  }

  Future<void> sync() async {
    if (user == null) return;
    try {
      await repository.flushPending();
      await refreshHome();
    } catch (_) {}
  }

  Future<void> _run(Future<void> Function() operation) async {
    busy = true;
    error = null;
    notifyListeners();
    try {
      await operation();
    } catch (e) {
      error = e is ApiException ? e.message : AppStrings.get('error', locale);
      rethrow;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _connectivitySubscription?.cancel();
    _stopPushListeners();
    super.dispose();
  }
}
