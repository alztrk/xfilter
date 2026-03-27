// XFilter Content Script
(function() {
  'use strict';

  let settings = {
    enabled: true,
    hideCompletely: false,
    hidePremiumPromo: false,
    hideLiveSection: false,
    hideTrendsSection: false,
    hideWhoToFollowSection: false,
    hideGrokNav: false,
    hidePremiumNav: false,
    wordCaseSensitive: false,
    wordWholeMatch: false,
    performanceMode: false,
    language: 'auto',
    whitelist: [],
    blacklist: [],
    wordFilter: []
  };

  let sessionFilteredCount = 0;
  let dailyFilteredCount = 0;
  let dailyFilteredDate = '';
  let filteredUsers = new Set();
  let whitelistSet = new Set();
  let blacklistSet = new Set();
  let wordFilterSet = [];
  let manuallyOpenedItems = new Set();

  const HIDDEN_META = {
    hidden: 'data-xfilter-hidden',
    overlay: 'data-xfilter-overlay',
    collapsed: 'data-xfilter-collapsed',
    originalStyle: 'data-xfilter-original-style',
    username: 'data-xfilter-username',
    reason: 'data-xfilter-reason',
    recollapse: 'data-xfilter-recollapse',
    opened: 'data-xfilter-opened',
    itemKey: 'data-xfilter-item-key'
  };

  function isContextInvalidated(error) {
    return String(error?.message || error || '').includes('Extension context invalidated');
  }

  async function safeStorageGet(area, defaults) {
    try {
      return await chrome.storage[area].get(defaults);
    } catch (error) {
      if (isContextInvalidated(error)) return defaults;
      throw error;
    }
  }

  async function safeStorageSet(area, value) {
    try {
      await chrome.storage[area].set(value);
      return true;
    } catch (error) {
      if (isContextInvalidated(error)) return false;
      throw error;
    }
  }

  function safeRuntimeSendMessage(message) {
    return chrome.runtime.sendMessage(message).catch(error => {
      if (!isContextInvalidated(error)) throw error;
    });
  }

  // Load settings
  async function loadSettings() {
    const stored = await safeStorageGet('sync', settings);
    settings = { ...settings, ...stored };
    refreshDerivedSettings();
    
    const local = await safeStorageGet('local', {
      filteredUsers: [],
      filteredCount: 0,
      dailyFilteredCount: 0,
      dailyFilteredDate: getTodayKey()
    });
    filteredUsers = new Set(local.filteredUsers || []);
    sessionFilteredCount = local.filteredCount || 0;
    dailyFilteredDate = local.dailyFilteredDate === getTodayKey() ? local.dailyFilteredDate : getTodayKey();
    dailyFilteredCount = local.dailyFilteredDate === getTodayKey() ? (local.dailyFilteredCount || 0) : 0;
    
    updateBadge();
  }

  function refreshDerivedSettings() {
    whitelistSet = new Set((settings.whitelist || []).map(u => u.toLowerCase()));
    blacklistSet = new Set((settings.blacklist || []).map(u => u.toLowerCase()));
    wordFilterSet = settings.wordFilter || [];
  }

  // Update badge
  function updateBadge() {
    safeRuntimeSendMessage({ type: 'UPDATE_BADGE', count: sessionFilteredCount }).catch(() => {});
  }

  // Save filtered count and users
  function saveFilteredData() {
    const todayKey = getTodayKey();
    dailyFilteredDate = todayKey;
    safeStorageSet('local', {
      filteredCount: sessionFilteredCount,
      filteredUsers: [...filteredUsers],
      dailyFilteredCount,
      dailyFilteredDate: todayKey
    }).catch(() => {});
    safeRuntimeSendMessage({
      type: 'FILTERED_UPDATE', 
      count: sessionFilteredCount,
      users: [...filteredUsers],
      dailyCount: dailyFilteredCount,
      dailyDate: todayKey
    }).catch(() => {});
    updateBadge();
  }

  function syncFilteredState() {
    const hiddenItems = [...document.querySelectorAll(`[${HIDDEN_META.hidden}][${HIDDEN_META.reason}]`)];
    const activeUsers = new Set();

    hiddenItems.forEach(el => {
      const username = el.getAttribute(HIDDEN_META.username);
      if (username) activeUsers.add(username.toLowerCase());
    });

    sessionFilteredCount = hiddenItems.length;
    filteredUsers = activeUsers;
    saveFilteredData();
  }

  // Check if whitelisted
  function isWhitelisted(username) {
    return username && whitelistSet.has(username.toLowerCase());
  }

  function isBlacklisted(username) {
    return username && blacklistSet.has(username.toLowerCase());
  }

  function applyIncomingSettings(nextSettings) {
    settings = { ...settings, ...nextSettings };
    refreshDerivedSettings();
  }

  function getTodayKey() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function incrementFilteredCount() {
    const todayKey = getTodayKey();
    if (dailyFilteredDate !== todayKey) {
      dailyFilteredDate = todayKey;
      dailyFilteredCount = 0;
    }
    sessionFilteredCount++;
    dailyFilteredCount++;
  }

  // Check if tweet contains filtered words
  function containsFilteredWord(tweet) {
    if (!wordFilterSet.length) return false;
    const textEl = tweet.querySelector('[data-testid="tweetText"]');
    if (!textEl) return false;
    const sourceText = textEl.textContent || '';
    const text = settings.wordCaseSensitive ? sourceText : sourceText.toLowerCase();

    return wordFilterSet.some(word => {
      const candidate = settings.wordCaseSensitive ? word : word.toLowerCase();
      if (settings.wordWholeMatch) {
        const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`(^|\\W)${escaped}(?=$|\\W)`, settings.wordCaseSensitive ? 'u' : 'iu').test(sourceText);
      }
      return text.includes(candidate);
    });
  }

  // Get username from element
  function getUsername(el) {
    const blocked = new Set(['home', 'explore', 'notifications', 'messages', 'i', 'settings', 'search', 'compose', 'login', 'signup']);

    for (const link of el.querySelectorAll('a[href]')) {
      const href = link.getAttribute('href') || '';
      const match = href.match(/^\/([a-zA-Z0-9_]+)(?:\/status\/\d+)?(?:[/?].*)?$/);
      if (!match) continue;

      const name = match[1];
      if (!blocked.has(name)) return name;
    }

    const handleText = el.textContent?.match(/@([a-zA-Z0-9_]{1,15})\b/);
    if (handleText?.[1]) {
      return handleText[1];
    }

    return null;
  }

  function getItemKey(el, username = '') {
    const root = findHideTarget(el) || el;
    const statusLink = root?.querySelector('a[href*="/status/"]');
    const statusMatch = statusLink?.getAttribute('href')?.match(/\/status\/(\d+)/);
    if (statusMatch?.[1]) return `tweet:${statusMatch[1]}`;

    const handle = (username || getUsername(root) || 'unknown').toLowerCase();
    const text = root?.querySelector('[data-testid="tweetText"]')?.textContent?.trim().slice(0, 80) || '';
    return `fallback:${handle}:${text}`;
  }

  function hasVerifiedBadge(el, username) {
    const userNameBlocks = [...el.querySelectorAll('[data-testid="User-Name"]')];
    if (!userNameBlocks.length) return false;

    let primaryBlock = userNameBlocks[0];

    if (username) {
      const normalized = username.toLowerCase();
      const matchedBlock = userNameBlocks.find(block =>
        [...block.querySelectorAll('a[href]')].some(link => {
          const href = (link.getAttribute('href') || '').toLowerCase();
          return href === `/${normalized}` || href.startsWith(`/${normalized}?`);
        })
      );

      if (matchedBlock) {
        primaryBlock = matchedBlock;
      }
    }

    return Boolean(primaryBlock.querySelector('svg[data-testid="icon-verified"]'));
  }

  // Find timeline item container
  function findHideTarget(el) {
    if (!el) return null;

    const article = el.closest('article');
    if (article) return article;

    return el.closest('[data-testid="UserCell"]') || el;
  }

  function isInsideSidebar(el) {
    return Boolean(el?.closest('aside[role="complementary"]'));
  }

  function getNthParent(el, levels) {
    let current = el;
    for (let i = 0; i < levels && current; i++) {
      current = current.parentElement;
    }
    return current;
  }

  function hideStaticElement(el) {
    if (!el || el.getAttribute(HIDDEN_META.hidden) === 'true') return;
    const originalStyle = el.getAttribute('style') || '';
    el.setAttribute(HIDDEN_META.originalStyle, originalStyle);
    el.setAttribute(HIDDEN_META.hidden, 'true');
    el.style.display = 'none';
  }

  function processSidebarSections() {
    const sidebar = document.querySelector('[data-testid="sidebarColumn"]');
    const appRoot = document;

    if (settings.hideGrokNav) {
      appRoot.querySelectorAll('a[href="/i/grok"]').forEach(link => {
        hideStaticElement(link);
      });

      appRoot.querySelectorAll('.css-175oi2r.r-1777fci.r-bt1l66.r-bztko3.r-lrvibr.r-1loqt21.r-1ny4l3l').forEach(button => {
        const ariaLabel = button.getAttribute('aria-label') || '';
        if (ariaLabel.includes('Grok')) {
          hideStaticElement(button);
        }
      });

      appRoot.querySelectorAll('[data-testid="GrokDrawer"]').forEach(el => {
        hideStaticElement(el);
      });
    }

    if (settings.hidePremiumNav) {
      appRoot.querySelectorAll('[data-testid="premium-signup-tab"]').forEach(el => {
        hideStaticElement(el);
      });
    }

    if (!sidebar) return;

    if (settings.hidePremiumPromo) {
      sidebar.querySelectorAll('a[href="/i/premium_sign_up"]').forEach(link => {
        const target = getNthParent(link.closest('aside') || link, 2);
        hideStaticElement(target);
      });
    }

    if (settings.hideLiveSection) {
      sidebar.querySelectorAll('div[data-testid="placementTracking"]').forEach(block => {
        hideStaticElement(block.parentElement);
      });
    }

    if (settings.hideTrendsSection) {
      sidebar.querySelectorAll('section[aria-labelledby="accessible-list-0"][role="region"]').forEach(section => {
        hideStaticElement(section.parentElement);
      });
    }

    if (settings.hideWhoToFollowSection) {
      sidebar.querySelectorAll('a[href^="/i/connect_people?"]').forEach(link => {
        const target = getNthParent(link, 2) || getNthParent(link.closest('aside') || link, 2);
        hideStaticElement(target);
      });
    }
  }

  function restoreElement(el) {
    const originalStyle = el.getAttribute(HIDDEN_META.originalStyle) || '';
    if (originalStyle) {
      el.setAttribute('style', originalStyle);
    } else {
      el.removeAttribute('style');
    }

    el.classList.remove('xfilter-collapsed');
    el.removeAttribute(HIDDEN_META.hidden);
    el.removeAttribute(HIDDEN_META.collapsed);
    el.removeAttribute(HIDDEN_META.originalStyle);

    const overlay = el.querySelector(`[${HIDDEN_META.overlay}]`);
    if (overlay) overlay.remove();

    const recollapse = el.querySelector(`[${HIDDEN_META.recollapse}]`);
    if (recollapse) recollapse.remove();

    syncFilteredState();
  }

  function addRecollapseButton(el) {
    if (settings.hideCompletely) return;
    const username = el.getAttribute(HIDDEN_META.username) || '';
    const reason = el.getAttribute(HIDDEN_META.reason) || 'verified';
    const itemKey = el.getAttribute(HIDDEN_META.itemKey) || '';
    const host = findRecollapseHost(el);
    if (!host) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'xfilter-recollapse';
    button.setAttribute(HIDDEN_META.recollapse, 'true');
    button.textContent = 'Tekrar daralt';
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      const existing = el.querySelector(`[${HIDDEN_META.recollapse}]`);
      if (existing) existing.remove();
      el.removeAttribute(HIDDEN_META.opened);
      if (itemKey) manuallyOpenedItems.delete(itemKey);
      hideElement(el, username, reason);
    });

    host.appendChild(button);
  }

  function findRecollapseHost(el) {
    const root = el.matches('article, [data-testid="UserCell"]') ? el : findHideTarget(el);
    if (!root) return null;

    const caret = root.querySelector('[data-testid="caret"]');
    if (caret?.parentElement) {
      return caret.parentElement;
    }

    const preferred = root.querySelector('div.css-175oi2r.r-1awozwy.r-18u37iz.r-1cmwbt1.r-1wtj0ep');
    if (preferred) return preferred;

    return null;
  }

  // Create inline overlay
  function createOverlay(username, reason, original) {
    const overlay = document.createElement('button');
    overlay.type = 'button';
    overlay.className = 'xfilter-overlay';
    overlay.setAttribute(HIDDEN_META.overlay, 'true');
    overlay.setAttribute('aria-label', 'Gizlenen tweeti goster');

    const content = document.createElement('span');
    content.className = 'xfilter-placeholder-content';

    const icon = document.createElement('span');
    icon.className = 'xfilter-placeholder-icon';
    icon.textContent = '🚫';

    const text = document.createElement('span');
    text.className = 'xfilter-placeholder-text';
    text.innerHTML = reason === 'word'
      ? 'Bu tweet filtrelenen kelime nedeniyle daraltildi'
      : reason === 'blacklist'
        ? `Bu hesap${username ? ` <b>@${username}</b>` : ''} her zaman gizli`
      : `Onayli tweet${username ? ` <b>@${username}</b>` : ''} daraltildi`;

    const show = document.createElement('span');
    show.className = 'xfilter-placeholder-show';
    show.textContent = 'Gormek icin dokun';

    content.append(icon, text, show);
    overlay.appendChild(content);
    overlay.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      restoreElement(original);
      original.setAttribute(HIDDEN_META.opened, 'true');
      const itemKey = original.getAttribute(HIDDEN_META.itemKey) || getItemKey(original, username);
      original.setAttribute(HIDDEN_META.itemKey, itemKey);
      manuallyOpenedItems.add(itemKey);
      addRecollapseButton(original);
    });

    return overlay;
  }

  // Collapse element in place with overlay
  function hideElement(el, username, reason = 'verified') {
    if (!el || el.getAttribute(HIDDEN_META.hidden) === 'true') return;

    const rect = el.getBoundingClientRect();
    const originalHeight = Math.ceil(rect.height);
    const itemKey = el.getAttribute(HIDDEN_META.itemKey) || getItemKey(el, username);
    const originalStyle = el.getAttribute('style') || '';
    el.setAttribute(HIDDEN_META.originalStyle, originalStyle);
    el.setAttribute(HIDDEN_META.hidden, 'true');
    el.setAttribute(HIDDEN_META.collapsed, 'true');
    el.setAttribute(HIDDEN_META.username, username || '');
    el.setAttribute(HIDDEN_META.reason, reason);
    el.setAttribute(HIDDEN_META.itemKey, itemKey);
    el.removeAttribute(HIDDEN_META.opened);
    el.classList.add('xfilter-collapsed');

    const currentPosition = window.getComputedStyle(el).position;
    if (currentPosition === 'static') {
      el.style.position = 'relative';
    }

    if (settings.hideCompletely) {
      el.style.display = 'none';
      if (rect.top < 0 && originalHeight > 0) {
        window.scrollBy(0, -originalHeight);
      }
      syncFilteredState();
      return;
    }

    el.style.overflow = 'hidden';
    el.style.maxHeight = '64px';
    el.style.minHeight = '64px';

    const oldRecollapse = el.querySelector(`[${HIDDEN_META.recollapse}]`);
    if (oldRecollapse) oldRecollapse.remove();

    const overlay = createOverlay(username, reason, el);
    el.appendChild(overlay);

    const collapsedHeight = Math.ceil(el.getBoundingClientRect().height);
    const heightDiff = Math.max(0, originalHeight - collapsedHeight);
    if (rect.top < 0 && heightDiff > 0) {
      window.scrollBy(0, -heightDiff);
    }

    syncFilteredState();
  }

  // Show all hidden elements
  function showAllHidden() {
    document.querySelectorAll(`[${HIDDEN_META.hidden}]`).forEach(el => {
      restoreElement(el);
      el.removeAttribute(HIDDEN_META.opened);
    });
    syncFilteredState();
  }

  // Process tweet
  async function processTweet(tweet) {
    if (!settings.enabled) return;
    const container = findHideTarget(tweet);
    const username = getUsername(tweet);
    const itemKey = getItemKey(container || tweet, username);
    if (
      tweet.getAttribute(HIDDEN_META.opened) === 'true' ||
      container?.getAttribute(HIDDEN_META.opened) === 'true' ||
      manuallyOpenedItems.has(itemKey)
    ) return;

    // Word filter (applies to all)
    if (containsFilteredWord(tweet)) {
      incrementFilteredCount();
      hideElement(container, username, 'word');
      return;
    }

    if (username && isBlacklisted(username)) {
      incrementFilteredCount();
      hideElement(container, username, 'blacklist');
      return;
    }

    // Check verified badge
    if (!hasVerifiedBadge(tweet, username)) return;

    // Check whitelist
    if (username && isWhitelisted(username)) return;

    // Check if following
    // Hide and track
    incrementFilteredCount();
    hideElement(container, username, 'verified');
  }

  async function processUserCell(cell) {
    if (!settings.enabled) return;
    const username = getUsername(cell);
    const itemKey = getItemKey(cell, username);
    if (cell.getAttribute(HIDDEN_META.opened) === 'true' || manuallyOpenedItems.has(itemKey)) return;
    if (!username) return;
    if (isBlacklisted(username)) {
      incrementFilteredCount();
      hideElement(cell, username, 'blacklist');
      return;
    }
    if (!hasVerifiedBadge(cell, username)) return;
    if (isWhitelisted(username)) return;

    incrementFilteredCount();
    hideElement(cell, username, 'verified');
  }

  // Scan for tweets
  function scan() {
    if (!settings.enabled) {
      showAllHidden();
      return;
    }

    processSidebarSections();

    document.querySelectorAll('[data-testid="tweet"]').forEach(tweet => {
      if (isInsideSidebar(tweet)) return;
      if (settings.performanceMode && !isNearViewport(tweet)) return;
      processTweet(tweet);
    });

    document.querySelectorAll('[data-testid="UserCell"]').forEach(cell => {
      if (settings.performanceMode && !isNearViewport(cell)) return;
      processUserCell(cell);
    });
  }

  function isNearViewport(el) {
    const rect = el.getBoundingClientRect();
    return rect.bottom >= -800 && rect.top <= window.innerHeight + 800;
  }

  // Debounced scan
  let scanTimeout;
  function debouncedScan() {
    clearTimeout(scanTimeout);
    scanTimeout = setTimeout(scan, 50);
  }

  // Setup observer
  function setupObserver() {
    const observer = new MutationObserver(mutations => {
      if (mutations.some(m => m.addedNodes.length)) debouncedScan();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Message listener
  chrome.runtime.onMessage.addListener((msg, sender, respond) => {
    if (msg.type === 'SETTINGS_UPDATED') {
      const wasEnabled = settings.enabled;
      applyIncomingSettings(msg.settings);
      
      if (!settings.enabled && wasEnabled) {
        showAllHidden();
      } else if (settings.enabled) {
        showAllHidden();
        scan();
      }
    }
    
    if (msg.type === 'CLEAR_FILTERED') {
      filteredUsers.clear();
      sessionFilteredCount = 0;
      dailyFilteredCount = 0;
      saveFilteredData();
      respond({ success: true });
    }
    
    if (msg.type === 'GET_FILTERED_USERS') {
      respond({ users: [...filteredUsers], count: sessionFilteredCount });
    }
  });

  // Init
  async function init() {
    await loadSettings();
    scan();
    setupObserver();
    window.addEventListener('scroll', debouncedScan, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
