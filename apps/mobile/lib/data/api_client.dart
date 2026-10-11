import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../core/app_config.dart';

class ApiException implements Exception {
  const ApiException(this.message, this.statusCode);
  final String message;
  final int? statusCode;
  @override
  String toString() => message;
}

class ApiClient {
  ApiClient(this._storage)
    : dio = Dio(
        BaseOptions(
          baseUrl: AppConfig.apiBaseUrl,
          connectTimeout: const Duration(seconds: 12),
          receiveTimeout: const Duration(seconds: 20),
          sendTimeout: const Duration(seconds: 20),
          headers: const {'Accept': 'application/json'},
          validateStatus: (status) => status != null && status < 500,
        ),
      ) {
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final cookie = await _storage.read(key: _cookieKey);
          if (cookie != null && cookie.isNotEmpty) {
            options.headers['Cookie'] = cookie;
          }
          handler.next(options);
        },
        onResponse: (response, handler) async {
          await _captureCookies(response);
          handler.next(response);
        },
      ),
    );
  }

  static const _cookieKey = 'tamusni.http.cookies.v1';
  final FlutterSecureStorage _storage;
  final Dio dio;

  Future<void> _captureCookies(Response<dynamic> response) async {
    final lines = response.headers.map['set-cookie'] ?? const <String>[];
    if (lines.isEmpty) return;
    final stored = <String, String>{};
    for (final pair in (await _storage.read(key: _cookieKey) ?? '').split(
      ';',
    )) {
      final index = pair.indexOf('=');
      if (index > 0) {
        stored[pair.substring(0, index).trim()] = pair
            .substring(index + 1)
            .trim();
      }
    }
    for (final line in lines) {
      final first = line.split(';').first;
      final index = first.indexOf('=');
      if (index <= 0) continue;
      final name = first.substring(0, index).trim();
      final value = first.substring(index + 1).trim();
      if (value.isEmpty || line.toLowerCase().contains('max-age=0')) {
        stored.remove(name);
      } else {
        stored[name] = value;
      }
    }
    if (stored.isEmpty) {
      await _storage.delete(key: _cookieKey);
    } else {
      await _storage.write(
        key: _cookieKey,
        value: stored.entries.map((e) => '${e.key}=${e.value}').join('; '),
      );
    }
  }

  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, dynamic>? query,
  }) async {
    final response = await dio.get<dynamic>(path, queryParameters: query);
    return _unwrap(response);
  }

  Future<Map<String, dynamic>> post(
    String path, {
    Object? data,
    Options? options,
  }) async {
    final response = await dio.post<dynamic>(
      path,
      data: data,
      options: options,
    );
    return _unwrap(response);
  }

  Future<Map<String, dynamic>> patch(String path, {Object? data}) async {
    final response = await dio.patch<dynamic>(path, data: data);
    return _unwrap(response);
  }

  Future<Map<String, dynamic>> delete(String path, {Object? data}) async {
    final response = await dio.delete<dynamic>(path, data: data);
    return _unwrap(response);
  }

  Map<String, dynamic> _unwrap(Response<dynamic> response) {
    final body = response.data is Map
        ? Map<String, dynamic>.from(response.data as Map)
        : <String, dynamic>{};
    if ((response.statusCode ?? 500) >= 400) {
      throw ApiException(
        '${body['error'] ?? 'La requête a échoué.'}',
        response.statusCode,
      );
    }
    return body;
  }

  Future<void> clearSession() async => _storage.delete(key: _cookieKey);
  Future<bool> hasSessionCookie() async =>
      (await _storage.read(key: _cookieKey))?.contains('tamusni_session=') ??
      false;
  Future<bool> hasMfaChallenge() async =>
      (await _storage.read(key: _cookieKey))?.contains('tamusni_mfa=') ?? false;
}
