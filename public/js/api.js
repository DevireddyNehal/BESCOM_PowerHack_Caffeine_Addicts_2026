// ===================== API CLIENT =====================
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[ch]));
}

async function api(path, options = {}) {
  const headers = Object.assign({'Content-Type':'application/json'}, options.headers || {});
  let response;
  try { response = await fetch(path, Object.assign({ credentials:'same-origin' }, options, { headers })); }
  catch { throw new Error('PHP backend is not reachable. Run `php -S 127.0.0.1:8000 backend.php` in the project folder.'); }
  let payload;
  try { payload = await response.json(); }
  catch { throw new Error('PHP backend did not return JSON. Run `php -S 127.0.0.1:8000 backend.php` in the project folder.'); }
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
  return payload;
}
