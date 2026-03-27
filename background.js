// Background service worker for XFilter

// Update badge with filtered count
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'UPDATE_BADGE') {
    const count = message.count || 0;
    const text = count > 99 ? '99+' : count > 0 ? count.toString() : '';
    
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color: '#f4212e' });
  }
});

// Initialize badge on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeText({ text: '' });
  chrome.action.setBadgeBackgroundColor({ color: '#f4212e' });
});
