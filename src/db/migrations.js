/**
 * Migrations de données ponctuelles (au-delà du schéma Dexie).
 * Exécutées au démarrage de l'app, sur le projet actuellement chargé.
 */
import db from './schema.js';
import { getConfig, setConfig } from './schema.js';
import { deriveInitiales } from '../utils/helpers.js';

/**
 * Synchronise les initiales des enseignants avec leur prénom/nom.
 *
 * L'EDT affiche les initiales stockées (`ens.initiales`) dans chaque bloc, alors
 * que les autres vues recalculent le nom en direct. Un enseignant renommé avant
 * l'ajout de la synchro auto (modal Données) gardait donc d'anciennes initiales
 * — et l'ancienne identité — dans l'EDT.
 *
 * - Initiales VIDES : régénérées à chaque chargement (opération sûre, jamais
 *   destructrice — couvre aussi les enseignants créés sans initiales).
 * - Initiales PÉRIMÉES (non vides mais ≠ dérivation du nom actuel) : rafraîchies
 *   UNE SEULE FOIS (flag `initialesMigrationDone`). Après cette passe, la synchro
 *   du modal prend le relais et les initiales personnalisées sont préservées.
 *
 * @returns {Promise<number>} nombre d'enseignants dont les initiales ont changé
 */
export async function migrerInitiales() {
  const enseignants = await db.enseignants.toArray();
  if (enseignants.length === 0) return 0;

  const dejaFait = await getConfig('initialesMigrationDone');
  let modifs = 0;

  for (const e of enseignants) {
    const derive = deriveInitiales(e.prenom, e.nom);
    if (!derive) continue; // aucun nom exploitable → rien à dériver

    const actuelles = (e.initiales || '').trim();
    const vides = !actuelles;
    // Passe unique : ne touche aux initiales non vides que si elles ne
    // correspondent plus au nom (comparaison insensible à la casse).
    const perimees = !dejaFait && actuelles.toUpperCase() !== derive.toUpperCase();

    if (vides || perimees) {
      await db.enseignants.update(e.id, { initiales: derive.toUpperCase() });
      modifs++;
    }
  }

  if (!dejaFait) await setConfig('initialesMigrationDone', true);
  return modifs;
}
