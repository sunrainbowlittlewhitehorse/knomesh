// ---- State ----
let currentType = 'all';
let currentTags = [];
let currentQuery = '';
let currentOffset = 0;
let hasMore = false;
let searchTimeout = null;
let editingItemId = null;

// ---- DOM refs ----
const grid = document.getElementById('card-grid');
const emptyState = document.getElementById('empty-state');
const pagination = document.getElementById('pagination');
const loadMoreBtn = document.getElementById('btn-load-more');
const itemCount = document.getElementById('item-count');
const loading = document.getElementById('loading');
const searchInput = document.getElementById('search-input');
const typeTabs = document.querySelectorAll('#type-tabs [data-type]');
const tagFilterEls = document.querySelectorAll('#tag-filters [data-tag]');
const modal = document.getElementById('add-modal');
const modalCloseBtns = document.querySelectorAll('.modal-close-btn');
const saveBtn = document.getElementById('btn-save');
const deleteBtn = document.getElementById('btn-delete-item');
const modalTypeBtns = document.querySelectorAll('.modal-type-btn');
const titleInput = document.getElementById('field-title');
const contentInput = document.getElementById('field-content');
const urlInput = document.getElementById('field-url-input');
const langSelect = document.getElementById('field-language-select');
const tagInput = document.getElementById('field-tags');
const tagContainer = document.getElementById('tag-input-container');
const autocomplete = document.getElementById('tag-autocomplete');
const fieldUrl = document.getElementById('field-url');
const fieldLanguage = document.getElementById('field-language');

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  loadItems();
  setupSearch();
  setupTypeTabs();
  setupTagFilters();
  setupModal();
  setupCardClicks();
  setupLoadMore();
  updateFormFields('link');
});

// ---- API helper ----
async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  return res.json();
}

// ---- Load items ----
async function loadItems(append = false) {
  if (!append) {
    currentOffset = 0;
    if (loading) loading.classList.remove('hidden');
  }
  const params = new URLSearchParams();
  if (currentType !== 'all') params.set('type', currentType);
  currentTags.forEach(t => params.append('tag', t));
  if (currentQuery) params.set('q', currentQuery);
  params.set('offset', currentOffset);
  params.set('limit', 24);

  const res = await api(`/api/items?${params}`);
  if (!res.ok) return;
  const data = res.data;
  hasMore = data.has_more;

  if (!append && grid) grid.innerHTML = '';
  if (grid) {
    data.items.forEach(item => {
      grid.innerHTML += buildCard(item);
    });
  }

  if (loading) loading.classList.add('hidden');
  updatePagination(data.total, data.items.length, append);
}

function buildCard(item) {
  const icons = { link: 'link', note: 'description', code: 'code' };
  const isDark = item.type === 'code';
  const preview = item.type === 'code' ? item.content.slice(0, 80) :
                  item.type === 'link' ? (item.url || item.content.slice(0, 80)) :
                  item.content.slice(0, 80);
  const tagsHtml = (item.tags || []).map(t =>
    `<span class="px-xs py-[2px] bg-hairline-soft rounded text-[11px] font-medium text-muted uppercase tracking-wider">#${t.name}</span>`
  ).join('');

  return `
<div class="group ${isDark ? 'bg-surface-dark' : 'bg-surface-card'} p-lg rounded-xl border border-transparent hover:border-hairline hover:shadow-sm transition-all duration-300" data-id="${item.id}">
  <div class="flex items-start justify-between mb-md">
    <div class="w-10 h-10 rounded-lg ${isDark ? 'bg-surface-dark-soft' : 'bg-surface-container'} flex items-center justify-center ${isDark ? 'text-primary-fixed-dim' : 'text-primary'}">
      <span class="material-symbols-outlined">${icons[item.type]}</span>
    </div>
    <span class="font-caption text-caption ${isDark ? 'text-on-dark-soft' : 'text-muted-soft'}">${item.created_at.slice(0, 10)}</span>
  </div>
  <h3 class="font-title-md text-title-md ${isDark ? 'text-on-dark' : 'text-body-strong'} mb-xs line-clamp-1 transition-colors">${escapeHtml(item.title)}</h3>
  <p class="font-body-sm ${isDark ? 'text-on-dark-soft' : 'text-muted'} mb-lg line-clamp-1 ${isDark ? 'font-code' : ''}">${escapeHtml(preview)}</p>
  <div class="flex items-center justify-between">
    <div class="flex gap-xxs">${tagsHtml}</div>
    ${isDark ? '<span class="material-symbols-outlined text-on-dark-soft text-[18px]">terminal</span>' :
      item.type === 'link' && item.url ?
      `<span class="card-link-btn flex items-center gap-xxs text-primary hover:text-primary-active transition-colors cursor-pointer" data-url="${escapeHtml(item.url)}">
        <span class="material-symbols-outlined text-[18px]">open_in_new</span>
        <span class="font-caption text-caption">访问</span>
      </span>` :
      '<span class="material-symbols-outlined text-muted-soft text-[18px]">arrow_forward</span>'}
  </div>
</div>`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function updatePagination(total, count, append) {
  if (!emptyState || !pagination) return;
  if (total === 0) {
    emptyState.classList.remove('hidden');
    pagination.classList.add('hidden');
    return;
  }
  emptyState.classList.add('hidden');
  pagination.classList.remove('hidden');
  itemCount.textContent = `显示 ${Math.min(currentOffset + count, total)} 个项目中的 ${total} 个`;
  loadMoreBtn.classList.toggle('hidden', !hasMore);
}

// ---- Search ----
function setupSearch() {
  if (!searchInput) return;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentQuery = searchInput.value.trim();
      loadItems(false);
    }, 300);
  });
}

// ---- Type Tabs ----
function setupTypeTabs() {
  typeTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      typeTabs.forEach(t => {
        t.classList.remove('text-primary', 'border-b-2', 'border-primary');
        t.classList.add('text-secondary');
      });
      tab.classList.add('text-primary', 'border-b-2', 'border-primary');
      tab.classList.remove('text-secondary');
      currentType = tab.dataset.type;
      loadItems(false);
    });
  });
}

// ---- Tag Filters ----
function setupTagFilters() {
  const allTagEl = document.querySelector('#tag-filters [data-tag=""]');
  document.querySelectorAll('#tag-filters [data-tag]').forEach(el => {
    el.addEventListener('click', () => {
      const tag = el.dataset.tag;
      // "#全部" = clear all tag filters
      if (tag === '') {
        currentTags = [];
        document.querySelectorAll('#tag-filters [data-tag]').forEach(e => {
          if (e.dataset.tag === '') {
            e.classList.add('bg-primary', 'text-on-primary');
            e.classList.remove('border', 'border-hairline', 'text-secondary', 'hover:border-primary', 'hover:text-primary');
          } else {
            e.classList.remove('bg-primary', 'text-on-primary');
            e.classList.add('border', 'border-hairline', 'text-secondary', 'hover:border-primary', 'hover:text-primary');
          }
        });
        loadItems(false);
        return;
      }
      if (!tag) return;
      const idx = currentTags.indexOf(tag);
      if (idx > -1) {
        currentTags.splice(idx, 1);
        el.classList.remove('bg-primary', 'text-on-primary');
        el.classList.add('border', 'border-hairline', 'text-secondary', 'hover:border-primary', 'hover:text-primary');
      } else {
        currentTags.push(tag);
        // Reset "#全部" when a specific tag is selected
        if (allTagEl) {
          allTagEl.classList.remove('bg-primary', 'text-on-primary');
          allTagEl.classList.add('border', 'border-hairline', 'text-secondary');
        }
        el.classList.remove('border', 'border-hairline', 'text-secondary', 'hover:border-primary', 'hover:text-primary');
        el.classList.add('bg-primary', 'text-on-primary');
      }
      loadItems(false);
    });
  });
}

// ---- Load More ----
function setupLoadMore() {
  if (!loadMoreBtn) return;
  loadMoreBtn.addEventListener('click', () => {
    currentOffset += 24;
    loadItems(true);
  });
}

// ---- Card click -> Edit ----
function setupCardClicks() {
  if (!grid) return;
  grid.addEventListener('click', (e) => {
    const linkBtn = e.target.closest('.card-link-btn');
    if (linkBtn) {
      const url = linkBtn.dataset.url;
      if (url) window.open(url, '_blank', 'noopener');
      return;
    }
    const card = e.target.closest('[data-id]');
    if (!card) return;
    openEditModal(card.dataset.id);
  });
}

// ---- Modal ----
function setupModal() {
  modalCloseBtns.forEach(btn => btn.addEventListener('click', closeModal));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Type switching
  modalTypeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modalTypeBtns.forEach(b => {
        b.classList.remove('border-primary', 'bg-surface-container', 'text-primary');
        b.classList.add('border-hairline', 'hover:bg-hairline-soft', 'text-secondary');
      });
      btn.classList.add('border-primary', 'bg-surface-container', 'text-primary');
      btn.classList.remove('border-hairline', 'hover:bg-hairline-soft', 'text-secondary');
      updateFormFields(btn.dataset.type);
    });
  });

  // Tag autocomplete
  tagInput.addEventListener('input', async () => {
    const val = tagInput.value.trim();
    if (!val) { autocomplete.classList.add('hidden'); return; }
    const res = await api('/api/tags');
    if (!res.ok) return;
    const matches = res.data.filter(t => t.name.toLowerCase().includes(val.toLowerCase()) && !getSelectedTags().includes(t.name));
    if (matches.length === 0) { autocomplete.classList.add('hidden'); return; }
    autocomplete.innerHTML = matches.map(t => `<div class="p-sm hover:bg-hairline-soft cursor-pointer font-body-sm" data-tag-name="${t.name}">${t.name}</div>`).join('');
    autocomplete.querySelectorAll('[data-tag-name]').forEach(el => {
      el.addEventListener('click', () => {
        addTagPill(el.dataset.tagName);
        tagInput.value = '';
        autocomplete.classList.add('hidden');
        tagInput.focus();
      });
    });
    autocomplete.classList.remove('hidden');
  });
  tagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = tagInput.value.trim();
      if (val) { addTagPill(val); tagInput.value = ''; }
    }
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#tag-input-container') && !e.target.closest('#tag-autocomplete')) {
      autocomplete.classList.add('hidden');
    }
  });

  // Delete item (only visible in edit mode)
  deleteBtn.addEventListener('click', async () => {
    if (!editingItemId) return;
    const confirmed = await window.showConfirm('确定要删除这个条目吗？此操作不可撤销。');
    if (!confirmed) return;
    const res = await api(`/api/items/${editingItemId}`, { method: 'DELETE' });
    if (res.ok) {
      closeModal();
      if (window.location.pathname === '/') {
        loadItems(false);
        refreshTags();
      } else {
        window.location.href = '/';
      }
    }
  });

  // Save (create or update)
  saveBtn.addEventListener('click', async () => {
    const type = document.querySelector('.modal-type-btn.border-primary')?.dataset.type || 'link';
    const title = titleInput.value.trim();
    if (!title) { titleInput.focus(); return; }
    const data = { type, title, content: contentInput.value.trim(), tags: getSelectedTags() };
    if (type === 'link') data.url = urlInput.value.trim();
    if (type === 'code') data.language = langSelect.value || null;

    let res;
    if (editingItemId) {
      res = await api(`/api/items/${editingItemId}`, { method: 'PUT', body: JSON.stringify(data) });
    } else {
      res = await api('/api/items', { method: 'POST', body: JSON.stringify(data) });
    }
    if (res.ok) {
      closeModal();
      if (window.location.pathname === '/') {
        loadItems(false);
        refreshTags();
      } else {
        window.location.href = '/';
      }
    }
  });

  // Tab key -> insert 2 spaces in code editor
  contentInput.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && !e.shiftKey && contentInput.classList.contains('code-editor')) {
      e.preventDefault();
      const start = contentInput.selectionStart;
      const end = contentInput.selectionEnd;
      contentInput.value = contentInput.value.substring(0, start) + '  ' + contentInput.value.substring(end);
      contentInput.selectionStart = contentInput.selectionEnd = start + 2;
    }
  });
}

function openAddModal() {
  editingItemId = null;
  document.getElementById('modal-title').textContent = '添加到知识库';
  saveBtn.textContent = '保存条目';
  deleteBtn.classList.add('hidden');
  // Reset type to link
  modalTypeBtns.forEach(b => {
    b.classList.remove('border-primary', 'bg-surface-container', 'text-primary');
    b.classList.add('border-hairline', 'hover:bg-hairline-soft', 'text-secondary');
  });
  const linkBtn = document.querySelector('.modal-type-btn[data-type="link"]');
  if (linkBtn) {
    linkBtn.classList.add('border-primary', 'bg-surface-container', 'text-primary');
    linkBtn.classList.remove('border-hairline', 'hover:bg-hairline-soft', 'text-secondary');
  }
  resetModalForm();
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

async function openEditModal(itemId) {
  const res = await api(`/api/items/${itemId}`);
  if (!res.ok) return;
  const item = res.data;
  editingItemId = itemId;
  document.getElementById('modal-title').textContent = '编辑条目';
  saveBtn.textContent = '保存修改';
  deleteBtn.classList.remove('hidden');

  // Set type button
  modalTypeBtns.forEach(btn => {
    btn.classList.remove('border-primary', 'bg-surface-container', 'text-primary');
    btn.classList.add('border-hairline', 'hover:bg-hairline-soft', 'text-secondary');
  });
  const targetBtn = document.querySelector(`.modal-type-btn[data-type="${item.type}"]`);
  if (targetBtn) {
    targetBtn.classList.add('border-primary', 'bg-surface-container', 'text-primary');
    targetBtn.classList.remove('border-hairline', 'hover:bg-hairline-soft', 'text-secondary');
  }

  // Pre-fill fields
  titleInput.value = item.title;
  contentInput.value = item.content || '';
  urlInput.value = item.url || '';
  langSelect.value = item.language || '';
  updateFormFields(item.type);

  // Pre-fill tags
  document.querySelectorAll('#tag-input-container .tag-pill').forEach(el => el.remove());
  (item.tags || []).forEach(t => addTagPill(t.name));

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modal.classList.add('hidden');
  document.body.style.overflow = '';
}

function resetModalForm() {
  titleInput.value = '';
  contentInput.value = '';
  urlInput.value = '';
  langSelect.value = '';
  tagInput.value = '';
  autocomplete.classList.add('hidden');
  document.querySelectorAll('#tag-input-container .tag-pill').forEach(el => el.remove());
  updateFormFields('link');
}

function updateFormFields(type) {
  fieldUrl.style.display = type === 'link' ? '' : 'none';
  fieldLanguage.style.display = type === 'code' ? '' : 'none';

  const isCode = type === 'code';
  contentInput.placeholder = isCode ? '粘贴代码...' :
                             type === 'note' ? '写下你的想法...' : '摘要或描述...';
  contentInput.classList.toggle('code-editor', isCode);
  contentInput.classList.toggle('bg-canvas', !isCode);
  contentInput.classList.toggle('font-body-sm', !isCode);
  contentInput.classList.toggle('font-code', isCode);
  contentInput.rows = isCode ? 12 : 4;
}

function getSelectedTags() {
  return Array.from(document.querySelectorAll('#tag-input-container .tag-pill')).map(el => el.dataset.tag);
}

function addTagPill(name) {
  if (getSelectedTags().includes(name)) return;
  const pill = document.createElement('span');
  pill.className = 'tag-pill flex items-center gap-xxs px-sm py-1 bg-surface-cream-strong rounded-full font-caption text-caption text-ink';
  pill.dataset.tag = name;
  pill.innerHTML = `${name} <span class="material-symbols-outlined text-[14px] cursor-pointer tag-remove">close</span>`;
  pill.querySelector('.tag-remove').addEventListener('click', () => pill.remove());
  tagContainer.insertBefore(pill, tagInput);
}

// ---- Refresh tags in filter bar ----
async function refreshTags() {
  const res = await api('/api/tags');
  if (!res.ok) return;
  const container = document.getElementById('tag-filters');
  if (!container) return;
  container.innerHTML = `<span class="whitespace-nowrap px-md py-xs bg-primary text-on-primary rounded-full font-button text-button cursor-pointer" data-tag="">#全部</span>`;
  res.data.forEach(tag => {
    const el = document.createElement('span');
    el.className = 'whitespace-nowrap px-md py-xs border border-hairline text-secondary hover:border-primary hover:text-primary rounded-full font-button text-button cursor-pointer transition-all';
    el.dataset.tag = tag.name;
    el.textContent = `#${tag.name}`;
    container.appendChild(el);
  });
  // Re-attach tag filter listeners
  setupTagFilters();
}
