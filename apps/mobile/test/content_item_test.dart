import 'package:flutter_test/flutter_test.dart';
import 'package:tamusni_mobile/core/content_item.dart';
import 'package:tamusni_mobile/data/push_notifications.dart';

void main() {
  group('Push notification routing', () {
    test('accepts a safe article slug from message data', () {
      expect(
        contentSlugFromPushData({'slug': 'mission-mars-2030'}),
        'mission-mars-2030',
      );
    });

    test('extracts article slug from notification URL', () {
      expect(
        contentSlugFromPushData({'url': '/article/robotique/'}),
        'robotique',
      );
    });

    test('rejects unsafe and non-article destinations', () {
      expect(contentSlugFromPushData({'slug': '../admin'}), isNull);
      expect(contentSlugFromPushData({'url': '/admin/'}), isNull);
    });
  });

  group('ContentItem', () {
    test('parses API content and keeps source metadata', () {
      final item = ContentItem.fromJson({
        'id': 'content-1',
        'slug': 'mission-lunaire',
        'type': 'article',
        'title': 'Une mission scientifique',
        'excerpt': 'Résumé',
        'category': 'Espace',
        'published_at': '2026-10-10T06:00:00Z',
        'body': 'Texte',
        'author_name': 'Rédaction TAMUSNI',
        'views': 12,
        'likes': 3,
        'sources': [
          {'label': 'Agence', 'url': 'https://example.org/report'},
        ],
      });

      expect(item.slug, 'mission-lunaire');
      expect(item.views, 12);
      expect(item.likes, 3);
      expect(item.sources.single['label'], 'Agence');
    });

    test('recovers slug from article URL for favorites', () {
      final item = ContentItem.fromJson({
        'item_id': 'content-2',
        'item_type': 'video',
        'url': '/article/robotique-industrielle/',
        'title': 'Robotique',
      });

      expect(item.id, 'content-2');
      expect(item.slug, 'robotique-industrielle');
      expect(item.type, 'video');
    });

    test('copyWith changes offline-only fields without losing content', () {
      final original = ContentItem.fromJson({
        'id': 'content-3',
        'slug': 'science',
        'title': 'Science',
        'published_at': '2026-10-10',
      });
      final copy = original.copyWith(
        downloaded: true,
        localImagePath: '/cache/image.jpg',
      );

      expect(copy.title, original.title);
      expect(copy.downloaded, isTrue);
      expect(copy.localImagePath, '/cache/image.jpg');
    });
  });
}
