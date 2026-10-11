import 'dart:convert';

import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

import '../core/content_item.dart';

class LocalStore {
  Database? _db;

  Future<Database> get database async {
    if (_db != null) return _db!;
    final root = await getDatabasesPath();
    _db = await openDatabase(
      p.join(root, 'tamusni_local_v1.db'),
      version: 2,
      onCreate: (db, _) async {
        await db.execute(
          'CREATE TABLE content(slug TEXT PRIMARY KEY, payload TEXT NOT NULL, cached_at TEXT NOT NULL, downloaded INTEGER NOT NULL DEFAULT 0)',
        );
        await db.execute(
          'CREATE TABLE favorites(item_id TEXT PRIMARY KEY, payload TEXT NOT NULL, pending_action TEXT)',
        );
        await db.execute(
          'CREATE TABLE history(slug TEXT PRIMARY KEY, payload TEXT NOT NULL, viewed_at TEXT NOT NULL, progress REAL NOT NULL DEFAULT 0)',
        );
        await db.execute(
          'CREATE TABLE pending_likes(slug TEXT PRIMARY KEY, desired INTEGER NOT NULL)',
        );
        await db.execute(
          'CREATE TABLE app_state(key TEXT PRIMARY KEY, value TEXT NOT NULL)',
        );
        await db.execute(
          'CREATE TABLE contributor_drafts(id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL)',
        );
      },
      onUpgrade: (db, oldVersion, _) async {
        if (oldVersion < 2) {
          await db.execute(
            'CREATE TABLE contributor_drafts(id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL)',
          );
        }
      },
    );
    return _db!;
  }

  Future<void> saveContent(ContentItem item, {bool downloaded = false}) async {
    final db = await database;
    await db.insert('content', {
      'slug': item.slug,
      'payload': jsonEncode(item.toJson()),
      'cached_at': DateTime.now().toUtc().toIso8601String(),
      'downloaded': downloaded || item.downloaded ? 1 : 0,
    }, conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<void> cacheRecent(List<ContentItem> items, {int limit = 30}) async {
    final db = await database;
    await db.transaction((txn) async {
      for (final item in items.take(limit)) {
        await txn.insert('content', {
          'slug': item.slug,
          'payload': jsonEncode(item.toJson()),
          'cached_at': DateTime.now().toUtc().toIso8601String(),
          'downloaded': item.downloaded ? 1 : 0,
        }, conflictAlgorithm: ConflictAlgorithm.replace);
      }
      await txn.execute(
        'DELETE FROM content WHERE downloaded=0 AND slug NOT IN (SELECT slug FROM content ORDER BY cached_at DESC LIMIT ?)',
        [limit],
      );
    });
  }

  Future<List<ContentItem>> cachedContent({String query = ''}) async {
    final db = await database;
    final rows = await db.query('content', orderBy: 'cached_at DESC');
    final items = rows
        .map(
          (row) => ContentItem.fromJson(
            jsonDecode(row['payload'] as String) as Map<String, dynamic>,
          ),
        )
        .toList();
    if (query.trim().isEmpty) return items;
    final needle = query.toLowerCase();
    return items
        .where(
          (item) =>
              '${item.title} ${item.excerpt} ${item.body} ${item.category}'
                  .toLowerCase()
                  .contains(needle),
        )
        .toList();
  }

  Future<ContentItem?> contentBySlug(String slug) async {
    final db = await database;
    final row = await db.query(
      'content',
      where: 'slug=?',
      whereArgs: [slug],
      limit: 1,
    );
    if (row.isEmpty) return null;
    return ContentItem.fromJson(
      jsonDecode(row.first['payload'] as String) as Map<String, dynamic>,
    );
  }

  Future<void> setFavorite(
    ContentItem item,
    bool saved, {
    String? pending,
  }) async {
    final db = await database;
    if (saved) {
      await db.insert('favorites', {
        'item_id': item.id,
        'payload': jsonEncode(item.toJson()),
        'pending_action': pending,
      }, conflictAlgorithm: ConflictAlgorithm.replace);
    } else {
      await db.delete('favorites', where: 'item_id=?', whereArgs: [item.id]);
      if (pending != null) {
        await db.insert('favorites', {
          'item_id': item.id,
          'payload': jsonEncode(item.toJson()),
          'pending_action': pending,
        }, conflictAlgorithm: ConflictAlgorithm.replace);
      }
    }
  }

  Future<List<ContentItem>> favorites() async {
    final db = await database;
    final rows = await db.query(
      'favorites',
      where: 'pending_action IS NULL OR pending_action<>?',
      whereArgs: ['delete'],
      orderBy: 'rowid DESC',
    );
    return rows
        .map(
          (row) => ContentItem.fromJson(
            jsonDecode(row['payload'] as String) as Map<String, dynamic>,
          ),
        )
        .toList();
  }

  Future<List<Map<String, Object?>>> pendingFavorites() async =>
      (await (await database).query(
        'favorites',
        where: 'pending_action IS NOT NULL',
      )).toList();

  Future<void> clearFavoritePending(String id) async => (await database).update(
    'favorites',
    {'pending_action': null},
    where: 'item_id=?',
    whereArgs: [id],
  );

  Future<void> deleteFavorite(String id) async =>
      (await database).delete('favorites', where: 'item_id=?', whereArgs: [id]);

  Future<void> saveHistory(ContentItem item, {double progress = 0}) async {
    final db = await database;
    await db.insert('history', {
      'slug': item.slug,
      'payload': jsonEncode(item.toJson()),
      'viewed_at': DateTime.now().toUtc().toIso8601String(),
      'progress': progress,
    }, conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<List<ContentItem>> history() async {
    final rows = await (await database).query(
      'history',
      orderBy: 'viewed_at DESC',
      limit: 100,
    );
    return rows
        .map(
          (row) => ContentItem.fromJson(
            jsonDecode(row['payload'] as String) as Map<String, dynamic>,
          ),
        )
        .toList();
  }

  Future<void> savePendingLike(String slug, bool desired) async =>
      (await database).insert('pending_likes', {
        'slug': slug,
        'desired': desired ? 1 : 0,
      }, conflictAlgorithm: ConflictAlgorithm.replace);

  Future<List<Map<String, Object?>>> pendingLikes() async =>
      (await (await database).query('pending_likes')).toList();

  Future<void> deletePendingLike(String slug) async => (await database).delete(
    'pending_likes',
    where: 'slug=?',
    whereArgs: [slug],
  );

  Future<void> setState(String key, String value) async =>
      (await database).insert('app_state', {
        'key': key,
        'value': value,
      }, conflictAlgorithm: ConflictAlgorithm.replace);

  Future<String?> getState(String key) async {
    final rows = await (await database).query(
      'app_state',
      where: 'key=?',
      whereArgs: [key],
      limit: 1,
    );
    return rows.isEmpty ? null : rows.first['value'] as String?;
  }

  Future<void> saveContributorDraft(
    String id,
    Map<String, dynamic> payload,
  ) async => (await database).insert('contributor_drafts', {
    'id': id,
    'payload': jsonEncode(payload),
    'updated_at': DateTime.now().toUtc().toIso8601String(),
  }, conflictAlgorithm: ConflictAlgorithm.replace);

  Future<List<Map<String, dynamic>>> contributorDrafts() async {
    final rows = await (await database).query(
      'contributor_drafts',
      orderBy: 'updated_at DESC',
    );
    return rows.map((row) {
      final payload = Map<String, dynamic>.from(
        jsonDecode(row['payload'] as String) as Map,
      );
      return {
        ...payload,
        'id': row['id'],
        'status': 'draft',
        'localOnly': true,
        'updated_at': row['updated_at'],
      };
    }).toList();
  }

  Future<void> deleteContributorDraft(String id) async => (await database)
      .delete('contributor_drafts', where: 'id=?', whereArgs: [id]);

  Future<void> clearPrivateData() async {
    final db = await database;
    await db.delete('favorites');
    await db.delete('history');
    await db.delete('pending_likes');
    await db.delete('contributor_drafts');
  }
}
