const BADGE_CONTAINER_ID = '__framer-badge-container';

// Hiding the CONTAINER (not just the badge link) is the robust defense: the
// Framer runtime we ship re-injects the badge on hydration, but an ancestor at
// display:none cannot be un-hidden by a descendant's inline styles, so the
// re-injected subtree stays invisible. `!important` beats the badge's
// non-important inline styles.
const HIDE_STYLE =
  `<style id="frexport-no-badge">#${BADGE_CONTAINER_ID},.__framer-badge{display:none!important}</style>`;

function emptyBadgeContainer(html: string): string {
  const openRe = new RegExp(`<div[^>]*id="${BADGE_CONTAINER_ID}"[^>]*>`, 'i');
  const open = openRe.exec(html);
  if (!open) return html;

  const innerStart = open.index + open[0].length;
  const tagRe = /<(\/?)div\b[^>]*>/gi;
  tagRe.lastIndex = innerStart;

  let depth = 1;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(html)) !== null) {
    depth += match[1] === '/' ? -1 : 1;
    if (depth === 0) {
      return html.slice(0, innerStart) + html.slice(match.index);
    }
  }
  return html;
}

export function removeFramerBadge(html: string): string {
  let out = emptyBadgeContainer(html);
  if (out.includes('id="frexport-no-badge"')) return out;
  if (out.includes('</head>')) {
    out = out.replace('</head>', `${HIDE_STYLE}</head>`);
  } else if (/<html[^>]*>/i.test(out)) {
    out = out.replace(/(<html[^>]*>)/i, `$1${HIDE_STYLE}`);
  } else {
    out = HIDE_STYLE + out;
  }
  return out;
}
