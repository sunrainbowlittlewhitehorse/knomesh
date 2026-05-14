// ---- State ----
const tagList = document.getElementById('tag-list');
const emptyState = document.getElementById('empty-state');
const newTagInput = document.getElementById('new-tag-input');
const createBtn = document.getElementById('btn-create-tag');

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  setupCreateTag();
  setupTagActions();
  checkEmpty();
});

// ---- API helper ----
async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  return res.json();
}

// ---- Check empty ----
function checkEmpty() {
  const items = tagList.querySelectorAll('.tag-item');
  if (items.length === 0) {
    emptyState.classList.remove('hidden');
    tagList.classList.add('hidden');
  } else {
    emptyState.classList.add('hidden');
    tagList.classList.remove('hidden');
  }
}

// ---- Create tag ----
function setupCreateTag() {
  function doCreate() {
    const name = newTagInput.value.trim();
    if (!name) return;
    createBtn.disabled = true;
    api('/api/tags', { method: 'POST', body: JSON.stringify({ name }) }).then(res => {
      if (res.ok) {
        newTagInput.value = '';
        location.reload();
      } else {
        window.showAlert(res.error || '创建失败');
      }
    }).finally(() => { createBtn.disabled = false; });
  }

  createBtn.addEventListener('click', doCreate);
  newTagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doCreate();
  });
}

// ---- Tag actions (rename, delete) ----
function setupTagActions() {
  tagList.addEventListener('click', async (e) => {
    const item = e.target.closest('.tag-item');
    if (!item) return;
    const nameEl = item.querySelector('.tag-name');
    const inputEl = item.querySelector('.tag-rename-input');
    const btnRename = item.querySelector('.btn-rename');
    const btnDelete = item.querySelector('.btn-delete');
    const btnConfirm = item.querySelector('.btn-confirm');
    const btnCancel = item.querySelector('.btn-cancel');
    const tagId = item.dataset.id;

    // Rename button → enter edit mode
    if (e.target.closest('.btn-rename')) {
      nameEl.classList.add('hidden');
      inputEl.classList.remove('hidden');
      btnRename.classList.add('hidden');
      btnDelete.classList.add('hidden');
      btnConfirm.classList.remove('hidden');
      btnCancel.classList.remove('hidden');
      inputEl.focus();
      inputEl.select();
      return;
    }

    // Confirm rename
    if (e.target.closest('.btn-confirm')) {
      const newName = inputEl.value.trim();
      if (!newName || newName === nameEl.textContent) {
        // cancel if unchanged or empty
        exitEditMode(item, nameEl, inputEl, btnRename, btnDelete, btnConfirm, btnCancel);
        return;
      }
      api(`/api/tags/${tagId}`, { method: 'PUT', body: JSON.stringify({ name: newName }) }).then(res => {
        if (res.ok) {
          nameEl.textContent = newName;
          exitEditMode(item, nameEl, inputEl, btnRename, btnDelete, btnConfirm, btnCancel);
        } else {
          window.showAlert(res.error || '重命名失败');
        }
      });
      return;
    }

    // Cancel rename
    if (e.target.closest('.btn-cancel')) {
      inputEl.value = nameEl.textContent;
      exitEditMode(item, nameEl, inputEl, btnRename, btnDelete, btnConfirm, btnCancel);
      return;
    }

    // Delete tag
    if (e.target.closest('.btn-delete')) {
      const confirmed = await window.showConfirm(`确定要删除标签 "${nameEl.textContent}" 吗？相关项目的标签关联将被移除。`);
      if (!confirmed) return;
      api(`/api/tags/${tagId}`, { method: 'DELETE' }).then(res => {
        if (res.ok) {
          item.remove();
          checkEmpty();
        } else {
          window.showAlert(res.error || '删除失败');
        }
      });
      return;
    }
  });
}

function exitEditMode(item, nameEl, inputEl, btnRename, btnDelete, btnConfirm, btnCancel) {
  nameEl.classList.remove('hidden');
  inputEl.classList.add('hidden');
  btnRename.classList.remove('hidden');
  btnDelete.classList.remove('hidden');
  btnConfirm.classList.add('hidden');
  btnCancel.classList.add('hidden');
}
