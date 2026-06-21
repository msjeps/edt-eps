# TODO — Fonctionnalités à implémenter

> Les correctifs de sécurité sont dans `SECURITY_TODO.md`.
> Les chantiers UI/UX de fond sont dans `AUDIT_UI_UX.md`.

---

## Réservations d'installations — amélioration workflow statuts

### Phase 1 — Priorité haute ✅ FAIT (21/06/2026)

- [x] **Filtre par statut** — select `Tous / Proposé / Demandé / Accepté / Refusé` dans la barre de filtres
- [x] **Stat cards cliquables** — cliquer sur une carte filtre sur ce statut ; cliquer à nouveau réinitialise (toggle) ; carte active mise en évidence (bordure + fond bleu)
- [x] **Actions groupées** — colonne cases à cocher ; barre contextuelle "X sélectionnées" + select statut + Appliquer ; case "tout sélectionner" en en-tête
- [x] **Bouton "Tout demander"** — passe toutes les `propose` → `demande` avec confirmation ; désactivé si aucune proposée

### Phase 2 — Priorité moyenne ✅ FAIT (21/06/2026)

- [x] **Notes par réservation** — bouton ✏️ dans la colonne Actions, édition inline (input + ✓/✕, Enter/Escape) ; note affichée en italique sous le badge de statut ; sauvegarde en IDB sans migration de schéma
- [x] **Barre de progression globale** — sous les 4 compteurs : `X / total acceptées (Y %)` + barre colorée verte ≥80 % / ambre ≥50 % / rouge <50 % ; masquée si aucune réservation
- [x] **Tri par colonne** — tous les en-têtes cliquables, indicateur ▲ bleu visible en permanence sur toutes les colonnes (75 % opacité) → ▲/▼ plein + gras sur la colonne active ; tri secondaire stable lieu→installation→jour→heure ; état de tri persisté entre les changements de filtre

### Phase 3 — Intégration EDT + Conflits ✅ FAIT (21/06/2026)

- [x] **Bloc EDT rouge si réservation refusée** — quand une séance a une réservation au statut `refuse`, toute la case du bloc EDT passe en rouge (fond rouge clair, bordure rouge) ; **pas de badge** pour éviter la confusion avec les autres alertes (installation manquante 📍, conflit ⚠️) ; le rouge disparaît dès qu'une autre installation est assignée à la séance
- [x] **Conflit "installation non disponible"** — nouveau type de conflit `reservation_refusee` dans `constraints.js` qui remonte dans le tableau Conflits avec le libellé `"Installation non disponible — réservation refusée"` ; lié à la séance concernée ; suggère de changer d'installation ; conflit résolu automatiquement quand la réservation du nouveau créneau/installation n'est plus `refuse`

---

## Autres chantiers ouverts

- [ ] **Anti-inline (poursuite)** — patterns restants à fusionner en classes (`src/views/edt/`, `src/views/conflits/`) — faible valeur, pas bloquant
- [ ] **Daltonisme** — textures sur les vues "par installation" (fait sur EDT, reste vues individuelles)
- [ ] **Mode sombre** — polish sur quelques bleus de la modale Versions (sans token exact)
- [ ] **A11y** — états champs hover + `aria-busy`, audit automatisé
- [ ] **Validation nom de fichier** — `src/app.js:165` (cf. `SECURITY_TODO.md` §8)
- [ ] **Injection JSON dans contexte script** — `src/export/partage-html.js:138` (cf. `SECURITY_TODO.md` §4, basse priorité)
