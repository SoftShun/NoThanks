// 브라우저 연동 (C#: NoThanks.Proto.WebBridge)
mergeInto(LibraryManager.library, {
  NT_Vibrate: function (ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {}
  },
  NT_PrefersReducedMotion: function () {
    try {
      return (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) ? 1 : 0;
    } catch (e) { return 0; }
  },
  NT_DevicePixelRatio: function () {
    return window.devicePixelRatio || 1;
  },
  // 0=top 1=right 2=bottom 3=left, CSS px. 템플릿의 viewport-fit=cover 와 함께 동작.
  NT_SafeAreaInset: function (side) {
    try {
      var d = document.getElementById('nt-safe-probe');
      if (!d) {
        d = document.createElement('div');
        d.id = 'nt-safe-probe';
        d.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
          'padding-top:env(safe-area-inset-top);padding-right:env(safe-area-inset-right);' +
          'padding-bottom:env(safe-area-inset-bottom);padding-left:env(safe-area-inset-left);';
        document.body.appendChild(d);
      }
      var cs = window.getComputedStyle(d);
      var v = [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft][side];
      return parseFloat(v) || 0;
    } catch (e) { return 0; }
  },
  NT_IsTouch: function () {
    return (('ontouchstart' in window) || (navigator.maxTouchPoints > 0)) ? 1 : 0;
  },
  NT_LoadMs: function () {
    return (typeof window.__ntLoadMs === 'number') ? window.__ntLoadMs : -1;
  }
});
