// Browser-side observation. Animation code never supplies the reported metrics.
export function observe({reads, safe}) {
  const norm = s => String(s).replace(/\s+/g, ' ').trim();
  const measure = document.createElement('canvas').getContext('2d');
  const root = document.documentElement, rootStyle = getComputedStyle(root);
  const body = [...root.children].find(el => el.localName === 'body' && el.namespaceURI === 'http://www.w3.org/1999/xhtml');
  const bodyStyle = body && getComputedStyle(body);
  // CSS Overflow 3 §3.1.4: the propagated element has used overflow visible;
  // its computed overflow clips the viewport, not its (possibly empty) box.
  // Any containment disables the special HTML body propagation (Contain 1 §2).
  const bodyPropagates = root.localName === 'html' && root.namespaceURI === 'http://www.w3.org/1999/xhtml' &&
    rootStyle.overflowX === 'visible' && rootStyle.overflowY === 'visible' &&
    rootStyle.contain === 'none' && bodyStyle?.contain === 'none' && bodyStyle.display !== 'none';
  const propagated = rootStyle.display === 'none' ? null : bodyPropagates ? body : root;
  const viewport = {left:0, top:0, right:root.clientWidth, bottom:root.clientHeight};
  const alpha = color => {
    const match = color.match(/rgba?\(([^)]+)\)/);
    if (!match) return color === 'transparent' ? 0 : 1;
    const parts = match[1].split(/[,/\s]+/).filter(Boolean);
    return parts.length > 3 ? Number.parseFloat(parts[3]) : 1;
  };
  return reads.map(read => {
    let matches;
    try { matches = document.querySelectorAll(read.selector); } catch { return {id: read.id, text: '', visible: false, fits: false, font: 0, box: [], reasons: ['invalid-selector']}; }
    if (matches.length !== 1) return {id: read.id, text: '', visible: false, fits: false, font: 0, box: [], reasons: [`selector-count:${matches.length}`]};
    const el = matches[0], reasons = [], rects = [];
    let font = Infinity, visible = true, fits = true;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!norm(node.textContent)) continue;
      const range = document.createRange(); range.selectNodeContents(node);
      const cs = getComputedStyle(node.parentElement);
      let horizontal = true;
      for (let p = node.parentElement; p; p = p.parentElement) {
        const transform = getComputedStyle(p).transform;
        if (transform !== 'none') { const m = new DOMMatrix(transform); if (Math.abs(m.b) > .0001 || Math.abs(m.c) > .0001 || !m.is2D) horizontal = false; }
      }
      measure.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const ink = measure.measureText(node.textContent);
      // Range includes blank font ascent/descent. Use ink height for horizontal
      // text so a tight line-height mask does not claim to clip intact numerals.
      const glyphs = [...range.getClientRects()].filter(r => r.width > 0 && r.height > 0).map(r => {
        const height = ink.fontBoundingBoxAscent + ink.fontBoundingBoxDescent;
        if (!horizontal || !Number.isFinite(height) || height <= 0) return r;
        const s = r.height / height;
        return {left:r.left, right:r.right, width:r.width, top:r.top + (ink.fontBoundingBoxAscent - ink.actualBoundingBoxAscent)*s, bottom:r.top + (ink.fontBoundingBoxAscent + ink.actualBoundingBoxDescent)*s};
      });
      if (!glyphs.length) { visible = false; reasons.push('unpainted-text'); }
      let opacity = 1, scale = 1;
      for (let parent = node.parentElement; parent; parent = parent.parentElement) {
        const cs = getComputedStyle(parent);
        opacity *= Number(cs.opacity);
        if (cs.display === 'none' || cs.visibility !== 'visible' || cs.contentVisibility === 'hidden') visible = false;
        if (cs.transform !== 'none') { const m = new DOMMatrix(cs.transform); scale *= Math.min(Math.hypot(m.a, m.b), Math.hypot(m.c, m.d)); }
        // Non-rectangular masks cannot be established with a text-range bound.
        if (cs.clipPath !== 'none' || (cs.maskImage && cs.maskImage !== 'none') || cs.clip !== 'auto' || cs.filter !== 'none') { visible = false; reasons.push('unsupported-mask-or-filter'); }
        const viewportClip = parent === propagated;
        const paintContainment = /(^|\s)(paint|strict|content)(\s|$)/.test(cs.contain);
        const clipX = viewportClip || /hidden|clip|auto|scroll/.test(cs.overflowX), clipY = viewportClip || /hidden|clip|auto|scroll/.test(cs.overflowY);
        if (clipX || clipY) {
          const b = viewportClip ? viewport : parent.getBoundingClientRect();
          for (const r of glyphs) if ((clipX && (r.left < b.left - .5 || r.right > b.right + .5)) || (clipY && (r.top < b.top - .5 || r.bottom > b.bottom + .5))) { fits = false; reasons.push('ancestor-clip'); }
        }
        if (paintContainment) {
          const b = parent.getBoundingClientRect();
          for (const r of glyphs) if (r.left < b.left - .5 || r.right > b.right + .5 || r.top < b.top - .5 || r.bottom > b.bottom + .5) { fits = false; reasons.push('ancestor-clip'); }
        }
      }
      if (opacity * alpha(cs.color) < .95) { visible = false; reasons.push('opacity-or-color'); }
      font = Math.min(font, Number.parseFloat(cs.fontSize) * scale);
      for (const r of glyphs) {
        rects.push([r.left, r.top, r.right, r.bottom]);
        if (r.left < safe[0] - .5 || r.top < safe[1] - .5 || r.right > safe[2] + .5 || r.bottom > safe[3] + .5) { fits = false; reasons.push('safe-bounds'); }
        const x = Math.max(0, Math.min(innerWidth - 1, (r.left + r.right) / 2));
        const y = Math.max(0, Math.min(innerHeight - 1, (r.top + r.bottom) / 2));
        const top = document.elementsFromPoint(x, y)[0];
        if (top && top !== node.parentElement && !el.contains(top) && !top.contains(el)) { visible = false; reasons.push('occluded-at-probe'); }
      }
    }
    if (!rects.length) { visible = false; font = 0; }
    if (!visible && !reasons.length) reasons.push('hidden');
    const box = rects.length ? [Math.min(...rects.map(r => r[0])), Math.min(...rects.map(r => r[1])), Math.max(...rects.map(r => r[2])), Math.max(...rects.map(r => r[3]))] : [];
    return {id: read.id, text: norm(el.textContent), visible, fits, font: Number.isFinite(font) ? font : 0, box, reasons: [...new Set(reasons)]};
  });
}
