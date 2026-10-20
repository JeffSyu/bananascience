// 1. 滾動監聽：當向下滾動超過原標頭範圍時，縮小標頭並隱藏小標題
const siteHeader = document.getElementById('siteHeader');
window.addEventListener('scroll', () => {
  if (window.scrollY > 40) {
    siteHeader.classList.add('scrolled');
  } else {
    siteHeader.classList.remove('scrolled');
  }
}, { passive: true });

// 當 simulations/[project_name]/thumbnail.png 尚未放置時，自動產生 SVG 預覽圖避免破圖
function handleThumbError(imgEl, titleText) {
  imgEl.onerror = null;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#1e3a8a"/>
      </linearGradient>
    </defs>
    <rect width="640" height="360" fill="url(#g)"/>
    <circle cx="320" cy="155" r="38" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-dasharray="6 4" opacity="0.7"/>
    <polygon points="312,140 312,170 336,155" fill="#38bdf8"/>
    <text x="320" y="235" text-anchor="middle" fill="#e2e8f0" font-family="sans-serif" font-size="22" font-weight="bold">${titleText}</text>
    <text x="320" y="265" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="13">點擊啟動互動模擬</text>
  </svg>`;
  imgEl.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

// 2. 展開／收合左側篩選群組（搭配 CSS Grid 1fr <-> 0fr 平滑動畫）
function toggleGroup(btn) {
  const group = btn.closest('.filter-group');
  const isCollapsed = group.classList.toggle('collapsed');
  btn.setAttribute('aria-expanded', String(!isCollapsed));
}

// 解析每張卡片的複數 data-category 標籤（支援空白或逗號分隔）
function getCardTags(card) {
  const raw = card.dataset.category || '';
  return raw.split(/[\s,]+/).map(t => t.trim()).filter(Boolean);
}

const cards = Array.from(document.querySelectorAll('.sim-card'));
const checkboxes = Array.from(document.querySelectorAll('.filter-sidebar input[type="checkbox"]'));
const searchInput = document.getElementById('searchInput');
const resultStats = document.getElementById('resultStats');
const activeFiltersContainer = document.getElementById('activeFilters');
const emptyState = document.getElementById('emptyState');

// 初始化計算左側每個分類標籤的教材數量
function initCategoryCounts() {
  document.querySelectorAll('[data-count-for]').forEach(countSpan => {
    const tag = countSpan.getAttribute('data-count-for');
    const count = cards.filter(card => getCardTags(card).includes(tag)).length;
    countSpan.textContent = `(${count})`;
  });
}

// 執行複合篩選（同群組內 OR 聯集、跨群組間 AND 交集 + 關鍵字搜尋）
function applyFilters() {
  const keyword = searchInput.value.trim().toLowerCase();

  // 依群組名稱 (domain, topic, grade) 整理目前已勾選的項目
  const activeGroups = {};
  const selectedCheckboxes = [];

  checkboxes.forEach(cb => {
    if (cb.checked) {
      selectedCheckboxes.push(cb);
      if (!activeGroups[cb.name]) {
        activeGroups[cb.name] = [];
      }
      activeGroups[cb.name].push(cb.value);
    }
  });

  let visibleCount = 0;

  cards.forEach(card => {
    const tags = getCardTags(card);
    const textContent = card.textContent.toLowerCase();

    // 1. 檢查關鍵字
    const matchesKeyword = !keyword || textContent.includes(keyword);

    // 2. 檢查每個有勾選的群組是否都至少符合一項 (跨群組 AND，同群組 OR)
    const matchesAllGroups = Object.values(activeGroups).every(groupSelectedValues => {
      return groupSelectedValues.some(val => tags.includes(val));
    });

    if (matchesKeyword && matchesAllGroups) {
      card.classList.remove('hidden');
      visibleCount++;
    } else {
      card.classList.add('hidden');
    }
  });

  // 更新數量與空白狀態
  resultStats.textContent = `顯示 ${visibleCount} 個模擬教材`;
  emptyState.classList.toggle('hidden', visibleCount > 0);

  // 更新上方可點擊移除的篩選條件列
  renderActiveFilterChips(selectedCheckboxes, keyword);
}

// 產生已選條件的移除按鈕
function renderActiveFilterChips(selectedCheckboxes, keyword) {
  activeFiltersContainer.innerHTML = '';

  selectedCheckboxes.forEach(cb => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'filter-chip-btn';
    chip.innerHTML = `<span>${cb.dataset.label}</span> <span aria-hidden="true">×</span>`;
    chip.title = `移除「${cb.dataset.label}」篩選條件`;
    chip.onclick = () => {
      cb.checked = false;
      applyFilters();
    };
    activeFiltersContainer.appendChild(chip);
  });

  if (selectedCheckboxes.length > 0 || keyword) {
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'clear-all-btn';
    clearBtn.textContent = '清除全部';
    clearBtn.onclick = clearAllFilters;
    activeFiltersContainer.appendChild(clearBtn);
  }
}

// 一鍵清除所有篩選條件
function clearAllFilters() {
  checkboxes.forEach(cb => (cb.checked = false));
  searchInput.value = '';
  applyFilters();
}

// 綁定監聽器
checkboxes.forEach(cb => cb.addEventListener('change', applyFilters));
searchInput.addEventListener('input', applyFilters);

// 啟動初始化
initCategoryCounts();
applyFilters();
