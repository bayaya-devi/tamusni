class ContentItem {
  const ContentItem({
    required this.id,
    required this.slug,
    required this.type,
    required this.title,
    required this.excerpt,
    required this.category,
    required this.publishedAt,
    this.body = '',
    this.author = 'Rédaction TAMUSNI',
    this.coverUrl,
    this.localImagePath,
    this.sources = const [],
    this.views = 0,
    this.likes = 0,
    this.downloaded = false,
  });

  final String id;
  final String slug;
  final String type;
  final String title;
  final String excerpt;
  final String category;
  final String publishedAt;
  final String body;
  final String author;
  final String? coverUrl;
  final String? localImagePath;
  final List<Map<String, dynamic>> sources;
  final int views;
  final int likes;
  final bool downloaded;

  factory ContentItem.fromJson(Map<String, dynamic> json) {
    final nested = json['item'];
    final map = nested is Map ? Map<String, dynamic>.from(nested) : json;
    final url = '${map['url'] ?? ''}';
    final urlSlug = RegExp(r'/article/([^/?#]+)').firstMatch(url)?.group(1);
    return ContentItem(
      id: '${map['id'] ?? map['item_id'] ?? map['slug'] ?? ''}',
      slug: '${map['slug'] ?? urlSlug ?? ''}',
      type: '${map['type'] ?? map['item_type'] ?? 'article'}',
      title: '${map['title'] ?? ''}',
      excerpt: '${map['excerpt'] ?? map['summary'] ?? ''}',
      category: '${map['category'] ?? 'TAMUSNI'}',
      publishedAt: '${map['published_at'] ?? ''}',
      body: '${map['body'] ?? ''}',
      author: '${map['author_name'] ?? 'Rédaction TAMUSNI'}',
      coverUrl: _nullable(map['cover_url']),
      localImagePath: _nullable(map['localImagePath']),
      sources: (json['sources'] is List)
          ? (json['sources'] as List)
                .whereType<Map>()
                .map((e) => Map<String, dynamic>.from(e))
                .toList()
          : const [],
      views: int.tryParse('${map['views'] ?? 0}') ?? 0,
      likes: int.tryParse('${map['likes'] ?? 0}') ?? 0,
      downloaded: map['downloaded'] == true || map['downloaded'] == 1,
    );
  }

  static String? _nullable(dynamic value) =>
      value == null || '$value'.isEmpty ? null : '$value';

  Map<String, dynamic> toJson() => {
    'id': id,
    'slug': slug,
    'type': type,
    'title': title,
    'excerpt': excerpt,
    'category': category,
    'published_at': publishedAt,
    'body': body,
    'author_name': author,
    'cover_url': coverUrl,
    'localImagePath': localImagePath,
    'sources': sources,
    'views': views,
    'likes': likes,
    'downloaded': downloaded,
  };

  ContentItem copyWith({
    String? body,
    String? localImagePath,
    List<Map<String, dynamic>>? sources,
    int? views,
    int? likes,
    bool? downloaded,
  }) => ContentItem(
    id: id,
    slug: slug,
    type: type,
    title: title,
    excerpt: excerpt,
    category: category,
    publishedAt: publishedAt,
    body: body ?? this.body,
    author: author,
    coverUrl: coverUrl,
    localImagePath: localImagePath ?? this.localImagePath,
    sources: sources ?? this.sources,
    views: views ?? this.views,
    likes: likes ?? this.likes,
    downloaded: downloaded ?? this.downloaded,
  );
}
