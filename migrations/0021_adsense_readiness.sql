-- Honest institutional attribution and correct format classification.
UPDATE content_items
SET author_name = 'Rédaction TAMUSNI avec assistance IA',
    updated_at = CURRENT_TIMESTAMP
WHERE author_name IN ('Rédiger par IA', 'Rédigé par IA');

UPDATE content_items
SET type = 'brief',
    updated_at = CURRENT_TIMESTAMP
WHERE slug IN (
  'ai-act-transparence-2026',
  'stockage-batteries-2025',
  'debris-orbitaux-fin-de-mission',
  'cern-deconnexion-lhc-hilumi-atlas-cms'
) AND status = 'published';
