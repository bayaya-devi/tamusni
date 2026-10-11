import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:image/image.dart' as image_lib;
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/app_config.dart';
import '../core/content_item.dart';
import '../state/app_controller.dart';
import 'auth_screen.dart';

class MainShell extends StatefulWidget {
  const MainShell({super.key, required this.controller});
  final AppController controller;

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int index = 0;
  AppController get c => widget.controller;

  List<Widget> get pages {
    if (!c.authenticated) {
      return [
        HomePage(controller: c),
        ExplorePage(controller: c),
        AuthScreen(controller: c),
      ];
    }
    final result = <Widget>[
      HomePage(controller: c),
      ExplorePage(controller: c),
    ];
    if (c.role == 'CONTRIBUTOR') {
      result.add(ContributorListPage(controller: c));
      result.add(ContributorEditorPage(controller: c));
      result.add(ProfilePage(controller: c));
    } else if (c.role == 'ADMIN') {
      result.add(AdminPage(controller: c));
      result.add(ProfilePage(controller: c));
    } else {
      result.add(FavoritesPage(controller: c));
      result.add(ProfilePage(controller: c));
    }
    return result;
  }

  List<NavigationDestination> get destinations {
    final result = <NavigationDestination>[
      NavigationDestination(
        icon: const Icon(Icons.newspaper_outlined),
        selectedIcon: const Icon(Icons.newspaper),
        label: AppStrings.get('home', c.locale),
      ),
      NavigationDestination(
        icon: const Icon(Icons.explore_outlined),
        selectedIcon: const Icon(Icons.explore),
        label: AppStrings.get('explore', c.locale),
      ),
    ];
    if (!c.authenticated) {
      result.add(
        NavigationDestination(
          icon: const Icon(Icons.person_outline),
          selectedIcon: const Icon(Icons.person),
          label: AppStrings.get('signIn', c.locale),
        ),
      );
      return result;
    }
    if (c.role == 'CONTRIBUTOR') {
      result.add(
        NavigationDestination(
          icon: const Icon(Icons.assignment_outlined),
          selectedIcon: const Icon(Icons.assignment),
          label: AppStrings.get('submissions', c.locale),
        ),
      );
      result.add(
        NavigationDestination(
          icon: const Icon(Icons.edit_note_outlined),
          selectedIcon: const Icon(Icons.edit_note),
          label: AppStrings.get('contribute', c.locale),
        ),
      );
      result.add(
        NavigationDestination(
          icon: const Icon(Icons.person_outline),
          selectedIcon: const Icon(Icons.person),
          label: AppStrings.get('profile', c.locale),
        ),
      );
    } else if (c.role == 'ADMIN') {
      result.add(
        NavigationDestination(
          icon: const Icon(Icons.admin_panel_settings_outlined),
          selectedIcon: const Icon(Icons.admin_panel_settings),
          label: AppStrings.get('admin', c.locale),
        ),
      );
      result.add(
        NavigationDestination(
          icon: const Icon(Icons.person_outline),
          selectedIcon: const Icon(Icons.person),
          label: AppStrings.get('profile', c.locale),
        ),
      );
    } else {
      result.add(
        NavigationDestination(
          icon: const Icon(Icons.bookmark_border),
          selectedIcon: const Icon(Icons.bookmark),
          label: AppStrings.get('favorites', c.locale),
        ),
      );
      result.add(
        NavigationDestination(
          icon: const Icon(Icons.person_outline),
          selectedIcon: const Icon(Icons.person),
          label: AppStrings.get('profile', c.locale),
        ),
      );
    }
    return result;
  }

  @override
  Widget build(BuildContext context) {
    final pageList = pages;
    if (index >= pageList.length) index = 0;
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'TAMUSNI',
          style: TextStyle(
            fontWeight: FontWeight.w800,
            letterSpacing: 1.2,
            fontSize: 18,
          ),
        ),
        actions: [
          if (!c.isOnline)
            Padding(
              padding: const EdgeInsetsDirectional.only(end: 4),
              child: Tooltip(
                message: AppStrings.get('offline', c.locale),
                child: const Icon(Icons.cloud_off_outlined, size: 20),
              ),
            ),
          IconButton(
            tooltip: AppStrings.get('search', c.locale),
            onPressed: () => _push(SearchPage(controller: c)),
            icon: const Icon(Icons.search),
          ),
          if (c.authenticated)
            IconButton(
              tooltip: AppStrings.get('notifications', c.locale),
              onPressed: () => _push(NotificationsPage(controller: c)),
              icon: const Icon(Icons.notifications_none),
            ),
          PopupMenuButton<String>(
            tooltip: AppStrings.get('language', c.locale),
            onSelected: c.setLocale,
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'fr', child: Text('Français')),
              PopupMenuItem(value: 'ar', child: Text('العربية')),
              PopupMenuItem(value: 'en', child: Text('English')),
              PopupMenuItem(value: 'es', child: Text('Español')),
              PopupMenuItem(value: 'pt', child: Text('Português')),
            ],
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10),
              child: Center(
                child: Text(
                  c.locale.toUpperCase(),
                  style: const TextStyle(
                    color: TamusniPalette.blue,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
      body: IndexedStack(index: index, children: pageList),
      bottomNavigationBar: NavigationBar(
        destinations: destinations,
        selectedIndex: index,
        onDestinationSelected: (value) => setState(() => index = value),
      ),
    );
  }

  void _push(Widget child) =>
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => child));
}

class HomePage extends StatefulWidget {
  const HomePage({super.key, required this.controller});
  final AppController controller;
  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  @override
  void initState() {
    super.initState();
    if (widget.controller.feed.isEmpty) {
      unawaited(widget.controller.refreshHome());
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.controller;
    return RefreshIndicator(
      onRefresh: c.refreshHome,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 12, 18, 28),
        children: [
          if (!c.isOnline) _OfflineBanner(locale: c.locale),
          Text(
            AppStrings.get('welcome', c.locale),
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w700,
              height: 1.18,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            AppStrings.get('tagline', c.locale),
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(color: TamusniPalette.muted),
          ),
          const SizedBox(height: 26),
          _SectionTitle(
            title: AppStrings.get('latest', c.locale),
            icon: Icons.bolt_outlined,
          ),
          const SizedBox(height: 12),
          if (c.feed.isEmpty)
            _EmptyState(
              text: c.isOnline
                  ? AppStrings.get('noContent', c.locale)
                  : AppStrings.get('offline', c.locale),
              onRetry: c.refreshHome,
            )
          else
            ...c.feed
                .take(AppConfig.cachedContentLimit)
                .map(
                  (item) => Padding(
                    padding: const EdgeInsets.only(bottom: 14),
                    child: ContentCard(
                      item: item,
                      controller: c,
                      featured: c.feed.first.slug == item.slug,
                    ),
                  ),
                ),
          const SizedBox(height: 10),
          _SectionTitle(
            title: 'Explorer les rubriques',
            icon: Icons.explore_outlined,
          ),
          const SizedBox(height: 10),
          _TopicStrip(controller: c),
        ],
      ),
    );
  }
}

class ExplorePage extends StatelessWidget {
  const ExplorePage({super.key, required this.controller});
  final AppController controller;
  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(18),
    children: [
      Text(
        AppStrings.get('explore', controller.locale),
        style: Theme.of(
          context,
        ).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w700),
      ),
      const SizedBox(height: 8),
      Text(
        'Choisissez un univers et retrouvez ses dernières publications.',
        style: Theme.of(
          context,
        ).textTheme.bodyMedium?.copyWith(color: TamusniPalette.muted),
      ),
      const SizedBox(height: 18),
      Wrap(
        spacing: 9,
        runSpacing: 9,
        children: AppConfig.topics
            .map(
              (topic) => ActionChip(
                avatar: const Icon(Icons.arrow_forward, size: 16),
                label: Text(topic),
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => SearchPage(
                      controller: controller,
                      initialCategory: topic,
                    ),
                  ),
                ),
              ),
            )
            .toList(),
      ),
      const SizedBox(height: 22),
      ...controller.feed.map(
        (item) => Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: ContentCard(item: item, controller: controller),
        ),
      ),
    ],
  );
}

class SearchPage extends StatefulWidget {
  const SearchPage({super.key, required this.controller, this.initialCategory});
  final AppController controller;
  final String? initialCategory;
  @override
  State<SearchPage> createState() => _SearchPageState();
}

class _SearchPageState extends State<SearchPage> {
  final query = TextEditingController();
  Timer? debounce;
  bool loading = false;
  String? category;
  @override
  void initState() {
    super.initState();
    category = widget.initialCategory;
  }

  @override
  void dispose() {
    debounce?.cancel();
    query.dispose();
    super.dispose();
  }

  void search(String value) {
    debounce?.cancel();
    debounce = Timer(const Duration(milliseconds: 280), () async {
      setState(() => loading = true);
      try {
        await widget.controller.search(value);
      } finally {
        if (mounted) setState(() => loading = false);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.controller;
    final results = c.searchResults
        .where(
          (item) =>
              category == null ||
              item.category.toLowerCase() == category!.toLowerCase(),
        )
        .toList();
    return Scaffold(
      appBar: AppBar(title: Text(AppStrings.get('search', c.locale))),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: query,
              autofocus: true,
              onChanged: search,
              decoration: InputDecoration(
                hintText: 'Titre, sujet ou mot-clé',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: loading
                    ? const Padding(
                        padding: EdgeInsets.all(14),
                        child: SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                      )
                    : IconButton(
                        onPressed: () {
                          query.clear();
                          search('');
                        },
                        icon: const Icon(Icons.close),
                      ),
              ),
            ),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(
              children: [
                ChoiceChip(
                  label: const Text('Tout'),
                  selected: category == null,
                  onSelected: (_) => setState(() => category = null),
                ),
                ...AppConfig.topics.map(
                  (topic) => Padding(
                    padding: const EdgeInsetsDirectional.only(start: 8),
                    child: ChoiceChip(
                      label: Text(topic),
                      selected: category == topic,
                      onSelected: (_) => setState(() => category = topic),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: results.isEmpty
                ? Center(
                    child: Text(
                      query.text.isEmpty
                          ? 'Saisissez un sujet pour commencer.'
                          : 'Aucun résultat dans les contenus disponibles.',
                    ),
                  )
                : ListView(
                    padding: const EdgeInsets.all(16),
                    children: results
                        .map(
                          (item) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: ContentCard(item: item, controller: c),
                          ),
                        )
                        .toList(),
                  ),
          ),
        ],
      ),
    );
  }
}

class ContentCard extends StatelessWidget {
  const ContentCard({
    super.key,
    required this.item,
    required this.controller,
    this.featured = false,
  });
  final ContentItem item;
  final AppController controller;
  final bool featured;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final saved = controller.saved.any((value) => value.id == item.id);
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: .985, end: 1),
      duration: const Duration(milliseconds: 230),
      curve: Curves.easeOut,
      builder: (context, scale, child) =>
          Transform.scale(scale: scale, child: child),
      child: Card(
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) =>
                  ArticlePage(controller: controller, slug: item.slug),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (item.coverUrl != null)
                ClipRRect(
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(18),
                  ),
                  child: AspectRatio(
                    aspectRatio: featured ? 1.65 : 1.9,
                    child: _ContentImage(item: item),
                  ),
                ),
              Padding(
                padding: const EdgeInsets.fromLTRB(15, 14, 15, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        _CategoryLabel(text: item.category),
                        const Spacer(),
                        Text(
                          _formatDate(item.publishedAt),
                          style: Theme.of(context).textTheme.labelSmall
                              ?.copyWith(color: TamusniPalette.muted),
                        ),
                      ],
                    ),
                    const SizedBox(height: 9),
                    Text(
                      item.title,
                      style:
                          (featured
                                  ? Theme.of(context).textTheme.titleLarge
                                  : Theme.of(context).textTheme.titleMedium)
                              ?.copyWith(
                                fontWeight: FontWeight.w700,
                                height: 1.25,
                              ),
                    ),
                    if (item.excerpt.isNotEmpty) ...[
                      const SizedBox(height: 7),
                      Text(
                        item.excerpt,
                        maxLines: featured ? 3 : 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          height: 1.45,
                          color: dark
                              ? TamusniPalette.silver
                              : TamusniPalette.muted,
                        ),
                      ),
                    ],
                    const SizedBox(height: 7),
                    Row(
                      children: [
                        Text(
                          item.type.toUpperCase(),
                          style: Theme.of(context).textTheme.labelSmall
                              ?.copyWith(
                                letterSpacing: .7,
                                color: TamusniPalette.blue,
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                        const Spacer(),
                        IconButton(
                          visualDensity: VisualDensity.compact,
                          tooltip: 'À voir plus tard',
                          onPressed: () => controller.authenticated
                              ? controller.toggleFavorite(item)
                              : _openSignIn(context, controller),
                          icon: Icon(
                            saved ? Icons.bookmark : Icons.bookmark_border,
                          ),
                        ),
                        IconButton(
                          visualDensity: VisualDensity.compact,
                          tooltip: 'Partager',
                          onPressed: () => controller.share(item),
                          icon: const Icon(Icons.ios_share_outlined),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ContentImage extends StatelessWidget {
  const _ContentImage({required this.item});
  final ContentItem item;
  @override
  Widget build(BuildContext context) {
    final path = item.localImagePath;
    if (path != null && File(path).existsSync()) {
      return Image.file(File(path), fit: BoxFit.cover);
    }
    final source = item.coverUrl;
    if (source == null) return const SizedBox.shrink();
    final url = source.startsWith('http')
        ? source
        : '${AppConfig.apiBaseUrl}$source';
    return CachedNetworkImage(
      imageUrl: url,
      fit: BoxFit.cover,
      placeholder: (_, _) =>
          Container(color: TamusniPalette.silver.withValues(alpha: .14)),
      errorWidget: (_, _, _) => Container(
        color: TamusniPalette.night,
        alignment: Alignment.center,
        child: const Icon(
          Icons.auto_awesome,
          color: TamusniPalette.silver,
          size: 30,
        ),
      ),
    );
  }
}

class ArticlePage extends StatefulWidget {
  const ArticlePage({super.key, required this.controller, required this.slug});
  final AppController controller;
  final String slug;
  @override
  State<ArticlePage> createState() => _ArticlePageState();
}

class _ArticlePageState extends State<ArticlePage> {
  late Future<ContentItem> future;
  bool liked = false;
  bool downloading = false;
  @override
  void initState() {
    super.initState();
    future = widget.controller.openArticle(widget.slug);
    unawaited(
      future.then((item) async {
        try {
          final state = await widget.controller.repository.markViewed(
            item.slug,
          );
          if (mounted) setState(() => liked = state['liked'] == true);
        } catch (_) {}
      }),
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Lecture'),
      actions: [
        IconButton(
          tooltip: 'Partager',
          onPressed: () async => widget.controller.share(await future),
          icon: const Icon(Icons.ios_share_outlined),
        ),
        IconButton(
          tooltip: 'À voir plus tard',
          onPressed: () async {
            if (!widget.controller.authenticated) {
              await _openSignIn(context, widget.controller);
              return;
            }
            await widget.controller.toggleFavorite(await future);
          },
          icon: const Icon(Icons.bookmark_border),
        ),
      ],
    ),
    body: FutureBuilder<ContentItem>(
      future: future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        if (!snapshot.hasData) {
          return _EmptyState(
            text: 'Ce contenu n’est pas disponible hors ligne.',
            onRetry: () => setState(
              () => future = widget.controller.openArticle(widget.slug),
            ),
          );
        }
        final item = snapshot.data!;
        return SelectionArea(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 36),
            children: [
              _CategoryLabel(text: item.category),
              const SizedBox(height: 10),
              Text(
                item.title,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                  height: 1.2,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                '${item.author} · ${_formatDate(item.publishedAt)}',
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: TamusniPalette.muted),
              ),
              if (item.coverUrl != null) ...[
                const SizedBox(height: 18),
                ClipRRect(
                  borderRadius: BorderRadius.circular(18),
                  child: AspectRatio(
                    aspectRatio: 1.55,
                    child: _ContentImage(item: item),
                  ),
                ),
              ],
              if (item.excerpt.isNotEmpty) ...[
                const SizedBox(height: 20),
                Text(
                  item.excerpt,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w500,
                    height: 1.5,
                  ),
                ),
              ],
              const SizedBox(height: 18),
              Text(
                item.body.isEmpty
                    ? 'Le texte intégral ne figure pas dans le cache hors ligne.'
                    : item.body,
                style: Theme.of(
                  context,
                ).textTheme.bodyLarge?.copyWith(fontSize: 17, height: 1.75),
              ),
              if (item.sources.isNotEmpty) ...[
                const SizedBox(height: 24),
                const _SectionTitle(title: 'Sources', icon: Icons.link),
                const SizedBox(height: 8),
                ...item.sources.map(
                  (source) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(
                      Icons.open_in_new,
                      color: TamusniPalette.blue,
                    ),
                    title: Text(
                      '${source['label'] ?? source['publisher'] ?? 'Source'}',
                    ),
                    subtitle: Text(
                      '${source['url'] ?? ''}',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    onTap: () => _openSource('${source['url'] ?? ''}'),
                  ),
                ),
              ],
              const SizedBox(height: 16),
              Row(
                children: [
                  IconButton(
                    tooltip: 'J’aime',
                    onPressed: () async {
                      try {
                        if (!widget.controller.authenticated) {
                          await _openSignIn(context, widget.controller);
                          return;
                        }
                        final result = await widget.controller.toggleLike(item);
                        if (mounted) {
                          setState(() => liked = result['liked'] == true);
                        }
                      } catch (error) {
                        if (mounted) _message('$error');
                      }
                    },
                    icon: Icon(
                      liked ? Icons.thumb_up : Icons.thumb_up_outlined,
                      color: liked ? TamusniPalette.blue : null,
                    ),
                  ),
                  Text('${item.likes}'),
                  const SizedBox(width: 16),
                  const Icon(
                    Icons.visibility_outlined,
                    size: 18,
                    color: TamusniPalette.muted,
                  ),
                  const SizedBox(width: 5),
                  Text('${item.views}'),
                  const Spacer(),
                  OutlinedButton.icon(
                    onPressed: downloading
                        ? null
                        : () async {
                            setState(() => downloading = true);
                            try {
                              await widget.controller.download(item);
                              if (mounted) {
                                _message('Article disponible hors ligne.');
                              }
                            } catch (error) {
                              if (mounted) _message('$error');
                            } finally {
                              if (mounted) setState(() => downloading = false);
                            }
                          },
                    icon: Icon(
                      item.downloaded
                          ? Icons.download_done
                          : Icons.download_outlined,
                    ),
                    label: Text(
                      downloading
                          ? '…'
                          : item.downloaded
                          ? 'Hors ligne'
                          : 'Télécharger',
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    ),
  );

  Future<void> _openSource(String value) async {
    final uri = Uri.tryParse(value);
    if (uri == null || uri.scheme != 'https') return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  void _message(String value) => ScaffoldMessenger.of(
    context,
  ).showSnackBar(SnackBar(content: Text(value)));
}

class FavoritesPage extends StatefulWidget {
  const FavoritesPage({super.key, required this.controller});
  final AppController controller;
  @override
  State<FavoritesPage> createState() => _FavoritesPageState();
}

class _FavoritesPageState extends State<FavoritesPage> {
  @override
  void initState() {
    super.initState();
    unawaited(widget.controller.refreshAccountData());
  }

  @override
  Widget build(BuildContext context) => RefreshIndicator(
    onRefresh: () => widget.controller.refreshAccountData(),
    child: widget.controller.saved.isEmpty
        ? const _EmptyState(text: 'Vos contenus enregistrés apparaîtront ici.')
        : ListView(
            padding: const EdgeInsets.all(16),
            children: widget.controller.saved
                .map(
                  (item) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: ContentCard(
                      item: item,
                      controller: widget.controller,
                    ),
                  ),
                )
                .toList(),
          ),
  );
}

class _TopicStrip extends StatelessWidget {
  const _TopicStrip({required this.controller});
  final AppController controller;
  @override
  Widget build(BuildContext context) => SizedBox(
    height: 44,
    child: ListView(
      scrollDirection: Axis.horizontal,
      children: AppConfig.topics
          .map(
            (topic) => Padding(
              padding: const EdgeInsetsDirectional.only(end: 8),
              child: ActionChip(
                label: Text(topic),
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => SearchPage(
                      controller: controller,
                      initialCategory: topic,
                    ),
                  ),
                ),
              ),
            ),
          )
          .toList(),
    ),
  );
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title, required this.icon});
  final String title;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Row(
    children: [
      Icon(icon, color: TamusniPalette.blue, size: 19),
      const SizedBox(width: 8),
      Text(
        title,
        style: Theme.of(
          context,
        ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
      ),
    ],
  );
}

class _CategoryLabel extends StatelessWidget {
  const _CategoryLabel({required this.text});
  final String text;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
    decoration: BoxDecoration(
      color: TamusniPalette.blue.withValues(alpha: .09),
      borderRadius: BorderRadius.circular(7),
    ),
    child: Text(
      text.toUpperCase(),
      style: const TextStyle(
        color: TamusniPalette.blue,
        fontSize: 10,
        fontWeight: FontWeight.w700,
        letterSpacing: .5,
      ),
    ),
  );
}

class _OfflineBanner extends StatelessWidget {
  const _OfflineBanner({required this.locale});
  final String locale;
  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 14),
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
    decoration: BoxDecoration(
      color: TamusniPalette.silver.withValues(alpha: .18),
      borderRadius: BorderRadius.circular(10),
    ),
    child: Row(
      children: [
        const Icon(Icons.cloud_off_outlined, size: 17),
        const SizedBox(width: 8),
        Text(
          AppStrings.get('offline', locale),
          style: Theme.of(context).textTheme.labelMedium,
        ),
      ],
    ),
  );
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.text, this.onRetry});
  final String text;
  final FutureOr<void> Function()? onRetry;
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.inbox_outlined,
            size: 38,
            color: TamusniPalette.silver,
          ),
          const SizedBox(height: 12),
          Text(
            text,
            textAlign: TextAlign.center,
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(color: TamusniPalette.muted),
          ),
          if (onRetry != null) ...[
            const SizedBox(height: 12),
            TextButton.icon(
              onPressed: () => onRetry!(),
              icon: const Icon(Icons.refresh),
              label: Text(AppStrings.get('retry', 'fr')),
            ),
          ],
        ],
      ),
    ),
  );
}

String _formatDate(String value) {
  final date = DateTime.tryParse(value);
  if (date == null) return '';
  return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
}

Future<void> _openSignIn(BuildContext context, AppController controller) async {
  await Navigator.of(context).push(
    MaterialPageRoute<void>(builder: (_) => AuthScreen(controller: controller)),
  );
}

class NotificationsPage extends StatefulWidget {
  const NotificationsPage({super.key, required this.controller});
  final AppController controller;
  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  bool loading = false;
  Future<void> reload() async {
    setState(() => loading = true);
    try {
      if (widget.controller.role == 'ADMIN') {
        await widget.controller.loadAdminNotifications();
      } else {
        await widget.controller.refreshAccountData();
      }
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  void initState() {
    super.initState();
    unawaited(reload());
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(AppStrings.get('notifications', widget.controller.locale)),
    ),
    body: RefreshIndicator(
      onRefresh: reload,
      child: loading && widget.controller.notifications.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : widget.controller.notifications.isEmpty
          ? ListView(
              children: [
                SizedBox(height: MediaQuery.sizeOf(context).height * .3),
                const _EmptyState(text: 'Vos notifications apparaîtront ici.'),
              ],
            )
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: widget.controller.notifications.length,
              separatorBuilder: (_, _) => const SizedBox(height: 8),
              itemBuilder: (context, index) {
                final item = widget.controller.notifications[index];
                final id = '${item['id'] ?? ''}';
                final read = item['read_at'] != null;
                return Dismissible(
                  key: ValueKey(id),
                  direction: DismissDirection.endToStart,
                  background: Container(
                    alignment: AlignmentDirectional.centerEnd,
                    padding: const EdgeInsets.all(16),
                    color: Theme.of(context).colorScheme.error,
                    child: const Icon(
                      Icons.delete_outline,
                      color: Colors.white,
                    ),
                  ),
                  onDismissed: (_) => widget.controller.role == 'ADMIN'
                      ? widget.controller.deleteAdminNotification(id)
                      : widget.controller.deleteNotification(id),
                  child: Card(
                    child: ListTile(
                      leading: Icon(
                        read
                            ? Icons.notifications_none
                            : Icons.notifications_active_outlined,
                        color: read
                            ? TamusniPalette.muted
                            : TamusniPalette.blue,
                      ),
                      title: Text(
                        '${item['title'] ?? 'TAMUSNI'}',
                        style: TextStyle(
                          fontWeight: read ? FontWeight.w400 : FontWeight.w700,
                        ),
                      ),
                      subtitle: Text('${item['created_at'] ?? ''}'),
                      onTap: () async {
                        if (widget.controller.role == 'ADMIN') {
                          await widget.controller.updateAdminNotification(
                            id,
                            read: !read,
                          );
                        } else {
                          await widget.controller.notificationRead(id, !read);
                        }
                        final url =
                            '${item['url'] ?? item['target_url'] ?? ''}';
                        if (url.contains('/article/')) {
                          final slug = RegExp(
                            r'/article/([^/?#]+)',
                          ).firstMatch(url)?.group(1);
                          if (slug != null && context.mounted) {
                            Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => ArticlePage(
                                  controller: widget.controller,
                                  slug: slug,
                                ),
                              ),
                            );
                          }
                        }
                      },
                      trailing: IconButton(
                        tooltip: 'Supprimer',
                        onPressed: () => widget.controller.role == 'ADMIN'
                            ? widget.controller.deleteAdminNotification(id)
                            : widget.controller.deleteNotification(id),
                        icon: const Icon(Icons.close),
                      ),
                    ),
                  ),
                );
              },
            ),
    ),
  );
}

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key, required this.controller});
  final AppController controller;
  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  final name = TextEditingController();
  final bio = TextEditingController();
  final oldPassword = TextEditingController();
  final newPassword = TextEditingController();
  final confirmPassword = TextEditingController();
  final deletePassword = TextEditingController();
  List<String> topics = [];
  bool newsletter = false;
  bool pushEnabled = false;
  bool loading = true;
  Map<String, dynamic> profile = {};

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load() async {
    try {
      final data = await widget.controller.account();
      profile = Map<String, dynamic>.from(data['profile'] as Map? ?? const {});
      pushEnabled = widget.controller.pushEnabled;
      name.text = '${profile['name'] ?? ''}';
      bio.text = '${profile['bio'] ?? ''}';
      topics = (data['topics'] as List? ?? const [])
          .whereType<Map>()
          .map((e) => '${e['topic']}')
          .toList();
      newsletter = await widget.controller.getNewsletterStatus();
    } catch (error) {
      if (mounted) _toast('$error');
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  void dispose() {
    name.dispose();
    bio.dispose();
    oldPassword.dispose();
    newPassword.dispose();
    confirmPassword.dispose();
    deletePassword.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.controller;
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 12, 18, 30),
      children: [
        Text(
          AppStrings.get('profile', c.locale),
          style: Theme.of(
            context,
          ).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 6),
        Text(
          '${profile['email'] ?? c.user?['email'] ?? ''} · ${c.role}',
          style: Theme.of(
            context,
          ).textTheme.bodyMedium?.copyWith(color: TamusniPalette.muted),
        ),
        if (loading) const LinearProgressIndicator(),
        const SizedBox(height: 18),
        TextField(
          controller: name,
          decoration: const InputDecoration(
            labelText: 'Nom affiché',
            prefixIcon: Icon(Icons.person_outline),
          ),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: bio,
          maxLines: 2,
          decoration: const InputDecoration(
            labelText: 'À propos de vous',
            prefixIcon: Icon(Icons.notes),
          ),
        ),
        const SizedBox(height: 16),
        Text(
          'Rubriques préférées',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 4,
          children: AppConfig.topics
              .map(
                (topic) => FilterChip(
                  label: Text(topic),
                  selected: topics.contains(topic),
                  onSelected: (selected) => setState(() {
                    selected ? topics.add(topic) : topics.remove(topic);
                  }),
                ),
              )
              .toList(),
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          initialValue: c.locale,
          decoration: const InputDecoration(labelText: 'Langue'),
          items: const [
            DropdownMenuItem(value: 'fr', child: Text('Français')),
            DropdownMenuItem(value: 'ar', child: Text('العربية')),
            DropdownMenuItem(value: 'en', child: Text('English')),
            DropdownMenuItem(value: 'es', child: Text('Español')),
            DropdownMenuItem(value: 'pt', child: Text('Português')),
          ],
          onChanged: (value) {
            if (value != null) c.setLocale(value);
          },
        ),
        const SizedBox(height: 10),
        DropdownButtonFormField<ThemeMode>(
          initialValue: c.themeMode,
          decoration: const InputDecoration(labelText: 'Apparence'),
          items: const [
            DropdownMenuItem(
              value: ThemeMode.system,
              child: Text('Selon l’appareil'),
            ),
            DropdownMenuItem(value: ThemeMode.light, child: Text('Clair')),
            DropdownMenuItem(value: ThemeMode.dark, child: Text('Sombre')),
          ],
          onChanged: (value) {
            if (value != null) c.setTheme(value);
          },
        ),
        const SizedBox(height: 12),
        FilledButton.icon(
          onPressed: _saveProfile,
          icon: const Icon(Icons.save_outlined),
          label: const Text('Enregistrer le profil'),
        ),
        const Divider(height: 36),
        SwitchListTile(
          title: const Text('Newsletter TAMUSNI'),
          subtitle: const Text('Recevoir ou arrêter les envois éditoriaux.'),
          value: newsletter,
          onChanged: (value) async {
            try {
              await c.setNewsletter(value);
              setState(() => newsletter = value);
            } catch (e) {
              _toast('$e');
            }
          },
        ),
        SwitchListTile(
          secondary: const Icon(Icons.notifications_active_outlined),
          title: const Text('Notifications sur cet appareil'),
          subtitle: const Text(
            'Recevoir les alertes TAMUSNI sur cet appareil.',
          ),
          value: pushEnabled,
          onChanged: (value) async {
            try {
              if (value) {
                final accepted = await showDialog<bool>(
                  context: context,
                  builder: (context) => AlertDialog(
                    title: const Text('Activer les notifications ?'),
                    content: const Text(
                      'TAMUSNI vous préviendra des nouveaux contenus de vos rubriques et du suivi de vos propositions. Vous pourrez les désactiver ici à tout moment.',
                    ),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(context, false),
                        child: const Text('Plus tard'),
                      ),
                      FilledButton(
                        onPressed: () => Navigator.pop(context, true),
                        child: const Text('Continuer'),
                      ),
                    ],
                  ),
                );
                if (accepted != true) return;
                await c.enablePush();
              } else {
                await c.disablePush();
              }
              if (mounted) setState(() => pushEnabled = value);
            } catch (e) {
              _toast('$e');
            }
          },
        ),
        const Divider(height: 32),
        Text(
          'Sécurité du compte',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 10),
        TextField(
          controller: oldPassword,
          obscureText: true,
          decoration: const InputDecoration(labelText: 'Mot de passe actuel'),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: newPassword,
          obscureText: true,
          decoration: const InputDecoration(
            labelText: 'Nouveau mot de passe · 6 caractères minimum',
          ),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: confirmPassword,
          obscureText: true,
          decoration: const InputDecoration(
            labelText: 'Confirmer le mot de passe',
          ),
        ),
        const SizedBox(height: 10),
        OutlinedButton.icon(
          onPressed: _changePassword,
          icon: const Icon(Icons.lock_reset),
          label: const Text('Modifier le mot de passe'),
        ),
        const SizedBox(height: 10),
        OutlinedButton.icon(
          onPressed: () async {
            await c.logout();
          },
          icon: const Icon(Icons.logout),
          label: const Text('Déconnexion'),
        ),
        if (c.role != 'ADMIN') ...[
          const SizedBox(height: 24),
          Text(
            'Suppression définitive du compte',
            style: TextStyle(
              color: Theme.of(context).colorScheme.error,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: deletePassword,
            obscureText: true,
            decoration: const InputDecoration(
              labelText: 'Mot de passe pour confirmer',
            ),
          ),
          TextButton.icon(
            onPressed: _deleteAccount,
            icon: const Icon(Icons.delete_outline),
            label: const Text('Demander la suppression du compte'),
          ),
        ],
      ],
    );
  }

  Future<void> _saveProfile() async {
    if (topics.isEmpty) {
      return _toast('Choisissez au moins une rubrique préférée.');
    }
    try {
      await widget.controller.updateProfile({
        'name': name.text.trim(),
        'email':
            '${profile['email'] ?? widget.controller.user?['email'] ?? ''}',
        'bio': bio.text.trim(),
        'preferredTopics': topics,
        'language': widget.controller.locale,
        'theme': switch (widget.controller.themeMode) {
          ThemeMode.light => 'light',
          ThemeMode.dark => 'dark',
          _ => 'auto',
        },
        'notifications': true,
      });
      _toast('Profil enregistré.');
    } catch (e) {
      _toast('$e');
    }
  }

  Future<void> _changePassword() async {
    try {
      await widget.controller.changePassword(
        oldPassword.text,
        newPassword.text,
        confirmPassword.text,
      );
      oldPassword.clear();
      newPassword.clear();
      confirmPassword.clear();
      _toast('Mot de passe modifié.');
    } catch (e) {
      _toast('$e');
    }
  }

  Future<void> _deleteAccount() async {
    if (!mounted) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Supprimer le compte ?'),
        content: const Text(
          'Cette action est définitive. Un code de confirmation sera envoyé à votre adresse e-mail.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Annuler'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Continuer'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await widget.controller.requestAccountDeletion(deletePassword.text);
      if (mounted) _toast('Code de confirmation envoyé par e-mail.');
    } catch (e) {
      _toast('$e');
    }
  }

  void _toast(String text) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
    }
  }
}

class ContributorListPage extends StatefulWidget {
  const ContributorListPage({super.key, required this.controller});
  final AppController controller;
  @override
  State<ContributorListPage> createState() => _ContributorListPageState();
}

class _ContributorListPageState extends State<ContributorListPage> {
  bool loading = false;
  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      await widget.controller.loadContributorSubmissions();
    } catch (e) {
      _toast('$e');
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Mes propositions'),
      actions: [
        IconButton(
          tooltip: 'Actualiser',
          onPressed: _load,
          icon: const Icon(Icons.refresh),
        ),
      ],
    ),
    body: loading && widget.controller.submissions.isEmpty
        ? const Center(child: CircularProgressIndicator())
        : widget.controller.submissions.isEmpty
        ? const _EmptyState(
            text:
                'Aucune proposition. Créez un brouillon ou soumettez un contenu à la rédaction.',
          )
        : RefreshIndicator(
            onRefresh: _load,
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: widget.controller.submissions.length,
              separatorBuilder: (_, _) => const SizedBox(height: 8),
              itemBuilder: (context, i) {
                final item = widget.controller.submissions[i];
                return Card(
                  child: ListTile(
                    leading: const Icon(Icons.article_outlined),
                    title: Text('${item['title'] ?? 'Sans titre'}'),
                    subtitle: Text(
                      '${item['type'] ?? ''} · ${item['category'] ?? ''} · ${item['status'] ?? ''}',
                    ),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () async {
                      try {
                        final complete = await widget.controller
                            .loadContributorSubmission('${item['id']}');
                        if (!context.mounted) return;
                        await Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => ContributorEditorPage(
                              controller: widget.controller,
                              existing: complete,
                            ),
                          ),
                        );
                        await _load();
                      } catch (e) {
                        _toast('$e');
                      }
                    },
                  ),
                );
              },
            ),
          ),
  );
  void _toast(String value) {
    if (mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(value)));
    }
  }
}

class ContributorEditorPage extends StatefulWidget {
  const ContributorEditorPage({
    super.key,
    required this.controller,
    this.existing,
  });
  final AppController controller;
  final Map<String, dynamic>? existing;
  @override
  State<ContributorEditorPage> createState() => _ContributorEditorPageState();
}

class _ContributorEditorPageState extends State<ContributorEditorPage> {
  late final TextEditingController title, excerpt, body, sourceUrl, sourceLabel;
  String type = 'article';
  String category = AppConfig.topics.first;
  String? coverUrl;
  bool busy = false;
  @override
  void initState() {
    super.initState();
    final item = widget.existing ?? const <String, dynamic>{};
    title = TextEditingController(text: '${item['title'] ?? ''}');
    excerpt = TextEditingController(text: '${item['excerpt'] ?? ''}');
    body = TextEditingController(text: '${item['body'] ?? ''}');
    sourceUrl = TextEditingController();
    sourceLabel = TextEditingController();
    type = '${item['type'] ?? 'article'}';
    category = '${item['category'] ?? AppConfig.topics.first}';
    coverUrl = item['cover_url'] as String?;
    final sources = (item['sources'] as List? ?? const []).whereType<Map>();
    if (sources.isNotEmpty) {
      sourceLabel.text = '${sources.first['label'] ?? ''}';
      sourceUrl.text = '${sources.first['url'] ?? ''}';
    }
  }

  @override
  void dispose() {
    title.dispose();
    excerpt.dispose();
    body.dispose();
    sourceUrl.dispose();
    sourceLabel.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(
        widget.existing == null
            ? 'Nouvelle proposition'
            : 'Modifier la proposition',
      ),
    ),
    body: ListView(
      padding: const EdgeInsets.all(18),
      children: [
        DropdownButtonFormField<String>(
          initialValue: type,
          decoration: const InputDecoration(labelText: 'Format'),
          items: const [
            DropdownMenuItem(value: 'article', child: Text('Article')),
            DropdownMenuItem(value: 'brief', child: Text('Brève')),
          ],
          onChanged: (v) => setState(() => type = v ?? type),
        ),
        const SizedBox(height: 10),
        DropdownButtonFormField<String>(
          initialValue: category,
          decoration: const InputDecoration(labelText: 'Rubrique'),
          items: AppConfig.topics
              .map((v) => DropdownMenuItem(value: v, child: Text(v)))
              .toList(),
          onChanged: (v) => setState(() => category = v ?? category),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: title,
          decoration: const InputDecoration(labelText: 'Titre'),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: excerpt,
          maxLines: 3,
          decoration: const InputDecoration(labelText: 'Sous-titre / résumé'),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: body,
          minLines: 8,
          maxLines: 20,
          decoration: const InputDecoration(labelText: 'Texte du contenu'),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: sourceLabel,
          decoration: const InputDecoration(labelText: 'Nom de la source'),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: sourceUrl,
          keyboardType: TextInputType.url,
          decoration: const InputDecoration(
            labelText: 'Lien https de la source',
          ),
        ),
        const SizedBox(height: 10),
        OutlinedButton.icon(
          onPressed: busy ? null : _pickCover,
          icon: const Icon(Icons.image_outlined),
          label: Text(coverUrl == null ? 'Ajouter une image' : 'Image ajoutée'),
        ),
        const SizedBox(height: 18),
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: busy ? null : () => _save('draft'),
                child: const Text('Enregistrer le brouillon'),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: FilledButton(
                onPressed: busy ? null : () => _save('submit'),
                child: const Text('Soumettre à la rédaction'),
              ),
            ),
          ],
        ),
      ],
    ),
  );

  Future<void> _pickCover() async {
    try {
      final file = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        imageQuality: 85,
        maxWidth: 1800,
      );
      if (file == null) return;
      final bytes = await file.readAsBytes();
      final decoded = image_lib.decodeImage(bytes);
      if (decoded == null) throw const FormatException('Image illisible.');
      final resized = image_lib.copyResize(
        decoded,
        width: decoded.width > 1400 ? 1400 : decoded.width,
      );
      final jpeg = image_lib.encodeJpg(resized, quality: 78);
      final response = await widget.controller.uploadCover(base64Encode(jpeg));
      setState(() => coverUrl = '${response['url'] ?? ''}');
    } catch (e) {
      _toast('$e');
    }
  }

  Future<void> _save(String action) async {
    if (title.text.trim().length < 5 ||
        excerpt.text.trim().isEmpty ||
        body.text.trim().isEmpty) {
      return _toast('Complétez le titre, le résumé et le texte.');
    }
    setState(() => busy = true);
    try {
      await widget.controller.saveSubmission({
        if (widget.existing?['id'] != null) 'id': widget.existing!['id'],
        'action': action,
        'type': type,
        'category': category,
        'title': title.text.trim(),
        'excerpt': excerpt.text.trim(),
        'body': body.text.trim(),
        'coverUrl': coverUrl,
        'sources': sourceUrl.text.trim().isEmpty
            ? []
            : [
                {
                  'label': sourceLabel.text.trim(),
                  'url': sourceUrl.text.trim(),
                },
              ],
      });
      if (mounted) {
        _toast(
          action == 'draft'
              ? 'Brouillon enregistré.'
              : 'Proposition envoyée à la rédaction.',
        );
        Navigator.pop(context);
      }
    } catch (e) {
      _toast('$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  void _toast(String value) {
    if (mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(value)));
    }
  }
}

class AdminPage extends StatefulWidget {
  const AdminPage({super.key, required this.controller});
  final AppController controller;
  @override
  State<AdminPage> createState() => _AdminPageState();
}

class _AdminPageState extends State<AdminPage>
    with SingleTickerProviderStateMixin {
  late final TabController tabs = TabController(length: 4, vsync: this);
  bool busy = false;
  String _contentType = '';
  String _contentCategory = '';
  @override
  void initState() {
    super.initState();
    unawaited(_loadAll());
  }

  @override
  void dispose() {
    tabs.dispose();
    super.dispose();
  }

  Future<void> _loadAll() async {
    setState(() => busy = true);
    try {
      await Future.wait([
        widget.controller.loadAdminOverview(),
        widget.controller.loadAdminSubmissions(),
        widget.controller.loadAdminUsers(),
        widget.controller.loadAdminContent(),
      ]);
    } catch (e) {
      _toast('$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Administration'),
      actions: [
        IconButton(
          tooltip: 'Actualiser',
          onPressed: _loadAll,
          icon: const Icon(Icons.refresh),
        ),
        IconButton(
          tooltip: 'Créer un contenu',
          onPressed: _editContent,
          icon: const Icon(Icons.add_circle_outline),
        ),
      ],
      bottom: TabBar(
        controller: tabs,
        isScrollable: true,
        tabs: const [
          Tab(text: 'Vue générale'),
          Tab(text: 'Propositions'),
          Tab(text: 'Comptes'),
          Tab(text: 'Contenus'),
        ],
      ),
    ),
    body: busy && widget.controller.adminOverview == null
        ? const Center(child: CircularProgressIndicator())
        : TabBarView(
            controller: tabs,
            children: [_overview(), _submissions(), _users(), _contents()],
          ),
  );
  Widget _overview() {
    final data = widget.controller.adminOverview ?? const {};
    final counts = data['counts'] is Map
        ? Map<String, dynamic>.from(data['counts'] as Map)
        : data;
    return RefreshIndicator(
      onRefresh: _loadAll,
      child: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          Text(
            'Vue générale',
            style: Theme.of(context).textTheme.headlineMedium,
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: counts.entries
                .map(
                  (entry) => SizedBox(
                    width: 150,
                    child: Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              entry.key,
                              style: Theme.of(context).textTheme.labelMedium,
                            ),
                            const SizedBox(height: 8),
                            Text(
                              '${entry.value}',
                              style: Theme.of(context).textTheme.headlineSmall
                                  ?.copyWith(fontWeight: FontWeight.w700),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: 18),
          ListTile(
            leading: const Icon(Icons.rate_review_outlined),
            title: const Text('Propositions à examiner'),
            trailing: Text(
              '${widget.controller.submissions.where((e) => e['status'] == 'review').length}',
            ),
          ),
          ListTile(
            leading: const Icon(Icons.people_outline),
            title: const Text('Comptes utilisateurs'),
            trailing: Text('${widget.controller.adminUsers.length}'),
          ),
        ],
      ),
    );
  }

  Widget _submissions() => RefreshIndicator(
    onRefresh: widget.controller.loadAdminSubmissions,
    child: ListView(
      padding: const EdgeInsets.all(14),
      children: widget.controller.submissions
          .map(
            (item) => Card(
              child: Padding(
                padding: const EdgeInsets.all(8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ListTile(
                      title: Text('${item['title'] ?? 'Sans titre'}'),
                      subtitle: Text(
                        '${item['type'] ?? ''} · ${item['category'] ?? ''} · ${item['status'] ?? ''}',
                      ),
                    ),
                    ListTile(title: Text('${item['excerpt'] ?? ''}')),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        TextButton.icon(
                          onPressed: () => _review(item, false),
                          icon: const Icon(Icons.close),
                          label: const Text('Refuser'),
                        ),
                        const SizedBox(width: 8),
                        FilledButton.icon(
                          onPressed: () => _review(item, true),
                          icon: const Icon(Icons.check),
                          label: const Text('Approuver'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          )
          .toList(),
    ),
  );
  Widget _users() => RefreshIndicator(
    onRefresh: widget.controller.loadAdminUsers,
    child: ListView(
      padding: const EdgeInsets.all(14),
      children: [
        FilledButton.icon(
          onPressed: _createUser,
          icon: const Icon(Icons.person_add_alt_1),
          label: const Text('Créer un compte'),
        ),
        const SizedBox(height: 10),
        ...widget.controller.adminUsers.map((user) {
          final id = '${user['id'] ?? ''}';
          final banned = user['is_banned'] == true || user['is_banned'] == 1;
          return Card(
            child: ListTile(
              leading: CircleAvatar(
                child: Text(
                  '${user['name'] ?? '?'}'.characters.first.toUpperCase(),
                ),
              ),
              title: Text('${user['name'] ?? 'Compte'}'),
              subtitle: Text(
                '${user['email'] ?? ''} · ${user['role'] ?? 'USER'}',
              ),
              onTap: () => _showUserDetails(user),
              trailing: PopupMenuButton<String>(
                onSelected: (action) async {
                  try {
                    if (action == 'ban' || action == 'unban') {
                      await widget.controller.setUserBanned(
                        id,
                        action == 'ban',
                      );
                    } else if (action == 'delete') {
                      await _deleteUser(user);
                    } else {
                      await widget.controller.setUserRole(id, action);
                    }
                  } catch (e) {
                    _toast('$e');
                  }
                },
                itemBuilder: (_) => [
                  PopupMenuItem(
                    value: banned ? 'unban' : 'ban',
                    child: Text(banned ? 'Réactiver' : 'Bannir'),
                  ),
                  const PopupMenuItem(
                    value: 'USER',
                    child: Text('Rôle utilisateur'),
                  ),
                  const PopupMenuItem(
                    value: 'CONTRIBUTOR',
                    child: Text('Rôle contributeur'),
                  ),
                  const PopupMenuItem(
                    value: 'delete',
                    child: Text('Supprimer définitivement'),
                  ),
                ],
              ),
            ),
          );
        }),
      ],
    ),
  );
  Widget _contents() {
    final items = widget.controller.adminContent.where((item) {
      final matchesType = _contentType.isEmpty || item['type'] == _contentType;
      final matchesCategory =
          _contentCategory.isEmpty || item['category'] == _contentCategory;
      return matchesType && matchesCategory;
    }).toList();
    return RefreshIndicator(
      onRefresh: widget.controller.loadAdminContent,
      child: ListView(
        padding: const EdgeInsets.all(14),
        children: [
          FilledButton.icon(
            onPressed: _editContent,
            icon: const Icon(Icons.add),
            label: const Text('Créer un contenu'),
          ),
          const SizedBox(height: 8),
          DropdownButtonFormField<String>(
            initialValue: _contentType,
            decoration: const InputDecoration(labelText: 'Filtrer par format'),
            items: const [
              DropdownMenuItem(value: '', child: Text('Tous les formats')),
              DropdownMenuItem(value: 'article', child: Text('Articles')),
              DropdownMenuItem(value: 'brief', child: Text('Brèves')),
              DropdownMenuItem(value: 'video', child: Text('Vidéos')),
              DropdownMenuItem(value: 'interview', child: Text('Interviews')),
              DropdownMenuItem(value: 'podcast', child: Text('Podcasts')),
            ],
            onChanged: (value) => setState(() => _contentType = value ?? ''),
          ),
          const SizedBox(height: 8),
          DropdownButtonFormField<String>(
            initialValue: _contentCategory,
            decoration: const InputDecoration(
              labelText: 'Filtrer par rubrique',
            ),
            items: [
              const DropdownMenuItem(
                value: '',
                child: Text('Toutes les rubriques'),
              ),
              ...AppConfig.topics.map(
                (topic) => DropdownMenuItem(value: topic, child: Text(topic)),
              ),
            ],
            onChanged: (value) =>
                setState(() => _contentCategory = value ?? ''),
          ),
          const SizedBox(height: 12),
          ...items.map(
            (item) => Card(
              child: ListTile(
                title: Text('${item['title'] ?? ''}'),
                subtitle: Text(
                  '${item['type'] ?? ''} · ${item['category'] ?? ''} · ${item['status'] ?? ''}',
                ),
                onTap: () => _editContent(item),
                trailing: IconButton(
                  tooltip: 'Supprimer',
                  onPressed: () => _deleteContent(item),
                  icon: const Icon(Icons.delete_outline),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _createUser() async {
    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (context) => const _AdminCreateUserDialog(),
    );
    if (result == null) return;
    try {
      await widget.controller.createAdminUser(result);
      _toast('Compte créé.');
    } catch (error) {
      _toast('$error');
    }
  }

  Future<void> _showUserDetails(Map<String, dynamic> user) async {
    try {
      final data = await widget.controller.getAdminUserDetails('${user['id']}');
      if (!mounted) return;
      final detail = Map<String, dynamic>.from(data['user'] as Map? ?? user);
      final subscriptions = (data['subscriptions'] as List? ?? const [])
          .whereType<Map>()
          .map((item) => '${item['topic']}')
          .join(', ');
      final history = (data['history'] as List? ?? const [])
          .whereType<Map>()
          .toList();
      final saved = (data['saved'] as List? ?? const [])
          .whereType<Map>()
          .toList();
      final events = (data['events'] as List? ?? const [])
          .whereType<Map>()
          .toList();
      await showDialog<void>(
        context: context,
        builder: (context) => AlertDialog(
          title: Text('${detail['name'] ?? 'Compte utilisateur'}'),
          content: SizedBox(
            width: 520,
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('${detail['email'] ?? ''}'),
                  Text(
                    'Rôle : ${detail['role'] ?? 'USER'} · Créé le ${detail['created_at'] ?? '—'}',
                  ),
                  Text(
                    'Langue : ${detail['preferred_language'] ?? '—'} · Thèmes : ${subscriptions.isEmpty ? '—' : subscriptions}',
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Historique de lecture (${history.length})',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  ...history.map(
                    (row) => ListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      title: Text('${row['title'] ?? 'Article supprimé'}'),
                      subtitle: Text(
                        '${row['last_read_at'] ?? ''} · ${row['progress'] ?? 0}%',
                      ),
                    ),
                  ),
                  Text(
                    'Favoris (${saved.length})',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  ...saved.map((row) => Text('• ${row['title'] ?? ''}')),
                  const SizedBox(height: 10),
                  Text(
                    'Connexions récentes (${events.length})',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  ...events
                      .take(5)
                      .map(
                        (row) => Text(
                          '• ${row['event'] ?? ''} · ${row['country'] ?? '—'} · ${row['created_at'] ?? ''}',
                        ),
                      ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Fermer'),
            ),
          ],
        ),
      );
    } catch (error) {
      _toast('$error');
    }
  }

  Future<void> _deleteUser(Map<String, dynamic> user) async {
    final accepted = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Supprimer ce compte ?'),
        content: Text(
          'La suppression de ${user['email'] ?? 'ce compte'} est définitive.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Annuler'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Supprimer'),
          ),
        ],
      ),
    );
    if (accepted != true) return;
    try {
      await widget.controller.deleteAdminUser('${user['id']}');
      _toast('Compte supprimé.');
    } catch (error) {
      _toast('$error');
    }
  }

  Future<void> _review(Map<String, dynamic> item, bool approve) async {
    final id = '${item['id'] ?? ''}';
    var reason = '';
    if (!approve) {
      final result = await showDialog<String>(
        context: context,
        builder: (context) {
          final field = TextEditingController();
          return AlertDialog(
            title: const Text('Motif du refus'),
            content: TextField(
              controller: field,
              minLines: 2,
              maxLines: 4,
              decoration: const InputDecoration(
                hintText: 'Expliquez les corrections nécessaires',
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Annuler'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, field.text),
                child: const Text('Refuser'),
              ),
            ],
          );
        },
      );
      if (result == null) return;
      reason = result;
    }
    try {
      await widget.controller.reviewSubmission(
        id,
        approve: approve,
        reason: reason,
      );
      _toast(approve ? 'Contenu approuvé.' : 'Retour envoyé au contributeur.');
    } catch (e) {
      _toast('$e');
    }
  }

  Future<void> _editContent([Map<String, dynamic>? existing]) async {
    final form = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (context) => _AdminContentDialog(existing: existing),
    );
    if (form == null) return;
    try {
      await widget.controller.saveAdminContent(
        form,
        id: existing?['id']?.toString(),
      );
      _toast('Contenu enregistré.');
    } catch (e) {
      _toast('$e');
    }
  }

  Future<void> _deleteContent(Map<String, dynamic> item) async {
    final accepted = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Supprimer ce contenu ?'),
        content: Text('${item['title'] ?? ''}'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Annuler'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Supprimer'),
          ),
        ],
      ),
    );
    if (accepted != true) return;
    try {
      await widget.controller.deleteAdminContent('${item['id']}');
      _toast('Contenu supprimé.');
    } catch (e) {
      _toast('$e');
    }
  }

  void _toast(String value) {
    if (mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(value)));
    }
  }
}

class _AdminContentDialog extends StatefulWidget {
  const _AdminContentDialog({this.existing});
  final Map<String, dynamic>? existing;
  @override
  State<_AdminContentDialog> createState() => _AdminContentDialogState();
}

class _AdminContentDialogState extends State<_AdminContentDialog> {
  late final TextEditingController title,
      excerpt,
      body,
      slug,
      sourceLabel,
      sourceUrl,
      imageUrl,
      mediaUrl,
      scheduledAt;
  late String type, category, status;
  @override
  void initState() {
    super.initState();
    final item = widget.existing ?? const <String, dynamic>{};
    title = TextEditingController(text: '${item['title'] ?? ''}');
    excerpt = TextEditingController(text: '${item['excerpt'] ?? ''}');
    body = TextEditingController(text: '${item['body'] ?? ''}');
    slug = TextEditingController(text: '${item['slug'] ?? ''}');
    sourceLabel = TextEditingController();
    sourceUrl = TextEditingController();
    imageUrl = TextEditingController(text: '${item['cover_url'] ?? ''}');
    mediaUrl = TextEditingController(text: '${item['media_url'] ?? ''}');
    scheduledAt = TextEditingController(text: '${item['scheduled_at'] ?? ''}');
    type = '${item['type'] ?? 'article'}';
    category = '${item['category'] ?? AppConfig.topics.first}';
    status = '${item['status'] ?? 'draft'}';
  }

  @override
  void dispose() {
    title.dispose();
    excerpt.dispose();
    body.dispose();
    slug.dispose();
    sourceLabel.dispose();
    sourceUrl.dispose();
    imageUrl.dispose();
    mediaUrl.dispose();
    scheduledAt.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(
      widget.existing == null ? 'Nouveau contenu' : 'Modifier le contenu',
    ),
    content: SizedBox(
      width: 520,
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            DropdownButtonFormField<String>(
              initialValue: type,
              decoration: const InputDecoration(labelText: 'Type'),
              items: const [
                'article',
                'brief',
                'video',
                'interview',
                'podcast',
              ].map((v) => DropdownMenuItem(value: v, child: Text(v))).toList(),
              onChanged: (v) => setState(() => type = v ?? type),
            ),
            DropdownButtonFormField<String>(
              initialValue: category,
              decoration: const InputDecoration(labelText: 'Rubrique'),
              items: AppConfig.topics
                  .map((v) => DropdownMenuItem(value: v, child: Text(v)))
                  .toList(),
              onChanged: (v) => setState(() => category = v ?? category),
            ),
            DropdownButtonFormField<String>(
              initialValue: status,
              decoration: const InputDecoration(labelText: 'État'),
              items: const [
                'draft',
                'review',
                'scheduled',
                'published',
                'archived',
              ].map((v) => DropdownMenuItem(value: v, child: Text(v))).toList(),
              onChanged: (v) => setState(() => status = v ?? status),
            ),
            if (status == 'scheduled')
              TextField(
                controller: scheduledAt,
                decoration: const InputDecoration(
                  labelText: 'Date de publication (ISO 8601 UTC)',
                  hintText: '2026-10-12T06:00:00Z',
                ),
              ),
            TextField(
              controller: title,
              decoration: const InputDecoration(labelText: 'Titre'),
            ),
            TextField(
              controller: slug,
              decoration: const InputDecoration(labelText: 'Slug URL'),
            ),
            TextField(
              controller: excerpt,
              minLines: 2,
              maxLines: 4,
              decoration: const InputDecoration(
                labelText: 'Sous-titre / résumé',
              ),
            ),
            TextField(
              controller: body,
              minLines: 5,
              maxLines: 12,
              decoration: const InputDecoration(
                labelText: 'Texte / description',
              ),
            ),
            TextField(
              controller: imageUrl,
              decoration: const InputDecoration(
                labelText: 'URL HTTPS de la miniature',
              ),
            ),
            TextField(
              controller: mediaUrl,
              decoration: const InputDecoration(
                labelText: 'URL HTTPS du média (vidéo/interview)',
              ),
            ),
            TextField(
              controller: sourceLabel,
              decoration: const InputDecoration(labelText: 'Nom de la source'),
            ),
            TextField(
              controller: sourceUrl,
              decoration: const InputDecoration(
                labelText: 'URL HTTPS de la source',
              ),
            ),
          ],
        ),
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Annuler'),
      ),
      FilledButton(
        onPressed: () {
          final scheduled = DateTime.tryParse(scheduledAt.text.trim());
          if (status == 'scheduled' && scheduled == null) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text(
                  'Saisissez une date ISO 8601 valide pour programmer la publication.',
                ),
              ),
            );
            return;
          }
          Navigator.pop(context, {
            'title': title.text.trim(),
            'slug': slug.text.trim().isEmpty
                ? _slug(title.text)
                : slug.text.trim(),
            'type': type,
            'status': status,
            'scheduledAt': status == 'scheduled'
                ? scheduled!.toUtc().toIso8601String()
                : null,
            'category': category,
            'excerpt': excerpt.text.trim(),
            'body': body.text.trim(),
            'coverUrl': imageUrl.text.trim(),
            'mediaUrl': mediaUrl.text.trim(),
            'sourceLabel': sourceLabel.text.trim(),
            'sourceUrl': sourceUrl.text.trim(),
          });
        },
        child: const Text('Enregistrer'),
      ),
    ],
  );
  String _slug(String value) => value
      .toLowerCase()
      .replaceAll(RegExp(r'[^a-z0-9]+'), '-')
      .replaceAll(RegExp(r'^-|-$'), '');
}

class _AdminCreateUserDialog extends StatefulWidget {
  const _AdminCreateUserDialog();
  @override
  State<_AdminCreateUserDialog> createState() => _AdminCreateUserDialogState();
}

class _AdminCreateUserDialogState extends State<_AdminCreateUserDialog> {
  final name = TextEditingController();
  final email = TextEditingController();
  final password = TextEditingController();
  String role = 'USER';
  String topic = AppConfig.topics.first;
  @override
  void dispose() {
    name.dispose();
    email.dispose();
    password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Créer un compte'),
    content: SizedBox(
      width: 420,
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: name,
              decoration: const InputDecoration(labelText: 'Nom complet'),
            ),
            TextField(
              controller: email,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(labelText: 'Adresse e-mail'),
            ),
            TextField(
              controller: password,
              obscureText: true,
              decoration: const InputDecoration(
                labelText: 'Mot de passe temporaire (6 caractères minimum)',
              ),
            ),
            DropdownButtonFormField<String>(
              initialValue: topic,
              decoration: const InputDecoration(labelText: 'Rubrique préférée'),
              items: AppConfig.topics
                  .map(
                    (item) => DropdownMenuItem(value: item, child: Text(item)),
                  )
                  .toList(),
              onChanged: (value) => setState(() => topic = value ?? topic),
            ),
            DropdownButtonFormField<String>(
              initialValue: role,
              decoration: const InputDecoration(labelText: 'Rôle'),
              items: const [
                DropdownMenuItem(value: 'USER', child: Text('Utilisateur')),
                DropdownMenuItem(
                  value: 'CONTRIBUTOR',
                  child: Text('Contributeur'),
                ),
              ],
              onChanged: (value) => setState(() => role = value ?? role),
            ),
          ],
        ),
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Annuler'),
      ),
      FilledButton(
        onPressed: () {
          if (name.text.trim().length < 2 ||
              !email.text.contains('@') ||
              password.text.length < 6) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text(
                  'Vérifiez le nom, l’adresse e-mail et le mot de passe.',
                ),
              ),
            );
            return;
          }
          Navigator.pop(context, {
            'name': name.text.trim(),
            'email': email.text.trim(),
            'password': password.text,
            'preferredTopic': topic,
            'role': role,
          });
        },
        child: const Text('Créer'),
      ),
    ],
  );
}
