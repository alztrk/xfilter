// Translations
const translations = {
  en: {
    title: 'XFilter',
    subtitle: 'Filter Verified Accounts',
    enableFilter: 'Enable Filter',
    hideCompletely: 'Hide completely instead of collapsing',
    sidebarSectionsLabel: 'Hide sidebar sections:',
    hidePremiumPromo: 'Hide Premium promo',
    hideLiveSection: 'Hide Live section',
    hideTrendsSection: 'Hide Trends section',
    hideWhoToFollowSection: 'Hide Who to follow section',
    hideGrokNav: 'Hide Grok navigation',
    hidePremiumNav: 'Hide Premium navigation',
    wordWholeMatch: 'Match whole word only',
    wordCaseSensitive: 'Case sensitive',
    performanceMode: 'Performance mode',
    siteNotice: 'This extension only works on x.com.',
    whitelistLabel: 'Whitelist (always show):',
    blacklistLabel: 'Blacklist (always hide):',
    wordFilterLabel: 'Hide tweets containing:',
    language: 'Language',
    auto: 'Auto',
    statsFiltered: 'Filtered:',
    statsToday: 'Today:',
    statsAccounts: 'Accounts:',
    statsResetIn: 'Reset in:',
    filteredUsers: 'Filtered accounts:',
    alwaysShow: 'Always show',
    alwaysHide: 'Always hide',
    undo: 'Undo',
    toastWhitelisted: 'Added to always show',
    toastBlacklisted: 'Added to always hide',
    clearFiltered: 'Clear list',
    footer: 'Settings saved automatically'
  },
  tr: {
    title: 'XFilter',
    subtitle: 'Onaylı Hesapları Filtrele',
    enableFilter: 'Filtreyi Etkinleştir',
    hideCompletely: 'Daraltmak yerine tamamen gizle',
    sidebarSectionsLabel: 'Sag panelde gizlenecek bolumler:',
    hidePremiumPromo: 'Premium promosyonunu gizle',
    hideLiveSection: 'Canli bolumunu gizle',
    hideTrendsSection: 'Gundem bolumunu gizle',
    hideWhoToFollowSection: 'Kimi takip etmeli bolumunu gizle',
    hideGrokNav: 'Grok menusuunu gizle',
    hidePremiumNav: 'Premium menusuunu gizle',
    wordWholeMatch: 'Sadece tam kelime eslesmesi',
    wordCaseSensitive: 'Buyuk-kucuk harf duyarli',
    performanceMode: 'Performans modu',
    siteNotice: 'Bu eklenti yalnizca x.com uzerinde calisir.',
    whitelistLabel: 'Beyaz liste (her zaman göster):',
    blacklistLabel: 'Kara liste (her zaman gizle):',
    wordFilterLabel: 'Bu kelimeleri içeren tweetleri gizle:',
    language: 'Dil',
    auto: 'Otomatik',
    statsFiltered: 'Filtrelenen:',
    statsToday: 'Bugun:',
    statsAccounts: 'Hesap:',
    statsResetIn: 'Sifirlanma:',
    filteredUsers: 'Filtrelenen hesaplar:',
    alwaysShow: 'Her zaman goster',
    alwaysHide: 'Her zaman gizle',
    undo: 'Geri al',
    toastWhitelisted: 'Her zaman goster listesine eklendi',
    toastBlacklisted: 'Her zaman gizle listesine eklendi',
    clearFiltered: 'Listeyi temizle',
    footer: 'Ayarlar otomatik kaydedilir'
  }
};

// Detect browser language
function detectLanguage() {
  const lang = navigator.language.split('-')[0];
  return translations[lang] ? lang : 'en';
}

// DOM Elements
const enableFilterToggle = document.getElementById('enableFilter');
const hideCompletelyToggle = document.getElementById('hideCompletely');
const hidePremiumPromoToggle = document.getElementById('hidePremiumPromo');
const hideLiveSectionToggle = document.getElementById('hideLiveSection');
const hideTrendsSectionToggle = document.getElementById('hideTrendsSection');
const hideWhoToFollowSectionToggle = document.getElementById('hideWhoToFollowSection');
const hideGrokNavToggle = document.getElementById('hideGrokNav');
const hidePremiumNavToggle = document.getElementById('hidePremiumNav');
const wordWholeMatchToggle = document.getElementById('wordWholeMatch');
const wordCaseSensitiveToggle = document.getElementById('wordCaseSensitive');
const performanceModeToggle = document.getElementById('performanceMode');
const siteNoticeEl = document.getElementById('siteNotice');
const languageSelect = document.getElementById('languageSelect');
const filteredCountEl = document.getElementById('filteredCount');
const dailyFilteredCountEl = document.getElementById('dailyFilteredCount');
const filteredAccountsCountEl = document.getElementById('filteredAccountsCount');
const resetCountdownEl = document.getElementById('resetCountdown');
const whitelistInput = document.getElementById('whitelistInput');
const addWhitelistBtn = document.getElementById('addWhitelist');
const whitelistTagsEl = document.getElementById('whitelistTags');
const blacklistInput = document.getElementById('blacklistInput');
const addBlacklistBtn = document.getElementById('addBlacklist');
const blacklistTagsEl = document.getElementById('blacklistTags');
const wordFilterInput = document.getElementById('wordFilterInput');
const addWordFilterBtn = document.getElementById('addWordFilter');
const wordFilterTagsEl = document.getElementById('wordFilterTags');
const filteredUsersSection = document.getElementById('filteredUsersSection');
const filteredUsersList = document.getElementById('filteredUsersList');
const toggleUsersListBtn = document.getElementById('toggleUsersList');
const clearFilteredBtn = document.getElementById('clearFiltered');
const toastEl = document.getElementById('toast');

// State
let usersListExpanded = false;
let isSupportedSite = true;
let currentLang = 'en';
let toastTimeout = null;
let lastUndo = null;

// Default settings
const defaultSettings = {
  enabled: true,
  hideCompletely: false,
  hidePremiumPromo: false,
  hideLiveSection: false,
  hideTrendsSection: false,
  hideWhoToFollowSection: false,
  hideGrokNav: false,
  hidePremiumNav: false,
  wordWholeMatch: false,
  wordCaseSensitive: false,
  performanceMode: false,
  language: 'auto',
  whitelist: [],
  blacklist: [],
  wordFilter: []
};

// Render tags
function renderTags(container, items, type) {
  container.innerHTML = '';
  items.forEach(item => {
    const tag = document.createElement('span');
    tag.className = `tag ${type}-tag`;
    tag.innerHTML = `${type === 'whitelist' ? '@' : ''}${item} <span class="tag-remove" data-item="${item}" data-type="${type}">×</span>`;
    container.appendChild(tag);
  });
}

// Render filtered users list
function renderFilteredUsers(users) {
  if (!users || users.length === 0) {
    filteredUsersSection.style.display = 'none';
    filteredAccountsCountEl.textContent = '0';
    return;
  }
  
  filteredUsersSection.style.display = 'block';
  filteredUsersList.innerHTML = '';
  filteredAccountsCountEl.textContent = users.length;
  
  if (!usersListExpanded) {
    filteredUsersList.style.display = 'none';
    toggleUsersListBtn.textContent = '▼';
    return;
  }
  
  toggleUsersListBtn.textContent = '▲';
  filteredUsersList.style.display = 'block';
  
  users.slice(0, 50).forEach(username => {
    const item = document.createElement('div');
    item.className = 'filtered-user-item';

    const link = document.createElement('a');
    link.href = `https://x.com/${username}`;
    link.target = '_blank';
    link.className = 'filtered-user-link';
    link.textContent = `@${username}`;

    const showBtn = document.createElement('button');
    showBtn.type = 'button';
    showBtn.className = 'mini-action';
    showBtn.dataset.action = 'whitelist';
    showBtn.dataset.username = username;
    showBtn.textContent = translations[currentLang]?.alwaysShow || translations.en.alwaysShow;

    const hideBtn = document.createElement('button');
    hideBtn.type = 'button';
    hideBtn.className = 'mini-action mini-action-danger';
    hideBtn.dataset.action = 'blacklist';
    hideBtn.dataset.username = username;
    hideBtn.textContent = translations[currentLang]?.alwaysHide || translations.en.alwaysHide;

    item.append(link, showBtn, hideBtn);
    filteredUsersList.appendChild(item);
  });
  
  if (users.length > 50) {
    const more = document.createElement('span');
    more.className = 'more-users';
    more.textContent = `+${users.length - 50} more`;
    filteredUsersList.appendChild(more);
  }
}

function getResetCountdownText() {
  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  const diff = Math.max(0, nextMidnight.getTime() - now.getTime());
  const hours = String(Math.floor(diff / 3600000)).padStart(2, '0');
  const minutes = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function showToast(message, undoFn) {
  clearTimeout(toastTimeout);
  lastUndo = undoFn || null;
  const undoLabel = translations[currentLang]?.undo || translations.en.undo;
  toastEl.innerHTML = '';

  const text = document.createElement('span');
  text.textContent = message;
  toastEl.appendChild(text);

  if (undoFn) {
    const undoBtn = document.createElement('button');
    undoBtn.type = 'button';
    undoBtn.className = 'toast-undo';
    undoBtn.textContent = undoLabel;
    undoBtn.addEventListener('click', async () => {
      if (!lastUndo) return;
      const fn = lastUndo;
      lastUndo = null;
      hideToast();
      await fn();
    });
    toastEl.appendChild(undoBtn);
  }

  toastEl.style.display = 'flex';
  requestAnimationFrame(() => toastEl.classList.add('is-visible'));
  toastTimeout = setTimeout(() => hideToast(), 4200);
}

function hideToast() {
  toastEl.classList.remove('is-visible');
  setTimeout(() => {
    if (!toastEl.classList.contains('is-visible')) {
      toastEl.style.display = 'none';
    }
  }, 180);
}

// Add item
async function addItem(type, value) {
  value = value.trim();
  if (type === 'whitelist' || type === 'blacklist') value = value.replace(/^@/, '');
  if (!value) return;
  
  const current = await chrome.storage.sync.get(defaultSettings);
  const list = current[type] || [];
  
  if (!list.includes(value)) {
    const next = { ...current, [type]: [...list, value] };
    if (type === 'whitelist') {
      next.blacklist = (current.blacklist || []).filter(item => item !== value);
    }
    if (type === 'blacklist') {
      next.whitelist = (current.whitelist || []).filter(item => item !== value);
    }
    await saveSettings(next);
    renderTags(whitelistTagsEl, next.whitelist || [], 'whitelist');
    renderTags(blacklistTagsEl, next.blacklist || [], 'blacklist');
    renderTags(wordFilterTagsEl, next.wordFilter || [], 'wordFilter');
  }
  
  (type === 'whitelist' ? whitelistInput : type === 'blacklist' ? blacklistInput : wordFilterInput).value = '';
}

// Remove item
async function removeItem(type, value) {
  const current = await chrome.storage.sync.get(defaultSettings);
  const list = (current[type] || []).filter(i => i !== value);
  await saveSettings({ ...current, [type]: list });
  renderTags(whitelistTagsEl, type === 'whitelist' ? list : current.whitelist || [], 'whitelist');
  renderTags(blacklistTagsEl, type === 'blacklist' ? list : current.blacklist || [], 'blacklist');
  renderTags(wordFilterTagsEl, type === 'wordFilter' ? list : current.wordFilter || [], 'wordFilter');
}

// Load settings
async function loadSettings() {
  const settings = await chrome.storage.sync.get(defaultSettings);
  const local = await chrome.storage.local.get({ filteredUsers: [], filteredCount: 0, dailyFilteredCount: 0 });
  
  enableFilterToggle.checked = settings.enabled;
  hideCompletelyToggle.checked = settings.hideCompletely;
  hidePremiumPromoToggle.checked = settings.hidePremiumPromo;
  hideLiveSectionToggle.checked = settings.hideLiveSection;
  hideTrendsSectionToggle.checked = settings.hideTrendsSection;
  hideWhoToFollowSectionToggle.checked = settings.hideWhoToFollowSection;
  hideGrokNavToggle.checked = settings.hideGrokNav;
  hidePremiumNavToggle.checked = settings.hidePremiumNav;
  wordWholeMatchToggle.checked = settings.wordWholeMatch;
  wordCaseSensitiveToggle.checked = settings.wordCaseSensitive;
  performanceModeToggle.checked = settings.performanceMode;
  
  // Handle auto language
  const effectiveLang = settings.language === 'auto' ? detectLanguage() : settings.language;
  currentLang = effectiveLang;
  languageSelect.value = settings.language;
  
  filteredCountEl.textContent = local.filteredCount || 0;
  dailyFilteredCountEl.textContent = local.dailyFilteredCount || 0;
  resetCountdownEl.textContent = getResetCountdownText();
  
  renderTags(whitelistTagsEl, settings.whitelist || [], 'whitelist');
  renderTags(blacklistTagsEl, settings.blacklist || [], 'blacklist');
  renderTags(wordFilterTagsEl, settings.wordFilter || [], 'wordFilter');
  renderFilteredUsers(local.filteredUsers || []);
  
  applyTranslations(effectiveLang);
  await updateSiteAvailability();
  updateOptionsState(settings.enabled);
  
  return settings;
}

// Save settings
async function saveSettings(settings) {
  await chrome.storage.sync.set(settings);
  notifyContentScript(settings);
}

// Notify content script
function notifyContentScript(settings) {
  chrome.tabs.query({ url: ['*://x.com/*'] }, tabs => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { type: 'SETTINGS_UPDATED', settings }).catch(() => {});
    });
  });
}

// Update options state
function updateOptionsState(enabled) {
  document.querySelectorAll('.section, .filtered-users-section').forEach(el => {
    const active = enabled && isSupportedSite;
    el.style.opacity = active ? '1' : '0.5';
    el.style.pointerEvents = active ? 'auto' : 'none';
  });
}

// Apply translations
function applyTranslations(lang) {
  const t = translations[lang] || translations.en;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key]) el.textContent = t[key];
  });
  if (siteNoticeEl && t.siteNotice) siteNoticeEl.textContent = t.siteNotice;
  // Update auto option text
  const autoOption = languageSelect.querySelector('option[value="auto"]');
  if (autoOption && t.auto) autoOption.textContent = t.auto;
  currentLang = lang;
}

async function updateSiteAvailability() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url || '';
    isSupportedSite = /^https?:\/\/x\.com\//i.test(url);
  } catch {
    isSupportedSite = true;
  }

  siteNoticeEl.style.display = isSupportedSite ? 'none' : 'block';
}

// Event listeners
enableFilterToggle.addEventListener('change', async () => {
  const current = await chrome.storage.sync.get(defaultSettings);
  await saveSettings({ ...current, enabled: enableFilterToggle.checked });
  updateOptionsState(enableFilterToggle.checked);
});

hideCompletelyToggle.addEventListener('change', async () => {
  const current = await chrome.storage.sync.get(defaultSettings);
  await saveSettings({ ...current, hideCompletely: hideCompletelyToggle.checked });
});

hidePremiumPromoToggle.addEventListener('change', async () => {
  const current = await chrome.storage.sync.get(defaultSettings);
  await saveSettings({ ...current, hidePremiumPromo: hidePremiumPromoToggle.checked });
});

hideLiveSectionToggle.addEventListener('change', async () => {
  const current = await chrome.storage.sync.get(defaultSettings);
  await saveSettings({ ...current, hideLiveSection: hideLiveSectionToggle.checked });
});

hideTrendsSectionToggle.addEventListener('change', async () => {
  const current = await chrome.storage.sync.get(defaultSettings);
  await saveSettings({ ...current, hideTrendsSection: hideTrendsSectionToggle.checked });
});

hideWhoToFollowSectionToggle.addEventListener('change', async () => {
  const current = await chrome.storage.sync.get(defaultSettings);
  await saveSettings({ ...current, hideWhoToFollowSection: hideWhoToFollowSectionToggle.checked });
});

hideGrokNavToggle.addEventListener('change', async () => {
  const current = await chrome.storage.sync.get(defaultSettings);
  await saveSettings({ ...current, hideGrokNav: hideGrokNavToggle.checked });
});

hidePremiumNavToggle.addEventListener('change', async () => {
  const current = await chrome.storage.sync.get(defaultSettings);
  await saveSettings({ ...current, hidePremiumNav: hidePremiumNavToggle.checked });
});

wordWholeMatchToggle.addEventListener('change', async () => {
  const current = await chrome.storage.sync.get(defaultSettings);
  await saveSettings({ ...current, wordWholeMatch: wordWholeMatchToggle.checked });
});

wordCaseSensitiveToggle.addEventListener('change', async () => {
  const current = await chrome.storage.sync.get(defaultSettings);
  await saveSettings({ ...current, wordCaseSensitive: wordCaseSensitiveToggle.checked });
});

performanceModeToggle.addEventListener('change', async () => {
  const current = await chrome.storage.sync.get(defaultSettings);
  await saveSettings({ ...current, performanceMode: performanceModeToggle.checked });
});

languageSelect.addEventListener('change', async () => {
  const lang = languageSelect.value;
  const effectiveLang = lang === 'auto' ? detectLanguage() : lang;
  applyTranslations(effectiveLang);
  const current = await chrome.storage.sync.get(defaultSettings);
  await saveSettings({ ...current, language: lang });
});

// Whitelist
addWhitelistBtn.addEventListener('click', () => addItem('whitelist', whitelistInput.value));
whitelistInput.addEventListener('keypress', e => { if (e.key === 'Enter') addItem('whitelist', whitelistInput.value); });

// Blacklist
addBlacklistBtn.addEventListener('click', () => addItem('blacklist', blacklistInput.value));
blacklistInput.addEventListener('keypress', e => { if (e.key === 'Enter') addItem('blacklist', blacklistInput.value); });

// Word filter
addWordFilterBtn.addEventListener('click', () => addItem('wordFilter', wordFilterInput.value));
wordFilterInput.addEventListener('keypress', e => { if (e.key === 'Enter') addItem('wordFilter', wordFilterInput.value); });

// Tag removal
document.addEventListener('click', async e => {
  if (e.target.classList.contains('tag-remove')) {
    removeItem(e.target.dataset.type, e.target.dataset.item);
  }

  if (e.target.classList.contains('mini-action')) {
    const username = e.target.dataset.username;
    const action = e.target.dataset.action;
    if (!username || !action) return;

    const current = await chrome.storage.sync.get(defaultSettings);
    const previous = structuredClone(current);
    const normalized = username.toLowerCase();
    const next = { ...current };

    if (action === 'whitelist') {
      next.whitelist = [...new Set([...(current.whitelist || []).filter(item => item !== normalized), normalized])];
      next.blacklist = (current.blacklist || []).filter(item => item !== normalized);
      await saveSettings(next);
      renderTags(whitelistTagsEl, next.whitelist || [], 'whitelist');
      renderTags(blacklistTagsEl, next.blacklist || [], 'blacklist');
      showToast(translations[currentLang]?.toastWhitelisted || translations.en.toastWhitelisted, async () => {
        await saveSettings(previous);
        renderTags(whitelistTagsEl, previous.whitelist || [], 'whitelist');
        renderTags(blacklistTagsEl, previous.blacklist || [], 'blacklist');
      });
    }

    if (action === 'blacklist') {
      next.blacklist = [...new Set([...(current.blacklist || []).filter(item => item !== normalized), normalized])];
      next.whitelist = (current.whitelist || []).filter(item => item !== normalized);
      await saveSettings(next);
      renderTags(whitelistTagsEl, next.whitelist || [], 'whitelist');
      renderTags(blacklistTagsEl, next.blacklist || [], 'blacklist');
      showToast(translations[currentLang]?.toastBlacklisted || translations.en.toastBlacklisted, async () => {
        await saveSettings(previous);
        renderTags(whitelistTagsEl, previous.whitelist || [], 'whitelist');
        renderTags(blacklistTagsEl, previous.blacklist || [], 'blacklist');
      });
    }
  }
});

// Toggle users list
toggleUsersListBtn.addEventListener('click', async () => {
  usersListExpanded = !usersListExpanded;
  const local = await chrome.storage.local.get({ filteredUsers: [] });
  renderFilteredUsers(local.filteredUsers || []);
});

// Clear filtered
clearFilteredBtn.addEventListener('click', async () => {
  await chrome.storage.local.set({ filteredUsers: [], filteredCount: 0 });
  filteredCountEl.textContent = '0';
  filteredUsersSection.style.display = 'none';
  
  chrome.tabs.query({ url: ['*://x.com/*'] }, tabs => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { type: 'CLEAR_FILTERED' }).catch(() => {});
    });
  });
});

// Listen for updates
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'FILTERED_UPDATE') {
    filteredCountEl.textContent = msg.count;
    dailyFilteredCountEl.textContent = msg.dailyCount ?? dailyFilteredCountEl.textContent;
    resetCountdownEl.textContent = getResetCountdownText();
    renderFilteredUsers(msg.users);
  }
});

// Init
loadSettings();
setInterval(() => {
  resetCountdownEl.textContent = getResetCountdownText();
}, 60000);
