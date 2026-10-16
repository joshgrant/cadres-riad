import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { step } from '../app/history';
import { prefs, updatePrefs } from '../app/prefs';
import { reducedMotion } from '../app/store';
import type { FrameId } from '../frames/ids';
import { t } from '../i18n/fr';
import { smartQuotes } from '../i18n/typography';
import {
  CAPTION_MAX_LENGTH,
  baselineRatio,
  captionPlacement,
  captionStyle,
  fitCaption,
  type CaptionStyle,
} from '../render/caption';
import type { FrameLayout } from '../render/layout';
import { useTooltip } from '../ui/Tooltip';
import './CaptionEditor.css';

interface CaptionEditorProps {
  frame: FrameId;
  layout: FrameLayout;
  /** Tells the canvas to hide its rendered text while the live field sits on top. */
  onEditingChange: (editing: boolean) => void;
}

/** Collapses pasted or typed line breaks, and applies French quotes and apostrophes. */
export function cleanCaption(text: string): string {
  return smartQuotes(text.replace(/[\r\n]+/g, ' ').replace(/ /g, ' '));
}

/**
 * The caption is edited where it sits: click (or Tab, then Enter) and a
 * single-line field appears exactly over the rendered text, matched in font,
 * size and position. Enter or a click outside commits; Escape reverts.
 */
export function CaptionEditor({ frame, layout, onEditingChange }: CaptionEditorProps) {
  const caption = prefs.value.caption;
  const style = captionStyle(frame, layout);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(caption);
  const [shake, setShake] = useState(false);
  const field = useRef<HTMLSpanElement>(null);
  const composing = useRef(false);
  // Guards against the blur that follows Escape or Enter committing a second time.
  const active = useRef(false);
  const tooltip = useTooltip(t('caption.edit'), { describe: false });

  const shown = editing ? draft : caption;
  const fitted = fitCaption(shown, style);
  const placement = captionPlacement(style, fitted.fontSize);

  const start = () => {
    active.current = true;
    setDraft(caption);
    setEditing(true);
    onEditingChange(true);
  };

  const finish = (commit: boolean) => {
    if (!active.current) return;
    active.current = false;
    setEditing(false);
    onEditingChange(false);
    const next = (field.current?.textContent ?? draft).trim();
    if (commit && next !== caption) step(() => updatePrefs({ caption: next }));
  };

  // Focus the field and put the caret at the end when editing starts.
  useLayoutEffect(() => {
    const element = field.current;
    if (!editing || !element) return;
    element.textContent = draft;
    element.focus();
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [editing]);

  const refuse = () => {
    if (reducedMotion.value) return;
    setShake(true);
  };

  /** Would `text` still fit at the smallest allowed size and length? */
  const accepts = (text: string) => text.length <= CAPTION_MAX_LENGTH && fitCaption(text, style).fits;

  const onBeforeInput = (event: InputEvent) => {
    if (composing.current || !event.data) return;
    const element = field.current;
    if (!element) return;
    const current = element.textContent ?? '';
    const selected = getSelection()?.toString().length ?? 0;
    if (!accepts(current.slice(0, current.length - selected) + event.data)) {
      event.preventDefault();
      refuse();
    }
  };

  const onInput = () => {
    const element = field.current;
    if (!element || composing.current) return;
    applyTypography(element);
    const text = element.textContent ?? '';
    if (!accepts(text)) {
      // Pasted or composed text that overflows is trimmed back to what fits.
      let trimmed = text;
      while (trimmed && !accepts(trimmed)) trimmed = trimmed.slice(0, -1);
      element.textContent = trimmed;
      placeCaretAtEnd(element);
      refuse();
    }
    setDraft(element.textContent ?? '');
  };

  const onPaste = (event: ClipboardEvent) => {
    event.preventDefault();
    const text = cleanCaption(event.clipboardData?.getData('text/plain') ?? '');
    document.execCommand('insertText', false, text);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      finish(true);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      finish(false);
    }
  };

  const css = textStyle(style, fitted.fontSize, placement);

  if (editing) {
    return (
      <span
        ref={field}
        class={`caption-editor__field${shake ? ' is-shaking' : ''}`}
        contentEditable
        role="textbox"
        aria-label={t('caption.edit')}
        aria-multiline="false"
        spellcheck={false}
        data-no-pan
        style={css}
        onBeforeInput={onBeforeInput}
        onInput={onInput}
        onPaste={onPaste}
        onKeyDown={onKeyDown}
        onBlur={() => finish(true)}
        onCompositionStart={() => (composing.current = true)}
        onCompositionEnd={() => {
          composing.current = false;
          onInput();
        }}
        onAnimationEnd={() => setShake(false)}
      />
    );
  }

  const empty = !caption.trim();
  return (
    <>
      <button
        type="button"
        class={`caption-editor__target${empty ? ' is-empty' : ''}`}
        aria-label={empty ? t('caption.placeholder') : t('caption.aria', { caption })}
        data-no-pan
        style={{
          left: `${style.box.x}px`,
          top: `${style.box.y}px`,
          width: `${style.box.width}px`,
          height: `${style.box.height}px`,
        }}
        onClick={start}
        {...tooltip.trigger}
      >
        {empty && (
          <span
            class="caption-editor__placeholder"
            aria-hidden="true"
            style={{ ...css, position: 'absolute', left: `${parseFloat(css.left) - style.box.x}px`, top: `${parseFloat(css.top) - style.box.y}px` }}
          >
            {t('caption.placeholder')}
          </span>
        )}
      </button>
      {tooltip.tooltip}
    </>
  );
}

/** Absolute CSS for text whose baseline and centre match the rendered caption. */
function textStyle(style: CaptionStyle, fontSize: number, placement: ReturnType<typeof captionPlacement>) {
  const top = placement.baseline - baselineRatio(style) * fontSize;
  return {
    left: `${placement.centerX}px`,
    top: `${top}px`,
    fontFamily: style.family,
    fontWeight: style.weight,
    fontSize: `${fontSize}px`,
    letterSpacing: `${style.letterSpacing * (fontSize / style.fontSize)}px`,
    color: style.color,
    transform: `translateX(-50%) rotate(${placement.rotation}deg)`,
  } as const;
}

function placeCaretAtEnd(element: HTMLElement): void {
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  const selection = getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

/** Converts quotes as he types, keeping the caret where it was. */
function applyTypography(element: HTMLElement): void {
  const text = element.textContent ?? '';
  const cleaned = cleanCaption(text);
  if (cleaned === text) return;
  const selection = getSelection();
  let caret = text.length;
  if (selection && selection.rangeCount > 0 && element.contains(selection.anchorNode)) {
    const range = selection.getRangeAt(0).cloneRange();
    range.selectNodeContents(element);
    range.setEnd(selection.anchorNode!, selection.anchorOffset);
    caret = range.toString().length;
  }
  const before = cleanCaption(text.slice(0, caret));
  element.textContent = cleaned;
  const node = element.firstChild;
  if (!node || !selection) return;
  const range = document.createRange();
  range.setStart(node, Math.min(before.length, cleaned.length));
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

