const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const https = require('https');

/**
 * Fetch a URL as a Buffer (for avatars).
 */
function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Wrap text to fit within a max width on a canvas context.
 */
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Generates a stylised quote card and returns a Buffer (PNG).
 * @param {Object} opts
 * @param {string} opts.content       - The message text
 * @param {string} opts.authorName    - Display name of the author
 * @param {string} opts.authorAvatar  - Avatar URL (512px recommended)
 * @param {string} opts.timestamp     - Formatted date string
 * @param {string} [opts.guildName]   - Server name (shown in footer)
 */
async function generateQuoteImage({ content, authorName, authorAvatar, timestamp, guildName }) {
  const W = 900;
  const PADDING = 48;
  const AVATAR_SIZE = 72;
  const FONT_BODY = 26;
  const FONT_META = 19;
  const LINE_HEIGHT = FONT_BODY * 1.55;

  // ── Measure text height first ────────────────────────────────────────────
  const tmpCanvas = createCanvas(W, 100);
  const tmpCtx = tmpCanvas.getContext('2d');
  tmpCtx.font = `${FONT_BODY}px sans-serif`;
  const textWidth = W - PADDING * 2 - AVATAR_SIZE - 24;
  const lines = wrapText(tmpCtx, content, textWidth);

  const bodyH = lines.length * LINE_HEIGHT;
  const H = Math.max(160, PADDING * 2 + AVATAR_SIZE + 20 + bodyH + 48);

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // ── Background ───────────────────────────────────────────────────────────
  // Dark gradient
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#1a1a2e');
  bg.addColorStop(1, '#16213e');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, 18);
  ctx.fill();

  // Accent bar on the left
  const accent = ctx.createLinearGradient(0, 0, 0, H);
  accent.addColorStop(0, '#7289da');
  accent.addColorStop(1, '#5865f2');
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.roundRect(0, 0, 6, H, [18, 0, 0, 18]);
  ctx.fill();

  // ── Avatar ───────────────────────────────────────────────────────────────
  const avatarX = PADDING + 6; // offset for accent bar
  const avatarY = PADDING;

  try {
    const avatarUrl = authorAvatar.replace(/\?size=\d+/, '') + '?size=128';
    const avatarBuf = await fetchBuffer(avatarUrl);
    const avatar = await loadImage(avatarBuf);

    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + AVATAR_SIZE / 2, avatarY + AVATAR_SIZE / 2, AVATAR_SIZE / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, avatarX, avatarY, AVATAR_SIZE, AVATAR_SIZE);
    ctx.restore();
  } catch {
    // Fallback: coloured circle with initials
    ctx.fillStyle = '#5865f2';
    ctx.beginPath();
    ctx.arc(avatarX + AVATAR_SIZE / 2, avatarY + AVATAR_SIZE / 2, AVATAR_SIZE / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `bold 28px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(authorName[0].toUpperCase(), avatarX + AVATAR_SIZE / 2, avatarY + AVATAR_SIZE / 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  // ── Author name + timestamp ──────────────────────────────────────────────
  const textStartX = avatarX + AVATAR_SIZE + 18;

  ctx.font = `bold ${FONT_BODY}px sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(authorName, textStartX, avatarY + 30);

  ctx.font = `${FONT_META}px sans-serif`;
  ctx.fillStyle = '#8e9297';
  ctx.fillText(timestamp, textStartX, avatarY + 30 + FONT_META + 4);

  // ── Quote body ───────────────────────────────────────────────────────────
  const bodyStartY = avatarY + AVATAR_SIZE + 24;
  ctx.font = `${FONT_BODY}px sans-serif`;
  ctx.fillStyle = '#dcddde';

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], PADDING + 12, bodyStartY + i * LINE_HEIGHT);
  }

  // ── Opening quote mark ───────────────────────────────────────────────────
  ctx.font = 'bold 80px sans-serif';
  ctx.fillStyle = 'rgba(88, 101, 242, 0.25)';
  ctx.fillText('"', PADDING + 12, bodyStartY - 4);

  // ── Footer ───────────────────────────────────────────────────────────────
  if (guildName) {
    ctx.font = `${FONT_META - 2}px sans-serif`;
    ctx.fillStyle = '#4f545c';
    ctx.textAlign = 'right';
    ctx.fillText(guildName, W - PADDING, H - 16);
    ctx.textAlign = 'left';
  }

  return canvas.toBuffer('image/png');
}

module.exports = { generateQuoteImage };
