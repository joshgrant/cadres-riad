import { typeset } from './typography';

/**
 * Every visible string. Written with plain punctuation; `typeset` adds the
 * typographic apostrophe and narrow no-break spaces once, at load.
 * `{name}` placeholders are filled by `t`.
 */
const source = {
  'app.title': 'Cadres Riad',
  'section.frame': 'Cadre',
  'section.background': 'Fond',
  'frame.dore': 'Doré sculpté',
  'frame.noyer': 'Noyer sculpté',
  'frame.brut': 'Bois brut',
  'frame.chene': 'Chêne clair',
  'frame.noir': 'Noir',
  'frame.blanc': 'Blanc',
  'frame.polaroid': 'Polaroid',
  'bg.neutral': 'Neutre',
  'bg.add': 'Ajouter un fond',
  'bg.dropHere': 'Déposez l’image pour l’ajouter',
  'bg.disabledNote': 'Activez le détourage pour placer les personnes devant un fond.',
  'bg.deleteLabel': 'Supprimer ce fond',
  'bg.deleted': 'Fond supprimé',
  'common.undo': 'Annuler',
  'common.cancel': 'Annuler',
  'canvas.emptyTitle': 'Aucune photo',
  'canvas.emptyBody': 'Déposez une photo ici, ou choisissez-en une sur votre ordinateur.',
  'canvas.choose': 'Choisir une photo',
  'canvas.dropReplace': 'Déposez pour remplacer la photo',
  'canvas.label': 'Photo dans un cadre {frame}, légende : {caption}',
  'canvas.labelEmpty': 'Cadre {frame}, sans photo',
  'hint.drag': 'Glisser pour déplacer la photo',
  'hint.dismiss': 'Cliquer pour masquer',
  'ctrl.group': 'Commandes de la photo',
  'ctrl.cutout.off': 'Détourer les personnes',
  'ctrl.cutout.on': 'Détourage activé — cliquer pour désactiver',
  'ctrl.rotate': 'Pivoter le cadre',
  'ctrl.zoomIn': 'Zoom avant (Maj : ×2)',
  'ctrl.zoomOut': 'Zoom arrière (Maj : ×2)',
  'download.title': 'Préparation du détourage',
  'download.body': 'Téléchargement unique d’environ {total} Mo. Ensuite, le détourage fonctionne sans connexion.',
  'download.progress': '{done} Mo sur {total} Mo — {eta}',
  'eta.calculating': 'Calcul du temps restant…',
  'eta.lessThanMinute': 'moins d’une minute',
  'eta.oneMinute': 'environ 1 min restante',
  'eta.minutes': 'environ {n} min restantes',
  'cutout.running': 'Détourage en cours…',
  'cutout.done': 'Détourage terminé',
  'caption.placeholder': 'Ajouter une légende',
  'caption.edit': 'Cliquer pour modifier la légende',
  'caption.aria': 'Modifier la légende : {caption}',
  'caption.default': 'Riad Les Chtis D’Agadir 2026',
  'save.label': 'Enregistrer',
  'save.busy': 'Enregistrement…',
  'save.done': 'Photo enregistrée',
  'save.dialogTitle': 'Enregistrer la photo encadrée',
  'drawer.open': 'Cadre et fond',
  'drawer.close': 'Fermer',
  'update.available': 'Une mise à jour est disponible.',
  'update.action': 'Mettre à jour',
  'error.format': 'Ce format d’image n’est pas pris en charge. Utilisez une photo JPEG ou PNG.',
  'error.cutout': 'Le détourage n’a pas pu démarrer. Vérifiez la connexion Internet, puis réessayez.',
  'error.storage': 'Plus assez d’espace pour ce fond. Supprimez un fond existant, puis réessayez.',
  'error.save': 'La photo n’a pas pu être enregistrée. Réessayez.',
} as const;

export type MessageKey = keyof typeof source;

export const messages: Record<MessageKey, string> = Object.fromEntries(
  Object.entries(source).map(([key, value]) => [key, typeset(value)]),
) as Record<MessageKey, string>;

/** Looks up a string and fills `{name}` placeholders. Values are inserted as-is. */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const message = messages[key];
  if (!params) return message;
  return message.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}
