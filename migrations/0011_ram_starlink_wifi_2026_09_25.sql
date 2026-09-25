INSERT OR IGNORE INTO tags(id,slug,name) VALUES
('tag-ram','royal-air-maroc','Royal Air Maroc'),
('tag-starlink','starlink','Starlink'),
('tag-aviation-wifi','wifi-en-vol','Wi-Fi en vol');

INSERT OR IGNORE INTO content_items(
  id,slug,type,status,title,excerpt,body,summary,category,author_name,cover_url,
  fact_check_status,published_at,created_at,updated_at
) VALUES (
  'news-ram-starlink-wifi-2026',
  'royal-air-maroc-starlink-wifi-avions',
  'article','published',
  'VÉRIFICATION — Royal Air Maroc et Starlink : ce que l’on sait réellement du Wi-Fi à bord',
  'Plusieurs médias annoncent un accord et un déploiement visé en 2027. Une autre source rapporte qu’aucun fournisseur n’était encore définitivement choisi. Le service ne peut donc pas être présenté comme déjà disponible.',
  'Verdict : un projet de Wi-Fi à bord visant 2027 est rapporté par plusieurs médias, mais les informations publiques disponibles ne permettent pas d’affirmer que les passagers de Royal Air Maroc disposent déjà de Starlink. Elles se contredisent aussi sur le caractère définitif de l’accord.

Le 18 août 2026, Africa Intelligence a annoncé qu’un accord avait été conclu entre Royal Air Maroc et Starlink après plusieurs mois de négociations. Selon ce média, la solution de SpaceX devait équiper l’ensemble de la flotte de la compagnie marocaine d’ici 2027.

Le lendemain, Médias24 a écrit qu’une source autorisée au sein de Royal Air Maroc lui confirmait une mise en service à partir de 2027. Le média rappelle qu’un tel déploiement exige l’installation et la certification d’équipements adaptés à chaque type d’avion. Cette contrainte rend nécessaire un calendrier appareil par appareil.

Une information contradictoire a toutefois été publiée par Assahifa le 18 août. Le média dit avoir interrogé des sources officielles de la compagnie, selon lesquelles Royal Air Maroc discutait encore avec plusieurs fournisseurs et n’avait pas arrêté son choix définitif. Ces mêmes sources confirmaient néanmoins l’objectif de lancer une connectivité en vol en 2027.

Starlink Aviation repose sur une constellation de satellites en orbite terrestre basse et sur des équipements installés à bord. En pratique, la disponibilité pour un voyageur dépendrait de l’avion effectivement équipé, des certifications, de la couverture, des règles d’utilisation et de l’offre commerciale retenue par la compagnie.

Au 25 septembre 2026, TAMUSNI n’a pas identifié de communiqué public de Royal Air Maroc ou de Starlink précisant une date de lancement, les appareils concernés, les lignes desservies, le prix ou les conditions d’accès. Cette absence de publication officielle ne prouve pas qu’aucun contrat n’existe, mais elle empêche de considérer les modalités comme confirmées publiquement.

Conclusion pratique : les voyageurs ne doivent pas supposer qu’un vol Royal Air Maroc propose déjà le Wi-Fi Starlink. Il faudra attendre une annonce officielle et, idéalement, une indication lors de la réservation précisant si l’appareil du vol est équipé. TAMUSNI mettra cette vérification à jour dès qu’une communication directe de la compagnie ou de Starlink sera disponible.',
  'Des médias rapportent un accord ou un déploiement visé en 2027, mais leurs sources se contredisent sur la décision finale. Aucun élément public vérifié ne permet de présenter Starlink comme déjà disponible sur les vols de Royal Air Maroc.',
  'Technologies','Rédiger par IA','/images/editorial-ram-starlink.svg','context',
  '2026-09-25T14:00:00Z','2026-09-25T14:00:00Z','2026-09-25T14:00:00Z'
);

INSERT OR IGNORE INTO content_sources(id,content_id,label,url,publisher,published_at,created_at) VALUES
('src-ram-starlink-africa-intelligence','news-ram-starlink-wifi-2026','Royal Air Maroc hook-up with Starlink Wi-Fi to go ahead','https://www.africaintelligence.com/north-africa/2026/08/18/royal-air-maroc-hook-up-with-starlink-wi-fi-to-go-ahead,110861011-art','Africa Intelligence','2026-08-18','2026-09-25T14:00:00Z'),
('src-ram-starlink-assahifa','news-ram-starlink-wifi-2026','Royal Air Maroc Still Seeking In-Flight Internet Provider, No Final Starlink Deal','https://en.assahifa.com/economy/royal-air-maroc-starlink/','Assahifa English','2026-08-18','2026-09-25T14:00:00Z'),
('src-ram-starlink-medias24','news-ram-starlink-wifi-2026','Le Wi-Fi Starlink à bord des avions de la RAM en 2027','https://medias24.com/2026/08/19/le-wi-fi-starlink-a-bord-des-avions-de-la-ram-en-2027-1741761/','Médias24','2026-08-19','2026-09-25T14:00:00Z'),
('src-ram-starlink-official','news-ram-starlink-wifi-2026','Starlink Aviation','https://www.starlink.com/business/aviation','Starlink',NULL,'2026-09-25T14:00:00Z');

INSERT OR IGNORE INTO content_tags(content_id,tag_id) VALUES
('news-ram-starlink-wifi-2026','tag-ram'),
('news-ram-starlink-wifi-2026','tag-starlink'),
('news-ram-starlink-wifi-2026','tag-aviation-wifi');

INSERT OR IGNORE INTO content_timeline_events(id,content_id,event_date,title,description,position) VALUES
('tl-ram-starlink-1','news-ram-starlink-wifi-2026','2026-08-18','Accord annoncé par Africa Intelligence','Le média rapporte qu’un accord permettra d’équiper la flotte de Royal Air Maroc d’ici 2027.',1),
('tl-ram-starlink-2','news-ram-starlink-wifi-2026','2026-08-18','Une décision finale contestée','Assahifa rapporte que plusieurs fournisseurs restent évalués et que le choix définitif n’est pas arrêté.',2),
('tl-ram-starlink-3','news-ram-starlink-wifi-2026','2026-08-19','Objectif 2027 confirmé à Médias24','Médias24 cite une source autorisée au sein de la compagnie confirmant un équipement à partir de 2027.',3);
