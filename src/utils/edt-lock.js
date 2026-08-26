/**
 * Verrouillage global de l'emploi du temps.
 * Une fois l'EDT accepté et transmis, ce verrou empêche toute modification
 * accidentelle (glisser-déposer, modal séance, synchro depuis la Programmation,
 * Annuler...). Stocké en config projet (IndexedDB) : voyage avec le fichier
 * projet (export/import JSON), contrairement à un simple localStorage.
 */
import { getConfig, setConfig } from '../db/schema.js';
import { toast } from '../components/toast.js';

const CLE = 'edtVerrouille';

export async function isEdtVerrouille() {
  return (await getConfig(CLE)) === true;
}

export async function setEdtVerrouille(valeur) {
  await setConfig(CLE, !!valeur);
}

/**
 * À appeler avant toute écriture directe déclenchée par une action utilisateur
 * (drag & drop, enregistrer/supprimer/dupliquer une séance, Annuler...).
 * Affiche un toast d'avertissement et renvoie false si l'EDT est verrouillé —
 * l'appelant doit alors abandonner l'opération sans écrire en base.
 */
export async function assertEdtEditable() {
  if (await isEdtVerrouille()) {
    toast.warning('EDT verrouillé — déverrouillez-le pour le modifier.');
    return false;
  }
  return true;
}
