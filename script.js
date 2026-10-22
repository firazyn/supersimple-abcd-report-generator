(() => {
  'use strict';

  /* ==========================================================
   * ABCD Report Generator (vanilla JS)
   * Laporan digambar langsung ke <canvas> berukuran 1440 x 1027
   * sehingga pratinjau dan file PNG selalu identik.
   * ========================================================== */

  const W = 1440;
  const H = 1027;
  const FONT = 'Poppins, "Segoe UI", Helvetica, Arial, sans-serif';
  const STORAGE_KEY = 'abcd-report-state-v1';
  const PREVIEW_SCALE = 2;

  const BASE_SIZE = 12.8;   // ukuran teks isi (px) pada 1x
  const MIN_SIZE = 8;     // batas terkecil saat auto-fit
  const LINE_RATIO = 20 / 12.8;

  const C = {
    bg: '#EEF1FD',
    card: '#FFFFFF',
    border: '#E3E6F3',
    title: '#000000',
    body: '#0F0F12',
    icon: '#45454F',
    iconBox: '#D3D5DD',
  };

  const GEO = {
    header: { x: 180, y: 54, w: 1080, h: 143, r: 36 },
    cards: { xs: [126, 747], ys: [254, 618], w: 567, h: 322, r: 34 },
    iconOffset: { x: 39, y: 22, size: 66, r: 16 },
    headingY: 113,      // pusat judul kategori, relatif ke atas kartu
    contentY: 143,      // pusat baris pertama isi, relatif ke atas kartu
    contentX: 40,
    contentW: 480,
    contentBottom: 304, // batas bawah isi, relatif ke atas kartu
  };

  const SECTIONS = [
    { key: 'achievement', letter: 'A', title: 'Achievement', icon: 'award',   col: 0, row: 0 },
    { key: 'benefits',    letter: 'B', title: 'Benefits',    icon: 'chart',   col: 1, row: 0 },
    { key: 'concerns',    letter: 'C', title: 'Concerns',    icon: 'heart',   col: 0, row: 1 },
    { key: 'next',        letter: 'D', title: 'Do next',     icon: 'forward', col: 1, row: 1 },
  ];

  /* ---------- helpers ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);

  function pad2(n) { return String(n).padStart(2, '0'); }

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function formatDate(iso, lang) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date();
    return d.toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function titleFor(name) {
    const n = (name || '').trim() || 'Nama';
    return `${n.toUpperCase()}\u2019S ABCD REPORT`;
  }

  function titleCaseName(n) {
    return (n || '').trim().split(/\s+/).filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }

  function ddmmyy(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date();
    return `${pad2(d.getDate())}${pad2(d.getMonth() + 1)}${String(d.getFullYear()).slice(-2)}`;
  }

  // {Nama}'s ABCD Report {DDMMYY}.png
  function fileName(st) {
    const name = titleCaseName(st.name).replace(/[\\/:*?"<>|]+/g, '').trim() || 'Nama';
    return `${name}'s ABCD Report ${ddmmyy(st.date)}.png`;
  }

  /* ---------- state ---------- */
  function defaultState() {
    return {
      name: 'Lorem Ipsum',
      date: todayISO(),
      dateLang: 'en-GB',
      sections: {
        achievement: [
          { title: 'Lorem Ipsum', mode: 'bullets',
            text: 'Lorem ipsum dolor sit amet (90%)\n  Consectetur adipiscing elit\n  Sed do eiusmod tempor\nUt enim ad minim veniam' },
        ],
        benefits: [
          { title: 'Lorem Ipsum', mode: 'paragraph',
            text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.' },
        ],
        concerns: [
          { title: 'Dolor Sit Amet', mode: 'paragraph',
            text: 'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse.' },
        ],
        next: [
          { title: '', mode: 'paragraph',
            text: 'Excepteur sint occaecat cupidatat non proident (dd/mm/yy)' },
        ],
      },
    };
  }

  function loadState() {
    const base = defaultState();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return base;
      const s = JSON.parse(raw);
      const out = {
        name: typeof s.name === 'string' ? s.name : base.name,
        date: todayISO(), // tanggal selalu mulai dari hari ini
        dateLang: s.dateLang === 'id-ID' ? 'id-ID' : 'en-GB',
        sections: {},
      };
      for (const sec of SECTIONS) {
        const arr = s.sections && Array.isArray(s.sections[sec.key]) ? s.sections[sec.key] : base.sections[sec.key];
        out.sections[sec.key] = arr.map((b) => ({
          title: String((b && b.title) || ''),
          mode: b && b.mode === 'bullets' ? 'bullets' : 'paragraph',
          text: String((b && b.text) || ''),
        }));
      }
      return out;
    } catch (e) {
      return base;
    }
  }

  let state = loadState();

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* abaikan */ }
  }

  /* ==========================================================
   * Parsing isi
   * ========================================================== */
  function parseBlock(block) {
    const title = (block.title || '').trim();
    const lines = (block.text || '').replace(/\r/g, '').split('\n');
    const items = [];

    if (block.mode === 'bullets') {
      for (const raw of lines) {
        if (!raw.trim()) continue;
        const lead = raw.match(/^[ \t]*/)[0].replace(/\t/g, '  ');
        const level = Math.min(2, Math.floor(lead.length / 2));
        const text = raw.trim().replace(/^[-*\u2022\u2013\u25E6\u25AA]\s+/, '').trim();
        if (text) items.push({ type: 'bullet', level, text });
      }
    } else {
      for (const raw of lines) {
        const t = raw.trim();
        if (t) items.push({ type: 'para', text: t });
      }
    }
    return { title, items };
  }

  /* ==========================================================
   * Text wrapping & layout
   * ========================================================== */
  function breakWord(ctx, word, maxW) {
    const parts = [];
    let cur = '';
    for (const ch of word) {
      if (cur && ctx.measureText(cur + ch).width > maxW) { parts.push(cur); cur = ch; }
      else cur += ch;
    }
    if (cur) parts.push(cur);
    return parts;
  }

  function wrapText(ctx, text, maxW) {
    const out = [];
    let line = '';
    const flush = () => { if (line) { out.push(line); line = ''; } };

    for (const word of text.split(/\s+/).filter(Boolean)) {
      const parts = ctx.measureText(word).width > maxW ? breakWord(ctx, word, maxW) : [word];
      parts.forEach((p, i) => {
        const test = line ? `${line} ${p}` : p;
        if (!line || ctx.measureText(test).width <= maxW) line = test;
        else { flush(); line = p; }
        if (parts.length > 1 && i < parts.length - 1) flush();
      });
    }
    flush();
    return out.length ? out : [''];
  }

  function layoutBlocks(ctx, blocks, size) {
    const k = size / BASE_SIZE;
    const lh = size * LINE_RATIO;
    const gap = 8 * k;
    const cmds = [];
    let y = 0;
    let started = false;

    for (const block of blocks) {
      const pb = parseBlock(block);
      if (!pb.title && !pb.items.length) continue;
      if (started) y += gap;
      started = true;

      if (pb.title) {
        ctx.font = `600 ${size}px ${FONT}`;
        for (const ln of wrapText(ctx, pb.title, GEO.contentW)) {
          cmds.push({ t: 'text', s: ln, x: 0, y: y + lh / 2, w: 600 });
          y += lh;
        }
      }

      ctx.font = `400 ${size}px ${FONT}`;
      for (const it of pb.items) {
        if (it.type === 'bullet') {
          const indent = (19 + it.level * 16) * k;
          const lines = wrapText(ctx, it.text, GEO.contentW - indent);
          lines.forEach((ln, i) => {
            if (i === 0) cmds.push({ t: 'dot', x: indent - 10 * k, y: y + lh / 2, level: it.level, k });
            cmds.push({ t: 'text', s: ln, x: indent, y: y + lh / 2, w: 400 });
            y += lh;
          });
        } else {
          for (const ln of wrapText(ctx, it.text, GEO.contentW)) {
            cmds.push({ t: 'text', s: ln, x: 0, y: y + lh / 2, w: 400 });
            y += lh;
          }
        }
      }
    }
    return { cmds, height: y, lh, size };
  }

  function fitBlocks(ctx, blocks) {
    for (let size = BASE_SIZE; size >= MIN_SIZE; size -= 0.5) {
      const r = layoutBlocks(ctx, blocks, size);
      const firstTop = GEO.contentY - r.lh / 2;
      if (r.height <= GEO.contentBottom - firstTop) return { ...r, overflow: false };
    }
    return { ...layoutBlocks(ctx, blocks, MIN_SIZE), overflow: true };
  }

  /* ==========================================================
   * Drawing primitives
   * ========================================================== */
  function rrPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function panel(ctx, x, y, w, h, r) {
    rrPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
    ctx.fillStyle = C.card;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = C.border;
    ctx.stroke();
  }

  const HEART = 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z';

  function drawIcon(ctx, name, cx, cy) {
    ctx.save();
    ctx.strokeStyle = C.icon;
    ctx.fillStyle = C.icon;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (name === 'award') {
      const s = 1.9;
      ctx.translate(cx - 12 * s, cy - 12 * s);
      ctx.scale(s, s);
      ctx.lineWidth = 0.95;
      ctx.beginPath(); ctx.arc(12, 8, 6, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(12, 8, 3, 0, Math.PI * 2); ctx.stroke();
      ctx.stroke(new Path2D('M15.477 12.89 17 22l-5-3-5 3 1.523-9.11'));
    }

    if (name === 'chart') {
      const s = 1.8;
      ctx.translate(cx - 12 * s, cy - 12 * s);
      ctx.scale(s, s);
      ctx.lineWidth = 1.2;
      ctx.stroke(new Path2D('M3 3v18h18'));
      ctx.stroke(new Path2D('M7.5 16.5c3.6-.4 5.6-3.2 6.6-9.2'));
      ctx.stroke(new Path2D('M11 9.4 14.2 6l2.4 3.4'));
    }

    if (name === 'heart') {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(0.9, 0.9);
      ctx.translate(-12, -12);
      ctx.fill(new Path2D(HEART));
      ctx.restore();

      ctx.lineWidth = 3.2;
      const a = 0.9;
      for (const r of [13.5, 21]) {
        ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI - a, Math.PI + a); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, r, -a, a); ctx.stroke();
      }
    }

    if (name === 'forward') {
      ctx.translate(cx, cy);
      ctx.lineWidth = 2;
      const tri = (x1, y1, x2, y2, x3, y3) => {
        ctx.beginPath();
        ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3);
        ctx.closePath();
        ctx.stroke();
      };
      tri(-21, -16, -21, 16, 1, 0);
      tri(-9, -17, -9, 17, 21, 0);
    }

    ctx.restore();
  }

  function drawDot(ctx, cmd, x, y) {
    const k = cmd.k;
    ctx.save();
    ctx.fillStyle = C.body;
    ctx.strokeStyle = C.body;
    ctx.lineWidth = 1 * k;
    if (cmd.level === 0) {
      ctx.beginPath(); ctx.arc(x, y, 1.8 * k, 0, Math.PI * 2); ctx.fill();
    } else if (cmd.level === 1) {
      ctx.beginPath(); ctx.arc(x, y, 1.7 * k, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(x - 2.2 * k, y); ctx.lineTo(x + 2.2 * k, y); ctx.stroke();
    }
    ctx.restore();
  }

  /* ==========================================================
   * Render utama
   * ========================================================== */
  function render(canvas, scale, st) {
    canvas.width = Math.round(W * scale);
    canvas.height = Math.round(H * scale);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';

    // background
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    // header card
    const hd = GEO.header;
    panel(ctx, hd.x, hd.y, hd.w, hd.h, hd.r);

    ctx.textAlign = 'center';
    const title = titleFor(st.name);
    let ts = 47;
    ctx.font = `500 ${ts}px ${FONT}`;
    const maxTitleW = hd.w - 100;
    const tw = ctx.measureText(title).width;
    if (tw > maxTitleW) {
      ts = Math.max(22, (ts * maxTitleW) / tw);
      ctx.font = `500 ${ts}px ${FONT}`;
    }
    ctx.fillStyle = C.title;
    ctx.fillText(title, W / 2, hd.y + 59 + 0.35 * ts);

    ctx.font = `400 20px ${FONT}`;
    ctx.fillStyle = C.body;
    ctx.fillText(formatDate(st.date, st.dateLang), W / 2, hd.y + 109 + 0.35 * 20);
    ctx.textAlign = 'left';

    // 4 kartu
    const info = {};
    for (const sec of SECTIONS) {
      const x = GEO.cards.xs[sec.col];
      const y = GEO.cards.ys[sec.row];
      const { w, h, r } = GEO.cards;
      panel(ctx, x, y, w, h, r);

      // kotak ikon
      const io = GEO.iconOffset;
      const ix = x + io.x;
      const iy = y + io.y;
      rrPath(ctx, ix + 0.75, iy + 0.75, io.size - 1.5, io.size - 1.5, io.r);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = C.iconBox;
      ctx.stroke();
      drawIcon(ctx, sec.icon, ix + io.size / 2, iy + io.size / 2);

      // judul kategori (tetap)
      ctx.font = `800 20px ${FONT}`;
      ctx.fillStyle = C.title;
      ctx.fillText(sec.title, x + GEO.contentX, y + GEO.headingY + 0.33 * 20);

      // isi (bisa diatur)
      const fitted = fitBlocks(ctx, st.sections[sec.key] || []);
      info[sec.key] = { size: fitted.size, overflow: fitted.overflow };

      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 2, y + 2, w - 4, h - 4);
      ctx.clip();
      const top = y + GEO.contentY - fitted.lh / 2;
      const left = x + GEO.contentX;
      for (const cmd of fitted.cmds) {
        if (cmd.t === 'dot') {
          drawDot(ctx, cmd, left + cmd.x, top + cmd.y);
        } else {
          ctx.font = `${cmd.w} ${fitted.size}px ${FONT}`;
          ctx.fillStyle = C.body;
          ctx.fillText(cmd.s, left + cmd.x, top + cmd.y + 0.33 * fitted.size);
        }
      }
      ctx.restore();
    }
    return info;
  }

  /* ==========================================================
   * UI
   * ========================================================== */
  const previewCanvas = $('#report');
  let rafId = 0;

  const fontsReady = (async () => {
    try {
      await Promise.all(['400 12px Poppins', '500 12px Poppins', '600 12px Poppins', '800 12px Poppins']
        .map((f) => document.fonts.load(f)));
      await document.fonts.ready;
    } catch (e) { /* pakai font cadangan */ }
  })();

  function updateStatus(info) {
    for (const sec of SECTIONS) {
      const el = $(`.group[data-key="${sec.key}"] .status`);
      if (!el) continue;
      const i = info[sec.key];
      if (i.overflow) {
        el.hidden = false;
        el.textContent = 'Terlalu panjang, terpotong';
      } else if (i.size < BASE_SIZE) {
        el.hidden = false;
        el.textContent = `Font otomatis ${i.size}px`;
      } else {
        el.hidden = true;
      }
    }
  }

  function doRender() {
    rafId = 0;
    const info = render(previewCanvas, PREVIEW_SCALE, state);
    updateStatus(info);
    $('#titlePreview').textContent = titleFor(state.name);
  }

  function scheduleRender() {
    if (!rafId) rafId = requestAnimationFrame(doRender);
  }

  function changed() {
    saveState();
    scheduleRender();
  }

  /* ---------- editor blok ---------- */
  const PLACEHOLDER = {
    paragraph: 'Tulis paragraf di sini…',
    bullets: 'Satu baris = satu poin\n  Tab di awal baris = sub-poin',
  };
  const HINT = {
    paragraph: 'Teks biasa. Baris baru dianggap paragraf baru.',
    bullets: 'Satu baris = satu poin. Tekan Tab (atau 2 spasi) di awal baris untuk sub-poin, Shift+Tab untuk menaikkan lagi.',
  };

  function blockEl(key, block, redraw) {
    const el = document.createElement('div');
    el.className = 'block';
    el.innerHTML = `
      <div class="block-top">
        <input class="b-title" type="text" maxlength="80" placeholder="Judul blok (opsional), mis. Lorem Ipsum">
        <div class="seg" role="group" aria-label="Bentuk isi">
          <button type="button" data-mode="paragraph">Paragraf</button>
          <button type="button" data-mode="bullets">Poin</button>
        </div>
        <button type="button" class="icon-btn" title="Hapus blok" aria-label="Hapus blok">\u2715</button>
      </div>
      <textarea class="b-text" rows="3"></textarea>
      <p class="hint"></p>`;

    const titleInput = $('.b-title', el);
    const ta = $('.b-text', el);
    const hint = $('.hint', el);
    const segBtns = [...el.querySelectorAll('.seg button')];

    titleInput.value = block.title;
    ta.value = block.text;

    const applyMode = () => {
      segBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === block.mode)));
      ta.placeholder = PLACEHOLDER[block.mode];
      hint.textContent = HINT[block.mode];
    };
    applyMode();

    titleInput.addEventListener('input', () => { block.title = titleInput.value; changed(); });
    ta.addEventListener('input', () => { block.text = ta.value; changed(); });

    segBtns.forEach((b) => b.addEventListener('click', () => {
      block.mode = b.dataset.mode;
      applyMode();
      changed();
    }));

    $('.icon-btn', el).addEventListener('click', () => {
      const arr = state.sections[key];
      arr.splice(arr.indexOf(block), 1);
      redraw();
      changed();
    });

    ta.addEventListener('keydown', (e) => {
      if (block.mode !== 'bullets') return;

      if (e.key === 'Tab') {
        e.preventDefault();
        const v = ta.value;
        const s = ta.selectionStart;
        const en = ta.selectionEnd;
        const ls = v.lastIndexOf('\n', s - 1) + 1;
        let le = v.indexOf('\n', en);
        if (le === -1) le = v.length;
        const seg = v.slice(ls, le).split('\n');
        const next = seg.map((l) => (e.shiftKey ? l.replace(/^( {1,2}|\t)/, '') : '  ' + l));
        const joined = next.join('\n');
        ta.value = v.slice(0, ls) + joined + v.slice(le);
        const firstDelta = next[0].length - seg[0].length;
        ta.selectionStart = Math.max(ls, s + firstDelta);
        ta.selectionEnd = en + (joined.length - (le - ls));
        ta.dispatchEvent(new Event('input'));
        return;
      }

      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        const v = ta.value;
        const s = ta.selectionStart;
        const ls = v.lastIndexOf('\n', s - 1) + 1;
        const lead = (v.slice(ls, s).match(/^[ \t]*/) || [''])[0];
        if (lead) {
          e.preventDefault();
          ta.setRangeText('\n' + lead, s, ta.selectionEnd, 'end');
          ta.dispatchEvent(new Event('input'));
        }
      }
    });

    return el;
  }

  function buildEditors() {
    const root = $('#sections');
    root.innerHTML = '';

    for (const sec of SECTIONS) {
      const box = document.createElement('section');
      box.className = 'group';
      box.dataset.key = sec.key;
      box.innerHTML = `
        <div class="group-head">
          <span class="badge">${sec.letter}</span>
          <h2>${sec.title}</h2>
          <span class="status" hidden></span>
        </div>
        <div class="blocks"></div>
        <button type="button" class="btn ghost add">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
          <span>Tambah blok</span>
        </button>`;
      root.appendChild(box);

      const list = $('.blocks', box);
      const redraw = () => {
        list.innerHTML = '';
        state.sections[sec.key].forEach((b) => list.appendChild(blockEl(sec.key, b, redraw)));
      };

      $('.add', box).addEventListener('click', () => {
        state.sections[sec.key].push({ title: '', mode: 'bullets', text: '' });
        redraw();
        changed();
        const last = list.lastElementChild;
        if (last) $('.b-text', last).focus();
      });

      redraw();
    }
  }

  /* ---------- header, ekspor ---------- */
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  async function makeBlob(scale) {
    await fontsReady;
    const c = document.createElement('canvas');
    render(c, scale, state);
    return new Promise((resolve, reject) => {
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('Gagal membuat PNG'))), 'image/png');
    });
  }

  function currentScale() {
    return Number($('#scale').value) || 1;
  }

  async function downloadPng() {
    const btn = $('#download');
    btn.disabled = true;
    try {
      const blob = await makeBlob(currentScale());
      const a = document.createElement('a');
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = fileName(state);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast('PNG berhasil diunduh');
    } catch (e) {
      toast('Gagal membuat PNG');
    } finally {
      btn.disabled = false;
    }
  }

  async function copyPng() {
    try {
      const blob = await makeBlob(currentScale());
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      toast('Gambar disalin ke clipboard');
    } catch (e) {
      toast('Tidak bisa menyalin, pakai Download PNG saja');
    }
  }

  function syncHeader() {
    $('#name').value = state.name;
    $('#date').value = state.date;
    $('#dateLang').value = state.dateLang;
  }

  function bindHeader() {
    const name = $('#name');
    const date = $('#date');
    const lang = $('#dateLang');
    name.addEventListener('input', () => { state.name = name.value; changed(); });
    date.addEventListener('input', () => { state.date = date.value || todayISO(); changed(); });
    lang.addEventListener('change', () => { state.dateLang = lang.value; changed(); });
  }

  function init() {
    syncHeader();
    bindHeader();
    buildEditors();

    $('#download').addEventListener('click', downloadPng);
    $('#copy').addEventListener('click', copyPng);
    // modal konfirmasi reset
    const dlg = $('#resetModal');
    $('#reset').addEventListener('click', () => {
      dlg.returnValue = '';
      dlg.showModal();
    });
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close('cancel'); });
    dlg.addEventListener('close', () => {
      if (dlg.returnValue !== 'confirm') return;
      state = defaultState();
      syncHeader();
      buildEditors();
      changed();
      toast('Isi dikembalikan ke contoh awal');
    });

    doRender();
    fontsReady.then(doRender);
  }

  init();
})();
