/** French typography helpers. U+202F is the narrow no-break space (espace fine insécable). */

export const NNBSP = ' ';

const SPACES = /[   ]/;

/**
 * Puts a narrow no-break space before `: ; ! ? %`, replacing any ordinary or
 * no-break space already there. Leaves `://`, times like `12:30`, the start of
 * the string and doubled marks like `?!` alone.
 */
export function frenchSpacing(text: string): string {
  return text.replace(/[   ]*([:;!?%])/g, (match, mark: string, offset: number, whole: string) => {
    const end = offset + match.length;
    const hadSpace = match.length > 1;
    const before = whole[offset - 1];
    const after = whole[end];
    if (mark === ':' && whole.startsWith('//', end)) return match;
    if (!hadSpace) {
      if (before === undefined || SPACES.test(before)) return match;
      if (/[:;!?%]/.test(before)) return match;
      if (mark === ':' && /\d/.test(before) && after !== undefined && /\d/.test(after)) return match;
    }
    return `${NNBSP}${mark}`;
  });
}

/** Straight apostrophe → ’; straight double quotes → « … » with narrow no-break spaces inside. */
export function smartQuotes(text: string): string {
  let open = true;
  return text.replace(/'/g, '’').replace(/"/g, () => {
    const mark = open ? `«${NNBSP}` : `${NNBSP}»`;
    open = !open;
    return mark;
  }).replace(/« \s+/g, `«${NNBSP}`).replace(/\s+ »/g, `${NNBSP}»`);
}

/** Both transforms, for UI strings. */
export function typeset(text: string): string {
  return frenchSpacing(smartQuotes(text));
}

const numberFormat = new Intl.NumberFormat('fr-FR');

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return options ? new Intl.NumberFormat('fr-FR', options).format(value) : numberFormat.format(value);
}
