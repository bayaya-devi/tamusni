import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:path_provider/path_provider.dart';

import '../core/app_config.dart';
import '../core/content_item.dart';
import 'api_client.dart';
import 'local_store.dart';

class TamusniRepository {
  TamusniRepository(this.api, this.local);
  final ApiClient api;
  final LocalStore local;

  Future<List<ContentItem>> feed({
    String sort = 'recent',
    String locale = 'fr',
  }) async {
    final data = await api.get(
      '/api/content',
      query: {
        'limit': AppConfig.cachedContentLimit,
        'sort': sort,
        'lang': locale,
      },
    );
    final list = (data['items'] as List? ?? const [])
        .whereType<Map>()
        .map((row) => ContentItem.fromJson(Map<String, dynamic>.from(row)))
        .toList();
    await local.cacheRecent(list);
    return list;
  }

  Future<List<ContentItem>> search(String query, {String locale = 'fr'}) async {
    final data = await api.get(
      '/api/content',
      query: {'limit': 30, 'q': query, 'lang': locale},
    );
    final list = (data['items'] as List? ?? const [])
        .whereType<Map>()
        .map((row) => ContentItem.fromJson(Map<String, dynamic>.from(row)))
        .toList();
    return list;
  }

  Future<ContentItem> article(String slug, String locale) async {
    final data = await api.get(
      '/api/content/${Uri.encodeComponent(slug)}',
      query: {'lang': locale},
    );
    final item = ContentItem.fromJson(data);
    await local.saveContent(item);
    return item;
  }

  Future<List<Map<String, dynamic>>> favorites() async {
    final data = await api.get('/api/favorites');
    return (data['items'] as List? ?? const [])
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList();
  }

  Future<void> saveFavorite(ContentItem item) async {
    await api.post(
      '/api/favorites',
      data: {
        'itemId': item.id,
        'itemType': item.type,
        'title': item.title,
        'url': '/article/${item.slug}/',
      },
    );
  }

  Future<void> removeFavorite(String itemId) async =>
      api.delete('/api/favorites', data: {'itemId': itemId});

  Future<Map<String, dynamic>> markViewed(String slug, {double progress = 0}) =>
      api.post(
        '/api/content/${Uri.encodeComponent(slug)}',
        data: {'progress': progress},
      );

  Future<Map<String, dynamic>> toggleLike(String slug) => api.post(
    '/api/content/${Uri.encodeComponent(slug)}',
    data: {'action': 'like'},
  );

  Future<ContentItem> download(ContentItem item, String locale) async {
    final full = item.body.isEmpty ? await article(item.slug, locale) : item;
    var imagePath = full.localImagePath;
    if (imagePath == null && full.coverUrl != null) {
      final url = full.coverUrl!.startsWith('http')
          ? full.coverUrl!
          : '${AppConfig.apiBaseUrl}${full.coverUrl}';
      final response = await api.dio.get<List<int>>(
        url,
        options: Options(responseType: ResponseType.bytes),
      );
      final directory = await getApplicationDocumentsDirectory();
      final imageDirectory = Directory(
        '${directory.path}${Platform.pathSeparator}article-images',
      );
      await imageDirectory.create(recursive: true);
      final imageFile = File(
        '${imageDirectory.path}${Platform.pathSeparator}${full.slug}.img',
      );
      await imageFile.writeAsBytes(response.data ?? const []);
      imagePath = imageFile.path;
    }
    final downloaded = full.copyWith(
      localImagePath: imagePath,
      downloaded: true,
    );
    await local.saveContent(downloaded, downloaded: true);
    return downloaded;
  }

  Future<void> removeDownload(String slug) async {
    final item = await local.contentBySlug(slug);
    if (item?.localImagePath != null) {
      final image = File(item!.localImagePath!);
      if (await image.exists()) await image.delete();
    }
    final db = await local.database;
    await db.update(
      'content',
      {'downloaded': 0},
      where: 'slug=?',
      whereArgs: [slug],
    );
  }

  Future<void> flushPending() async {
    final favorites = await local.pendingFavorites();
    for (final row in favorites) {
      final id = '${row['item_id']}';
      if (row['pending_action'] == 'delete') {
        await removeFavorite(id);
        await local.deleteFavorite(id);
      } else {
        final map =
            jsonDecode(row['payload'] as String) as Map<String, dynamic>;
        await saveFavorite(ContentItem.fromJson(map));
        await local.clearFavoritePending(id);
      }
    }
    final likes = await local.pendingLikes();
    for (final row in likes) {
      final slug = '${row['slug']}';
      final state = await markViewed(slug);
      if ((state['liked'] == true) != (row['desired'] == 1)) {
        await toggleLike(slug);
      }
      await local.deletePendingLike(slug);
    }
  }
}
