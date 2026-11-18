// ===================== AUTHENTICATION & SESSION =====================
let signedInUser = null;
let confirmedLocation = false;
let portalPoll = null;

function setAuthMessage(message, tone = 'error') {
  const node = document.getElementById('authMessage');
  node.textContent = message;
  node.className = `mt-4 min-h-5 text-sm ${tone==='info'?'text-amberWatch':'text-terracotta'}`;
}

async function submitLogin(event) {
  event.preventDefault();
  setAuthMessage('');
  const button = document.getElementById('loginButton');
  button.disabled = true;
  try {
    const result = await api('/api/auth/login', {
      method:'POST',
      body:JSON.stringify({
        username:document.getElementById('loginUsername').value.trim(),
        password:document.getElementById('loginPassword').value
      })
    });
    if (result.requires_otp) {
      document.getElementById('loginForm').classList.add('hidden');
      document.getElementById('otpForm').classList.remove('hidden');
      document.getElementById('otpCode').focus();
      const hint = document.getElementById('demoOtpHint');
      hint.textContent = `Demo OTP: ${result.demo_otp} · expires in 5 minutes`;
      hint.classList.remove('hidden');
      setAuthMessage(result.message, 'info');
      return;
    }
    openRolePanel(result.user);
  } catch (error) {
    setAuthMessage(error.message);
  } finally {
    button.disabled = false;
  }
}

async function submitOtp(event) {
  event.preventDefault();
  setAuthMessage('');
  try {
    const result = await api('/api/auth/verify-otp', {
      method:'POST',
      body:JSON.stringify({ code:document.getElementById('otpCode').value.trim() })
    });
    openRolePanel(result.user);
  } catch (error) {
    setAuthMessage(error.message);
  }
}

function restartSignIn() {
  document.getElementById('otpForm').reset();
  document.getElementById('otpForm').classList.add('hidden');
  document.getElementById('loginForm').classList.remove('hidden');
  document.getElementById('demoOtpHint').classList.add('hidden');
  setAuthMessage('');
}

function openRolePanel(user) {
  if (!user || !['admin','customer','worker'].includes(user.role)) {
    setAuthMessage('The server returned an unknown account role.');
    return;
  }
  signedInUser = user;
  if (portalPoll) clearInterval(portalPoll);
  document.body.classList.remove('guest','admin','customer','worker');
  document.body.classList.add(user.role);
  document.getElementById('adminPanel').classList.toggle('hidden', user.role !== 'admin');
  document.getElementById('customerPanel').classList.toggle('hidden', user.role !== 'customer');
  document.getElementById('workerPanel').classList.toggle('hidden', user.role !== 'worker');
  document.getElementById('appTitle').textContent = user.role === 'admin'
    ? 'BESCOM Operations Desk' : user.role === 'worker' ? 'Field Worker Portal' : 'Customer Service Portal';
  document.getElementById('appSubtitle').textContent = `${user.full_name} · ${user.role} · demo account`;
  document.getElementById('signedInBadge').textContent = `${user.full_name} · ${user.role}`;
  document.getElementById('signedInBadge').classList.remove('hidden');
  document.getElementById('logoutButton').classList.remove('hidden');
  if (user.role === 'admin') {
    showAdminView('overview');
    initCharts();
    renderAll();
    refreshAdmin();
  }
  if (user.role === 'customer') {
    document.getElementById('chatMessages').innerHTML = '';
    addChatMessage('Hi. Tell me the area where the problem is. I will check it against the service demo and the location on your account.');
    refreshCustomer();
  }
  if (user.role === 'worker') refreshWorkerTasks();
  portalPoll = setInterval(() => {
    if (signedInUser?.role === 'admin' && !document.getElementById('adminPanel').contains(document.activeElement)) refreshAdmin();
    if (signedInUser?.role === 'customer') refreshCustomer();
    if (signedInUser?.role === 'worker' && !document.getElementById('workerTasks').contains(document.activeElement)) refreshWorkerTasks();
  }, 30000);
}

async function initializePortal() {
  if (location.protocol === 'file:') {
    setAuthMessage('Start the PHP server in this folder, then open http://127.0.0.1:8000.', 'info');
    return;
  }
  try {
    const result = await api('/api/auth/me');
    openRolePanel(result.user);
  } catch (error) {
    if (!error.message.includes('sign in')) setAuthMessage(error.message, 'info');
  }
}

async function logout() {
  if (portalPoll) clearInterval(portalPoll);
  portalPoll = null;
  try { await api('/api/auth/logout', { method:'POST', body:'{}' }); }
  catch (error) { showToast('Sign-out issue', error.message); }
  signedInUser = null;
  confirmedLocation = false;
  document.body.classList.remove('admin','customer','worker');
  document.body.classList.add('guest');
  document.getElementById('signedInBadge').classList.add('hidden');
  document.getElementById('logoutButton').classList.add('hidden');
  document.getElementById('loginForm').reset();
  document.getElementById('loginForm').classList.remove('hidden');
  document.getElementById('otpForm').reset();
  document.getElementById('otpForm').classList.add('hidden');
  document.getElementById('demoOtpHint').classList.add('hidden');
  setAuthMessage('');
}
