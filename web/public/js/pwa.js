// PWA 註冊 + 安裝提示
(function () {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((e) => console.warn('SW 註冊失敗', e));
    });
  }

  // 安裝提示按鈕
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallBtn();
  });

  function showInstallBtn() {
    if (document.getElementById('pwaInstallBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'pwaInstallBtn';
    btn.innerHTML = '📲 安裝到桌面';
    btn.style.cssText =
      'position:fixed;bottom:16px;right:16px;z-index:9999;padding:10px 18px;border:none;border-radius:24px;background:#1e3a5f;color:white;font-size:14px;font-weight:bold;box-shadow:0 4px 14px rgba(0,0,0,0.25);cursor:pointer;font-family:inherit;';
    btn.onclick = async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') btn.remove();
      deferredPrompt = null;
    };
    document.body.appendChild(btn);
  }

  // 安裝完成後隱藏按鈕
  window.addEventListener('appinstalled', () => {
    const btn = document.getElementById('pwaInstallBtn');
    if (btn) btn.remove();
  });
})();
