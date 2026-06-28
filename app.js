/* ═══════════════════════════════════════════════════════
   DotWav Sheets — Click-to-Add Chord Editor
   ═══════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const SHARP_NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const FLAT_NOTES  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
  const SECTION_KW  = ['verse','chorus','bridge','pre-chorus','prechorus','intro','outro','interlude','tag','ending','hook','refrain','solo','break','coda','instrumental'];
  const STORAGE_KEY = 'dotwav-sheets-v2';

  // ─── Firebase Config (Active) ───
  const firebaseConfig = {
    apiKey: "AIzaSyC1RmOtKT1B3h8w3xGFmrUmhH27WaTZ-n4",
    authDomain: "dotwav-sheets.firebaseapp.com",
    projectId: "dotwav-sheets",
    storageBucket: "dotwav-sheets.firebasestorage.app",
    messagingSenderId: "882261057983",
    appId: "1:882261057983:web:ff92b29a6863ac29ae410a",
    measurementId: "G-D5LNQ5PLSM"
  };

  // Initialize Firebase if SDK is loaded
  let db = null;
  if (typeof firebase !== 'undefined') {
    try {
      firebase.initializeApp(firebaseConfig);
      db = firebase.firestore();
      if (firebase.analytics) firebase.analytics();
      
      // Heartbeat check for Firestore API status
      db.collection('_health').doc('status').get().catch(e => {
        if (e.code === 'permission-denied') {
          console.warn("⚠️ Firestore API is disabled or has no rules. Operating in Offline Mode. Enable it here: https://console.cloud.google.com/apis/api/firestore.googleapis.com/overview?project=" + firebaseConfig.projectId);
        }
      });
    } catch (e) {
      console.error("Firebase Initialization Failed:", e);
    }
  }

  let song = {
    title: '', artist: '', key: 'C', keyMode: 'major', tempo: 120, capo: 0, transposeAmount: 0,
    preferSharps: false,
    lines: []
  };
  let currentSongId = null; 
  // userId removed - Global Sync Model

  let activeTab = 'edit';
  let sidebarOpen = true;
  let currentScreen = 'home';
  let charWidthCache = null;
  let selectedLines = new Set();
  let lastSelectedIdx = null;
  let dragIdx = null;
  let cursorIdx = null; // last interacted line — insert new lines after this
  let homeScrollPos = 0;
  let allSongs = []; // Cache for filtering
  let allSetlists = [];
  let currentSetlistId = null;
  let currentSetlist = null;
  let activeHomeTab = 'songs'; // 'songs' or 'setlists'
  let selectedSongIds = new Set();
  let perfSongIdx = 0;
  let isDragging = false;
  let autoScrollInterval = null;
  let deferredPrompt = null;

  const isSetlistNote = (item) => {
    if (!item) return false;
    if (item.type === 'note') return true;
    if (typeof item.text === 'string' && item.text.trim() !== '' && !item.id) return true;
    if (!item.id && item.text != null) return true;
    return false;
  };

  // ─── DOM Cache ───
  const $ = s => document.querySelector(s);
  const el = {};

  // Helper to safely bind events even if element is missing
  function safeBind(selector, event, fn) {
    const element = $(selector);
    if (element) {
      element.addEventListener(event, fn);
      return element;
    }
    console.warn(`[SafeBind] Element not found: ${selector}`);
    return null;
  }

  // Global Error Handler for easier debugging
  window.onerror = function(msg, url, lineNo, columnNo, error) {
    const string = msg.toLowerCase();
    const substring = "script error";
    if (string.indexOf(substring) > -1) {
      toast("Script Error: See Browser Console for Detail", "error");
    } else {
      const message = [
        'Message: ' + msg,
        'Line: ' + lineNo,
        'Column: ' + columnNo,
        'Error object: ' + JSON.stringify(error)
      ].join(' - ');
      toast("Error: " + msg, "error");
    }
    return false;
  };

  function cacheDom() {
    el.editorPanel = $('#editor-panel');
    el.previewPanel = $('#preview-panel');
    el.editorContent = $('#editor-content');
    el.editorScroll = $('#editor-scroll');
    el.previewContent = $('#preview-content');
    el.tabEdit = $('#tab-edit');
    el.tabPreview = $('#tab-preview');
    el.sidebar = $('#sidebar');
    el.title = $('#input-title');
    el.artist = $('#input-artist');
    el.key = $('#key-select');
    el.keyMode = $('#key-mode');
    el.tempo = $('#input-tempo');
    el.capo = $('#input-capo');
    el.transposeVal = $('#transpose-value');
    el.chordPopup = $('#chord-popup');
    el.chordInput = $('#chord-popup-input');
    el.importModal = $('#import-modal');
    el.importTextarea = $('#import-textarea');
    el.importReplace = $('#import-replace');
    el.toasts = $('#toast-container');
    el.selectionBar = $('#selection-bar');
    el.selCount = $('#sel-count');

    // Home Screen
    el.homeScreen = $('#home-screen');
    el.editorScreen = $('#editor-screen');
    el.songGrid = $('#song-grid');
    el.btnBackHome = $('#btn-back-home');
    el.cardCreate = $('#card-create');
    el.saveStatus = $('#save-status');
    el.btnToggleSidebar = $('#btn-toggle-sidebar');
    el.btnSidebarClose = $('#btn-sidebar-close');
    el.homeMain = $('.home-main');
    el.homeTabSongs = $('#home-tab-songs');
    el.homeTabSetlists = $('#home-tab-setlists');
    el.songsView = $('#songs-view');
    el.setlistsView = $('#setlists-view');
    el.setlistGrid = $('#setlist-grid');
    el.setlistScreen = $('#setlist-screen');
    el.setlistSongList = $('#setlist-song-list');
    el.setlistTitleDisplay = $('#setlist-title-display');
    el.addSongModal = $('#add-song-modal');
    el.addSongSearch = $('#add-song-search');
    el.addSongResults = $('#add-song-results');
    el.performanceScreen = $('#performance-screen');
    el.perfContent = $('#perf-content');
    el.perfSongTitle = $('#perf-song-title');
    el.perfSongArtist = $('#perf-song-artist');
    el.perfTransposeVal = $('#perf-transpose-val');
    el.perfProgress = $('#perf-progress');
    el.perfMain = $('#perf-main');
    el.btnPerfNext = $('#btn-perf-next');
    el.btnPerfPrev = $('#btn-perf-prev');
    el.btnPerfClose = $('#btn-perf-close');
    el.btnPerfTransposeUp = $('#btn-perf-transpose-up');
    el.btnPerfTransposeDown = $('#btn-perf-transpose-down');
    el.btnPerfTempoDown = $('#btn-perf-tempo-down');
    el.btnPerfTempoUp = $('#btn-perf-tempo-up');
    el.perfTempoVal = $('#perf-tempo-val');
    el.perfScrollToggle = $('#perf-scroll-toggle');
    el.perfScrollSpeed = $('#perf-scroll-speed');
    el.homeSearch = $('#home-search');
    el.toggleSharps = $('#toggle-sharps');
    el.cardCreateSetlist = $('#card-create-setlist');
    el.sidebarOverlay = $('#sidebar-overlay');
    el.btnAddSongConfirm = $('#btn-add-song-confirm');
    el.btnAddSongCancel = $('#btn-add-song-cancel');
    el.btnSelectAllSongs = $('#btn-select-all-songs');
    el.btnDeselectAllSongs = $('#btn-deselect-all-songs');
    el.modalCreateSetlist = $('#modal-create-setlist');
    el.inputSetlistName = $('#input-setlist-name');
    el.btnConfirmCreateSetlist = $('#btn-confirm-create-setlist');
    el.btnCancelCreateSetlist = $('#btn-cancel-create-setlist');
    el.btnCloseCreateSetlist = $('#btn-close-create-setlist');
    el.perfPlayedToggle = $('#perf-played-toggle');
    el.perfPlayedToggleWrapper = $('#perf-played-toggle-wrapper');
    el.btnAddNote = $('#btn-add-note');
    el.modalAddNote = $('#modal-add-note');
    el.inputSetlistNote = $('#input-setlist-note');
    el.btnConfirmAddNote = $('#btn-confirm-add-note');
    el.btnCancelAddNote = $('#btn-cancel-add-note');
    el.btnCloseAddNote = $('#btn-close-add-note');
    el.ptrIndicator = $('#ptr-indicator');
    el.btnInstallHeader = $('#btn-install-header');

    // Naadan Chords import
    el.cardNaadan = $('#card-naadan-import');
    el.naadanModal = $('#naadan-modal');
    el.naadanSearch = $('#naadan-search');
    el.naadanResults = $('#naadan-results');
  }

  // ═══════════════════════════════════════════════════════
  // CHARACTER WIDTH MEASUREMENT
  // ═══════════════════════════════════════════════════════
  function getCharWidth() {
    if (charWidthCache) return charWidthCache;
    const m = document.createElement('span');
    m.style.cssText = "font-family:'JetBrains Mono',monospace;font-size:0.95rem;position:absolute;visibility:hidden;white-space:pre";
    m.textContent = '0000000000';
    document.body.appendChild(m);
    charWidthCache = m.getBoundingClientRect().width / 10;
    m.remove();
    return charWidthCache;
  }

  // ═══════════════════════════════════════════════════════
  // EDITOR RENDERING
  // ═══════════════════════════════════════════════════════
  function renderEditor() {
    hideChordPopup();
    let html = '';

    if (song.lines.length === 0) {
      html = `<div class="editor-empty" style="text-align:center;padding:60px 20px;color:var(--text-muted)">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:12px;opacity:0.3"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        <p style="margin-bottom:8px">No lyrics yet</p>
        <p style="font-size:0.82rem">Click <strong>Import Lyrics</strong> to paste your lyrics, or use <strong>+ Line</strong> to add lines.</p>
      </div>`;
      el.editorContent.innerHTML = html;
      return;
    }

    song.lines.forEach((line, i) => {
      const selClass = selectedLines.has(i) ? ' selected' : '';
      const grip = `<span class="line-grip" data-idx="${i}" title="Click to select, drag to reorder">⋮⋮</span>`;
      if (line.type === 'empty') {
        html += `<div class="editor-line empty-line${selClass}" data-idx="${i}" draggable="true">${grip}<button class="line-delete" data-idx="${i}" title="Delete line">&times;</button></div>`;
      } else if (line.type === 'section') {
        html += `<div class="editor-line${selClass}" data-idx="${i}" draggable="true">${grip}
          <div class="section-label" data-idx="${i}">${esc(line.text)}</div>
          <button class="line-delete" data-idx="${i}" title="Delete line">&times;</button>
        </div>`;
      } else {
        const chordHtml = (line.chords || []).map((c, ci) =>
          `<span class="chord-badge" data-line="${i}" data-ci="${ci}" style="left:${c.pos}ch">${esc(c.name)}</span>`
        ).join('');
        html += `<div class="editor-line${selClass}" data-idx="${i}" draggable="true">${grip}
          <div class="chord-lane" data-idx="${i}">${chordHtml}</div>
          <div class="lyric-text" data-idx="${i}">${esc(line.text)}</div>
          <button class="line-delete" data-idx="${i}" title="Delete line">&times;</button>
        </div>`;
      }
    });

    el.editorContent.innerHTML = html;
    updateSelectionBar();
  }

  // ═══════════════════════════════════════════════════════
  // CHORD PLACEMENT (CLICK TO ADD)
  // ═══════════════════════════════════════════════════════
  let popupState = null; // {lineIdx, chordIdx|null, pos}

  function onChordLaneClick(e) {
    const lane = e.target.closest('.chord-lane');
    if (!lane) return;
    const lineIdx = parseInt(lane.dataset.idx);
    cursorIdx = lineIdx;

    // Clicking on an existing chord badge → edit it
    const badge = e.target.closest('.chord-badge');
    if (badge) {
      const ci = parseInt(badge.dataset.ci);
      showChordPopup(lineIdx, song.lines[lineIdx].chords[ci].pos, ci);
      return;
    }

    // Clicking on empty space → add new chord
    const rect = lane.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const charPos = Math.max(0, Math.round(relX / getCharWidth()));
    showChordPopup(lineIdx, charPos, null);
  }

  function showChordPopup(lineIdx, charPos, chordIdx) {
    popupState = { lineIdx, charPos, chordIdx };
    const lane = document.querySelector(`.chord-lane[data-idx="${lineIdx}"]`);
    if (!lane) return;

    el.chordPopup.style.display = 'flex';
    const leftPos = lane.offsetLeft + charPos * getCharWidth() - 4;
    const topPos = Math.max(0, lane.offsetTop - 2);
    el.chordPopup.style.left = leftPos + 'px';
    el.chordPopup.style.top = topPos + 'px';

    el.chordInput.value = chordIdx !== null ? song.lines[lineIdx].chords[chordIdx].name : '';
    el.chordInput.focus();
    if (chordIdx !== null) el.chordInput.select();
  }

  function hideChordPopup() {
    el.chordPopup.style.display = 'none';
    popupState = null;
  }

  function commitChordPopup() {
    if (!popupState) return;
    const { lineIdx, charPos, chordIdx } = popupState;
    const val = el.chordInput.value.trim();
    const line = song.lines[lineIdx];

    if (val) {
      if (chordIdx !== null) {
        line.chords[chordIdx].name = val;
      } else {
        line.chords.push({ pos: charPos, name: val });
        line.chords.sort((a, b) => a.pos - b.pos);
      }
    } else if (chordIdx !== null) {
      line.chords.splice(chordIdx, 1);
    }

    hideChordPopup();
    renderEditor();
    save();
  }

  // ═══════════════════════════════════════════════════════
  // INLINE LYRIC / SECTION EDITING (single-click)
  // ═══════════════════════════════════════════════════════
  function onLyricClick(e) {
    const lyricEl = e.target.closest('.lyric-text');
    if (!lyricEl) return;
    if (lyricEl.querySelector('.lyric-edit-input')) return; // already editing
    const idx = parseInt(lyricEl.dataset.idx);
    cursorIdx = idx;
    const line = song.lines[idx];

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'lyric-edit-input';
    input.value = line.text;
    lyricEl.textContent = '';
    lyricEl.appendChild(input);
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);

    let finishing = false;
    const finish = (saveIt) => {
      if (finishing) return;
      finishing = true;
      if (saveIt) { line.text = input.value; save(); }
      renderEditor();
    };

    // Expose a cancel handle so the global Escape handler can reach it
    input._cancelEdit = () => finish(false);

    input.addEventListener('blur', () => finish(true));
    input.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        const text = input.value;
        line.text = text;
        finishing = true;
        song.lines.splice(idx + 1, 0, { type: 'lyric', text: '', chords: [] });
        cursorIdx = idx + 1;
        save();
        renderEditor();
        requestAnimationFrame(() => {
          const nextLyric = document.querySelector(`.lyric-text[data-idx="${idx + 1}"]`);
          if (nextLyric) nextLyric.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
      } else if (ev.key === 'Backspace' && input.value === '') {
        ev.preventDefault();
        finishing = true;
        song.lines.splice(idx, 1);
        const prevIdx = Math.max(0, idx - 1);
        cursorIdx = prevIdx;
        save();
        renderEditor();
        requestAnimationFrame(() => {
          const prevLine = song.lines[prevIdx];
          if (prevLine && prevLine.type === 'lyric') {
            const prevLyric = document.querySelector(`.lyric-text[data-idx="${prevIdx}"]`);
            if (prevLyric) {
              prevLyric.dispatchEvent(new MouseEvent('click', { bubbles: true }));
              requestAnimationFrame(() => {
                const inp = prevLyric.querySelector('.lyric-edit-input');
                if (inp) inp.setSelectionRange(inp.value.length, inp.value.length);
              });
            }
          }
        });
      } else if (ev.key === 'Tab') {
        ev.preventDefault();
        line.text = input.value;
        finishing = true;
        save();
        const nextIdx = ev.shiftKey ? idx - 1 : idx + 1;
        renderEditor();
        if (nextIdx >= 0 && nextIdx < song.lines.length) {
          requestAnimationFrame(() => {
            const nextLine = song.lines[nextIdx];
            if (nextLine && nextLine.type === 'lyric') {
              const nextLyric = document.querySelector(`.lyric-text[data-idx="${nextIdx}"]`);
              if (nextLyric) nextLyric.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            }
          });
        }
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        finish(false);
      }
    });
  }

  function onSectionClick(e) {
    const secEl = e.target.closest('.section-label');
    if (!secEl) return;
    if (secEl.querySelector('.section-edit-input')) return; // already editing
    const idx = parseInt(secEl.dataset.idx);
    cursorIdx = idx;
    const line = song.lines[idx];

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'section-edit-input';
    input.value = line.text;
    secEl.textContent = '';
    secEl.appendChild(input);
    input.focus();
    input.select();

    let finishing = false;
    const finish = (saveIt) => {
      if (finishing) return;
      finishing = true;
      if (saveIt && input.value.trim()) { line.text = input.value.trim(); save(); }
      else if (saveIt && !input.value.trim()) {
        // Remove the section if name left blank
        song.lines.splice(idx, 1);
        save();
      }
      renderEditor();
    };
    input._cancelEdit = () => finish(false);

    input.addEventListener('blur', () => finish(true));
    input.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') { ev.preventDefault(); finish(true); }
      if (ev.key === 'Escape') { ev.preventDefault(); finish(false); }
      if (ev.key === 'Tab') { ev.preventDefault(); finish(true); }
    });
  }

  // ═══════════════════════════════════════════════════════
  // LINE MANAGEMENT
  // ═══════════════════════════════════════════════════════
  function onDeleteLine(e) {
    const btn = e.target.closest('.line-delete');
    if (!btn) return;
    const idx = parseInt(btn.dataset.idx);
    song.lines.splice(idx, 1);
    renderEditor();
    save();
  }

  function addLine() {
    const insertAt = getInsertPosition();
    song.lines.splice(insertAt, 0, { type: 'lyric', text: '', chords: [] });
    cursorIdx = insertAt;
    renderEditor();
    save();
    requestAnimationFrame(() => {
      const newLyric = document.querySelector(`.lyric-text[data-idx="${insertAt}"]`);
      if (newLyric) newLyric.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  }

  function addSection() {
    const insertAt = getInsertPosition();
    song.lines.splice(insertAt, 0, { type: 'section', text: 'Section', chords: [] });
    cursorIdx = insertAt;
    renderEditor();
    save();
    requestAnimationFrame(() => {
      const secEl = document.querySelector(`.section-label[data-idx="${insertAt}"]`);
      if (secEl) secEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  }

  function getInsertPosition() {
    // If lines are selected, insert after the last selected line
    if (selectedLines.size > 0) {
      return Math.max(...selectedLines) + 1;
    }
    // If cursor is set, insert after it
    if (cursorIdx !== null && cursorIdx < song.lines.length) {
      return cursorIdx + 1;
    }
    // Default: append to end
    return song.lines.length;
  }

  // ═══════════════════════════════════════════════════════
  // DRAG AND DROP REORDERING
  // ═══════════════════════════════════════════════════════
  function onDragStart(e) {
    const grip = e.target.closest('.line-grip');
    const line = e.target.closest('.editor-line');
    if (!grip || !line) { e.preventDefault(); return; }
    dragIdx = parseInt(line.dataset.idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragIdx);
    requestAnimationFrame(() => line.classList.add('dragging'));
  }

  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    clearDropIndicators();
    const line = e.target.closest('.editor-line');
    if (!line || parseInt(line.dataset.idx) === dragIdx) return;
    const rect = line.getBoundingClientRect();
    if (e.clientY < rect.top + rect.height / 2) {
      line.classList.add('drag-over-top');
    } else {
      line.classList.add('drag-over-bottom');
    }
  }

  function onDragEnd() {
    dragIdx = null;
    clearDropIndicators();
    document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
  }

  function onDrop(e) {
    e.preventDefault();
    const targetLine = e.target.closest('.editor-line');
    if (!targetLine || dragIdx === null) return;
    let targetIdx = parseInt(targetLine.dataset.idx);
    if (targetIdx === dragIdx) return;

    const rect = targetLine.getBoundingClientRect();
    const dropAfter = e.clientY >= rect.top + rect.height / 2;

    const [moved] = song.lines.splice(dragIdx, 1);
    let insertAt = dropAfter ? targetIdx : targetIdx;
    if (dragIdx < targetIdx) insertAt--;
    if (dropAfter) insertAt++;
    insertAt = Math.max(0, Math.min(song.lines.length, insertAt));
    song.lines.splice(insertAt, 0, moved);

    selectedLines.clear();
    dragIdx = null;
    clearDropIndicators();
    renderEditor();
    save();
  }

  function clearDropIndicators() {
    document.querySelectorAll('.drag-over-top,.drag-over-bottom').forEach(el => {
      el.classList.remove('drag-over-top', 'drag-over-bottom');
    });
  }

  // ═══════════════════════════════════════════════════════
  // LINE SELECTION
  // ═══════════════════════════════════════════════════════
  function onGripClick(e) {
    const grip = e.target.closest('.line-grip');
    if (!grip) return;
    e.stopPropagation();
    const idx = parseInt(grip.dataset.idx);
    cursorIdx = idx;

    if (e.shiftKey && lastSelectedIdx !== null) {
      const from = Math.min(lastSelectedIdx, idx);
      const to = Math.max(lastSelectedIdx, idx);
      for (let i = from; i <= to; i++) selectedLines.add(i);
    } else if (e.ctrlKey || e.metaKey) {
      if (selectedLines.has(idx)) selectedLines.delete(idx);
      else selectedLines.add(idx);
    } else {
      if (selectedLines.has(idx) && selectedLines.size === 1) selectedLines.clear();
      else { selectedLines.clear(); selectedLines.add(idx); }
    }
    lastSelectedIdx = idx;
    renderEditor();
  }

  function updateSelectionBar() {
    const n = selectedLines.size;
    if (n > 0) {
      el.selectionBar.classList.add('visible');
      el.selCount.textContent = n + ' line' + (n > 1 ? 's' : '') + ' selected';
    } else {
      el.selectionBar.classList.remove('visible');
    }
  }

  function clearSelection() {
    selectedLines.clear();
    lastSelectedIdx = null;
    renderEditor();
  }

  function moveSelectedUp() {
    const indices = [...selectedLines].sort((a, b) => a - b);
    if (indices[0] === 0) return;
    const newSel = new Set();
    for (const i of indices) {
      [song.lines[i - 1], song.lines[i]] = [song.lines[i], song.lines[i - 1]];
      newSel.add(i - 1);
    }
    selectedLines = newSel;
    renderEditor(); save();
  }

  function moveSelectedDown() {
    const indices = [...selectedLines].sort((a, b) => b - a);
    if (indices[0] >= song.lines.length - 1) return;
    const newSel = new Set();
    for (const i of indices) {
      [song.lines[i], song.lines[i + 1]] = [song.lines[i + 1], song.lines[i]];
      newSel.add(i + 1);
    }
    selectedLines = newSel;
    renderEditor(); save();
  }

  function duplicateSelected() {
    const indices = [...selectedLines].sort((a, b) => a - b);
    const copies = indices.map(i => JSON.parse(JSON.stringify(song.lines[i])));
    const insertAt = Math.max(...indices) + 1;
    song.lines.splice(insertAt, 0, ...copies);
    selectedLines.clear();
    for (let i = 0; i < copies.length; i++) selectedLines.add(insertAt + i);
    renderEditor(); save();
    toast(`Duplicated ${copies.length} line${copies.length > 1 ? 's' : ''}`, 'success');
  }

  function deleteSelected() {
    if (selectedLines.size === 0) return;
    const indices = [...selectedLines].sort((a, b) => b - a);
    for (const i of indices) song.lines.splice(i, 1);
    selectedLines.clear();
    renderEditor(); save();
    toast(`Deleted ${indices.length} line${indices.length > 1 ? 's' : ''}`, 'info');
  }

  // ═══════════════════════════════════════════════════════
  // IMPORT LYRICS
  // ═══════════════════════════════════════════════════════
  function openImportModal() {
    toast('Import modal triggered', 'info');
    el.importTextarea.value = '';
    el.importModal.classList.add('open');
    el.importTextarea.focus();
  }

  function closeImportModal() {
    el.importModal.classList.remove('open');
  }

  function isSectionLine(text) {
    const t = text.trim().toLowerCase();
    // Bare section keywords
    for (const kw of SECTION_KW) {
      if (t === kw || t.match(new RegExp(`^${kw}\\s*\\d*$`))) return true;
    }
    // Bracket section headers like [Verse 1]
    const m = t.match(/^\[([^\]]+)\]$/);
    if (m) {
      const inner = m[1].trim().toLowerCase();
      for (const kw of SECTION_KW) {
        if (inner === kw || inner.match(new RegExp(`^${kw}\\s*\\d*$`))) return true;
      }
    }
    return false;
  }

  function parseBracketLine(text) {
    // Parse [Chord] notation from a line
    const regex = /\[([^\]]+)\]/g;
    const chords = [];
    let plain = '';
    let last = 0;
    let m;
    while ((m = regex.exec(text)) !== null) {
      const before = text.substring(last, m.index);
      const pos = plain.length + before.length;
      plain += before;
      chords.push({ pos, name: m[1] });
      last = m.index + m[0].length;
    }
    plain += text.substring(last);
    return { text: plain, chords };
  }

  function importLyrics() {
    const raw = el.importTextarea.value;
    if (!raw.trim()) { toast('Nothing to import', 'info'); return; }

    const replace = el.importReplace.checked;
    const newLines = [];
    const lines = raw.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        newLines.push({ type: 'empty', text: '', chords: [] });
      } else if (isSectionLine(trimmed)) {
        // Extract section name
        const bracketMatch = trimmed.match(/^\[([^\]]+)\]$/);
        newLines.push({ type: 'section', text: bracketMatch ? bracketMatch[1].trim() : trimmed, chords: [] });
      } else if (/\[[^\]]+\]/.test(trimmed)) {
        // Has bracket chords
        const parsed = parseBracketLine(trimmed);
        newLines.push({ type: 'lyric', text: parsed.text, chords: parsed.chords });
      } else {
        newLines.push({ type: 'lyric', text: line.replace(/\t/g, '  '), chords: [] });
      }
    }

    if (replace) {
      song.lines = newLines;
    } else {
      if (song.lines.length > 0) song.lines.push({ type: 'empty', text: '', chords: [] });
      song.lines.push(...newLines);
    }

    closeImportModal();
    selectedLines.clear();
    renderEditor();
    save();
    toast(`Imported ${newLines.length} lines`, 'success');
  }

  // ═══════════════════════════════════════════════════════
  // PREVIEW RENDERING
  // ═══════════════════════════════════════════════════════
  function buildSegments(line) {
    const chords = [...(line.chords || [])].sort((a, b) => a.pos - b.pos);
    if (chords.length === 0) return [{ chord: '', text: line.text }];

    const segs = [];
    if (chords[0].pos > 0) segs.push({ chord: '', text: line.text.substring(0, chords[0].pos) });
    for (let i = 0; i < chords.length; i++) {
      const start = chords[i].pos;
      const end = (i + 1 < chords.length) ? chords[i + 1].pos : line.text.length;
      segs.push({ chord: chords[i].name, text: line.text.substring(start, Math.max(start, end)) });
    }
    return segs;
  }

  function renderPreview() {
    if (song.lines.length === 0) {
      el.previewContent.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-muted)"><p>No content to preview.</p></div>';
      return;
    }
    const keyDisplay = song.key + ' ' + (song.keyMode === 'minor' ? 'Minor' : 'Major');
    let h = '';
    h += `<div class="cs-title">${esc(song.title || 'Untitled')}</div>`;
    if (song.artist) h += `<div class="cs-artist">${esc(song.artist)}</div>`;
    const meta = [`<span class="cs-meta-item"><strong>Key:</strong> ${esc(keyDisplay)}</span>`,
      `<span class="cs-meta-item"><strong>Tempo:</strong> ${song.tempo} BPM</span>`];
    if (parseInt(song.capo) > 0) meta.push(`<span class="cs-meta-item"><strong>Capo:</strong> ${song.capo}</span>`);
    h += `<div class="cs-meta">${meta.join('')}</div>`;

    for (const line of song.lines) {
      if (line.type === 'empty') { h += '<div class="cs-empty-line"></div>'; continue; }
      if (line.type === 'section') { h += `<div class="cs-section">${esc(line.text)}</div>`; continue; }
      const segs = buildSegments(line);
      const hasChords = segs.some(s => s.chord);
      h += '<div class="cs-line">';
      for (const s of segs) {
        h += `<span class="cs-segment"><span class="cs-chord">${s.chord ? esc(s.chord) : (hasChords ? ' ' : '')}</span><span class="cs-text">${esc(s.text || ' ')}</span></span>`;
      }
      h += '</div>';
    }
    el.previewContent.innerHTML = h;
  }

  // ═══════════════════════════════════════════════════════
  // TRANSPOSE
  // ═══════════════════════════════════════════════════════
  function noteIndex(n) { let i = SHARP_NOTES.indexOf(n); return i !== -1 ? i : FLAT_NOTES.indexOf(n); }
  function useFlats(key) { 
    if (song.preferSharps) return false;
    return ['F','Bb','Eb','Ab','Db','Gb','Dm','Gm','Cm','Fm','Bbm','Ebm'].includes(key); 
  }
  function transposeNote(n, s, flat) { const i = noteIndex(n); return i === -1 ? n : (flat ? FLAT_NOTES : SHARP_NOTES)[((i + s) % 12 + 12) % 12]; }
  function transposeChord(ch, s, flat) {
    const m = ch.match(/^([A-G][#b]?)(.*?)(?:\/([A-G][#b]?)(.*))?$/);
    if (!m) return ch;
    let r = transposeNote(m[1], s, flat) + m[2];
    if (m[3]) r += '/' + transposeNote(m[3], s, flat) + (m[4] || '');
    return r;
  }

  function transposeAll(semitones) {
    const flat = useFlats(song.key);
    for (const line of song.lines) {
      if (line.chords) line.chords.forEach(c => { c.name = transposeChord(c.name, semitones, flat); });
    }
    if (semitones !== 0) {
      song.key = transposeNote(song.key, semitones, flat);
      el.key.value = song.key;
      song.transposeAmount = (song.transposeAmount || 0) + semitones;
      updateTransposeDisplay();
    }
    renderEditor();
    if (activeTab === 'preview') renderPreview();
    save();
  }

  function updateTransposeDisplay() {
    const v = song.transposeAmount || 0;
    el.transposeVal.textContent = v > 0 ? `+${v}` : v.toString();
    el.transposeVal.className = 'transpose-value' + (v > 0 ? ' positive' : v < 0 ? ' negative' : '');
  }

  async function exportPdf() {
    if (!window.jspdf) { toast('PDF library loading...', 'info'); return; }
    if (song.lines.length === 0) { toast('Nothing to export!', 'info'); return; }
    const btn = $('#btn-export-pdf');
    btn.classList.add('exporting');
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const mL = 18, mR = 18, mT = 20, mB = 18;
      let y = mT;

      function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(e => {
        console.warn(`Error attempting to enable fullscreen: ${e.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }

  // ─── UTILS ───
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(17, 17, 17);
      doc.text(song.title || 'Untitled', mL, y);
      y += 8;

      // ─── Artist ───
      if (song.artist) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        doc.setTextColor(85, 85, 85);
        doc.text(song.artist, mL, y);
        y += 6;
      }

      // ─── Meta ───
      doc.setFontSize(9);
      doc.setTextColor(119, 119, 119);
      const keyStr = (song.key || 'C') + ' ' + (song.keyMode === 'minor' ? 'Minor' : 'Major');
      let metaStr = 'Key: ' + keyStr + '     Tempo: ' + song.tempo + ' BPM';
      if (parseInt(song.capo) > 0) metaStr += '     Capo: ' + song.capo;
      doc.text(metaStr, mL, y);
      y += 4;

      // ─── Divider ───
      doc.setDrawColor(34, 34, 34);
      doc.setLineWidth(0.5);
      doc.line(mL, y, pageW - mR, y);
      y += 8;

      // ─── Song lines ───
      const chordCharW = 2.1; // mm per character for courier 10pt

      for (const line of song.lines) {
        const needH = (line.type === 'section') ? 12 : ((line.chords && line.chords.length) ? 10 : 6);
        if (y + needH > pageH - mB) { doc.addPage(); y = mT; }

        if (line.type === 'empty') { y += 4; continue; }

        if (line.type === 'section') {
          y += 3;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(136, 136, 136);
          doc.text(line.text.toUpperCase(), mL, y);
          y += 6;
          continue;
        }

        // Lyric line — chords above, lyrics below
        const chords = line.chords || [];
        if (chords.length > 0) {
          doc.setFont('courier', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(17, 17, 17);
          for (const c of chords) {
            const x = mL + c.pos * chordCharW;
            doc.text(c.name, Math.min(x, pageW - mR - 12), y);
          }
          y += 4.5;
        }

        const txt = line.text || '';
        if (txt.trim()) {
          doc.setFont('courier', 'normal');
          doc.setFontSize(11);
          doc.setTextColor(34, 34, 34);
          doc.text(txt, mL, y);
        }
        y += 5;
      }

      // ─── Footer on last page ───
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(170, 170, 170);
      doc.text('Created with DotWav Sheets', pageW / 2, pageH - 10, { align: 'center' });

      const fn = (song.title || 'chord-sheet').replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-').toLowerCase();
      doc.save(fn + '.pdf');
      toast('PDF exported!', 'success');
    } catch (e) { console.error(e); toast('Export failed: ' + e.message, 'info'); }
    finally { btn.classList.remove('exporting'); }
  }

  // ═══════════════════════════════════════════════════════
  // SHARING (cross-device)
  // ═══════════════════════════════════════════════════════
  function shareSong() {
    if (song.lines.length === 0) { toast('Nothing to share!', 'info'); return; }
    try {
      const data = JSON.stringify(song);
      const encoded = btoa(unescape(encodeURIComponent(data)));
      const url = window.location.origin + window.location.pathname + '#song=' + encoded;
      navigator.clipboard.writeText(url).then(() => {
        toast('Share link copied to clipboard!', 'success');
      }).catch(() => {
        // Fallback: prompt
        prompt('Copy this link to share your song:', url);
      });
    } catch (e) { console.error(e); toast('Could not generate share link', 'info'); }
  }

  function loadFromUrl() {
    const hash = window.location.hash;
    if (!hash.startsWith('#song=')) return false;
    try {
      const encoded = hash.substring(6);
      const data = decodeURIComponent(escape(atob(encoded)));
      const parsed = JSON.parse(data);
      song = { ...song, ...parsed };
      // Clear the hash so it doesn't persist on reload
      history.replaceState(null, '', window.location.pathname);
      toast('Song loaded from shared link!', 'success');
      return true;
    } catch (e) { console.error('Failed to load from URL:', e); return false; }
  }

  // ═══════════════════════════════════════════════════════
  // TABS / UI
  // ═══════════════════════════════════════════════════════
  function switchTab(tabId) {
    activeTab = tabId;
    el.editorPanel.classList.toggle('hidden', tabId !== 'edit');
    el.previewPanel.classList.toggle('hidden', tabId !== 'preview');
    el.tabEdit.classList.toggle('active', tabId === 'edit');
    el.tabPreview.classList.toggle('active', tabId === 'preview');
    if (tabId === 'preview') renderPreview();
    save();
  }

  function switchHomeTab(tab) {
    activeHomeTab = tab;
    el.homeTabSongs.classList.toggle('active', tab === 'songs');
    el.homeTabSetlists.classList.toggle('active', tab === 'setlists');
    el.songsView.classList.toggle('hidden', tab !== 'songs');
    el.setlistsView.classList.toggle('hidden', tab !== 'setlists');
  }

  function toggleSidebar() {
    sidebarOpen = !sidebarOpen;
    if (window.innerWidth <= 768) {
      el.sidebar.classList.toggle('open', sidebarOpen);
      el.sidebarOverlay.classList.toggle('active', sidebarOpen);
    } else {
      el.sidebar.classList.toggle('collapsed', !sidebarOpen);
    }
  }

  function closeSidebar() {
    if (window.innerWidth <= 768) {
      sidebarOpen = false;
      el.sidebar.classList.remove('open');
      el.sidebarOverlay.classList.remove('active');
    }
  }

  function newSheet() {
    currentSongId = null; 
    song = { title: '', artist: '', key: 'C', keyMode: 'major', tempo: 120, capo: 0, transposeAmount: 0, lines: [] };
    el.title.value = ''; el.artist.value = ''; el.key.value = 'C'; el.keyMode.value = 'major'; el.tempo.value = 120; el.capo.value = 0;
    selectedLines.clear();
    updateTransposeDisplay(); renderEditor(); 
    showScreen('editor');
    syncToCloud();
    toast('New sheet created', 'success');
  }

  // Check if song has meaningful content
  function hasContent() {
    if (song.title && song.title.trim()) return true;
    if (song.artist && song.artist.trim()) return true;
    if (song.lines && song.lines.length > 0) {
      // Check if any line is not empty
      return song.lines.some(l => l.type !== 'empty' || (l.text && l.text.trim()));
    }
    return false;
  }

  // ═══════════════════════════════════════════════════════
  // PERSISTENCE
  // ═══════════════════════════════════════════════════════
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ song, activeTab, sidebarOpen, currentSongId })); } catch (e) {}
    debouncedSync();
  }

  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (d) {
        song = { ...song, ...d.song };
        activeTab = d.activeTab || 'edit';
        sidebarOpen = d.sidebarOpen !== false;
        currentSongId = d.currentSongId || null;
      }
    } catch (e) {}
  }

  function restoreUi() {
    el.title.value = song.title || '';
    el.artist.value = song.artist || '';
    el.key.value = song.key || 'C';
    el.keyMode.value = song.keyMode || 'major';
    el.tempo.value = song.tempo || 120;
    el.capo.value = song.capo || 0;
    // Use toggleSidebar for initial state to handle mobile correctly
    if (sidebarOpen) {
      if (window.innerWidth > 768) el.sidebar.classList.remove('collapsed');
      else el.sidebar.classList.add('open'); // Should not happen on restore unless mobile was open
    } else {
      if (window.innerWidth > 768) el.sidebar.classList.add('collapsed');
      else el.sidebar.classList.remove('open');
    }
    updateTransposeDisplay();
    if (activeTab === 'preview') switchTab('preview');
  }

  // ═══════════════════════════════════════════════════════
  // ROUTING & CLOUD LOGIC
  // ═══════════════════════════════════════════════════════
  function showScreen(screen, pushState = true) {
    currentScreen = screen;
    el.homeScreen.classList.toggle('hidden', screen !== 'home');
    el.editorScreen.classList.toggle('hidden', screen !== 'editor');
    el.setlistScreen.classList.toggle('hidden', screen !== 'setlist');
    el.performanceScreen.classList.toggle('hidden', screen !== 'performance');

    // Footer: hide on performance, show elsewhere; save-status only in editor
    const footer = document.getElementById('app-footer');
    const saveStatus = document.getElementById('save-status');
    if (footer) footer.classList.toggle('hidden', screen === 'performance');
    if (saveStatus) saveStatus.classList.toggle('hidden', screen !== 'editor');
    
    if (screen === 'editor' || screen === 'setlist') {
      homeScrollPos = el.homeMain.scrollTop;
    } else if (screen === 'home') {
      setTimeout(() => { el.homeMain.scrollTop = homeScrollPos; }, 0);
    }

    if (pushState) {
      const path = screen === 'home' ? '' : '#editor';
      history.pushState({ screen }, '', window.location.pathname + path);
    }

    if (screen === 'home') {
      loadSongsFromCloud();
      loadSetlistsFromCloud();
      // Reset current context
      currentSongId = null; 
      currentSetlistId = null;
      song = { title: '', artist: '', key: 'C', keyMode: 'major', tempo: 120, capo: 0, transposeAmount: 0, lines: [] };
    }
  }

  // Handle browser back/forward
  window.addEventListener('popstate', (e) => {
    const screen = (e.state && e.state.screen) ? e.state.screen : 'home';
    showScreen(screen, false);
  });

  async function loadSongsFromCloud() {
    if (!db) return;
    // Switch to onSnapshot for real-time sync
    db.collection('songs').orderBy('updatedAt', 'desc').onSnapshot(snapshot => {
      allSongs = [];
      snapshot.forEach(doc => allSongs.push({ id: doc.id, ...doc.data() }));
      renderSongGrid(allSongs);
    }, err => console.error("Songs sync error:", err));
  }

  async function loadSetlistsFromCloud() {
    if (!db) return;
    db.collection('setlists').orderBy('updatedAt', 'desc').onSnapshot(snapshot => {
      allSetlists = [];
      snapshot.forEach(doc => allSetlists.push({ id: doc.id, ...doc.data() }));
      renderSetlistGrid(allSetlists);
    }, err => console.error("Setlists sync error:", err));
  }

  function renderSongGrid(songs) {
    el.songGrid.innerHTML = '';
    el.songGrid.appendChild(el.cardCreate);

    const query = (el.homeSearch && el.homeSearch.value || '').toLowerCase().trim();
    const validSongs = songs.filter(s => {
      if (query) {
        const matches = (s.title && s.title.toLowerCase().includes(query)) || 
                        (s.artist && s.artist.toLowerCase().includes(query));
        if (!matches) return false;
      }
      // Safety check: only render if has some content
      return (s.title && s.title.trim()) || (s.artist && s.artist.trim());
    });

    validSongs.forEach(s => {
      const card = document.createElement('div');
      card.className = 'song-card';
      const dateStr = s.updatedAt ? new Date(s.updatedAt.seconds * 1000).toLocaleDateString() : 'Recently';
      card.innerHTML = `<h3>${esc(s.title || 'Untitled')}</h3><p>${esc(s.artist || 'Unknown Artist')}</p>
        <div class="card-meta"><span>${esc(s.key)} ${s.keyMode === 'minor' ? 'm' : ''}</span><span>${dateStr}</span></div>`;
      card.onclick = () => loadSong(s.id, s);
      el.songGrid.appendChild(card);
    });
  }

  function renderSetlistGrid(setlists) {
    el.setlistGrid.innerHTML = '';
    el.setlistGrid.appendChild(el.cardCreateSetlist);

    setlists.forEach(sl => {
      const card = document.createElement('div');
      card.className = 'song-card';
      // Only count "real songs" in setlists (exclude setlist notes).
      // Notes can be stored inconsistently across versions, so detect them by shape too.
      // isSetlistNote is now a global helper

      const songCount = (sl.songs || []).reduce((acc, item) => {
        if (!item) return acc;
        if (isSetlistNote(item)) return acc;
        if (!item.id) return acc; // no song id => not a real song

        // If songs are loaded, only count ids we actually have.
        if (Array.isArray(allSongs) && allSongs.length > 0) {
          return acc + (allSongs.some(s => s.id === item.id) ? 1 : 0);
        }
        return acc + 1;
      }, 0);
      card.innerHTML = `<h3>${esc(sl.title || 'Setlist')}</h3><p>${songCount} song${songCount !== 1 ? 's' : ''}</p>
        <div class="card-meta"><span>Setlist</span><span>Recently</span></div>`;
      card.onclick = () => loadSetlist(sl.id, sl);
      el.setlistGrid.appendChild(card);
    });
  }

  function createNewSetlist() {
    el.modalCreateSetlist.classList.add('open');
    el.inputSetlistName.value = '';
    el.inputSetlistName.focus();
  }

  async function confirmCreateSetlist() {
    const title = el.inputSetlistName.value.trim();
    if (!title) return toast('Please enter a name', 'error');
    
    try {
      el.modalCreateSetlist.classList.remove('open');
      const res = await db.collection('setlists').add({
        title,
        songs: [],
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      toast('Setlist created', 'success');
      loadSetlist(res.id, { title, songs: [] });
    } catch (err) {
      console.error(err);
      toast('Failed to create setlist', 'error');
    }
  }

  async function loadSetlist(id, data) {
    currentSetlistId = id;
    currentSetlist = data;
    el.setlistTitleDisplay.textContent = data.title;
    renderSetlistSongs();
    showScreen('setlist');
    
    // Subscribe to real-time updates for THIS setlist
    if (window.setlistUnsub) window.setlistUnsub();
    window.setlistUnsub = db.collection('setlists').doc(id).onSnapshot(doc => {
      if (doc.exists && !isDragging) {
        currentSetlist = doc.data();
        renderSetlistSongs();
        if (currentScreen === 'performance') renderPerformanceSong();
      }
    });
  }

  function renderSetlistSongs() {
    el.setlistSongList.innerHTML = '';
    if (!currentSetlist || !currentSetlist.songs || currentSetlist.songs.length === 0) {
      el.setlistSongList.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No songs in this setlist yet.</div>';
      return;
    }

    currentSetlist.songs.forEach((sls, i) => {
      const item = document.createElement('div');
      item.className = 'setlist-item' + (sls.played ? ' played' : '');
      item.dataset.idx = i;
      item.onclick = (e) => {
        if (e.target.closest('.setlist-item-checkbox') || e.target.closest('.setlist-item-menu-trigger') || e.target.closest('.setlist-item-actions-popup')) return;
        startPerformance(i);
      };

      const isNote = sls.type === 'note';
      const canEditNote = isNote && (sls.editable !== false && sls.canEdit !== false && sls.locked !== true && sls.readonly !== true);

      if (isNote) {
        item.classList.add('note');
        item.innerHTML = `
          <div class="setlist-item-grip">⋮⋮</div>
          <div class="setlist-item-info">
            <span class="setlist-item-title">${esc(sls.text || 'Note')}</span>
          </div>
          <button class="setlist-item-menu-trigger" data-setlist-idx="${i}" aria-label="Open menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
          </button>
          <div class="setlist-item-actions-popup" id="item-menu-${i}">
            ${canEditNote ? `
              <button class="btn-edit-note" data-setlist-idx="${i}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                Edit Note
              </button>
            ` : ''}
            <button class="btn-delete" data-setlist-idx="${i}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              Remove
            </button>
          </div>
        `;
      } else {
        const songData = allSongs.find(s => s.id === sls.id);
        if (!songData) return;
        item.innerHTML = `
          <div class="setlist-item-grip">⋮⋮</div>
          <div class="setlist-item-checkbox ${sls.played ? 'checked' : ''}">
            ${sls.played ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
          </div>
          <div class="setlist-item-info">
            <span class="setlist-item-title">${esc(songData.title || 'Untitled')}</span>
            <span class="setlist-item-subtitle">${esc(songData.artist || 'Unknown')}</span>
          </div>
          <div class="setlist-item-meta">${songData.key || '--'}${songData.keyMode === 'minor' ? 'm' : ''}</div>
          <button class="setlist-item-menu-trigger" data-setlist-idx="${i}" aria-label="Open menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
          </button>
          <div class="setlist-item-actions-popup" id="item-menu-${i}">
            <button class="btn-delete" data-setlist-idx="${i}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              Remove
            </button>
          </div>
        `;
        
        const cb = item.querySelector('.setlist-item-checkbox');
        if (cb) {
          cb.onclick = (e) => {
            e.stopPropagation();
            toggleSongPlayed(i);
          };
        }
      }

      // Improved Drag and Drop
      item.draggable = true;
      item.addEventListener('dragstart', (e) => {
        isDragging = true;
        dragIdx = i;
        e.dataTransfer.effectAllowed = 'move';
        item.classList.add('dragging');
        // Hide popup menus during drag
        document.querySelectorAll('.setlist-item-actions-popup').forEach(m => m.classList.remove('open'));
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        const draggingItem = $('.setlist-item.dragging');
        if (!draggingItem) return;

        // Auto-scroll logic
        const container = el.setlistSongList;
        const rect = container.getBoundingClientRect();
        const threshold = 60;
        const scrollSpeed = 15;

        if (e.clientY < rect.top + threshold) {
          if (!autoScrollInterval) autoScrollInterval = setInterval(() => { container.scrollTop -= scrollSpeed; }, 20);
        } else if (e.clientY > rect.bottom - threshold) {
          if (!autoScrollInterval) autoScrollInterval = setInterval(() => { container.scrollTop += scrollSpeed; }, 20);
        } else {
          clearInterval(autoScrollInterval);
          autoScrollInterval = null;
        }

        // Real-time Preview: Element Swapping
        const target = e.target.closest('.setlist-item');
        if (target && target !== draggingItem) {
          const targetRect = target.getBoundingClientRect();
          const midpoint = targetRect.top + targetRect.height / 2;
          if (e.clientY < midpoint) {
            container.insertBefore(draggingItem, target);
          } else {
            container.insertBefore(draggingItem, target.nextSibling);
          }
        }
      });

      item.addEventListener('dragend', () => {
        isDragging = false;
        clearInterval(autoScrollInterval);
        autoScrollInterval = null;
        item.classList.remove('dragging');
        // Sync final order
        const newOrder = Array.from(el.setlistSongList.children)
          .map(child => {
            const idx = parseInt(child.dataset.idx);
            return currentSetlist.songs[idx];
          })
          .filter(s => s); // remove undefined if any
        
        currentSetlist.songs = newOrder;
        syncSetlist();
        renderSetlistSongs(); // Refresh indices
      });

      el.setlistSongList.appendChild(item);
    });
  }

  async function toggleSongPlayed(idx) {
    if (!currentSetlist.songs[idx]) return;
    currentSetlist.songs[idx].played = !currentSetlist.songs[idx].played;
    await syncSetlist();
  }

  function toggleItemMenu(idx) {
    const menuId = `item-menu-${idx}`;
    const allMenus = document.querySelectorAll('.setlist-item-actions-popup');
    
    allMenus.forEach(m => {
      if (m.id !== menuId) m.classList.remove('open');
    });

    const menu = document.getElementById(menuId);
    if (menu) {
      menu.classList.toggle('open');
    }
  }

  // Close menus on click outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.setlist-item-menu-trigger') && !e.target.closest('.setlist-item-actions-popup')) {
      document.querySelectorAll('.setlist-item-actions-popup').forEach(m => m.classList.remove('open'));
    }
  });

  async function removeSongFromSetlist(idx) {
    if (!confirm('Remove song from setlist?')) return;
    currentSetlist.songs.splice(idx, 1);
    await syncSetlist();
    document.querySelectorAll('.setlist-item-actions-popup').forEach(m => m.classList.remove('open'));
  }

  async function syncSetlist() {
    if (!db || !currentSetlistId) return;
    await db.collection('setlists').doc(currentSetlistId).update({
      songs: currentSetlist.songs,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  async function deleteSetlist() {
    if (!currentSetlistId) return;
    if (!confirm(`Are you sure you want to delete the setlist "${currentSetlist.title}"?`)) return;
    try {
      await db.collection('setlists').doc(currentSetlistId).delete();
      toast('Setlist deleted', 'info');
      showScreen('home');
    } catch (e) { toast('Error deleting setlist', 'error'); }
  }

  function openAddSongModal() {
    el.addSongModal.classList.add('open');
    el.addSongSearch.value = '';
    selectedSongIds.clear();
    renderAddSongResults('');
    el.addSongSearch.focus();
  }

  let editingNoteIdx = -1;
  function openAddNoteModal() {
    editingNoteIdx = -1;
    el.modalAddNote.classList.add('open');
    el.modalAddNote.querySelector('h2').textContent = 'Add Note to Setlist';
    el.btnConfirmAddNote.textContent = 'Add Note';
    el.inputSetlistNote.value = '';
    el.inputSetlistNote.focus();
  }

  function editSetlistNote(idx) {
    const sls = currentSetlist.songs[idx];
    if (!sls || sls.type !== 'note') return;

    const canEditNote = sls.editable !== false && sls.canEdit !== false && sls.locked !== true && sls.readonly !== true;
    if (!canEditNote) {
      toast('This note cannot be edited', 'warning');
      return;
    }

    editingNoteIdx = idx;
    el.modalAddNote.classList.add('open');
    el.modalAddNote.querySelector('h2').textContent = 'Edit Note';
    el.btnConfirmAddNote.textContent = 'Save Changes';
    el.inputSetlistNote.value = sls.text || '';
    el.inputSetlistNote.focus();
    // Close the 3-dots menu
    document.querySelectorAll('.setlist-item-actions-popup').forEach(m => m.classList.remove('open'));
  }

  function confirmAddNote() {
    const text = el.inputSetlistNote.value.trim();
    if (!text) return toast('Please enter note text', 'error');
    
    if (editingNoteIdx !== -1) {
      currentSetlist.songs[editingNoteIdx].text = text;
      toast('Note updated', 'success');
    } else {
      currentSetlist.songs.push({ type: 'note', text, played: false });
    }
    
    syncSetlist();
    el.modalAddNote.classList.remove('open');
  }

  function renderAddSongResults(query) {
    el.addSongResults.innerHTML = '';
    const filtered = allSongs.filter(s => 
      !currentSetlist.songs.some(sls => sls.id === s.id) &&
      ((s.title || '').toLowerCase().includes(query.toLowerCase()) || 
       (s.artist || '').toLowerCase().includes(query.toLowerCase()))
    );

    if (filtered.length === 0) {
      el.addSongResults.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)">No songs found</div>';
      return;
    }

    filtered.forEach(s => {
      const isSelected = selectedSongIds.has(s.id);
      const res = document.createElement('div');
      res.className = `modal-song-result ${isSelected ? 'selected' : ''}`;
      res.innerHTML = `
        <div class="result-check"></div>
        <div class="result-info">
          <strong>${esc(s.title || 'Untitled')}</strong>
          <div style="font-size:0.8rem;color:var(--text-muted)">${esc(s.artist || 'Unknown')}</div>
        </div>`;
      res.onclick = () => {
        if (selectedSongIds.has(s.id)) selectedSongIds.delete(s.id);
        else selectedSongIds.add(s.id);
        renderAddSongResults(el.addSongSearch.value);
      };
      el.addSongResults.appendChild(res);
    });
  }

  function addSelectedToSetlist() {
    if (selectedSongIds.size === 0) return toast('Select at least one song', 'warning');
    
    selectedSongIds.forEach(id => {
      currentSetlist.songs.push({ id, played: false, transpose: 0 });
    });
    
    syncSetlist();
    el.addSongModal.classList.remove('open');
    toast(`Added ${selectedSongIds.size} songs`, 'success');
  }

  async function loadSong(id, data) {
    currentSongId = id;
    song = data;
    restoreUi();
    renderEditor();
    showScreen('editor');

    // Subscribe to real-time updates for THIS song (other-device changes only)
    if (window.songUnsub) window.songUnsub();
    if (db && id) {
      window.songUnsub = db.collection('songs').doc(id).onSnapshot(doc => {
        // Skip snapshots triggered by our own writes (Firestore echoes them back).
        // We allow remote changes through only after 5s of local write silence.
        if (Date.now() - lastSyncedAt < 5000) return;
        if (!doc.exists) return;
        const newData = doc.data();
        const changed =
          JSON.stringify(newData.lines) !== JSON.stringify(song.lines) ||
          (newData.transposeAmount ?? 0) !== (song.transposeAmount ?? 0) ||
          newData.title !== song.title ||
          newData.artist !== song.artist;
        if (changed) {
          song = { id: doc.id, ...newData };
          restoreUi();
          renderEditor();
          if (activeTab === 'preview') renderPreview();
        }
      }, err => console.error("Song sync error:", err));
    }
  }

  let lastSyncedAt = 0; // timestamp of our last successful cloud write

  async function syncToCloud() {
    if (!db) return; // localStorage already saved in save() — no need to call save() here
    if (!hasContent()) {
      el.saveStatus.textContent = 'Local Draft';
      return; // do NOT call save() — that re-schedules debouncedSync → infinite loop
    }

    el.saveStatus.textContent = 'Syncing...';
    try {
      const payload = {
        ...song,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      if (currentSongId) {
        await db.collection('songs').doc(currentSongId).set(payload, { merge: true });
      } else {
        const existing = await db.collection('songs')
          .where('title', '==', song.title)
          .where('artist', '==', song.artist)
          .limit(1)
          .get();

        if (!existing.empty) {
          currentSongId = existing.docs[0].id;
          await db.collection('songs').doc(currentSongId).set(payload, { merge: true });
        } else {
          const docRef = await db.collection('songs').add(payload);
          currentSongId = docRef.id;
        }
        // Persist the resolved ID to localStorage (no cloud sync re-schedule)
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ song, activeTab, sidebarOpen, currentSongId })); } catch (_) {}
      }
      lastSyncedAt = Date.now();
      el.saveStatus.textContent = 'Saved to Cloud';
    } catch (e) {
      console.error("Sync error:", e);
      el.saveStatus.textContent = 'Local Only';
      // do NOT call save() here — that re-schedules debouncedSync → retry storm
    }
  }

  function debounce(fn, ms) {
    let timeout;
    return function() {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(this, arguments), ms);
    };
  }

  const debouncedSync = debounce(syncToCloud, 4000); // 4s — no need to hammer Firestore

  // ═══════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════
  function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  function toast(msg, type) {
    const t = document.createElement('div');
    t.className = `toast toast-${type || 'info'}`;
    const icon = type === 'success'
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00d4aa" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c5bf5" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    t.innerHTML = `${icon}<span>${msg}</span>`;
    el.toasts.appendChild(t);
    setTimeout(() => { t.classList.add('toast-exit'); setTimeout(() => t.remove(), 300); }, 2800);
  }

  // ═══════════════════════════════════════════════════════
  // DEMO DATA
  // ═══════════════════════════════════════════════════════
  function loadDemo() {
    const demoText = `[Verse 1]
[G]Amazing [G/B]grace how [C]sweet the [G]sound
[G]That saved a [Em]wretch like [D]me
[G]I once was [G/B]lost but [C]now I'm [G]found
Was [Em]blind but [D]now I [G]see

[Verse 2]
[G]'Twas grace that [G/B]taught my [C]heart to [G]fear
And [G]grace my [Em]fears re[D]lieved
[G]How precious [G/B]did that [C]grace ap[G]pear
The [Em]hour I [D]first be[G]lieved`;

    const lines = demoText.split('\n');
    song.lines = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) { song.lines.push({ type: 'empty', text: '', chords: [] }); continue; }
      if (isSectionLine(trimmed)) {
        const m = trimmed.match(/^\[([^\]]+)\]$/);
        song.lines.push({ type: 'section', text: m ? m[1] : trimmed, chords: [] });
        continue;
      }
      if (/\[[^\]]+\]/.test(trimmed)) {
        const parsed = parseBracketLine(trimmed);
        song.lines.push({ type: 'lyric', text: parsed.text, chords: parsed.chords });
        continue;
      }
      song.lines.push({ type: 'lyric', text: line, chords: [] });
    }
    song.title = 'Amazing Grace';
    song.artist = 'John Newton';
    song.key = 'G';
    song.tempo = 72;
    el.title.value = song.title;
    el.artist.value = song.artist;
    el.key.value = song.key;
    el.tempo.value = song.tempo;
    el.toggleSharps.checked = !!song.preferSharps;
    save();
  }


  // ═══════════════════════════════════════════════════════
  // PERFORMANCE VIEW & SWIPE
  // ═══════════════════════════════════════════════════════
  function startPerformance(idx) {
    perfSongIdx = idx;
    showScreen('performance');
    renderPerformanceSong();
  }

  function renderPerformanceSong() {
    const sls = currentSetlist.songs[perfSongIdx];
    if (!sls) return;
    
    const songsOnly = currentSetlist.songs.filter(s => !isSetlistNote(s));
    const totalSongs = songsOnly.length;
    const isNote = isSetlistNote(sls);

    if (isNote) {
      el.perfProgress.textContent = 'Setlist Note';
    } else {
      const songNum = currentSetlist.songs.slice(0, perfSongIdx + 1).filter(s => !isSetlistNote(s)).length;
      el.perfProgress.textContent = `${songNum} / ${totalSongs}`;
    }

    if (sls.type === 'note') {
      el.perfSongTitle.textContent = sls.text || 'Note';
      el.perfSongArtist.textContent = 'Setlist Note';
      el.perfPlayedToggle.checked = !!sls.played;
      el.perfContent.innerHTML = `
        <div style="height: 100%; display: flex; align-items: center; justify-content: center; text-align: center; padding: 40px;">
          <h1 style="font-size: 3rem; color: var(--accent-primary); font-weight: 800; line-height: 1.2;">
            ${esc(sls.text)}
          </h1>
        </div>
      `;
      return;
    }

    const songData = allSongs.find(s => s.id === sls.id);
    if (!songData) return;

    el.perfSongTitle.textContent = songData.title || 'Untitled';
    el.perfSongArtist.textContent = songData.artist || 'Unknown';
    el.perfTransposeVal.textContent = sls.transpose > 0 ? `+${sls.transpose}` : sls.transpose;
    if (el.perfTempoVal) el.perfTempoVal.textContent = songData.tempo || 120;
    
    // Reset auto-scroll on song load
    stopAutoScroll("song load");
    if (el.perfScrollToggle) {
      el.perfScrollToggle.classList.remove('active');
      el.perfScrollToggle.querySelector('span').textContent = 'Scroll';
    }

    // Sync Played Toggle
    if (el.perfPlayedToggle) {
      el.perfPlayedToggle.checked = !!sls.played;
    }
    
    // Apply setlist transpose to the song content for preview
    const tempSong = JSON.parse(JSON.stringify(songData));
    const semitones = sls.transpose || 0;
    if (semitones !== 0) {
      const flat = useFlats(tempSong.key);
      for (const line of tempSong.lines) {
        if (line.chords) line.chords.forEach(c => { c.name = transposeChord(c.name, semitones, flat); });
      }
      tempSong.key = transposeNote(tempSong.key, semitones, flat);
    }
    
    // Render the preview using existing renderPreview logic but redirect to perfContent
    const oldPreviewContent = el.previewContent;
    el.previewContent = el.perfContent;
    const oldSong = song;
    song = tempSong;
    renderPreview();
    // Reset
    el.previewContent = oldPreviewContent;
    song = oldSong;
  }

  async function adjustPerfTranspose(amt) {
    const sls = currentSetlist.songs[perfSongIdx];
    sls.transpose = (sls.transpose || 0) + amt;
    await syncSetlist();
  }

  function nextPerfSong() {
    if (perfSongIdx < currentSetlist.songs.length - 1) {
      perfSongIdx++;
      renderPerformanceSong();
    }
  }

  function prevPerfSong() {
    if (perfSongIdx > 0) {
      perfSongIdx--;
      renderPerformanceSong();
    }
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(e => {
        console.warn(`Error attempting to enable fullscreen: ${e.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }

  // Swipe handling
  let touchStartX = 0;
  function handleTouchStart(e) { touchStartX = e.changedTouches[0].screenX; }
  function handleTouchEnd(e) {
    const touchEndX = e.changedTouches[0].screenX;
    const diff = touchStartX - touchEndX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) nextPerfSong();
      else prevPerfSong();
    }
  }

  // Auto-scroll logic for Performance Mode
  let perfScrollActive = false;
  let perfScrollTimer = null;
  let lastPerfScrollTime = 0;

  function toggleAutoScroll() {
    perfScrollActive = !perfScrollActive;
    if (perfScrollActive) {
      el.perfScrollToggle.classList.add('active');
      el.perfScrollToggle.querySelector('span').textContent = 'Stop';
      startAutoScroll();
    } else {
      el.perfScrollToggle.classList.remove('active');
      el.perfScrollToggle.querySelector('span').textContent = 'Scroll';
      stopAutoScroll();
    }
  }

  function startAutoScroll() {
    lastPerfScrollTime = performance.now();
    
    // Sync fractional scroll with current position to handle manual scrolls
    let scrollTarget = el.perfMain;
    if (el.perfContent && el.perfContent.scrollHeight > el.perfContent.clientHeight) {
      scrollTarget = el.perfContent;
    }
    if (scrollTarget) {
      scrollTarget._fractionalScroll = scrollTarget.scrollTop;
    }

    if (perfScrollTimer) clearInterval(perfScrollTimer);
    perfScrollTimer = setInterval(autoScrollStep, 30);
  }

  function stopAutoScroll(reason = "manual") {
    perfScrollActive = false;
    if (perfScrollTimer) {
      clearInterval(perfScrollTimer);
      perfScrollTimer = null;
    }
  }

  function autoScrollStep() {
    if (!perfScrollActive) return;
    
    const now = performance.now();
    const delta = now - lastPerfScrollTime;
    lastPerfScrollTime = now;

    // Gradual speed with small precision
    const speedVal = el.perfScrollSpeed ? parseFloat(el.perfScrollSpeed.value) : 50;
    const speedFactor = speedVal / 50; 
    const pixelsPerMs = 0.08 * speedFactor; // Balanced speed
    
    // Dynamically find the scrollable container
    let scrollTarget = el.perfMain;
    if (el.perfContent && el.perfContent.scrollHeight > el.perfContent.clientHeight) {
      scrollTarget = el.perfContent;
    }
    
    if (scrollTarget) {
      const deltaScroll = pixelsPerMs * delta;
      
      // Use a hidden property to track fractional scroll to avoid rounding issues
      if (scrollTarget._fractionalScroll === undefined) scrollTarget._fractionalScroll = scrollTarget.scrollTop;
      scrollTarget._fractionalScroll += deltaScroll;
      
      const newScrollTop = Math.floor(scrollTarget._fractionalScroll);
      if (newScrollTop !== scrollTarget.scrollTop) {
        scrollTarget.scrollTop = newScrollTop;
      }
      
      // Stop if reached bottom
      if (scrollTarget.scrollTop + scrollTarget.clientHeight >= scrollTarget.scrollHeight - 10) {
        stopAutoScroll("reached bottom");
        el.perfScrollToggle.classList.remove('active');
        el.perfScrollToggle.querySelector('span').textContent = 'Scroll';
      }
    } else {
      stopAutoScroll("no target");
    }
  }

  async function adjustPerfTempo(amt) {
    // This updates the ACTUAL song tempo globally
    const sls = currentSetlist.songs[perfSongIdx];
    if (!sls || isSetlistNote(sls)) return;
    
    const songData = allSongs.find(s => s.id === sls.id);
    if (!songData) return;

    songData.tempo = Math.max(20, Math.min(300, (songData.tempo || 120) + amt));
    if (el.perfTempoVal) el.perfTempoVal.textContent = songData.tempo;
    
    // Sync to cloud
    try {
      await db.collection('songs').doc(sls.id).update({
        tempo: songData.tempo,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) {
      console.error("Error updating tempo in perf mode:", e);
    }
  }

  // ═══════════════════════════════════════════════════════
  // NAADAN CHORDS IMPORT
  // ═══════════════════════════════════════════════════════
  const NAADAN_API = 'https://api.naadanchords.com/posts';
  let naadanSearchTimeout = null;

  function openNaadanModal() {
    el.naadanModal.classList.add('open');
    el.naadanSearch.value = '';
    el.naadanResults.innerHTML = `<div class="naadan-placeholder">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <span>Search for a song to import</span>
    </div>`;
    requestAnimationFrame(() => el.naadanSearch.focus());
  }

  function closeNaadanModal() {
    el.naadanModal.classList.remove('open');
    clearTimeout(naadanSearchTimeout);
  }

  function isChordToken(t) {
    return /^[A-G][#b]?(m(aj(7|9|11|13)?)?|min|dim[57]?|aug|sus[24]?|add(2|4|9|11|13)?|M)?(\d+)?(\/[A-G][#b]?)?$/.test(t);
  }

  function isChordLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return false;
    const tokens = trimmed.split(/\s+/);
    return tokens.length > 0 && tokens.every(t => isChordToken(t));
  }

  function parseNaadanContent(content) {
    const clean = content
      .replace(/\{start_heading\}.*?\{end_heading\}/gs, '')
      .replace(/\{start_italic\}/g, '').replace(/\{end_italic\}/g, '')
      .replace(/\{start_strumming\}.*?\{end_strumming\}/gs, '')
      .replace(/\{[^}]+\}/g, '');

    const rawLines = clean.split('\n');
    const lines = [];
    let i = 0;

    while (i < rawLines.length) {
      const line = rawLines[i];
      if (!line.trim()) { i++; continue; }

      if (isChordLine(line)) {
        const next = rawLines[i + 1];
        const hasLyric = next !== undefined && next.trim() !== '' && !isChordLine(next);
        const lyricText = hasLyric ? next.trim() : '';

        // Extract chord positions from the chord line (character indices)
        const chords = [];
        const re = /(\S+)/g;
        let m;
        while ((m = re.exec(line)) !== null) {
          if (isChordToken(m[1])) chords.push({ name: m[1], pos: m.index });
        }
        lines.push({ type: 'lyric', text: lyricText, chords });
        i += hasLyric ? 2 : 1;
      } else {
        lines.push({ type: 'lyric', text: line.trim(), chords: [] });
        i++;
      }
    }

    return lines;
  }

  function renderNaadanResults(items) {
    if (!items || items.length === 0) {
      el.naadanResults.innerHTML = `<div class="naadan-empty">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <span>No songs found</span>
      </div>`;
      return;
    }

    const langClass = { MALAYALAM: '', TAMIL: 'lang-tamil', HINDI: 'lang-hindi', TELUGU: 'lang-telugu' };
    el.naadanResults.innerHTML = items.map(item => {
      const songName = item.song || item.title.split('  -  ')[0].trim();
      const album = item.album || '';
      const lang = item.category || '';
      const lc = langClass[lang] || '';
      const artistMeta = item.singers ? esc(item.singers) : '';
      return `<div class="naadan-result-item" data-id="${esc(item.postId)}" data-title="${esc(songName)}">
        <div class="naadan-result-info">
          <span class="naadan-result-title">${esc(songName)}</span>
          <div class="naadan-result-meta">
            ${lang ? `<span class="naadan-badge ${lc}">${esc(lang)}</span>` : ''}
            ${album ? `<span>${esc(album)}</span>` : ''}
            ${artistMeta ? `<span>· ${artistMeta}</span>` : ''}
          </div>
        </div>
        <svg class="naadan-import-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
      </div>`;
    }).join('');

    el.naadanResults.querySelectorAll('.naadan-result-item').forEach(row => {
      row.addEventListener('click', () => importNaadanSong(row.dataset.id, row.dataset.title));
    });
  }

  async function searchNaadan(query) {
    query = query.trim();
    if (!query) {
      el.naadanResults.innerHTML = `<div class="naadan-placeholder">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <span>Search for a song to import</span>
      </div>`;
      return;
    }

    el.naadanResults.innerHTML = `<div class="naadan-loading">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
      <span>Searching…</span>
    </div>`;

    try {
      const resp = await fetch(`${NAADAN_API}?search=${encodeURIComponent(query)}`);
      if (!resp.ok) throw new Error(resp.statusText);
      const data = await resp.json();
      renderNaadanResults(data.Items || []);
    } catch (e) {
      el.naadanResults.innerHTML = `<div class="naadan-empty"><span>Search failed — check your connection</span></div>`;
    }
  }

  async function importNaadanSong(postId, titleHint) {
    closeNaadanModal();
    toast('Importing song…', 'info');

    try {
      const resp = await fetch(`${NAADAN_API}/${postId}`);
      if (!resp.ok) throw new Error(resp.statusText);
      const post = await resp.json();

      const title = post.song || (post.title || '').split('  -  ')[0].trim() || titleHint;
      const lines = parseNaadanContent(post.content || '');

      currentSongId = null;
      song = {
        title,
        artist: post.singers || '',
        key: post.scale || 'C',
        keyMode: 'major',
        tempo: parseInt(post.tempo) || 120,
        capo: parseInt(post.capo) || 0,
        transposeAmount: 0,
        preferSharps: false,
        lines
      };

      if (el.title) el.title.value = song.title;
      if (el.artist) el.artist.value = song.artist;
      if (el.key) el.key.value = song.key;
      if (el.keyMode) el.keyMode.value = song.keyMode;
      if (el.tempo) el.tempo.value = song.tempo;
      if (el.capo) el.capo.value = song.capo;
      selectedLines.clear();
      updateTransposeDisplay();
      renderEditor();
      showScreen('editor');
      save();
      syncToCloud();
      toast(`"${title}" imported!`, 'success');
    } catch (e) {
      console.error('Naadan import failed', e);
      toast('Import failed — please try again', 'error');
    }
  }

  function bindEvents() {
    // Editor clicks (delegated)
    el.editorContent.addEventListener('click', e => {
      onGripClick(e);
      onChordLaneClick(e);
      onDeleteLine(e);
      onLyricClick(e);
      onSectionClick(e);
    });

    // Drag and drop
    el.editorContent.addEventListener('dragstart', onDragStart);
    el.editorContent.addEventListener('dragover', onDragOver);
    el.editorContent.addEventListener('drop', onDrop);
    el.editorContent.addEventListener('dragend', onDragEnd);
    el.editorContent.addEventListener('dragleave', e => {
      const line = e.target.closest('.editor-line');
      if (line) line.classList.remove('drag-over-top', 'drag-over-bottom');
    });

    // Selection bar actions
    safeBind('#btn-sel-up', 'click', moveSelectedUp);
    safeBind('#btn-sel-down', 'click', moveSelectedDown);
    safeBind('#btn-sel-dup', 'click', duplicateSelected);
    safeBind('#btn-sel-del', 'click', deleteSelected);
    safeBind('#btn-sel-clear', 'click', clearSelection);

    // Chord popup
    el.chordInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); commitChordPopup(); }
      if (e.key === 'Escape') hideChordPopup();
    });
    el.chordInput.addEventListener('blur', () => setTimeout(hideChordPopup, 150));

    // Sidebar inputs
    el.title.addEventListener('input', () => { song.title = el.title.value; save(); });
    el.artist.addEventListener('input', () => { song.artist = el.artist.value; save(); });
    el.key.addEventListener('change', () => { song.key = el.key.value; save(); });
    el.keyMode.addEventListener('change', () => { song.keyMode = el.keyMode.value; save(); });
    el.tempo.addEventListener('input', () => { song.tempo = parseInt(el.tempo.value) || 120; save(); });
    el.capo.addEventListener('change', () => { song.capo = parseInt(el.capo.value) || 0; save(); });
    el.toggleSharps.addEventListener('change', () => {
      song.preferSharps = el.toggleSharps.checked;
      transposeAll(0); // Re-render names
      save();
      toast(song.preferSharps ? 'Preferring Sharps' : 'Standard Note Names', 'info');
    });

    // Tabs
    el.tabEdit.addEventListener('click', () => switchTab('edit'));
    el.tabPreview.addEventListener('click', () => switchTab('preview'));

    // Sidebar toggle (Consolidated)
    el.btnToggleSidebar.addEventListener('click', toggleSidebar);
    el.btnSidebarClose.addEventListener('click', closeSidebar);
    if (el.sidebarOverlay) el.sidebarOverlay.addEventListener('click', closeSidebar);

    // Transpose
    safeBind('#btn-transpose-up', 'click', () => transposeAll(1));
    safeBind('#btn-transpose-down', 'click', () => transposeAll(-1));
    safeBind('#btn-transpose-reset', 'click', () => {
      if (song.transposeAmount) { transposeAll(-song.transposeAmount); song.transposeAmount = 0; updateTransposeDisplay(); save(); toast('Transpose reset', 'info'); }
    });

    // Export
    safeBind('#btn-export-pdf', 'click', exportPdf);

    // Share
    safeBind('#btn-share', 'click', shareSong);

    // New & Home
    safeBind('#btn-new', 'click', () => newSheet());
    el.btnBackHome.addEventListener('click', () => {
      showScreen('home');
    });
    el.cardCreate.addEventListener('click', () => newSheet());

    // Naadan Chords import
    if (el.cardNaadan) el.cardNaadan.addEventListener('click', () => openNaadanModal());
    if (el.naadanModal) {
      el.naadanModal.addEventListener('click', e => { if (e.target === el.naadanModal) closeNaadanModal(); });
      safeBind('#btn-naadan-close', 'click', closeNaadanModal);
      el.naadanSearch.addEventListener('input', e => {
        clearTimeout(naadanSearchTimeout);
        naadanSearchTimeout = setTimeout(() => searchNaadan(e.target.value), 350);
      });
      el.naadanSearch.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeNaadanModal();
      });
    }

    // Setlist Events
    el.homeTabSongs.addEventListener('click', () => switchHomeTab('songs'));
    el.homeTabSetlists.addEventListener('click', () => switchHomeTab('setlists'));
    safeBind('#card-create-setlist', 'click', createNewSetlist);
    safeBind('#btn-setlist-back', 'click', () => showScreen('home'));
    safeBind('#btn-add-to-setlist', 'click', openAddSongModal);
    safeBind('#btn-add-song', 'click', openAddSongModal);
    safeBind('#btn-delete-setlist', 'click', deleteSetlist);

    // Setlist item actions (avoid inline onclick; functions are inside this IIFE scope)
    if (el.setlistSongList) {
      el.setlistSongList.addEventListener('click', (e) => {
        const trigger = e.target.closest('.setlist-item-menu-trigger');
        if (trigger) {
          toggleItemMenu(parseInt(trigger.dataset.setlistIdx, 10));
          return;
        }

        const editBtn = e.target.closest('.btn-edit-note');
        if (editBtn) {
          editSetlistNote(parseInt(editBtn.dataset.setlistIdx, 10));
          return;
        }

        const deleteBtn = e.target.closest('.btn-delete');
        if (deleteBtn) {
          removeSongFromSetlist(parseInt(deleteBtn.dataset.setlistIdx, 10));
        }
      });
    }

    safeBind('#btn-add-song-close', 'click', () => el.addSongModal.classList.remove('open'));
    el.addSongSearch.addEventListener('input', () => renderAddSongResults(el.addSongSearch.value));
    
    safeBind('#btn-perf-close', 'click', () => showScreen('setlist'));
    safeBind('#btn-perf-next', 'click', nextPerfSong);
    safeBind('#btn-perf-prev', 'click', prevPerfSong);
    safeBind('#btn-perf-transpose-up', 'click', () => adjustPerfTranspose(1));
    safeBind('#btn-perf-transpose-down', 'click', () => adjustPerfTranspose(-1));
    safeBind('#btn-perf-tempo-up', 'click', () => adjustPerfTempo(1));
    safeBind('#btn-perf-tempo-down', 'click', () => adjustPerfTempo(-1));
    safeBind('#perf-scroll-toggle', 'click', toggleAutoScroll);
    safeBind('#btn-perf-fullscreen', 'click', toggleFullscreen);

    el.performanceScreen.addEventListener('touchstart', handleTouchStart, false);
    el.performanceScreen.addEventListener('touchend', handleTouchEnd, false);

    // Search
    safeBind('#btn-import', 'click', openImportModal);
    safeBind('#btn-import-close', 'click', closeImportModal);
    safeBind('#btn-import-cancel', 'click', closeImportModal);
    safeBind('#btn-import-confirm', 'click', importLyrics);
    el.importModal.addEventListener('click', e => { if (e.target === el.importModal) closeImportModal(); });

    // Line management
    safeBind('#btn-add-line', 'click', addLine);
    safeBind('#btn-add-section', 'click', addSection);

    // Search
    // Modal Events
    if (el.btnAddSongConfirm) el.btnAddSongConfirm.onclick = addSelectedToSetlist;
    if (el.btnAddSongCancel || el.btnAddSongClose) {
      const closeAdd = () => el.addSongModal.classList.remove('open');
      if (el.btnAddSongCancel) el.btnAddSongCancel.onclick = closeAdd;
      if (el.btnAddSongClose) el.btnAddSongClose.onclick = closeAdd;
    }
    if (el.btnSelectAllSongs) {
      el.btnSelectAllSongs.onclick = () => {
        allSongs.filter(s => !currentSetlist.songs.some(sls => sls.id === s.id)).forEach(s => selectedSongIds.add(s.id));
        renderAddSongResults(el.addSongSearch.value);
      };
    }
    if (el.btnDeselectAllSongs) {
      el.btnDeselectAllSongs.onclick = () => {
        selectedSongIds.clear();
        renderAddSongResults(el.addSongSearch.value);
      };
    }

    if (el.btnConfirmCreateSetlist) el.btnConfirmCreateSetlist.onclick = confirmCreateSetlist;
    if (el.btnCancelCreateSetlist || el.btnCloseCreateSetlist) {
      const closeCreate = () => el.modalCreateSetlist.classList.remove('open');
      if (el.btnCancelCreateSetlist) el.btnCancelCreateSetlist.onclick = closeCreate;
      if (el.btnCloseCreateSetlist) el.btnCloseCreateSetlist.onclick = closeCreate;
    }

    if (el.btnAddNote) el.btnAddNote.onclick = openAddNoteModal;
    if (el.btnConfirmAddNote) el.btnConfirmAddNote.onclick = confirmAddNote;
    if (el.btnCancelAddNote) el.btnCancelAddNote.onclick = () => el.modalAddNote.classList.remove('open');
    if (el.btnCloseAddNote) el.btnCloseAddNote.onclick = () => el.modalAddNote.classList.remove('open');

    if (el.perfPlayedToggle) {
      el.perfPlayedToggle.onchange = () => {
        const sls = currentSetlist.songs[perfSongIdx];
        if (sls) {
          sls.played = el.perfPlayedToggle.checked;
          syncSetlist();
        }
      };
    }

    // Performance controls are already bound above via safeBind

    // Swipe to Refresh
    let touchStartY = 0;
    let touchStartAtTop = false;
    const REFRESH_PULL_PX = 50;
    const TOP_Y_LIMIT_PX = 60; // allow swipes that start on header area

    if (el.homeMain && el.homeScreen) {
      el.homeScreen.addEventListener('touchstart', e => {
        if (!e.touches || !e.touches[0]) return;
        touchStartY = e.touches[0].clientY;
        touchStartAtTop = el.homeMain.scrollTop === 0 && touchStartY <= TOP_Y_LIMIT_PX;
        if (el.ptrIndicator) el.ptrIndicator.classList.remove('active');
      }, { passive: true });

      el.homeScreen.addEventListener('touchmove', e => {
        if (!touchStartAtTop) return;
        if (!e.touches || !e.touches[0]) return;

        const touchY = e.touches[0].clientY;
        const pull = touchY - touchStartY;
        if (el.homeMain.scrollTop === 0 && pull > REFRESH_PULL_PX) {
          if (el.ptrIndicator) el.ptrIndicator.classList.add('active');
          // prevent the native "bounce" once threshold is crossed
          e.preventDefault();
        }
      }, { passive: false });

      el.homeScreen.addEventListener('touchend', () => {
        const shouldRefresh = !!(el.ptrIndicator && el.ptrIndicator.classList.contains('active'));
        if (shouldRefresh) {
          if (el.ptrIndicator) el.ptrIndicator.classList.remove('active');
          toast('Refreshing...', 'info');
          window.location.reload();
        }
        touchStartAtTop = false;
      });
    }

    // Search logic with grid preservation
    let searchTimeout;
    if (el.homeSearch) {
      el.homeSearch.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          renderSongGrid(allSongs);
        }, 100);
      });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if (e.target.closest('.modal')) return;
      if (e.ctrlKey && e.key === 'ArrowUp') { e.preventDefault(); transposeAll(1); }
      if (e.ctrlKey && e.key === 'ArrowDown') { e.preventDefault(); transposeAll(-1); }
      if (e.ctrlKey && e.key === 'p') { e.preventDefault(); switchTab(activeTab === 'edit' ? 'preview' : 'edit'); }
      if (e.ctrlKey && e.key === 'e') { e.preventDefault(); exportPdf(); }
      // Enter adds a new line when in the editor with no text field focused
      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.shiftKey
          && currentScreen === 'editor' && activeTab === 'edit'
          && !['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) {
        e.preventDefault();
        addLine();
      }
      // Escape dismisses any open inline edit
      if (e.key === 'Escape' && currentScreen === 'editor') {
        const active = document.querySelector('.lyric-edit-input, .section-edit-input');
        if (active && active._cancelEdit) { e.preventDefault(); active._cancelEdit(); }
      }
    });

    // PWA Install
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (el.btnInstallHeader) el.btnInstallHeader.classList.remove('hidden');
    });

    if (el.btnInstallHeader) {
      el.btnInstallHeader.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          if (el.btnInstallHeader) el.btnInstallHeader.classList.add('hidden');
        }
        deferredPrompt = null;
      });
    }

    window.addEventListener('appinstalled', () => {
      if (el.btnInstallHeader) el.btnInstallHeader.classList.add('hidden');
      deferredPrompt = null;
      toast('DotWav Sheets installed!', 'success');
    });
  }

  // ═══════════════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════════════
  function init() {
    cacheDom();
    
    // 1. Try to load shared song from URL
    const fromUrl = loadFromUrl();
    if (fromUrl) {
      restoreUi();
      renderEditor();
      showScreen('editor');
      bindEvents();
      save(); // Save shared to cloud
      return;
    }

    // 2. Load basic settings & last edited song
    load();
    if (window.innerWidth <= 768) sidebarOpen = false; // Force closed on mobile
    restoreUi();
    
    // 3. Migrate local store to Cloud if first time
    if (!localStorage.getItem('dotwav-synced') && song.lines.length > 0) {
      syncToCloud().then(() => {
        localStorage.setItem('dotwav-synced', 'true');
        toast('Local song migrated to cloud!', 'success');
      });
    }

    // 4. Default to Home screen
    showScreen('home');
    bindEvents();
    switchHomeTab('songs');
    
    // 5. Final load from cloud (if active)
    if (db) loadSongsFromCloud();

    // 6. Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => {
          reg.onupdatefound = () => {
            const installingWorker = reg.installing;
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                toast('Update available! Refreshing...', 'info');
                setTimeout(() => location.reload(), 1500);
              }
            };
          };
        })
        .catch(err => console.error('Service Worker Registry Failed', err));
    }

  }

  async function triggerRefresh() {
    toast('Refreshing...', 'info');
    setTimeout(() => {
      location.reload();
    }, 800);
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
