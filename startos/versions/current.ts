import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '0.35.0:0',
  releaseNotes: {
    en_US:
      'Updates Karakeep to 0.35.0: a redesigned web app, cleaner article extraction, and many security fixes. Meilisearch moves to 1.55.0, and the search index is upgraded in place on the first start; new bookmarks appear in search once that finishes. Headless Chrome moves to 157.',
    es_ES:
      'Actualiza Karakeep a 0.35.0: una aplicación web rediseñada, una extracción de artículos más limpia y numerosas correcciones de seguridad. Meilisearch pasa a 1.55.0 y el índice de búsqueda se actualiza en el primer inicio; los marcadores nuevos aparecen en la búsqueda cuando termina. Chrome sin interfaz pasa a la versión 157.',
    de_DE:
      'Aktualisiert Karakeep auf 0.35.0: eine neu gestaltete Web-App, sauberere Artikelextraktion und viele Sicherheitskorrekturen. Meilisearch wechselt auf 1.55.0, und der Suchindex wird beim ersten Start direkt aktualisiert; neue Lesezeichen erscheinen in der Suche, sobald das abgeschlossen ist. Headless Chrome wechselt auf Version 157.',
    pl_PL:
      'Aktualizuje Karakeep do wersji 0.35.0: przeprojektowana aplikacja webowa, czystsze wyodrębnianie artykułów i wiele poprawek bezpieczeństwa. Meilisearch przechodzi na 1.55.0, a indeks wyszukiwania jest aktualizowany na miejscu przy pierwszym uruchomieniu; nowe zakładki pojawią się w wyszukiwaniu po jego zakończeniu. Headless Chrome przechodzi na wersję 157.',
    fr_FR:
      'Met à jour Karakeep vers 0.35.0 : une application web repensée, une extraction d’articles plus propre et de nombreux correctifs de sécurité. Meilisearch passe à 1.55.0 et l’index de recherche est mis à niveau sur place au premier démarrage ; les nouveaux favoris apparaissent dans la recherche une fois cette opération terminée. Chrome headless passe à la version 157.',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
