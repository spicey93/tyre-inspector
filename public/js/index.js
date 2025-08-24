(function () {
  var codeInput = document.getElementById('code');
  var openBtn   = document.getElementById('open-btn');
  var okIcon    = document.getElementById('code-valid');
  var badIcon   = document.getElementById('code-invalid');

  function norm(v){
    return (v || '').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);
  }
  function isValid(v){
    return /^[A-Z0-9]{6}$/.test(v || '');
  }
  function updateState(){
    var v = codeInput.value;
    var valid = isValid(v);
    if (openBtn) openBtn.disabled = !valid;
    if (okIcon)  okIcon.classList.toggle('hidden', !valid);
    if (badIcon) badIcon.classList.toggle('hidden', valid || !v);
    codeInput.setAttribute('aria-invalid', valid ? 'false' : 'true');
  }

  // Uppercase + restrict on input (preserve caret)
  if (codeInput) {
    codeInput.addEventListener('input', function(){
      var start = codeInput.selectionStart;
      var n = norm(codeInput.value);
      if (codeInput.value !== n){
        codeInput.value = n;
        var pos = Math.min(n.length, start);
        codeInput.setSelectionRange(pos, pos);
      }
      updateState();
    });

    // Autofocus and initial state
    try { codeInput.focus(); } catch (_) {}
    updateState();
  }

  // Prevent submitting with invalid code (extra guard)
  var form = codeInput && codeInput.closest('form');
  form && form.addEventListener('submit', function(e){
    if (!isValid(codeInput.value)) {
      e.preventDefault();
      codeInput.focus();
    }
  });
})();
