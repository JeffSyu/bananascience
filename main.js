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

// 展開／收合左側篩選群組（搭配 CSS Grid 1fr <-> 0fr 平滑動畫）
function toggleGroup(btn) {
  const group = btn.closest('.filter-group');
  const isCollapsed = group.classList.toggle('collapsed');
  btn.setAttribute('aria-expanded', String(!isCollapsed));
}

// 解析每張卡片的複數 data-category 標籤
function getCardTags(card) {
  const raw = card.dataset.category || '';
  return raw.split(/[\s,]+/).map(t => t.trim()).filter(Boolean);
}

const filterGroupsContainer = document.getElementById('filterGroupsContainer');
const simGrid = document.getElementById('simGrid');
const searchInput = document.getElementById('searchInput');
const resultStats = document.getElementById('resultStats');
const activeFiltersContainer = document.getElementById('activeFilters');
const emptyState = document.getElementById('emptyState');
const emptyStateText = document.getElementById('emptyStateText');
const resetFilterBtn = document.getElementById('resetFilterBtn');

let checkboxes = [];
let cards = [];

// 2. 根據 JSON 自動生成左側所有篩選群組與標籤
function renderFilterGroups(filterGroupsData) {
  filterGroupsContainer.innerHTML = '';

  filterGroupsData.forEach(group => {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'filter-group';

    // 群組標題摺疊按鈕
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'group-toggle';
    toggleBtn.setAttribute('aria-expanded', 'true');
    toggleBtn.onclick = () => toggleGroup(toggleBtn);
    toggleBtn.innerHTML = `
      <span>${group.title}</span>
      <span class="chevron">▼</span>
    `;

    // 摺疊動畫外框與選項容器
    const collapseDiv = document.createElement('div');
    collapseDiv.className = 'group-collapse';

    const optionsDiv = document.createElement('div');
    optionsDiv.className = 'group-options';

    (group.options || []).forEach(opt => {
      const labelEl = document.createElement('label');
      labelEl.className = 'checkbox-label';

      const leftSpan = document.createElement('span');
      leftSpan.className = 'checkbox-left';

      const inputEl = document.createElement('input');
      inputEl.type = 'checkbox';
      inputEl.name = group.id;
      inputEl.value = opt.value;
      inputEl.dataset.label = opt.chipLabel || opt.label;
      inputEl.addEventListener('change', applyFilters);

      const textSpan = document.createElement('span');
      textSpan.textContent = opt.label;

      leftSpan.appendChild(inputEl);
      leftSpan.appendChild(textSpan);

      const countSpan = document.createElement('span');
      countSpan.className = 'item-count';
      countSpan.setAttribute('data-count-for', opt.value);
      countSpan.textContent = '(0)';

      labelEl.appendChild(leftSpan);
      labelEl.appendChild(countSpan);
      optionsDiv.appendChild(labelEl);
    });

    collapseDiv.appendChild(optionsDiv);
    groupDiv.appendChild(toggleBtn);
    groupDiv.appendChild(collapseDiv);
    filterGroupsContainer.appendChild(groupDiv);
  });

  // 更新全域核取方塊陣列
  checkboxes = Array.from(filterGroupsContainer.querySelectorAll('input[type="checkbox"]'));
}

// 3. 根據 JSON 自動建立所有模擬教材卡片
function renderCards(simsData) {
  simGrid.innerHTML = '';

  simsData.forEach(sim => {
    const categoriesStr = Array.isArray(sim.categories)
      ? sim.categories.join(' ')
      : String(sim.categories || '');

    const simUrl = sim.link || `./sims/${sim.id}/`;
    const thumbUrl = sim.thumbnail || `./simulations/${sim.id}/thumbnail.png`;

    const card = document.createElement('a');
    card.href = simUrl;
    card.className = 'sim-card';
    card.dataset.category = categoriesStr;

    const thumbWrapper = document.createElement('div');
    thumbWrapper.className = 'thumb-wrapper';

    const img = document.createElement('img');
    img.src = thumbUrl;
    img.alt = `${sim.title}操作畫面`;
    img.loading = 'lazy';
    img.onerror = () => handleThumbError(img, sim.title);

    const playOverlay = document.createElement('div');
    playOverlay.className = 'play-overlay';
    playOverlay.innerHTML = `
      <div class="play-circle" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
      </div>
    `;

    thumbWrapper.appendChild(img);
    thumbWrapper.appendChild(playOverlay);

    const cardBody = document.createElement('div');
    cardBody.className = 'card-body';

    const metaDiv = document.createElement('div');
    metaDiv.className = 'sim-meta';
    metaDiv.textContent = sim.meta || '';

    const titleH2 = document.createElement('h2');
    titleH2.className = 'sim-title';
    titleH2.textContent = sim.title || '';

    const descP = document.createElement('p');
    descP.className = 'sim-desc';
    descP.textContent = sim.desc || '';

    cardBody.appendChild(metaDiv);
    cardBody.appendChild(titleH2);
    cardBody.appendChild(descP);

    card.appendChild(thumbWrapper);
    card.appendChild(cardBody);
    simGrid.appendChild(card);
  });

  cards = Array.from(simGrid.querySelectorAll('.sim-card'));
}

// 計算左側每個分類標籤的教材數量
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

    const matchesKeyword = !keyword || textContent.includes(keyword);
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

  resultStats.textContent = `顯示 ${visibleCount} 個模擬`;
  emptyState.classList.toggle('hidden', visibleCount > 0);

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
    clearBtn.textContent = '清除';
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

// 4. 讀取 sims-data.json 並同時載入篩選欄與卡片
async function loadSimulations() {
  try {
    const response = await fetch('./sims-data.json');
    if (!response.ok) {
      throw new Error(`HTTP 錯誤碼: ${response.status}`);
    }
    const data = await response.json();

    // 相容性處理：支援新版物件結構 { filterGroups, simulations }
    const filterGroups = data.filterGroups || [];
    const simulations = Array.isArray(data) ? data : (data.simulations || []);

    renderFilterGroups(filterGroups);
    renderCards(simulations);
    initCategoryCounts();
    applyFilters();
  } catch (error) {
    console.error('無法載入 sims-data.json:', error);
    resultStats.textContent = '顯示 0 個模擬';
    emptyStateText.textContent = '無法讀取 sims-data.json 清單檔案（若在本地或雲端編輯器預覽，請使用 Live Server 開啟）。';
    resetFilterBtn.classList.add('hidden');
    emptyState.classList.remove('hidden');
  }
}

searchInput.addEventListener('input', applyFilters);
loadSimulations();