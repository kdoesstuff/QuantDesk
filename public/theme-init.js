// Applies the saved theme before first paint so there is no flash of the
// default. Kept as its own file so the page can carry a strict content
// security policy with no inline scripts.
;(function () {
  var ok = ['ink', 'periwinkle', 'blush', 'charcoal', 'plum', 'sky']
  var t = 'ink'
  try {
    var saved = localStorage.getItem('qd.theme')
    if (ok.indexOf(saved) >= 0) t = saved
  } catch (e) {
    /* storage blocked: default theme */
  }
  document.documentElement.dataset.theme = t
})()
