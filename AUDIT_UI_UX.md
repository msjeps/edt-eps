# Audit UI/UX — EDT EPS

> Audit réalisé le 12/06/2026 sur la base d'une lecture réelle du code :
> `styles/main.css`, `styles/components.css`, `styles/grid.css`, `index.html`,
> `src/views/exports/exports.js`, `src/views/dashboard.js`, et relevés automatiques
> (styles inline, ARIA, labels, tailles de cibles) sur l'ensemble de `src/`.
>
> **Cadre** : application métier desktop-first, utilisée en **sessions longues**
> (plusieurs heures de saisie d'affilée) par des enseignants non-experts.
> Les priorités de l'audit sont donc : confort visuel longue durée, lisibilité,
> repérage des containers, faible charge cognitive, cohérence et accessibilité.

---

## 0. Synthèse des relevés objectifs

| Indicateur | Mesure | Verdict |
|---|---|---|
| Styles inline `style="..."` dans `src/views` | **476 occurrences** | Dette CSS majeure |
| Attributs `aria-*` dans tout `src/` + `index.html` | **1** (help-tooltip) | Accessibilité quasi absente |
| Attributs `role=` | **1** | Idem |
| `<label>` dans les vues | 94 | Mais… |
| `<label for="…">` (association explicite) | **0** | Aucun label relié à son champ |
| Règles `:focus-visible` dans tout le CSS | **1** (sur `.btn` seulement) | Focus clavier non géré ailleurs |
| Hauteur du bloc séance EDT | **36 px**, police **8,5–11 px** | Sous le seuil de confort |
| Cibles interactives < 40 px de haut | nombreuses (24/26/30/32 px) | Sous WCAG 2.5.8 + confort |

Ces quatre chiffres (476 / 1 / 0 / 1) résument l'essentiel : **le design system de base est de très bon niveau** (tokens cohérents, échelle typo récemment relevée, composants soignés), mais **trois dettes transversales** le minent : (1) le markup applicatif court-circuite le design system par du style inline massif, (2) l'accessibilité clavier/lecteur d'écran n'est pas câblée, (3) plusieurs zones de densité (EDT, petites cibles) entrent en tension directe avec l'usage « longues sessions ».

---

## 1. Lisibilité & typographie

### 1.1 — L'échelle relevée est bonne, mais le `line-height` global est trop serré pour de la lecture longue — **Mineur**
**Constat.** `body { line-height: 1.5 }` (main.css L129). Pour un outil de saisie consulté des heures, 1.5 est un minimum ; les tableaux passent même à 1.4 (`.data-table td`, L741) et les blocs EDT à 1.25 (grid.css L195).
**Impact.** Fatigue oculaire accrue sur les longues listes (Données) et les cellules denses.
**Reco.** Monter le texte courant à 1.55–1.6 et garder 1.4 uniquement pour les cellules monolignes.
```css
body { line-height: 1.55; }
.data-table td { line-height: 1.5; }     /* au lieu de 1.4 */
.empty-state-text, .aide-section-body p { line-height: 1.7; } /* déjà bon, à généraliser */
```

### 1.2 — Aucune contrainte de longueur de ligne (`max-width` / `measure`) sur les textes — **Mineur**
**Constat.** Les descriptions et paragraphes s'étirent sur toute la largeur du conteneur (ex. cartes wide en `grid-column:1/-1`, panneau de validation dashboard). Au-delà de ~75 caractères, la lecture devient pénible.
**Reco.** Introduire un token de mesure et l'appliquer aux blocs de texte longs.
```css
:root { --measure: 68ch; }
.export-card > p, .dashboard-card-desc, .aide-section-body p { max-width: var(--measure); }
```

### 1.3 — Hiérarchie des titres incohérente entre vues — **Majeur**
**Constat.** Chaque vue réinvente son titre :
- Exports : `<h2 style="margin-bottom:var(--sp-6)">Exports</h2>` (exports.js L90) — h2 nu, sans classe.
- Dashboard : `<h2 style="margin-bottom: var(--sp-2)">${nom}</h2>` (dashboard.js L60).
- Les `<h3>` de section Exports portent une grosse pile de styles inline répétée 6 fois (exports.js L113-116, 136-138, 225-227…).
Le header applicatif a déjà un `.view-title` (« Exports », « Accueil ») — donc le `<h2>` interne **duplique** le titre de page déjà affiché en haut.
**Impact.** Double titre « Exports » à l'écran (header + corps) ; aucune échelle de titres réutilisable ; charge cognitive (l'œil ne sait pas quel niveau est quoi).
**Reco.**
1. Supprimer le `<h2>` redondant en tête de vue quand le header affiche déjà le titre.
2. Créer des classes de titres réutilisables et bannir les `<hN style="…">` :
```css
.section-title {                 /* remplace les 6 h3 inline d'Exports */
  grid-column: 1 / -1;
  font-size: var(--fs-md);
  font-weight: 700;
  letter-spacing: .04em;
  text-transform: uppercase;
  color: var(--c-text-secondary);
  padding-bottom: var(--sp-2);
  border-bottom: 2px solid var(--c-border);
  margin: var(--sp-5) 0 calc(-1 * var(--sp-2));
}
.section-title:first-child { margin-top: 0; }
```

### 1.4 — `font-size` en pixels en dur dans l'EDT, hors de l'échelle — **Mineur**
**Constat.** grid.css multiplie les tailles non-tokenisées : `font-size: 11px`, `10px`, `9.5px`, `8.5px`, `9px` (L84, 195, 261, 268, 99…). Ces valeurs ignorent l'échelle `--fs-*` fraîchement relevée.
**Impact.** Le travail d'amélioration typo (passage base 16px) **ne touche pas l'EDT**, qui reste à 8,5–11px — soit la zone la plus regardée en session longue.
**Reco.** Voir §5.1 (densité EDT). Au minimum, remonter les libellés de bloc à 11/12px et tokeniser.

---

## 2. Repérage des containers & structure visuelle

### 2.1 — `.card` renforcée : bon, mais incohérence avec les autres « cartes » — **Majeur**
**Constat.** `.card` a désormais `border: var(--c-border-dark)` + `box-shadow: var(--shadow-sm)` (main.css L516-522). Mais les cartes voisines gardent l'ancienne bordure claire :
- `.stat-card` → `border: var(--c-border)` + `--shadow-xs` (L1017-1019)
- `.dashboard-card` → `border: var(--c-border)` (L1133)
- `.export-card` hérite de `.card` (OK) mais coexiste avec des `.stat-card` plus pâles sur le même dashboard.
**Impact.** Deux « poids » de container différents à l'écran sans logique sémantique → l'œil ne hiérarchise pas, charge cognitive.
**Reco.** Définir **2 niveaux de container assumés** et les documenter :
- *Container primaire* (`.card`, `.export-card`) : bordure `--c-border-dark` + `--shadow-sm`.
- *Container secondaire / métrique* (`.stat-card`) : volontairement plus léger.
Et **aligner `.dashboard-card` sur `.card`** (c'est un container cliquable principal, pas une métrique).
```css
.dashboard-card { border-color: var(--c-border-dark); box-shadow: var(--shadow-sm); }
```

### 2.2 — Le bloc « Synthèse occupation » et les cartes wide cassent le gabarit de carte — **Majeur**
**Constat.** Dans Exports, les cartes pleine largeur (exports.js L250-271, L283-325, L394-416) **n'utilisent pas** la structure `.export-card-icon / h3 / p` mais reconstruisent un en-tête à la main en flex inline (`<span style="font-size:1.8rem">📍</span><h3 style="margin:0">…`). Résultat : la pastille d'icône (48×48, fond, bordure) **disparaît** sur ces cartes, l'icône redevient un simple emoji flottant.
**Impact.** Incohérence visuelle directe **dans la page qu'on vient d'uniformiser** : 5 cartes ont une pastille d'icône, 3 ne l'ont pas.
**Reco.** Créer une variante d'en-tête horizontal réutilisable, qui conserve la pastille :
```css
.export-card-head {            /* en-tête horizontal pour cartes wide */
  display: flex; align-items: center; gap: var(--sp-3); margin-bottom: var(--sp-2);
}
.export-card-head .export-card-icon { margin-bottom: 0; width: 40px; height: 40px; font-size: 1.3rem; }
.export-card-head h3 { margin: 0; }
.export-card-head .export-card-meta { margin-left: auto; font-size: var(--fs-sm); color: var(--c-text-secondary); }
```
puis remplacer les `<span style="font-size:1.8rem">📍</span>` par `<div class="export-card-icon">📍</div>` dans un `.export-card-head`.

### 2.3 — Espacement vertical des sections géré par des marges négatives fragiles — **Mineur**
**Constat.** Les titres de section Exports utilisent `margin: var(--sp-5) 0 calc(-1 * var(--sp-2))` (exports.js L136) pour compenser le `gap` de la grille. C'est un hack qui se répète et casse si le gap change.
**Reco.** Externaliser dans `.section-title` (§1.3) et, mieux, structurer chaque groupe d'exports dans un vrai conteneur de section plutôt que de poser des titres en `grid-column:1/-1` au milieu de la grille.

---

## 3. Cohérence du design system

### 3.1 — 476 styles inline : le design system est court-circuité — **Critique**
**Constat.** `grep` relève **476** attributs `style="…"` dans `src/views`, dont :
`donnees.js` 101, `exports.js` 91, `wizard.js` 88, `programmation.js` 63, `vues.js` 46, `dashboard.js` 35.
On y trouve des composants entiers stylés à la main : la liste d'exclusions (exports.js L66-73), les lignes du panneau de validation (dashboard.js L216-224), les badges « Nouveau », les bandeaux colorés…
**Impact.**
- **Maintenance** : changer une couleur ou un rayon impose de chasser dans le JS, pas dans le CSS.
- **Cohérence** : mêmes objets stylés différemment selon le fichier (ex. bordure `6px` vs `8px` vs `var(--radius-md)` ; couleurs `#3b82f6`, `#2563eb`, `var(--c-primary)` utilisées indifféremment).
- **Thématisation** : impossible de basculer en mode confort/sombre tant que les valeurs sont figées dans le markup.
**Reco. (chantier de fond, par lots).**
1. Inventorier les patterns inline récurrents et les promouvoir en classes (voir §9 pour la liste).
2. Interdire en revue tout `style="color:#…"` / `style="background:#…"` : passer par les tokens.
3. Commencer par les composants les plus dupliqués : `.section-title`, `.list-row` (lignes type exclusions), `.callout` (bandeaux info/warning), `.badge-new`.

### 3.2 — Couleurs en hexadécimal codées en dur, hors tokens — **Majeur**
**Constat.** Le markup et certains CSS réintroduisent des hex qui doublonnent les tokens : `#3b82f6`, `#2563eb`, `#1e40af`, `#bfdbfe`, `#f0f9ff`, `#64748b` (exports.js L95-97, L398, L412), `#FFFBEB`, `#FEF3C7` (components.css)… alors que `--c-primary`, `--c-primary-bg`, `--c-primary-bg-strong`, `--c-warning-bg` existent.
**Impact.** Dérive chromatique : le « bleu » de l'app existe en au moins 3 valeurs visuellement proches mais non identiques.
**Reco.** Ajouter quelques tokens manquants (`--c-info-bg-soft`, bordures de callout) et remplacer tous les hex inline par des `var(--…)`.

### 3.3 — `.form-control` utilisé mais non défini — **Majeur (bug visuel)**
**Constat.** Le formulaire « Dates à exclure » (exports.js L301, L305) applique `class="form-control"` aux `<input>` — **mais cette classe n'existe nulle part dans le CSS** (le design system définit `.form-input`, pas `.form-control`). Ces champs tombent donc sur le style navigateur par défaut, incohérent avec tous les autres champs de l'app.
**Impact.** Champs visiblement différents (hauteur, bordure, focus) au milieu d'une carte stylée.
**Reco.** Remplacer `form-control` par `form-input` partout, ou ajouter un alias :
```css
.form-control { /* alias historique */ }
```
(Vérifier les autres vues : si `form-control` est employé ailleurs, soit créer la classe, soit harmoniser sur `form-input`.)

### 3.4 — États `disabled` / `hover` / `focus` partiellement traités — **Majeur**
**Constat.**
- `.btn:disabled` existe (L628), mais beaucoup de boutons d'export sont rendus `disabled` quand `seances.length===0` **sans aucune explication** : l'utilisateur voit un bouton grisé sans savoir pourquoi.
- `.form-input:hover` ne change rien (`border-color: var(--c-border-dark)` = couleur déjà au repos, main.css L673) → hover mort.
- Le focus n'est stylé que sur `.btn` (1 seul `:focus-visible` dans tout le CSS, cf. §6).
**Reco.**
- Sur les boutons désactivés, ajouter un `title`/`aria-describedby` explicatif (« Ajoutez des séances pour activer cet export ») ou afficher un *empty state* en haut de la page Exports quand `seances.length===0`.
- Donner un vrai hover aux champs (`border-color: var(--c-text-muted)`).

### 3.5 — `--c-warning` parfois absent en var, contourné par fallback inline — **Mineur**
**Constat.** dashboard.js L106 écrit `var(--c-warning,#b45309)`, L233 `var(--c-warning-text,#92400e)`, alors que `--c-warning: #D97706` existe (main.css L18) mais **`--c-warning-text` n'existe pas**. Les fallbacks masquent des tokens manquants.
**Reco.** Compléter le jeu de tokens sémantiques *-text / *-border* pour success/warning/danger/info et supprimer les fallbacks :
```css
--c-success-text:#065F46; --c-success-border:#A7F3D0;
--c-warning-text:#92400E; --c-warning-border:#FDE68A;
--c-danger-text:#991B1B;  --c-danger-border:#FECACA;
```

---

## 4. Couleur, contraste & daltonisme

### 4.1 — `--c-text-muted #94A3B8` sur fond blanc : sous le seuil WCAG AA — **Majeur**
**Constat.** `#94A3B8` sur `#FFFFFF` donne un ratio ≈ **2.6:1**, très en dessous des 4.5:1 requis pour du texte normal (et même des 3:1 pour du grand texte). Or `--c-text-muted` est utilisé pour les `form-hint`, `stat-label`, `empty-state-text`, descriptions… (main.css L693, 962, 1038). Idem `--sidebar-text #94A3B8` sur `#1E293B` ≈ 4.0:1 (limite pour du petit texte).
**Impact.** Indices et libellés secondaires difficiles à lire — aggravé en session longue et sur écrans peu contrastés.
**Reco.** Foncer le muted d'un cran :
```css
--c-text-muted: #64748B;   /* ≈ 4.6:1 sur blanc — AA OK */
```
et réserver `#94A3B8` aux éléments décoratifs non textuels (chevrons d'icône).

### 4.2 — Texte blanc sur `--c-warning #D97706` (`.btn-warning`) : insuffisant — **Mineur**
**Constat.** Blanc sur `#D97706` ≈ 2.6:1. `.btn-warning` (main.css L583) affiche du texte blanc sur orange moyen.
**Reco.** Soit foncer le fond (`#B45309`, ratio ≈ 3.5:1 — acceptable pour bouton/gros texte), soit passer le texte en `#1F2937`.

### 4.3 — Palette installations non distinguable en daltonisme — **Majeur**
**Constat.** La palette installations (main.css L40-51) repose **uniquement sur la teinte** : rose `#E91E63`, rouge `#D32F2F`, vert `#43A047`, violet `#7B1FA2`, teal `#00796B`, cyan `#0097A7`… Or rouge/vert (Fort Carré rose vs Foch vert vs Beach rouge) et teal/cyan (Gymnase vs Piscine) sont confondus en deutéranopie/protanopie. Dans l'EDT, l'installation **n'est codée que par la couleur** du bloc.
**Impact.** ~8% des hommes ne distinguent pas certaines installations dans la grille — directement gênant pour un outil de planification.
**Reco.**
1. Ne jamais transmettre l'information *uniquement* par la couleur : le bloc EDT affiche déjà `.bloc-install` (texte) — s'assurer qu'il reste lisible (cf. §5.1).
2. Ajouter un **second canal** : motif/liseré ou initiale d'installation dans le bloc et la légende.
3. Vérifier que chaque couleur a un contraste suffisant avec le texte du bloc (le texte de bloc passe en `opacity:0.65` sur `.bloc-install`, ce qui dégrade encore).

### 4.4 — Mode sombre / mode confort absent — **Mineur (mais pertinent pour sessions longues)**
**Constat.** Aucun thème alternatif. Pour un usage de plusieurs heures, un mode sombre ou un mode « contraste/confort » est un vrai plus ergonomique.
**Reco.** Le design étant déjà tokenisé, prévoir un `[data-theme="dark"]` qui ne redéfinit que les tokens de surface/texte — faisable *à condition d'avoir d'abord résorbé les hex inline* (§3.1/3.2). À classer en fond.

---

## 5. Confort longue session (densité, fatigue, feedback)

### 5.1 — Densité du bloc séance EDT trop forte : 36px de haut, police 8,5px — **Critique** (pour cet usage)
**Constat.** `.edt-bloc` : `height: 36px`, `.bloc-install` `font-size: 8.5px; opacity: 0.65`, `.bloc-prof` `8.5px; opacity:0.65` (grid.css L198, 268, 274). C'est **l'écran central** de l'outil, regardé en permanence.
**Impact.** Lecture pénible de l'installation et du prof (8,5px à 65% d'opacité ≈ contraste effondré) ; clic/drag sur 36px de haut peu confortable à la souris répété des centaines de fois. C'est l'antithèse de l'objectif « confort longue session ».
**Reco.**
- Monter la hauteur de bloc à ≥ 44px et les libellés secondaires à ≥ 10–11px, supprimer l'`opacity` au profit d'une **vraie couleur** (`color: rgba(15,23,42,0.7)`), qui se calcule sans empiler la transparence.
- Prévoir un **toggle de densité** (Confort / Compact) dans la toolbar EDT — laisser le compact aux écrans chargés, le confort par défaut pour les longues sessions.
```css
.edt-bloc { height: 44px; }
.edt-bloc .bloc-install { font-size: 10.5px; opacity: 1; color: rgba(15,23,42,.72); }
.edt-bloc .bloc-prof    { font-size: 10.5px; opacity: 1; color: rgba(15,23,42,.7); }
```

### 5.2 — Animations « infinies » fatigantes & non respect de `prefers-reduced-motion` — **Majeur (accessibilité + confort)**
**Constat.** `.edt-bloc.conflict` joue `conflict-pulse 2s infinite` (grid.css L245) — un clignotement **permanent** tant qu'un conflit existe. Aucune règle `@media (prefers-reduced-motion: reduce)` dans tout le CSS.
**Impact.** Un conflit non résolu fait pulser la grille en continu pendant des heures : fatigue, distraction, risque pour utilisateurs sensibles (vestibulaire). Non conforme WCAG 2.3.3.
**Reco.**
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; transition-duration: .001ms !important; }
}
```
Et remplacer le pulse infini par un état statique fort (liseré rouge + petit badge ⚠), animé **une seule fois** à l'apparition.

### 5.3 — Feedback de chargement / d'attente absent sur les exports — **Mineur**
**Constat.** Les exports (Excel multi-feuilles, PDF, génération dates) peuvent prendre du temps ; le bouton ne change pas d'état pendant le calcul (exports.js L492-518). L'utilisateur peut re-cliquer.
**Reco.** Passer le bouton en état `aria-busy`, désactivé + libellé « Génération… » pendant l'opération, puis toast de succès (déjà présent).

### 5.4 — Toasts en bas-droite, hors champ de saisie — **Mineur**
**Constat.** `.toast-container` est en `bottom/right` (main.css L850). En saisie longue centrée sur la grille, le feedback de sauvegarde peut passer inaperçu. La sauvegarde a aussi un `#save-status` dans la sidebar — deux canaux concurrents.
**Reco.** OK de garder le toast, mais rendre le statut de sauvegarde sidebar plus contrasté (il est à `opacity:0.7`, 11px, `--sidebar-text` faible — quasi illisible). Un indicateur « Enregistré ✓ / Modifié • » plus visible rassure sur les longues sessions.

---

## 6. Accessibilité (WCAG 2.2)

### 6.1 — Focus clavier visible quasi inexistant — **Critique**
**Constat.** **Un seul** `:focus-visible` dans tout le CSS (`.btn`, main.css L561). Les `.nav-btn`, `.dashboard-card`, `.tab-btn`, `.chip`, `.export-card-icon`, les `<select>` des filtres, les lignes de liste cliquables, les `.sidebar-action-btn`… n'ont **aucun style de focus** → un utilisateur au clavier ne sait jamais où il est. WCAG 2.4.7 + 2.4.11 (Focus Appearance) non respectés.
**Reco.** Règle de focus globale + outline ≥ 2px contrasté :
```css
:where(a, button, [tabindex], .nav-btn, .dashboard-card, .tab-btn, .chip,
       input, select, textarea, .sidebar-action-btn):focus-visible {
  outline: 2px solid var(--c-primary);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}
```

### 6.2 — Cartes/blocs cliquables non focusables au clavier — **Critique**
**Constat.** Les `.dashboard-card` (dashboard.js L124-148) et `.export-card-icon`-cards portent `data-goto`/`click` sur des `<div>` **sans** `tabindex`, `role="button"` ni gestion `Enter/Espace`. Idem `#stat-conflits` (div cliquable). La navigation se fait quasi exclusivement à la souris.
**Impact.** Pans entiers de l'app inaccessibles au clavier.
**Reco.** Transformer ces `<div>` cliquables en `<button>` (préférable), ou à défaut ajouter `role="button" tabindex="0"` + handler clavier. Pour le dashboard, des `<button class="dashboard-card">` règlent focus + clavier d'un coup.

### 6.3 — Aucun `<label for>` : 94 labels, 0 association — **Critique**
**Constat.** 94 `<label>` dans les vues, **0** avec `for=`. Les `<select>`/`<input>` d'export (périodes, enseignants, classes, date d'exclusion) n'ont ni `for`/`id` reliés, ni `aria-label`. Un lecteur d'écran annonce « liste, vide » sans dire de quoi il s'agit.
**Impact.** Formulaires inutilisables au lecteur d'écran ; cibles de clic réduites (cliquer le label n'active pas le champ).
**Reco.** Systématiser `for`/`id` ou, pour les selects sans label visible (Exports), un `aria-label` :
```html
<select class="form-select" id="export-mairie-per" aria-label="Période pour l'export réservations collectivité">…</select>
```

### 6.4 — Tailles de cibles sous le minimum WCAG 2.5.8 (24px) et sous le confort (40px) — **Majeur**
**Constat.** Relevé des hauteurs : `.btn-xs` 24px, `.btn-icon-sm` 26px, `.cibles-display` 30px, `.btn-sm` 30px, `.edt-filters select` 32px, croix de suppression d'exclusion `padding:2px 8px` (~20px, exports.js L72), bloc séance 36px. Plusieurs sont *à* 24px (limite stricte) et la plupart sous les 40px confortables.
**Impact.** Clics ratés répétés en session longue, surtout sur les `✕` de suppression et les filtres.
**Reco.** Plancher à **40px** pour les actions courantes, **32px minimum** pour les contrôles secondaires denses ; les icônes-boutons gardent une *zone de clic* ≥ 40px même si le visuel est plus petit (`padding` + `min-width/height`).

### 6.5 — SVG d'icônes sans `aria-hidden`, boutons icône sans nom accessible — **Majeur**
**Constat.** Les boutons sidebar (`#btn-undo`, `#btn-save-project`…) ont un `title` (bien) mais leurs `<svg>` ne sont pas `aria-hidden="true"` et le `.nav-label` est masqué visuellement en mode replié (`opacity:0`) **sans** rester accessible. En mode replié, un bouton sans `title` n'a plus de nom.
**Reco.** `aria-hidden="true"` sur tous les SVG décoratifs ; garantir un `aria-label` sur chaque bouton-icône ; ne pas masquer le nom accessible avec `opacity:0` seul (utiliser une classe `.sr-only` pour conserver le texte aux AT).
```css
.sr-only { position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0; }
```

### 6.6 — Pas de landmarks ni de « skip link » — **Mineur**
**Constat.** `<aside>`, `<header>`, `<main>`, `<nav>` existent (bien) mais sans `aria-label` distinctifs ; pas de lien d'évitement vers le contenu.
**Reco.** `aria-label` sur `<nav>` (« Navigation principale ») et sur `<main>` ; ajouter un skip-link visible au focus.

---

## 7. Navigation & intuitivité

### 7.1 — Double titre de page (header + corps) — **Majeur** (cf. §1.3)
Le header affiche « Exports »/« Accueil » via `.view-title`, et chaque vue réaffiche un `<h2>` identique. Redondance visuelle. **Reco.** : garder un seul titre (le header), réserver les `<h2>` internes au nom de l'établissement ou à des sous-sections.

### 7.2 — Pas de fil d'Ariane ni de contexte de période persistant — **Mineur**
**Constat.** Le sélecteur de période est recréé localement dans chaque vue (Exports, EDT, Vues…) sans état partagé. L'utilisateur re-choisit « T2 » dans chaque écran.
**Reco.** Envisager un **sélecteur de période global** dans le header (à droite, près de `.header-project`), mémorisé, que les vues consomment par défaut. Réduit la charge cognitive et les clics répétés.

### 7.3 — Libellés sidebar vs header désynchronisés — **Mineur**
**Constat.** La nav affiche « Accueil » (index.html L55) mais `data-view="dashboard"` et le titre de la page parle de « Tableau de bord » (title attr). « Programmation » / « Programmation annuelle », « Vues » / « Vues individuelles » : libellé court en nav, long en title. Cohérent globalement, mais « Vues » seul est peu explicite.
**Reco.** Renommer « Vues » → « Vues indiv. » ou « Par prof/classe » ; garder les libellés stables entre nav, titre et aide.

### 7.4 — Découvrabilité des actions de projet (Sauvegarder/Charger/Versions) — **Mineur**
**Constat.** Ces actions vitales sont en **bas** de la sidebar, en petit (36px, `--fs-xs`, texte gris faible). Pour un public non-expert, « où est ma sauvegarde » n'est pas évident, surtout sidebar repliée.
**Reco.** Renforcer le contraste de ces boutons, et exposer « Sauvegarder » aussi dans le header (zone droite) où l'œil va naturellement.

---

## 8. Page Exports — revue spécifique post-uniformisation

L'uniformisation `.export-card` est globalement réussie sur les cartes standard. Restent ces incohérences :

| # | Problème | Sévérité |
|---|---|---|
| E1 | **3 cartes wide** (Synthèse occupation, Dates à exclure, Partage) n'utilisent pas la pastille `.export-card-icon` → en-tête divergent (cf. §2.2). | Majeur |
| E2 | Le `<h2>Exports</h2>` interne **duplique** le titre du header (cf. §7.1). | Majeur |
| E3 | Les **6 titres de section** sont stylés par une pile de styles inline copiée-collée (exports.js L113-116…) au lieu d'une classe `.section-title` (cf. §1.3). | Majeur |
| E4 | Champs « Dates à exclure » en `class="form-control"` **inexistante** → style navigateur par défaut, rupture visuelle (cf. §3.3). | Majeur |
| E5 | Badge dossier d'export en hex inline `#f0f9ff/#bfdbfe/#1e40af/#64748b` (L95-97) hors tokens (cf. §3.2). | Mineur |
| E6 | Badge « Nouveau » (L398-400) : hex inline + non réutilisable → en faire `.badge-new`. | Mineur |
| E7 | Boutons d'export `disabled` quand `seances.length===0` **sans message** : page Exports vide et grisée, déroutante (cf. §3.4). | Majeur |
| E8 | `select multiple` des classes (L310) : hauteur 72px, hint « Ctrl+clic » en `font-size:10px` gris muted → sous le seuil de lisibilité (§4.1). | Mineur |
| E9 | La carte « Synthèses » (L373-382) n'a **pas** de `.export-card-actions` (bouton seul, pas de `margin-top:auto`) → son bouton ne s'aligne pas avec les autres de la rangée. | Mineur |

**Reco. groupée Exports.**
1. Introduire `.section-title`, `.export-card-head`, `.callout`, `.badge-new` et retirer le style inline correspondant.
2. Corriger `form-control` → `form-input`.
3. Ajouter un *empty state* en tête de page quand aucune séance, plutôt que 11 cartes grisées.
4. Donner un `.export-card-actions` à la carte Synthèses pour l'alignement.

---

## 9. Dette CSS — patterns inline à promouvoir en classes

Classes à créer (élimine la majeure partie des 476 inline) :

| Classe proposée | Remplace (exemples) | Occurrences visées |
|---|---|---|
| `.section-title` | les 6 `<h3 style="grid-column:1/-1;…">` d'Exports | Exports + réutilisable |
| `.export-card-head` | en-têtes flex inline des cartes wide | Exports |
| `.callout` / `.callout--info/warn/danger/success` | panneau validation (dashboard.js L206-249), badge dossier (exports.js L94), bandeaux divers | Dashboard, Exports, Programmation |
| `.list-row` | lignes d'exclusions (exports.js L66-73) | Exports, listes diverses |
| `.badge-new` | badge « Nouveau » (exports.js L398) | Exports |
| `.field-inline` / `.form-stack` | groupes label+input en flex inline (exports.js L299-319) | Exports, Wizard |
| `.view-intro` | `<p style="color:var(--c-text-muted);margin-bottom:…">` sous-titres de vue | Dashboard, toutes vues |
| `.stat-split` | la stat-card composite « Classes placées / Conflits » (dashboard.js L104-118) | Dashboard |
| `.sr-only` | (nouveau) pour l'accessibilité des icônes | Global |

**Règle de revue à instaurer :** aucun `style="color:#…"`, `style="background:#…"`, `style="border:…#…"` ne doit entrer dans le JS. Les seuls inline tolérés : valeurs **dynamiques** calculées en JS (largeur d'une barre, couleur d'installation issue de la donnée).

---

## 10. Feuille de route priorisée

> **Suivi — MàJ 12/06/2026.** ✅ fait · 🟡 partiel · ⬜ à faire.
> Tous les quick wins, tout le court terme (hors états champs), et 2 items de fond
> (sélecteur période global, toggle densité) sont livrés et vérifiés au navigateur.

### 🟢 Quick wins (≤ 1 j, fort ratio impact/effort) — ✅ TERMINÉ
1. ✅ **Focus global** : règle `:focus-visible` générale (§6.1) + utilitaire `.sr-only`.
2. ✅ **`prefers-reduced-motion`** + `conflict-pulse infinite` remplacé par état statique `conflict-in` (§5.2).
3. ✅ **Contraste muted** : `--c-text-muted: #64748B` ; ancien ton conservé en `--c-text-faint` (§4.1).
4. ✅ **Bug `form-control`** → `form-input` dans Exports (§3.3 / E4).
5. ✅ **`<h2>` redondant supprimé** en tête de la vue Exports (§7.1 / E2).
6. ✅ **`aria-label` sur les 12 `<select>` d'Exports** + `aria-hidden` sur les 16 SVG du sidebar (§6.3, §6.5).
7. ✅ **Empty state Exports** quand aucune séance (`.callout--info`) (§3.4 / E7).
8. ✅ **`.dashboard-card` alignée** sur `.card` (bordure + ombre) (§2.1).

### 🟡 Court terme (1–3 j) — ✅ quasi terminé
9. ✅ Classes `.section-title`, `.export-card-head`, `.callout`(+variantes), `.badge-new`, `.sr-only`, `.validation-list` créées et **Exports + Dashboard migrés** (§9, §2.2, E1/E3). _Reste `.list-row` (lignes d'exclusions) non extrait._
10. ✅ **Dashboard-cards & `#stat-conflits` → `<button>`** (focus + clavier) (§6.2).
11. ✅ **Confort EDT** : blocs 44px sur 2 lignes, libellés 10,5–12px sans `opacity` (couleur réelle) ; géométrie tokenisée via `DENSITES` (§5.1, §1.4).
12. ✅ **Tailles de cibles** : `.btn-sm` 34px, `.btn-xs` 30px, `.btn-icon-sm` 32px, `.cibles-display` 34px (§6.4).
13. ✅ **Tokens sémantiques** `*-text/*-border` ajoutés + fallbacks inline supprimés (Dashboard/Exports) (§3.2, §3.5).
14. ⬜ **États champs** : hover réel sur `.form-input`, feedback `aria-busy` sur exports longs (§3.4, §5.3).

### 🔵 Fond (chantier structurant)
15. 🟡 **Campagne anti-inline** : Exports + Dashboard migrés. **Passe donnees/wizard/programmation (12/06/2026)** : (a) **tokenisation complète** — tous les hex (`#64748b`, `#1e293b`, `#fff`, `#dc2626`, `#fef2f2`, `#e5e7eb`…) et tailles `rem` codés en dur dans les `style=` remplacés par des tokens (`var(--c-*)`, `var(--fs-*)`, `var(--sp-*)`) → **0 couleur hardcodée résiduelle**, débloque le mode sombre ; (b) **couche utilitaire** `u-*` (12 classes : `.u-hint/.u-desc/.u-muted/.u-text-sm/.u-field-hint/.u-unit/.u-code-chip/.u-row/.u-row-tight/.u-mb-3/.u-mb-4/.u-mb-2-0`, dans `main.css`) et migration des patterns répétés **sur éléments sans `class=`** → **252 → 191 attributs `style=`** (−24 %). Reste : styles dynamiques data-driven légitimes (`${color}`, `${pct}%`, positions) et patterns sur éléments déjà porteurs de `class` (`flex:1` sur `form-input`, `margin-bottom` mixtes) — faible valeur / risque de fusion de classes (§3.1, §9).
16. ✅ **Daltonisme installations** : second canal **texture** (9 motifs neutres distincts) dans les blocs EDT **et** la légende, activable via le toggle « Motifs » de la toolbar (mémorisé `localStorage['edt-patterns']`, off par défaut). Affectation **par index d'installation** (`data-pattern="0..8"`, indépendante de la palette codée en dur → fonctionne pour tout jeu d'installations) ; la légende sert de clé (pastille blanche + texture + liseré couleur). Encre neutre `rgba(15,23,42,…)` sous le texte, sans perte de lisibilité (§4.3). _Reste éventuel : étendre aux vues « par installation »._
17. ✅ **Sélecteur de période global** mémorisé dans le header, consommé par EDT + Vues (`src/utils/period-store.js`) (§7.2).
18. ✅ **Toggle densité Confort/Compact** sur l'EDT, mémorisé localStorage (§5.1).
19. ⬜ **Audit a11y automatisé** (axe-core) + passe clavier complète + landmarks/skip-link (§6.6) ; viser WCAG 2.2 AA.
20. ✅ **Mode sombre / confort** (12/06/2026) : bouton bascule dans le header (lune/soleil), mémorisé `localStorage['edteps-theme']`, **défaut = préférence système** (`prefers-color-scheme`), script inline anti-FOUC dans `index.html`. Bloc `[data-theme="dark"]` redéfinissant tous les tokens (surfaces, textes, bordures, fonds sémantiques, ombres, sidebar) + `color-scheme`. Surcharges ciblées : grille/blocs EDT + encre des motifs daltonisme (`grid.css`), tokenisation des couleurs sémantiques hardcodées de `components.css` (41) et `programmation.css` (15), onglet actif Vues, fond formulaire Exports. **Vérifié au navigateur** : 8 vues + EDT + modales, 0 fond clair / 0 texte sombre résiduel en sombre, thème clair inchangé (§4.4) — `src/utils/theme-store.js`, `src/app.js`, `index.html`, `styles/{main,grid,components,programmation}.css`.

---

### Note finale
La fondation (tokens, échelle typo relevée, `.card` renforcée, uniformisation Exports) est **saine et bien pensée**. Les gains les plus importants pour cet usage « plusieurs heures de saisie » viennent de trois axes : **(1) accessibilité clavier/focus** (aujourd'hui quasi absente, et ce sont des quick wins), **(2) confort de l'EDT** (le seul écran regardé en continu est aussi le plus dense et le moins lisible), et **(3) la fin du style inline**, qui conditionne toute évolution future (thème sombre, cohérence, maintenance). Les huit quick wins ci-dessus apportent l'essentiel du confort et de l'accessibilité pour un coût très réduit.
