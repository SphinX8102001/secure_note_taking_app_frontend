// Minimal vanilla-JS client. All user content is rendered with textContent (no innerHTML).
const $ = (sel) => document.querySelector(sel);
const LIMIT = 5;
const API = (window.API_BASE_URL || '').replace(/\/$/, '') + '/api';
let token = sessionStorage.getItem('token');
let me = null;

async function api(method, path, body) {
  // Free hosting sleeps when idle; the first request can take ~a minute.
  const slow = setTimeout(() => showError({ message: 'Waking up the server, please wait...' }), 3000);
  let res;
  try {
    res = await fetch(API + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the API at ' + API);
  } finally {
    clearTimeout(slow);
  }
  if ($('#msg').textContent.startsWith('Waking up')) showError(null);

  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) logout();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function showError(err) { $('#msg').textContent = err ? err.message || String(err) : ''; }
const run = (fn) => (...args) => { showError(null); return Promise.resolve(fn(...args)).catch(showError); };

function el(tag, text, cls) {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}
function btn(label, onClick) { const b = el('button', label); b.type = 'button'; b.onclick = run(onClick); return b; }
const splitInterests = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);
const fmt = (d) => new Date(d).toLocaleString();

// Pager supporting either {total,totalPages} or {hasMore}.
function renderPager(container, pagination, load) {
  container.replaceChildren();
  const { page } = pagination;
  const hasNext = pagination.hasMore ?? page < pagination.totalPages;
  if (page > 1) container.append(btn('Prev', () => load(page - 1)));
  container.append(el('span', ` Page ${page}${pagination.totalPages ? ' / ' + pagination.totalPages : ''} `, 'muted'));
  if (hasNext) container.append(btn('Next', () => load(page + 1)));
}

// ---------------- auth
async function onAuthed(data) {
  token = data.token;
  sessionStorage.setItem('token', token);
  await boot();
}
function logout() {
  token = null; me = null;
  sessionStorage.removeItem('token');
  $('#app-view').classList.add('hidden');
  $('#auth-view').classList.remove('hidden');
}

$('#login-form').onsubmit = run(async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  await onAuthed(await api('POST', '/auth/login', { email: f.get('email'), password: f.get('password') }));
});
$('#register-form').onsubmit = run(async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  await onAuthed(await api('POST', '/auth/register', {
    name: f.get('name'), email: f.get('email'), password: f.get('password'),
    interests: splitInterests(f.get('interests')),
  }));
});
$('#logout').onclick = logout;

// ---------------- tabs
function showTab(name) {
  document.querySelectorAll('[data-panel]').forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== name));
  document.querySelectorAll('nav button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  const loaders = {
    notes: () => loadNotes(1), posts: () => loadFeed(1), interests: () => loadInterests(1),
    profile: fillProfile, 'admin-users': () => loadUsers(1), 'admin-notes': () => loadAllNotes(1),
  };
  run(loaders[name])();
}
document.querySelectorAll('nav button').forEach((b) => (b.onclick = () => showTab(b.dataset.tab)));

// ---------------- notes
async function loadNotes(page) {
  const res = await api('GET', `/notes?page=${page}&limit=${LIMIT}`);
  const list = $('#notes-list');
  list.replaceChildren();
  if (!res.data.length) list.append(el('p', 'No notes yet.', 'muted'));
  for (const n of res.data) {
    const item = el('div', undefined, 'item');
    item.append(el('strong', n.title), el('div', n.content), el('div', 'Updated ' + fmt(n.updatedAt), 'muted'));
    item.append(
      btn('Edit', () => {
        const f = $('#note-form').elements;
        f.id.value = n._id; f.title.value = n.title; f.content.value = n.content;
      }),
      btn('Delete', async () => { if (confirm('Delete note?')) { await api('DELETE', '/notes/' + n._id); loadNotes(page); } })
    );
    list.append(item);
  }
  renderPager($('#notes-pager'), res.pagination, run(loadNotes));
}
$('#note-form').onsubmit = run(async (e) => {
  e.preventDefault();
  const f = e.target.elements;
  const body = { title: f.title.value, content: f.content.value };
  if (f.id.value) await api('PATCH', '/notes/' + f.id.value, body);
  else await api('POST', '/notes', body);
  e.target.reset(); f.id.value = '';
  await loadNotes(1);
});
$('#note-cancel').onclick = () => { $('#note-form').reset(); $('#note-form').elements.id.value = ''; };

// ---------------- posts
function renderPosts(posts, reload) {
  const list = $('#posts-list');
  list.replaceChildren();
  if (!posts.length) list.append(el('p', 'No posts.', 'muted'));
  for (const p of posts) {
    const item = el('div', undefined, 'item');
    item.append(el('strong', p.title), el('div', p.body));
    const meta = el('div', fmt(p.createdAt) + (p.author ? ' by ' : ''), 'muted');
    if (p.author) meta.append(btn(p.author.name, () => loadUserPosts(p.author._id, 1)));
    item.append(meta);
    const authorId = p.author ? p.author._id : null;
    if (me.role === 'admin' || authorId === me._id || reload.own) {
      item.append(btn('Delete', async () => { if (confirm('Delete post?')) { await api('DELETE', '/posts/' + p._id); reload.fn(); } }));
    }
    list.append(item);
  }
}
async function loadFeed(page) {
  const res = await api('GET', `/posts?page=${page}&limit=${LIMIT}`);
  $('#posts-heading').textContent = 'All posts';
  renderPosts(res.data, { fn: () => loadFeed(page) });
  renderPager($('#posts-pager'), res.pagination, run(loadFeed));
}
async function loadUserPosts(userId, page) {
  const res = await api('GET', `/posts/user/${userId}?page=${page}&limit=${LIMIT}`);
  $('#posts-heading').textContent = `Posts by ${res.user.name}`;
  renderPosts(res.data, { fn: () => loadUserPosts(userId, page), own: userId === me._id });
  renderPager($('#posts-pager'), res.pagination, run((pg) => loadUserPosts(userId, pg)));
}
$('#post-form').onsubmit = run(async (e) => {
  e.preventDefault();
  const f = e.target.elements;
  await api('POST', '/posts', { title: f.title.value, body: f.body.value });
  e.target.reset();
  await loadFeed(1);
});
$('#show-feed').onclick = run(() => loadFeed(1));
$('#show-mine').onclick = run(() => loadUserPosts(me._id, 1));

// ---------------- interests
let interestFilter = '';
async function loadInterests(page) {
  const q = interestFilter ? `&interest=${encodeURIComponent(interestFilter)}` : '';
  const res = await api('GET', `/interests/groups?page=${page}&limit=${LIMIT}${q}`);
  const list = $('#interests-list');
  list.replaceChildren();
  if (!res.data.length) list.append(el('p', 'No groups.', 'muted'));
  for (const g of res.data) {
    const item = el('div', undefined, 'item');
    item.append(el('strong', `${g.interest} (${g.userCount})`), el('div', g.users.map((u) => u.name).join(', ')));
    list.append(item);
  }
  renderPager($('#interests-pager'), res.pagination, run(loadInterests));
}
$('#interest-filter').onsubmit = run(async (e) => {
  e.preventDefault();
  interestFilter = e.target.elements.interest.value.trim();
  await loadInterests(1);
});

// ---------------- profile
function fillProfile() {
  const f = $('#profile-form').elements;
  f.name.value = me.name; f.interests.value = (me.interests || []).join(', ');
}
$('#profile-form').onsubmit = run(async (e) => {
  e.preventDefault();
  const f = e.target.elements;
  const res = await api('PATCH', '/me', { name: f.name.value, interests: splitInterests(f.interests.value) });
  me = res.user;
  $('#who').textContent = `${me.name} (${me.role})`;
  showError({ message: 'Profile saved.' });
});

// ---------------- admin: users
async function loadUsers(page) {
  const res = await api('GET', `/admin/users?page=${page}&limit=${LIMIT}`);
  const list = $('#users-list');
  list.replaceChildren();
  for (const u of res.data) {
    const item = el('div', undefined, 'item');
    item.append(el('strong', `${u.name} <${u.email}> [${u.role}]`), el('div', 'Interests: ' + (u.interests.join(', ') || '-'), 'muted'));
    item.append(
      btn('Edit', () => {
        const f = $('#user-form').elements;
        f.id.value = u._id; f.name.value = u.name; f.email.value = u.email;
        f.password.value = ''; f.interests.value = u.interests.join(', '); f.role.value = u.role;
      }),
      btn('Posts', () => { showTab('posts'); loadUserPosts(u._id, 1); }),
      btn('Delete', async () => { if (confirm(`Delete ${u.email} and all their notes/posts?`)) { await api('DELETE', '/admin/users/' + u._id); loadUsers(page); } })
    );
    list.append(item);
  }
  renderPager($('#users-pager'), res.pagination, run(loadUsers));
}
$('#user-form').onsubmit = run(async (e) => {
  e.preventDefault();
  const f = e.target.elements;
  const body = { name: f.name.value, email: f.email.value, role: f.role.value, interests: splitInterests(f.interests.value) };
  if (f.password.value) body.password = f.password.value;
  if (f.id.value) await api('PATCH', '/admin/users/' + f.id.value, body);
  else await api('POST', '/admin/users', body);
  e.target.reset(); f.id.value = '';
  await loadUsers(1);
});
$('#user-cancel').onclick = () => { $('#user-form').reset(); $('#user-form').elements.id.value = ''; };

// ---------------- admin: all notes
async function loadAllNotes(page) {
  const res = await api('GET', `/admin/notes?page=${page}&limit=${LIMIT}`);
  const list = $('#all-notes-list');
  list.replaceChildren();
  for (const n of res.data) {
    const item = el('div', undefined, 'item');
    const owner = n.owner ? `${n.owner.name} <${n.owner.email}>` : '(deleted user)';
    item.append(el('strong', n.title), el('div', n.content), el('div', `${owner} - ${fmt(n.updatedAt)}`, 'muted'));
    list.append(item);
  }
  renderPager($('#all-notes-pager'), res.pagination, run(loadAllNotes));
}

// ---------------- boot
async function boot() {
  if (!token) return logout();
  me = (await api('GET', '/me')).user;
  $('#who').textContent = `${me.name} (${me.role})`;
  document.querySelectorAll('.admin-only').forEach((b) => b.classList.toggle('hidden', me.role !== 'admin'));
  $('#auth-view').classList.add('hidden');
  $('#app-view').classList.remove('hidden');
  showTab('notes');
}
run(boot)();
