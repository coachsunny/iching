/**
 * 周易占筮與研習記事系統 - 前端核心腳本
 * 全功能包含：三枚銅錢法起卦、手動輸入、朱熹解卦指南、13項完整記錄、Markdown檔案保存、開新卦重置、備份匯入匯出
 */

(function () {
  'use strict';

  // --- 全局狀態變數 ---
  let hexagramsData = [];
  let hexagramMapByBinary = {}; // '111111' -> Hexagram object
  let recordsList = [];
  
  // 當前起卦狀態：6個爻值（初爻到上爻：索引 0~5）
  // 6: 老陰(動), 7: 少陽(靜), 8: 少陰(靜), 9: 老陽(動)
  let currentValues = [7, 7, 7, 7, 7, 7];
  let currentTossStep = 0; // 當前擲到第幾爻 (0~5)，6表示擲完
  let currentRecordId = null; // 當前記錄 ID，null 代表全新起卦

  // 爻位繁體名稱
  const YAO_POS_NAMES = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'];

  // --- 初始化入口 ---
  document.addEventListener('DOMContentLoaded', async () => {
    initDateTime();
    setupNavTabs();
    setupMethodTabs();
    setupCoinControls();
    setupManualControls();
    setupActionButtons();
    setupNewDivinationButtons();
    setupHistorySearch();
    setupImportRecords();
    setupDeepSeekSettings();
    setupAiAnalysisActions();

    await loadHexagramsData();
    populateSelectHexagramDropdown();
    populateEncyclopedia();
    await loadHistoryRecords();

    // 初始渲染
    recalculateHexagrams();
    renderCoinTrack();
  });

  // --- 1. 時間初始化 ---
  function initDateTime() {
    const dateInput = document.getElementById('input-date');
    if (dateInput) {
      resetDateToNow();
      dateInput.addEventListener('change', () => {
        updateRecordHeaderDisplays();
      });
    }

    const topicInput = document.getElementById('input-topic');
    if (topicInput) {
      topicInput.addEventListener('input', () => {
        updateRecordHeaderDisplays();
      });
    }

    const querentInput = document.getElementById('input-querent');
    if (querentInput) {
      querentInput.addEventListener('input', () => {
        updateRecordHeaderDisplays();
      });
    }
  }

  function resetDateToNow() {
    const dateInput = document.getElementById('input-date');
    if (dateInput) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      dateInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
    }
  }

  // --- 2. 導航標籤頁切換 ---
  function setupNavTabs() {
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        switchTab(targetTab);
      });
    });

    const gotoRecordBtn = document.getElementById('btn-goto-record');
    if (gotoRecordBtn) {
      gotoRecordBtn.addEventListener('click', () => {
        switchTab('tab-record');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }

  function switchTab(tabId) {
    document.querySelectorAll('.nav-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-tab') === tabId);
    });
    document.querySelectorAll('.view-section').forEach(sec => {
      sec.classList.toggle('active', sec.id === tabId);
    });
  }

  // --- 3. 開新占卦 / 清空重置功能 ---
  function setupNewDivinationButtons() {
    const btnHeader = document.getElementById('btn-new-divination-header');
    const btnForm = document.getElementById('btn-new-divination-form');
    const btnRecord = document.getElementById('btn-new-divination-record');
    const btnBottom = document.getElementById('btn-new-divination-bottom');

    [btnHeader, btnForm, btnRecord, btnBottom].forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          createNewDivination(true);
        });
      }
    });
  }

  window.createNewDivination = function(askConfirm = true) {
    const topicInput = document.getElementById('input-topic');
    const notesInput = document.getElementById('rec-val-notes');
    const aiInput = document.getElementById('rec-val-ai-analysis');
    const hasUnsavedContent = (topicInput && topicInput.value.trim().length > 0) || 
                              (notesInput && notesInput.value.trim().length > 0) ||
                              (aiInput && aiInput.value.trim().length > 0);

    if (askConfirm && hasUnsavedContent && !currentRecordId) {
      if (!confirm('是否確認開啟新的一卦？\n（當前尚未儲存的主題、心得與 AI 分析將被清空）')) {
        return;
      }
    }

    // 1. 重設 ID（防止覆蓋上一筆）
    currentRecordId = null;

    // 2. 重設時間為當前即時時間
    resetDateToNow();

    // 3. 清空主題
    if (topicInput) {
      topicInput.value = '';
    }

    // 4. 清空心得記錄
    if (notesInput) {
      notesInput.value = '';
    }

    // 4.1 清空 AI 分析與思考過程
    if (aiInput) {
      aiInput.value = '';
    }
    const aiRender = document.getElementById('ai-analysis-render');
    if (aiRender) {
      aiRender.innerHTML = `
        <div id="ai-analysis-placeholder" style="color: var(--text-light); text-align: center; padding: 2rem 1rem;">
          <div style="font-size: 2.2rem; margin-bottom: 0.4rem;">🔮</div>
          點擊上方「<strong>✨ 啟動 AI 解卦</strong>」，DeepSeek 將針對問占主題、本卦、動爻與之卦提供深刻獨到的決策反饋。<br>
          <small style="color: #a0aec0;">（初次使用請先點擊「⚙️ API 設定」輸入您的 DeepSeek API Key）</small>
        </div>
      `;
    }
    const aiReasoning = document.getElementById('ai-reasoning-details');
    if (aiReasoning) aiReasoning.style.display = 'none';
    const aiReasoningContent = document.getElementById('ai-reasoning-content');
    if (aiReasoningContent) aiReasoningContent.textContent = '';
    const aiStatusBar = document.getElementById('ai-status-bar');
    if (aiStatusBar) aiStatusBar.style.display = 'none';
    const aiBtnText = document.getElementById('ai-btn-text');
    if (aiBtnText) aiBtnText.textContent = '啟動 AI 解卦';

    // 5. 重設起卦狀態
    currentTossStep = 0;
    currentValues = [7, 7, 7, 7, 7, 7];

    // 6. 重置銅錢視覺與提示
    updateCoinVisuals(3, 3, 2);
    const promptEl = document.getElementById('toss-current-prompt');
    if (promptEl) {
      promptEl.innerHTML = `請擲「初爻」（第 1 爻）`;
    }

    // 7. 重新計算並渲染
    renderCoinTrack();
    recalculateHexagrams();
    updateRecordHeaderDisplays();

    // 8. 切換至起卦標籤頁並聚焦主題輸入框
    switchTab('tab-cast');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (topicInput) {
      setTimeout(() => topicInput.focus(), 250);
    }

    showToast('✨ 已清空重置，開啟全新占卦！請輸入問占主題。', 'success');
  };

  // --- 4. 起卦方式標籤頁切換 ---
  function setupMethodTabs() {
    const methodBtns = document.querySelectorAll('.method-btn');
    methodBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetMethod = btn.getAttribute('data-method');
        methodBtns.forEach(b => b.classList.toggle('active', b === btn));
        document.querySelectorAll('.method-content').forEach(c => {
          c.classList.toggle('active', c.id === targetMethod);
        });
      });
    });
  }

  // --- 5. 載入六十四卦數據 (全面相容 GitHub Pages、靜態離線與本地伺服器) ---
  async function loadHexagramsData() {
    try {
      let res;
      // 優先載入相對路徑（相容 GitHub Pages 與純靜態）
      try {
        res = await fetch('./data/hexagrams.json');
        if (!res.ok) throw new Error();
      } catch (e1) {
        try {
          res = await fetch('data/hexagrams.json');
          if (!res.ok) throw new Error();
        } catch (e2) {
          res = await fetch('/api/hexagrams');
        }
      }

      if (!res.ok) throw new Error('無法載入卦象資料庫');
      hexagramsData = await res.json();

      // 建立 binary -> hexagram 映射索引
      hexagramMapByBinary = {};
      hexagramsData.forEach(hex => {
        hexagramMapByBinary[hex.binary_bottom_up] = hex;
      });

      console.log('成功載入 64 卦資料，總計：', hexagramsData.length);
    } catch (err) {
      console.error('載入卦象資料失敗:', err);
      showToast('載入卦象數據庫時發生錯誤，請確認網路或檔案完整。', 'error');
    }
  }

  // 下拉選單填充 64 卦
  function populateSelectHexagramDropdown() {
    const sel = document.getElementById('select-hexagram');
    if (!sel || !hexagramsData.length) return;
    sel.innerHTML = '';
    hexagramsData.forEach(h => {
      const opt = document.createElement('option');
      opt.value = h.id;
      opt.textContent = `第${h.id}卦 ${h.symbol} ${h.palace_name} (${h.name})`;
      sel.appendChild(opt);
    });
  }

  // --- 6. 三枚銅錢起卦互動控制 ---
  function setupCoinControls() {
    const btnTossSingle = document.getElementById('btn-toss-single');
    const btnTossAll = document.getElementById('btn-toss-all');
    const btnResetToss = document.getElementById('btn-reset-toss');

    if (btnTossSingle) {
      btnTossSingle.addEventListener('click', () => {
        tossSingleLine();
      });
    }

    if (btnTossAll) {
      btnTossAll.addEventListener('click', () => {
        tossAllLines();
      });
    }

    if (btnResetToss) {
      btnResetToss.addEventListener('click', () => {
        resetToss();
      });
    }
  }

  // 擲單一爻 (3枚硬幣)
  function tossSingleLine() {
    if (currentTossStep >= 6) {
      currentTossStep = 0; // 重新開始
    }

    // 模擬銅錢動畫
    animateCoins();

    setTimeout(() => {
      // 隨機產生 3 枚硬幣 (正面3為陽，反面2為陰)
      const c1 = Math.random() < 0.5 ? 2 : 3;
      const c2 = Math.random() < 0.5 ? 2 : 3;
      const c3 = Math.random() < 0.5 ? 2 : 3;
      const sum = c1 + c2 + c3; // 6, 7, 8, 9

      updateCoinVisuals(c1, c2, c3);

      currentValues[currentTossStep] = sum;
      currentTossStep++;

      renderCoinTrack();
      recalculateHexagrams();

      // 更新提示
      const promptEl = document.getElementById('toss-current-prompt');
      if (promptEl) {
        if (currentTossStep < 6) {
          promptEl.innerHTML = `已起出第 <strong>${currentTossStep}</strong> 爻，請繼續擲第 <strong>${currentTossStep + 1}</strong> 爻（${YAO_POS_NAMES[currentTossStep]}）`;
        } else {
          promptEl.innerHTML = `🎉 <strong>六爻已全起完畢！</strong> 卦象已成，請參閱下方解卦。`;
        }
      }
    }, 400);
  }

  // 一鍵起完六爻
  function tossAllLines() {
    animateCoins();
    setTimeout(() => {
      for (let i = 0; i < 6; i++) {
        const c1 = Math.random() < 0.5 ? 2 : 3;
        const c2 = Math.random() < 0.5 ? 2 : 3;
        const c3 = Math.random() < 0.5 ? 2 : 3;
        currentValues[i] = c1 + c2 + c3;
      }
      currentTossStep = 6;
      updateCoinVisuals(
        Math.random() < 0.5 ? 2 : 3,
        Math.random() < 0.5 ? 2 : 3,
        Math.random() < 0.5 ? 2 : 3
      );
      renderCoinTrack();
      recalculateHexagrams();

      const promptEl = document.getElementById('toss-current-prompt');
      if (promptEl) {
        promptEl.innerHTML = `⚡ <strong>一鍵起卦完成！</strong> 六爻俱全，請參閱下方本卦與之卦。`;
      }
    }, 400);
  }

  function resetToss() {
    currentTossStep = 0;
    currentValues = [7, 7, 7, 7, 7, 7];
    renderCoinTrack();
    recalculateHexagrams();
    const promptEl = document.getElementById('toss-current-prompt');
    if (promptEl) {
      promptEl.innerHTML = `請擲「初爻」（第 1 爻）`;
    }
  }

  function animateCoins() {
    ['coin-1', 'coin-2', 'coin-3'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.add('coin-tossing');
        setTimeout(() => el.classList.remove('coin-tossing'), 450);
      }
    });
  }

  function updateCoinVisuals(c1, c2, c3) {
    const coins = [c1, c2, c3];
    coins.forEach((val, idx) => {
      const el = document.getElementById(`coin-${idx + 1}`);
      if (el) {
        const statusEl = el.querySelector('.coin-status');
        if (statusEl) {
          statusEl.textContent = val === 3 ? '正(3)' : '反(2)';
          statusEl.style.color = val === 3 ? 'var(--c-red)' : 'var(--text-muted)';
        }
      }
    });
  }

  // 渲染銅錢起卦的累計軌跡 (初爻在下，上爻在上)
  function renderCoinTrack() {
    const track = document.getElementById('coin-lines-track');
    if (!track) return;
    track.innerHTML = '';

    for (let i = 0; i < 6; i++) {
      const val = currentValues[i];
      const isFilled = i < currentTossStep;
      const isCurrent = i === currentTossStep;

      const row = document.createElement('div');
      row.className = `line-track-row ${isCurrent ? 'current' : ''} ${isFilled ? 'filled' : ''}`;

      let valDesc = '尚未投擲';
      let visualHtml = '<span style="color: #ccc;">- - - - - -</span>';

      if (isFilled) {
        if (val === 9) {
          valDesc = '9 老陽 (陽動 ○)';
          visualHtml = '<div class="bar-yang" style="width: 180px;"><span style="position: absolute; right: -24px; top: -3px; color: var(--c-red); font-weight: bold;">○</span></div>';
        } else if (val === 7) {
          valDesc = '7 少陽 (陽靜 ━)';
          visualHtml = '<div class="bar-yang" style="width: 180px;"></div>';
        } else if (val === 8) {
          valDesc = '8 少陰 (陰靜 - -)';
          visualHtml = '<div class="bar-yin" style="width: 180px;"><div class="bar-yin-seg"></div><div class="bar-yin-seg"></div></div>';
        } else if (val === 6) {
          valDesc = '6 老陰 (陰動 ✕)';
          visualHtml = '<div class="bar-yin" style="width: 180px;"><div class="bar-yin-seg"></div><div class="bar-yin-seg"></div></div><span style="color: var(--c-red); font-weight: bold; margin-left: 6px;">✕</span>';
        }
      }

      row.innerHTML = `
        <div class="line-pos-badge">${YAO_POS_NAMES[i]}</div>
        <div class="line-visual-preview">${visualHtml}</div>
        <div class="line-val-info" style="${val === 9 || val === 6 ? 'color: var(--c-red); font-weight: bold;' : ''}">
          ${valDesc}
        </div>
      `;

      track.appendChild(row);
    }
  }

  // --- 7. 手動輸入爻值控制 ---
  function setupManualControls() {
    const optButtons = document.querySelectorAll('.manual-opt-group .opt-btn');
    optButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const group = btn.closest('.manual-opt-group');
        group.querySelectorAll('.opt-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    const btnApplyManual = document.getElementById('btn-apply-manual');
    if (btnApplyManual) {
      btnApplyManual.addEventListener('click', () => {
        for (let pos = 1; pos <= 6; pos++) {
          const group = document.querySelector(`.manual-opt-group[data-pos="${pos}"]`);
          const activeBtn = group ? group.querySelector('.opt-btn.active') : null;
          if (activeBtn) {
            currentValues[pos - 1] = parseInt(activeBtn.getAttribute('data-val'), 10);
          }
        }
        currentTossStep = 6;
        renderCoinTrack();
        recalculateHexagrams();
        showToast('已成功套用手動輸入爻值！', 'success');
      });
    }

    // 方式三：直接指定本卦與動爻
    const btnApplySelect = document.getElementById('btn-apply-select');
    if (btnApplySelect) {
      btnApplySelect.addEventListener('click', () => {
        const selHexId = parseInt(document.getElementById('select-hexagram').value, 10);
        const hex = hexagramsData.find(h => h.id === selHexId);
        if (!hex) return;

        const checkedMoving = Array.from(document.querySelectorAll('#select-moving-checkboxes input:checked'))
          .map(cb => parseInt(cb.value, 10));

        for (let i = 0; i < 6; i++) {
          const isYang = hex.bits_bottom_up[i] === 1;
          const isMoving = checkedMoving.includes(i + 1);
          if (isYang) {
            currentValues[i] = isMoving ? 9 : 7;
          } else {
            currentValues[i] = isMoving ? 6 : 8;
          }
        }
        currentTossStep = 6;
        renderCoinTrack();
        recalculateHexagrams();
        showToast(`已指定為【${hex.palace_name}】，動爻共 ${checkedMoving.length} 個。`, 'success');
      });
    }

    // 方式四：梅花易數 (報數起卦)
    const btnApplyNumbers = document.getElementById('btn-apply-numbers');
    if (btnApplyNumbers) {
      btnApplyNumbers.addEventListener('click', () => {
        const n1 = parseInt(document.getElementById('num-1').value || '1', 10);
        const n2 = parseInt(document.getElementById('num-2').value || '1', 10);
        const n3 = parseInt(document.getElementById('num-3').value || '1', 10);

        const trigramBits = {
          1: [1, 1, 1], // 乾
          2: [1, 1, 0], // 兌
          3: [1, 0, 1], // 離
          4: [1, 0, 0], // 震
          5: [0, 1, 1], // 巽
          6: [0, 1, 0], // 坎
          7: [0, 0, 1], // 艮
          8: [0, 0, 0]  // 坤
        };

        const upperIdx = (n1 % 8) || 8;
        const lowerIdx = (n2 % 8) || 8;
        const movingPos = (n3 % 6) || 6; // 1~6

        const lowerBits = trigramBits[lowerIdx];
        const upperBits = trigramBits[upperIdx];
        const fullBits = [...lowerBits, ...upperBits];

        for (let i = 0; i < 6; i++) {
          const isYang = fullBits[i] === 1;
          const isMoving = (i + 1) === movingPos;
          if (isYang) {
            currentValues[i] = isMoving ? 9 : 7;
          } else {
            currentValues[i] = isMoving ? 6 : 8;
          }
        }

        currentTossStep = 6;
        renderCoinTrack();
        recalculateHexagrams();
        showToast(`梅花易數排盤完成：上卦第${upperIdx}、下卦第${lowerIdx}、動爻為第${movingPos}爻。`, 'success');
      });
    }
  }

  // --- 8. 核心算法：卦象計算與呈現 ---
  function recalculateHexagrams() {
    if (!hexagramsData.length) return;

    // 1. 本卦 bits (自下而上): 7,9為陽(1); 6,8為陰(0)
    const origBits = currentValues.map(v => (v === 7 || v === 9) ? 1 : 0);
    const origBinary = origBits.join('');

    // 2. 之卦 bits: 6(老陰變陽1), 7(少陽不變1), 8(少陰不變0), 9(老陽變陰0)
    const changedBits = currentValues.map(v => (v === 6 || v === 7) ? 1 : 0);
    const changedBinary = changedBits.join('');

    // 3. 動爻清單
    const movingLines = currentValues
      .map((val, idx) => ({
        pos: idx + 1,
        val: val,
        name: (origBits[idx] === 1) ? (idx === 0 ? '初九' : idx === 5 ? '上九' : `九${['', '', '二', '三', '四', '五'][idx + 1]}`)
                                    : (idx === 0 ? '初六' : idx === 5 ? '上六' : `六${['', '', '二', '三', '四', '五'][idx + 1]}`),
        isMoving: (val === 6 || val === 9)
      }))
      .filter(item => item.isMoving);

    // 查詢本卦與之卦
    const origHex = hexagramMapByBinary[origBinary] || hexagramsData[0];
    const changedHex = hexagramMapByBinary[changedBinary] || hexagramsData[0];

    // 渲染卦象對比圖 (本卦 vs 之卦)
    renderHexagramDuo(origHex, changedHex, movingLines);

    // 計算朱熹解卦方針
    const zhuxiRule = calculateZhuXiRule(origHex, changedHex, movingLines);
    const zhuxiTitleEl = document.getElementById('zhuxi-rule-title');
    const zhuxiDescEl = document.getElementById('zhuxi-rule-desc');
    if (zhuxiTitleEl && zhuxiDescEl) {
      zhuxiTitleEl.textContent = `【朱熹解卦方針 · 動爻數：${movingLines.length}】`;
      zhuxiDescEl.textContent = zhuxiRule;
    }

    // 填寫 13 項記錄表內容
    populateRecordForm(origHex, changedHex, movingLines, zhuxiRule);
  }

  // 渲染卦象視覺柱圖
  function renderHexagramDuo(origHex, changedHex, movingLines) {
    document.getElementById('disp-orig-unicode').textContent = origHex.symbol;
    document.getElementById('disp-orig-name').textContent = origHex.palace_name;
    document.getElementById('disp-orig-trigrams').textContent = `上${origHex.upper_trigram} · 下${origHex.lower_trigram}`;

    const hasMoving = movingLines.length > 0;
    document.getElementById('disp-changed-unicode').textContent = hasMoving ? changedHex.symbol : origHex.symbol;
    document.getElementById('disp-changed-name').textContent = hasMoving ? changedHex.palace_name : '無變卦';
    document.getElementById('disp-changed-trigrams').textContent = hasMoving ? `上${changedHex.upper_trigram} · 下${changedHex.lower_trigram}` : '（六爻皆靜）';
    document.getElementById('disp-moving-count').textContent = hasMoving ? `${movingLines.length} 個動爻` : '六爻安靜';

    const origStack = document.getElementById('disp-orig-stack');
    const changedStack = document.getElementById('disp-changed-stack');
    if (!origStack || !changedStack) return;

    origStack.innerHTML = '';
    changedStack.innerHTML = '';

    for (let pos = 1; pos <= 6; pos++) {
      const idx = pos - 1;
      const val = currentValues[idx];
      const isMoving = (val === 6 || val === 9);
      const isOrigYang = (val === 7 || val === 9);
      const isChangedYang = (val === 6 || val === 7);

      const origRow = document.createElement('div');
      origRow.className = `hex-line-bar ${isMoving ? 'moving' : ''}`;
      const origBarHtml = isOrigYang
        ? `<div class="bar-yang"></div>`
        : `<div class="bar-yin"><div class="bar-yin-seg"></div><div class="bar-yin-seg"></div></div>`;
      const markHtml = val === 9 ? '○' : val === 6 ? '✕' : '';

      origRow.innerHTML = `
        <span class="bar-label">${origHex.lines[idx].name}</span>
        ${origBarHtml}
        <span class="moving-mark">${markHtml}</span>
      `;
      origStack.appendChild(origRow);

      const changedRow = document.createElement('div');
      changedRow.className = 'hex-line-bar';
      const changedBarHtml = isChangedYang
        ? `<div class="bar-yang"></div>`
        : `<div class="bar-yin"><div class="bar-yin-seg"></div><div class="bar-yin-seg"></div></div>`;

      changedRow.innerHTML = `
        <span class="bar-label">${hasMoving ? changedHex.lines[idx].name : origHex.lines[idx].name}</span>
        ${changedBarHtml}
        <span class="moving-mark" style="color: transparent;">-</span>
      `;
      changedStack.appendChild(changedRow);
    }
  }

  // 朱熹占法解卦規則
  function calculateZhuXiRule(origHex, changedHex, movingLines) {
    const count = movingLines.length;
    switch (count) {
      case 0:
        return '【六爻皆不變】此卦六爻安靜。以本卦卦辭、卦意為準，體會當前整體大勢。';
      case 1:
        return `【一爻變】以本卦變爻「${movingLines[0].name}」之爻辭與爻義為主要核心斷之，此乃最重要之玄機所在！`;
      case 2:
        return `【二爻變】以本卦兩個變爻（${movingLines.map(m => m.name).join('、')}）之爻辭同看，但以較高位置之「${movingLines[1].name}」爻辭為主。`;
      case 3:
        return `【三爻變】以本卦（${origHex.palace_name}）與之卦（${changedHex.palace_name}）之卦辭合看，本卦卦辭為主，之卦卦辭為輔。`;
      case 4:
        return `【四爻變】動爻已過半，以之卦（${changedHex.palace_name}）中兩個不變爻之爻辭斷之，並以較低位置之不變爻為主。`;
      case 5:
        return `【五爻變】以之卦（${changedHex.palace_name}）中唯一的那個不變爻之爻辭斷之。`;
      case 6:
        if (origHex.id === 1) {
          return '【六爻全動 · 乾卦】乾卦六爻皆動，以「用九：見群龍无首，吉」斷之！大吉之象。';
        } else if (origHex.id === 2) {
          return '【六爻全動 · 坤卦】坤卦六爻皆動，以「用六：利永貞」斷之！純柔化剛之象。';
        } else {
          return `【六爻全變】本卦事物已全盤顛覆轉化，以之卦（${changedHex.palace_name}）之卦辭斷之！`;
        }
      default:
        return '以本卦卦辭與動爻爻辭合參。';
    }
  }

  // --- 9. 填充 13 項標準占卦記錄表 ---
  function populateRecordForm(origHex, changedHex, movingLines, zhuxiRule) {
    const dateInput = document.getElementById('input-date');
    const topicInput = document.getElementById('input-topic');
    const querentInput = document.getElementById('input-querent');

    const formattedDate = dateInput ? dateInput.value.replace('T', ' ') : new Date().toLocaleString();
    const topic = topicInput && topicInput.value.trim() ? topicInput.value.trim() : '（未填寫主題）';
    const querent = querentInput && querentInput.value.trim() ? querentInput.value.trim() : '本人';

    // 1. 占卜日期
    document.getElementById('rec-val-date').textContent = formattedDate;
    // 2. 占卜主題
    document.getElementById('rec-val-topic').textContent = topic;
    // 3. 占卜者
    document.getElementById('rec-val-querent').textContent = querent;

    // 4. 本卦卦名
    document.getElementById('rec-val-orig-name').textContent = `${origHex.symbol} ${origHex.palace_name}（${origHex.name}）`;

    // 5. 動爻
    const movingNames = movingLines.length > 0
      ? movingLines.map(m => m.name).join('、')
      : '無動爻（六爻安靜）';
    document.getElementById('rec-val-moving-lines').textContent = movingNames;

    // 6. 之卦卦名
    const hasMoving = movingLines.length > 0;
    document.getElementById('rec-val-changed-name').textContent = hasMoving
      ? `${changedHex.symbol} ${changedHex.palace_name}（${changedHex.name}）`
      : '無變卦';

    // 7. 本卦卦詞
    document.getElementById('rec-val-orig-guaci').textContent = origHex.guaci;
    const origDaxiangEl = document.getElementById('rec-val-orig-daxiang');
    if (origHex.daxiang) {
      origDaxiangEl.style.display = 'block';
      origDaxiangEl.textContent = `象曰：${origHex.daxiang}`;
    } else {
      origDaxiangEl.style.display = 'none';
    }

    // 8. 本卦卦意
    document.getElementById('rec-val-orig-guayi').textContent = origHex.guayi || '暫無白話卦意資料';

    // 9. 動爻爻詞 & 10. 動爻爻義
    const yaociContainer = document.getElementById('rec-val-moving-yaoci-container');
    const yaoyiContainer = document.getElementById('rec-val-moving-yaoyi-container');
    yaociContainer.innerHTML = '';
    yaoyiContainer.innerHTML = '';

    if (!hasMoving) {
      yaociContainer.innerHTML = `<div class="item-content" style="color: var(--text-muted);">六爻安靜，以本卦卦辭為主。</div>`;
      yaoyiContainer.innerHTML = `<div class="item-content" style="color: var(--text-muted);">六爻安靜，事態平穩或依循本卦之大勢發展，著重參酌本卦卦辭與卦意。</div>`;
    } else {
      movingLines.forEach(item => {
        const lineObj = origHex.lines[item.pos - 1];

        const yaociCard = document.createElement('div');
        yaociCard.className = 'yao-item-card';
        yaociCard.innerHTML = `
          <div class="yao-card-header">
            <span class="yao-card-name">【${lineObj.name}】</span>
            <span class="badge-jixiong ${lineObj.ji_xiong === '吉' ? 'badge-ji' : lineObj.ji_xiong === '凶' ? 'badge-xiong' : 'badge-zhong'}">
              趨勢：${lineObj.ji_xiong || '中'} ${lineObj.trend || ''}
            </span>
          </div>
          <div class="yao-ci-text">${lineObj.full_yaoci || (lineObj.name + '：' + lineObj.yaoci)}</div>
          ${lineObj.xiang ? `<div class="yao-xiang-text">象曰：${lineObj.xiang}</div>` : ''}
        `;
        yaociContainer.appendChild(yaociCard);

        const yaoyiCard = document.createElement('div');
        yaoyiCard.className = 'yao-item-card';
        yaoyiCard.innerHTML = `
          <div class="yao-card-header">
            <span class="yao-card-name">【${lineObj.name} 爻義深度解析】</span>
            <span class="item-tag">${lineObj.type === '陽' ? '陽爻變陰' : '陰爻變陽'}</span>
          </div>
          <div class="yao-yi-text">${lineObj.yaoyi || '暫無白話爻義資料'}</div>
        `;
        yaoyiContainer.appendChild(yaoyiCard);
      });
    }

    // 11. 之卦卦詞 & 12. 之卦卦意
    const changedGuaciEl = document.getElementById('rec-val-changed-guaci');
    const changedDaxiangEl = document.getElementById('rec-val-changed-daxiang');
    const changedGuayiEl = document.getElementById('rec-val-changed-guayi');

    if (!hasMoving) {
      changedGuaciEl.textContent = '（無動爻，無之卦）';
      changedDaxiangEl.style.display = 'none';
      changedGuayiEl.textContent = '（無動爻，無之卦）';
    } else {
      changedGuaciEl.textContent = changedHex.guaci;
      if (changedHex.daxiang) {
        changedDaxiangEl.style.display = 'block';
        changedDaxiangEl.textContent = `象曰：${changedHex.daxiang}`;
      } else {
        changedDaxiangEl.style.display = 'none';
      }
      changedGuayiEl.textContent = changedHex.guayi || '暫無白話卦意資料';
    }
  }

  function updateRecordHeaderDisplays() {
    const dateInput = document.getElementById('input-date');
    const topicInput = document.getElementById('input-topic');
    const querentInput = document.getElementById('input-querent');

    if (dateInput) {
      document.getElementById('rec-val-date').textContent = dateInput.value.replace('T', ' ');
    }
    if (topicInput) {
      document.getElementById('rec-val-topic').textContent = topicInput.value.trim() || '（未填寫主題）';
    }
    if (querentInput) {
      document.getElementById('rec-val-querent').textContent = querentInput.value.trim() || '本人';
    }
  }

  // --- 10. 儲存與匯出功能 ---
  function setupActionButtons() {
    const btnSaveTop = document.getElementById('btn-save-record');
    const btnSaveBottom = document.getElementById('btn-save-record-bottom');
    if (btnSaveTop) btnSaveTop.addEventListener('click', saveCurrentRecord);
    if (btnSaveBottom) btnSaveBottom.addEventListener('click', saveCurrentRecord);

    const btnCopyMd = document.getElementById('btn-copy-markdown');
    if (btnCopyMd) btnCopyMd.addEventListener('click', copyMarkdownToClipboard);

    const btnDownloadMd = document.getElementById('btn-download-markdown');
    if (btnDownloadMd) btnDownloadMd.addEventListener('click', downloadMarkdownFile);

    const btnPrint = document.getElementById('btn-print');
    if (btnPrint) btnPrint.addEventListener('click', () => window.print());

    const btnOpenFolder = document.getElementById('btn-open-folder');
    if (btnOpenFolder) btnOpenFolder.addEventListener('click', openRecordsFolder);

    const btnExportAll = document.getElementById('btn-export-all');
    if (btnExportAll) btnExportAll.addEventListener('click', exportAllRecordsJson);
  }

  // 匯總當前記錄數據物件
  function getCurrentRecordPayload() {
    const origBits = currentValues.map(v => (v === 7 || v === 9) ? 1 : 0);
    const changedBits = currentValues.map(v => (v === 6 || v === 7) ? 1 : 0);
    const origHex = hexagramMapByBinary[origBits.join('')] || hexagramsData[0];
    const changedHex = hexagramMapByBinary[changedBits.join('')] || hexagramsData[0];

    const movingLines = currentValues
      .map((val, idx) => ({
        pos: idx + 1,
        val: val,
        name: (origBits[idx] === 1) ? (idx === 0 ? '初九' : idx === 5 ? '上九' : `九${['', '', '二', '三', '四', '五'][idx + 1]}`)
                                    : (idx === 0 ? '初六' : idx === 5 ? '上六' : `六${['', '', '二', '三', '四', '五'][idx + 1]}`),
        isMoving: (val === 6 || val === 9)
      }))
      .filter(item => item.isMoving);

    const hasMoving = movingLines.length > 0;
    const zhuxiRule = calculateZhuXiRule(origHex, changedHex, movingLines);

    const dateVal = document.getElementById('rec-val-date').textContent.trim();
    const topicVal = document.getElementById('input-topic').value.trim() || '未定主題';
    const querentVal = document.getElementById('input-querent').value.trim() || '本人';
    const notesVal = document.getElementById('rec-val-notes').value.trim();

    let movingYaociText = '';
    let movingYaoyiText = '';
    if (!hasMoving) {
      movingYaociText = '六爻安靜，以本卦卦辭為主。';
      movingYaoyiText = '六爻安靜，事態平穩或依循本卦之大勢發展，著重參酌本卦卦辭與卦意。';
    } else {
      movingLines.forEach(item => {
        const l = origHex.lines[item.pos - 1];
        movingYaociText += `【${l.name}】${l.yaoci}${l.xiang ? ` (象曰：${l.xiang})` : ''}\n`;
        movingYaoyiText += `【${l.name}】${l.yaoyi}\n\n`;
      });
      movingYaociText = movingYaociText.trim();
      movingYaoyiText = movingYaoyiText.trim();
    }

    const diagramLines = [];
    for (let i = 5; i >= 0; i--) {
      const v = currentValues[i];
      const isY = (v === 7 || v === 9);
      const origBar = isY ? '━━━━━━━' : '━━━ ━━━';
      const mark = v === 9 ? ' (老陽○)' : v === 6 ? ' (老陰✕)' : '';
      const chY = (v === 6 || v === 7);
      const chBar = chY ? '━━━━━━━' : '━━━ ━━━';
      diagramLines.push(`${origHex.lines[i].name}: ${origBar}${mark}  ➔  ${chBar}`);
    }

    return {
      id: currentRecordId || ('rec_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)),
      date: dateVal,
      topic: topicVal,
      querent: querentVal,
      originalHexName: `${origHex.symbol} ${origHex.palace_name}（${origHex.name}）`,
      movingLinesNames: hasMoving ? movingLines.map(m => m.name).join('、') : '無動爻（六爻安靜）',
      changedHexName: hasMoving ? `${changedHex.symbol} ${changedHex.palace_name}（${changedHex.name}）` : '無變卦',
      originalGuaci: origHex.guaci + (origHex.daxiang ? `\n\n大象傳：${origHex.daxiang}` : ''),
      originalGuayi: origHex.guayi,
      movingYaoci: movingYaociText,
      movingYaoyi: movingYaoyiText,
      changedGuaci: hasMoving ? (changedHex.guaci + (changedHex.daxiang ? `\n\n大象傳：${changedHex.daxiang}` : '')) : '（無動爻，無之卦）',
      changedGuayi: hasMoving ? changedHex.guayi : '（無動爻，無之卦）',
      notes: notesVal,
      aiAnalysis: (document.getElementById('rec-val-ai-analysis')?.value || '').trim(),
      zhuxiRule: zhuxiRule,
      hexagramDiagram: diagramLines.join('\n'),
      values: [...currentValues]
    };
  }

  // 儲存記錄 (寫入本地 Markdown 檔案與資料庫)
  async function saveCurrentRecord() {
    const payload = getCurrentRecordPayload();

    try {
      let savedViaServer = false;
      try {
        const res = await fetch('/api/records', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const resData = await res.json();
          savedViaServer = true;
          showToast(`✅ 占卜記錄已成功保存！\n已存至 records/${resData.filename || ''} 與歷史檔案庫`, 'success');
        }
      } catch (e) {
        // Server not reachable (如 GitHub Pages 或無後端環境)
      }

      // 重要：標記當前占卦已成功存檔，防止開新卦時誤判為未儲存
      currentRecordId = payload.id;

      // LocalStorage 同步備份
      saveToLocalStorage(payload);

      if (!savedViaServer) {
        showToast('✅ 占卜記錄已成功存入「歷史紀錄匣」！隨時可載入覆盤，亦可點「匯出 .md」下載檔案。', 'success');
      }

      // 重新載入歷史列表
      await loadHistoryRecords();
    } catch (err) {
      console.error('儲存失敗:', err);
      showToast('儲存時發生錯誤: ' + err.message, 'error');
    }
  }

  // LocalStorage 備份處理
  function saveToLocalStorage(record) {
    try {
      let localRecords = JSON.parse(localStorage.getItem('iching_records') || '[]');
      const idx = localRecords.findIndex(r => r.id === record.id);
      if (idx >= 0) {
        localRecords[idx] = record;
      } else {
        localRecords.unshift(record);
      }
      localStorage.setItem('iching_records', JSON.stringify(localRecords));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }

  // 複製 Markdown 到剪貼簿
  function copyMarkdownToClipboard() {
    const payload = getCurrentRecordPayload();
    const md = buildMarkdownText(payload);
    navigator.clipboard.writeText(md).then(() => {
      showToast('📋 已複製完整 14 項占卦 Markdown 至剪貼簿！可直接貼上至筆記。', 'success');
    }).catch(() => {
      showToast('複製失敗，請手動選取文字。', 'error');
    });
  }

  // 下載 Markdown 檔案
  function downloadMarkdownFile() {
    const payload = getCurrentRecordPayload();
    const md = buildMarkdownText(payload);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeTopic = (payload.topic || '占卜').replace(/[\\/:*?"<>|]/g, '_');
    a.href = url;
    a.download = `${payload.date.slice(0, 10)}_${safeTopic}_易經占卦記錄.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('📥 Markdown 檔案已開始下載！', 'success');
  }

  // 建構完整的 14 項標準 Markdown 文字
  function buildMarkdownText(p) {
    return `# 易經占卜記錄表

---

### 1. 占卜日期:
${p.date}

### 2. 占卜主題:
${p.topic}

### 3. 占卜者:
${p.querent}

---

### 4. 本卦卦名:
${p.originalHexName}

### 5. 動爻:
${p.movingLinesNames}

### 6. 之卦卦名:
${p.changedHexName}

> **【卦象圖解】**
${p.hexagramDiagram.split('\n').map(l => '> ' + l).join('\n')}

> **【解卦方針】** ${p.zhuxiRule}

---

### 7. 本卦卦詞:
${p.originalGuaci}

### 8. 本卦卦意:
${p.originalGuayi}

---

### 9. 動爻爻詞:
${p.movingYaoci}

### 10. 動爻爻義:
${p.movingYaoyi}

---

### 11. 之卦卦詞:
${p.changedGuaci}

### 12. 之卦卦意:
${p.changedGuayi}

---

### 13. 心得記錄:
${p.notes || '（暫無心得筆記）'}

---

### 14. DeepSeek AI 智慧解卦分析:
${p.aiAnalysis || '（尚未進行 AI 分析）'}

---
*產生自：周易占筮與研習記事系統*
`;
  }

  // 開啟存檔資料夾 (僅本機伺服器環境支援)
  async function openRecordsFolder() {
    try {
      const res = await fetch('/api/open-folder', { method: 'POST' });
      if (res.ok) {
        showToast('📂 已於本機檔案總管開啟 records 資料夾！', 'success');
        return;
      }
    } catch (e) {}
    showToast('💡 提示：本機資料夾為 D:\\易經\\records (需啟動 node server.js)；在 GitHub Pages 上可直接點擊「匯出備份 (JSON)」或在個別紀錄中點擊「匯出 .md」下載檔案。', 'info');
  }

  // 備份全部 JSON
  function exportAllRecordsJson() {
    const jsonStr = JSON.stringify(recordsList, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `易經占卜全歷史備份_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📦 全歷史紀錄備份 JSON 已匯出下載！', 'success');
  }

  // --- 11. 匯入紀錄功能 (支援跨設備、跨平台資料同步) ---
  function setupImportRecords() {
    const btnImport = document.getElementById('btn-import-records');
    const fileInput = document.getElementById('input-import-file');

    if (btnImport && fileInput) {
      btnImport.addEventListener('click', () => {
        fileInput.value = '';
        fileInput.click();
      });

      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          importRecordsFromJson(file);
        }
      });
    }
  }

  function importRecordsFromJson(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (!Array.isArray(imported)) {
          throw new Error('格式錯誤：JSON 內容必須為紀錄陣列');
        }

        let localRecords = JSON.parse(localStorage.getItem('iching_records') || '[]');
        let addCount = 0;

        for (const item of imported) {
          if (!item.id) continue;
          const idx = localRecords.findIndex(r => r.id === item.id);
          if (idx < 0) {
            localRecords.push(item);
            addCount++;
          }
          // 若本機伺服器在線，同步寫入本機硬碟 records/
          try {
            await fetch('/api/records', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item)
            });
          } catch (err) {}
        }

        localStorage.setItem('iching_records', JSON.stringify(localRecords));
        await loadHistoryRecords();
        showToast(`✅ 匯入成功！共導入 ${addCount} 筆新紀錄（現有總計 ${recordsList.length} 筆）。`, 'success');
      } catch (err) {
        showToast('匯入失敗：' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  }

  // --- 12. 歷史紀錄匣管理 ---
  async function loadHistoryRecords() {
    try {
      let list = [];
      let loadedFromServer = false;

      // 1. 若本地伺服器在線，嘗試從伺服器讀取
      try {
        const res = await fetch('/api/records');
        if (res.ok) {
          const serverList = await res.json();
          if (Array.isArray(serverList)) {
            list = serverList;
            loadedFromServer = true;
            // 同步快取至 localStorage 作為雙重備份
            if (list.length > 0) {
              localStorage.setItem('iching_records', JSON.stringify(list));
            }
          }
        }
      } catch (e) {
        // 伺服器離線 (例如純靜態環境、GitHub Pages 或無網路)
      }

      // 2. 若未成功自伺服器取得資料 (例如 GitHub Pages 回傳 404)，自動從瀏覽器 localStorage 讀取
      if (!loadedFromServer || !Array.isArray(list) || list.length === 0) {
        try {
          const localStr = localStorage.getItem('iching_records');
          if (localStr) {
            const parsed = JSON.parse(localStr);
            if (Array.isArray(parsed) && parsed.length > 0) {
              list = parsed;
            }
          }
        } catch (e) {
          console.warn('LocalStorage 解析失敗:', e);
        }
      }

      recordsList = Array.isArray(list) ? list : [];
      const countEl = document.getElementById('history-count');
      if (countEl) countEl.textContent = recordsList.length;
      renderHistoryGrid(recordsList);
    } catch (err) {
      console.warn('讀取歷史紀錄異常:', err);
    }
  }

  function setupHistorySearch() {
    const searchInput = document.getElementById('hist-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const kw = e.target.value.toLowerCase().trim();
        if (!kw) {
          renderHistoryGrid(recordsList);
          return;
        }
        const filtered = recordsList.filter(r => {
          return (r.topic || '').toLowerCase().includes(kw) ||
                 (r.querent || '').toLowerCase().includes(kw) ||
                 (r.originalHexName || '').toLowerCase().includes(kw) ||
                 (r.changedHexName || '').toLowerCase().includes(kw) ||
                 (r.notes || '').toLowerCase().includes(kw) ||
                 (r.aiAnalysis || '').toLowerCase().includes(kw) ||
                 (r.date || '').includes(kw);
        });
        renderHistoryGrid(filtered);
      });
    }
  }

  function renderHistoryGrid(list) {
    const grid = document.getElementById('history-grid');
    const emptyEl = document.getElementById('history-empty');
    if (!grid) return;

    grid.innerHTML = '';
    if (!list || list.length === 0) {
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';

    list.forEach(rec => {
      const card = document.createElement('div');
      card.className = 'history-card';

      card.innerHTML = `
        <div>
          <div class="hist-header">
            <span class="hist-date">📅 ${rec.date || ''}</span>
            <span class="hist-querent">👤 ${rec.querent || '本人'}</span>
          </div>
          <div class="hist-topic">${rec.topic || '未命題'}</div>
          <div class="hist-hex-summary">
            <span>${rec.originalHexName || ''}</span>
            <span>➔</span>
            <span>${rec.changedHexName || '無變卦'}</span>
          </div>
          <div style="font-size: 0.8rem; color: var(--c-gold); margin-bottom: 0.4rem; font-weight: 600; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;">
            <span>動爻：${rec.movingLinesNames || '無動爻'}</span>
            ${rec.aiAnalysis ? `<span class="badge" style="background:#e0edff; color:#2563eb; font-size:0.72rem;">🤖 含 AI 解卦</span>` : ''}
          </div>
          <div class="hist-notes-snip">
            💬 ${rec.notes ? rec.notes : (rec.aiAnalysis ? '【AI 分析已就緒】' : '尚無心得筆記')}
          </div>
        </div>
        <div class="hist-card-footer">
          <span style="color: var(--text-light); font-size: 0.75rem;">點擊載入覆盤</span>
          <button class="btn-icon-danger" title="刪除此紀錄" onclick="event.stopPropagation(); deleteRecord('${rec.id}')">
            🗑️ 刪除
          </button>
        </div>
      `;

      card.addEventListener('click', () => {
        loadRecordIntoView(rec);
      });

      grid.appendChild(card);
    });
  }

  // 載入歷史記錄至當前編輯區
  window.loadRecordIntoView = function (rec) {
    currentRecordId = rec.id;
    if (rec.values && Array.isArray(rec.values)) {
      currentValues = [...rec.values];
    }

    // 填回輸入欄
    if (rec.date) {
      const d = document.getElementById('input-date');
      if (d) d.value = rec.date.replace(' ', 'T').slice(0, 16);
    }
    if (rec.topic) {
      const t = document.getElementById('input-topic');
      if (t) t.value = rec.topic;
    }
    if (rec.querent) {
      const q = document.getElementById('input-querent');
      if (q) q.value = rec.querent;
    }
    if (rec.notes) {
      const n = document.getElementById('rec-val-notes');
      if (n) n.value = rec.notes;
    }

    // 填回 AI 分析欄位
    const aiTextarea = document.getElementById('rec-val-ai-analysis');
    const aiRender = document.getElementById('ai-analysis-render');
    const aiVal = (rec.aiAnalysis || '').trim();
    if (aiTextarea) {
      aiTextarea.value = aiVal;
    }
    if (aiRender) {
      if (aiVal) {
        aiRender.innerHTML = renderSimpleMarkdown(aiVal);
      } else {
        aiRender.innerHTML = `
          <div id="ai-analysis-placeholder" style="color: var(--text-light); text-align: center; padding: 2rem 1rem;">
            <div style="font-size: 2.2rem; margin-bottom: 0.4rem;">🔮</div>
            點擊上方「<strong>✨ 啟動 AI 解卦</strong>」，DeepSeek 將針對問占主題、本卦、動爻與之卦提供深刻獨到的決策反饋。<br>
            <small style="color: #a0aec0;">（初次使用請先點擊「⚙️ API 設定」輸入您的 DeepSeek API Key）</small>
          </div>
        `;
      }
    }
    const aiReasoning = document.getElementById('ai-reasoning-details');
    if (aiReasoning) aiReasoning.style.display = 'none';
    const aiReasoningContent = document.getElementById('ai-reasoning-content');
    if (aiReasoningContent) aiReasoningContent.textContent = '';
    const aiStatusBar = document.getElementById('ai-status-bar');
    if (aiStatusBar) aiStatusBar.style.display = 'none';
    const aiBtnText = document.getElementById('ai-btn-text');
    if (aiBtnText) aiBtnText.textContent = aiVal ? '重新執行 AI 解卦' : '啟動 AI 解卦';

    currentTossStep = 6;
    renderCoinTrack();
    recalculateHexagrams();

    // 跳轉至結果記錄頁
    switchTab('tab-record');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast(`已載入歷史占筮【${rec.topic}】`, 'success');
  };

  // 刪除歷史記錄
  window.deleteRecord = async function (id) {
    if (!confirm('確定要刪除這筆占卜紀錄嗎？此操作將同時移除對應的本地 Markdown 存檔。')) {
      return;
    }

    try {
      try {
        await fetch(`/api/records/${id}`, { method: 'DELETE' });
      } catch (e) {}

      let localRecords = JSON.parse(localStorage.getItem('iching_records') || '[]');
      localRecords = localRecords.filter(r => r.id !== id);
      localStorage.setItem('iching_records', JSON.stringify(localRecords));

      if (currentRecordId === id) {
        currentRecordId = null;
      }

      showToast('紀錄已成功刪除', 'success');
      await loadHistoryRecords();
    } catch (e) {
      showToast('刪除失敗: ' + e.message, 'error');
    }
  };

  // --- 13. 六十四卦全典卡片 ---
  function populateEncyclopedia() {
    const grid = document.getElementById('encyclopedia-grid');
    if (!grid || !hexagramsData.length) return;
    grid.innerHTML = '';

    hexagramsData.forEach(h => {
      const card = document.createElement('div');
      card.className = 'ency-item';
      card.innerHTML = `
        <div class="ency-symbol">${h.symbol}</div>
        <div class="ency-name">${h.name}</div>
        <div class="ency-palace">${h.palace_name}</div>
      `;
      card.addEventListener('click', () => {
        currentRecordId = null; // 檢視卦典不當作編輯紀錄
        currentValues = h.bits_bottom_up.map(b => b === 1 ? 7 : 8);
        currentTossStep = 6;
        renderCoinTrack();
        recalculateHexagrams();
        switchTab('tab-record');
        showToast(`已檢視第${h.id}卦【${h.palace_name}】`, 'success');
      });
      grid.appendChild(card);
    });
  }

  // --- 14. 心得範本快捷插入 ---
  window.insertNoteTemplate = function (type) {
    const notesEl = document.getElementById('rec-val-notes');
    if (!notesEl) return;

    let template = '';
    const nowStr = new Date().toLocaleDateString('zh-TW');

    if (type === 'first_thought') {
      template = `\n\n【占卦感悟 - ${nowStr}】\n· 心境狀態：\n· 卦象呼應：\n· 核心提醒：`;
    } else if (type === 'action_plan') {
      template = `\n\n【決策行動方針 - ${nowStr}】\n· 應為（適合之舉）：\n· 忌為（防範之失）：\n· 關鍵時間節點：`;
    } else if (type === 'outcome_review') {
      template = `\n\n【事後應驗覆盤 - ${nowStr}】\n· 事態後續發展：\n· 卦象爻辭應驗之處：\n· 易道心得總結：`;
    }

    notesEl.value = (notesEl.value ? notesEl.value.trim() : '') + template;
    notesEl.focus();
  };

  window.setTopic = function (t) {
    const topicInput = document.getElementById('input-topic');
    if (topicInput) {
      topicInput.value = t;
      updateRecordHeaderDisplays();
    }
  };

  // --- 15. DeepSeek AI 智慧解卦整合 ---
  let isAiGenerating = false;
  let isAiEditing = false;

  function setupDeepSeekSettings() {
    const modal = document.getElementById('modal-ai-settings');
    const btnSettings = document.getElementById('btn-ai-settings');
    const btnClose = document.getElementById('btn-close-ai-modal');
    const btnSave = document.getElementById('btn-save-deepseek-settings');
    const btnTest = document.getElementById('btn-test-deepseek');
    const btnToggleKey = document.getElementById('btn-toggle-key-visibility');

    const inputKey = document.getElementById('input-deepseek-key');
    const selectModel = document.getElementById('select-deepseek-model');
    const inputUrl = document.getElementById('input-deepseek-url');

    // 初始載入設定並更新標籤
    updateAiModelBadge();

    function openModal() {
      if (inputKey) inputKey.value = localStorage.getItem('deepseek_api_key') || '';
      if (selectModel) selectModel.value = localStorage.getItem('deepseek_model') || 'deepseek-chat';
      if (inputUrl) inputUrl.value = localStorage.getItem('deepseek_base_url') || 'https://api.deepseek.com';
      if (inputKey) inputKey.type = 'password';
      if (btnToggleKey) btnToggleKey.textContent = '👁️';
      if (modal) modal.style.display = 'flex';
    }

    function closeModal() {
      if (modal) modal.style.display = 'none';
    }

    if (btnSettings) btnSettings.addEventListener('click', openModal);
    if (btnClose) btnClose.addEventListener('click', closeModal);

    // 點擊背景遮罩關閉
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
    }

    // 密碼顯示/隱藏切換
    if (btnToggleKey && inputKey) {
      btnToggleKey.addEventListener('click', () => {
        if (inputKey.type === 'password') {
          inputKey.type = 'text';
          btnToggleKey.textContent = '🙈';
        } else {
          inputKey.type = 'password';
          btnToggleKey.textContent = '👁️';
        }
      });
    }

    // 儲存設定
    if (btnSave) {
      btnSave.addEventListener('click', () => {
        const key = (inputKey ? inputKey.value : '').trim();
        const model = selectModel ? selectModel.value : 'deepseek-chat';
        let url = (inputUrl ? inputUrl.value : '').trim() || 'https://api.deepseek.com';
        url = url.replace(/\/+$/, '');

        localStorage.setItem('deepseek_api_key', key);
        localStorage.setItem('deepseek_model', model);
        localStorage.setItem('deepseek_base_url', url);

        updateAiModelBadge();
        closeModal();
        showToast('✅ DeepSeek API 設定已成功儲存！', 'success');
      });
    }

    // 測試連線
    if (btnTest) {
      btnTest.addEventListener('click', async () => {
        const key = (inputKey ? inputKey.value : '').trim();
        const model = selectModel ? selectModel.value : 'deepseek-chat';
        let url = (inputUrl ? inputUrl.value : '').trim() || 'https://api.deepseek.com';
        url = url.replace(/\/+$/, '');

        if (!key) {
          showToast('請先輸入 API Key 再進行連線測試', 'error');
          if (inputKey) inputKey.focus();
          return;
        }

        const spinner = document.getElementById('test-key-spinner');
        const text = document.getElementById('test-key-text');
        if (spinner) spinner.style.display = 'inline-block';
        if (text) text.textContent = '連線測試中...';
        btnTest.disabled = true;

        try {
          await testDeepSeekConnection(key, url, model);
          showToast('🎉 連線測試成功！API Key 授權正常運作。', 'success');
        } catch (err) {
          showToast('❌ 連線測試失敗：' + err.message, 'error');
        } finally {
          if (spinner) spinner.style.display = 'none';
          if (text) text.textContent = '🔌 測試連線';
          btnTest.disabled = false;
        }
      });
    }
  }

  function updateAiModelBadge() {
    const badge = document.getElementById('ai-model-badge');
    if (!badge) return;
    const model = localStorage.getItem('deepseek_model') || 'deepseek-chat';
    const hasKey = !!(localStorage.getItem('deepseek_api_key') || '').trim();

    if (model === 'deepseek-reasoner') {
      badge.textContent = hasKey ? 'DeepSeek-R1 (深度推演)' : 'DeepSeek-R1 (未設金鑰)';
      badge.style.background = '#4f46e5';
    } else {
      badge.textContent = hasKey ? 'DeepSeek-V3 (解卦通達)' : 'DeepSeek-V3 (未設金鑰)';
      badge.style.background = 'var(--c-blue)';
    }
  }

  async function testDeepSeekConnection(apiKey, baseUrl, model) {
    const endpoint = `${baseUrl}/chat/completions`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: 'Ping' }],
        max_tokens: 5
      })
    });

    if (!res.ok) {
      let errMsg = `HTTP ${res.status}`;
      try {
        const data = await res.json();
        if (data.error && data.error.message) errMsg = data.error.message;
      } catch (e) {}
      if (res.status === 401) {
        errMsg = 'API Key 無效或未授權，請核對金鑰。';
      } else if (res.status === 402) {
        errMsg = 'DeepSeek 帳戶額度不足，請至控制台充值。';
      }
      throw new Error(errMsg);
    }
    return true;
  }

  function setupAiAnalysisActions() {
    const btnRun = document.getElementById('btn-run-ai');
    const btnCopy = document.getElementById('btn-copy-ai');
    const btnToggleEdit = document.getElementById('btn-toggle-ai-edit');

    if (btnRun) {
      btnRun.addEventListener('click', runDeepSeekAnalysis);
    }

    if (btnCopy) {
      btnCopy.addEventListener('click', () => {
        const val = (document.getElementById('rec-val-ai-analysis')?.value || '').trim();
        if (!val) {
          showToast('目前尚無可複製的 AI 分析內容', 'info');
          return;
        }
        navigator.clipboard.writeText(val).then(() => {
          showToast('📋 AI 解卦分析內容已成功複製至剪貼簿！', 'success');
        }).catch(() => {
          showToast('複製失敗，請手動複製', 'error');
        });
      });
    }

    if (btnToggleEdit) {
      btnToggleEdit.addEventListener('click', () => {
        const textarea = document.getElementById('rec-val-ai-analysis');
        const render = document.getElementById('ai-analysis-render');
        if (!textarea || !render) return;

        isAiEditing = !isAiEditing;
        if (isAiEditing) {
          textarea.style.display = 'block';
          render.style.display = 'none';
          btnToggleEdit.innerHTML = '<span>👁️</span> 預覽';
          textarea.focus();
        } else {
          const val = textarea.value.trim();
          if (val) {
            render.innerHTML = renderSimpleMarkdown(val);
          } else {
            render.innerHTML = `
              <div id="ai-analysis-placeholder" style="color: var(--text-light); text-align: center; padding: 2rem 1rem;">
                <div style="font-size: 2.2rem; margin-bottom: 0.4rem;">🔮</div>
                點擊上方「<strong>✨ 啟動 AI 解卦</strong>」，DeepSeek 將針對問占主題、本卦、動爻與之卦提供深刻獨到的決策反饋。<br>
                <small style="color: #a0aec0;">（初次使用請先點擊「⚙️ API 設定」輸入您的 DeepSeek API Key）</small>
              </div>
            `;
          }
          textarea.style.display = 'none';
          render.style.display = 'block';
          btnToggleEdit.innerHTML = '<span>✏️</span> 編輯';
        }
      });
    }
  }

  // 執行 DeepSeek AI 解卦分析串流連線
  async function runDeepSeekAnalysis() {
    if (isAiGenerating) return;

    const apiKey = (localStorage.getItem('deepseek_api_key') || '').trim();
    if (!apiKey) {
      const modal = document.getElementById('modal-ai-settings');
      if (modal) modal.style.display = 'flex';
      showToast('請先輸入並儲存您的 DeepSeek API Key 才能啟動 AI 解卦！', 'info');
      return;
    }

    const payload = getCurrentRecordPayload();
    const btnRun = document.getElementById('btn-run-ai');
    const btnIcon = document.getElementById('ai-btn-icon');
    const btnText = document.getElementById('ai-btn-text');
    const statusBar = document.getElementById('ai-status-bar');
    const statusText = document.getElementById('ai-status-text');
    const textarea = document.getElementById('rec-val-ai-analysis');
    const render = document.getElementById('ai-analysis-render');
    const reasoningDetails = document.getElementById('ai-reasoning-details');
    const reasoningContent = document.getElementById('ai-reasoning-content');

    const model = localStorage.getItem('deepseek_model') || 'deepseek-chat';
    let baseUrl = (localStorage.getItem('deepseek_base_url') || 'https://api.deepseek.com').trim();
    baseUrl = baseUrl.replace(/\/+$/, '');

    // 切回預覽模式
    if (isAiEditing && textarea && render) {
      isAiEditing = false;
      textarea.style.display = 'none';
      render.style.display = 'block';
      const btnToggleEdit = document.getElementById('btn-toggle-ai-edit');
      if (btnToggleEdit) btnToggleEdit.innerHTML = '<span>✏️</span> 編輯';
    }

    // UI 進入載入狀態
    isAiGenerating = true;
    if (btnRun) btnRun.disabled = true;
    if (btnIcon) btnIcon.textContent = '⏳';
    if (btnText) btnText.textContent = 'AI 解卦研析中...';
    if (statusBar) statusBar.style.display = 'flex';
    if (statusText) statusText.textContent = '連線至 DeepSeek API，正在深度研析卦象...';

    if (textarea) textarea.value = '';
    if (render) {
      render.innerHTML = `
        <div style="color: var(--c-blue); text-align: center; padding: 2rem 1rem;">
          <span class="spinner" style="margin-right: 8px;"></span>
          DeepSeek 正在即時推演卦象、爻變與決策義理...
        </div>
      `;
    }

    if (model === 'deepseek-reasoner') {
      if (reasoningDetails) {
        reasoningDetails.style.display = 'block';
        reasoningDetails.open = true;
      }
      if (reasoningContent) reasoningContent.textContent = '';
    } else {
      if (reasoningDetails) reasoningDetails.style.display = 'none';
    }

    const { systemPrompt, userPrompt } = buildDeepSeekPrompt(payload);

    let fullContent = '';
    let fullReasoning = '';

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          stream: true
        })
      });

      if (!response.ok) {
        let errMsg = `HTTP ${response.status}`;
        try {
          const errData = await response.json();
          if (errData.error && errData.error.message) errMsg = errData.error.message;
        } catch (e) {}

        if (response.status === 401) {
          errMsg = 'API Key 無效或未授權，請至「API 設定」重新檢查金鑰。';
        } else if (response.status === 402) {
          errMsg = 'DeepSeek 帳戶餘額不足，請至 DeepSeek 開放平台儲值。';
        } else if (response.status === 429) {
          errMsg = 'API 請求頻率過高或伺服器忙碌，請稍候重試。';
        }
        throw new Error(errMsg);
      }

      if (statusText) statusText.textContent = 'DeepSeek 正在即時串流輸出解卦剖析...';

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // 保留尚未結尾的一行

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const dataStr = trimmed.replace(/^data:\s*/, '');
          if (dataStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(dataStr);
            const delta = parsed.choices?.[0]?.delta;
            if (delta) {
              // DeepSeek-R1 思考過程
              if (delta.reasoning_content) {
                fullReasoning += delta.reasoning_content;
                if (reasoningContent) reasoningContent.textContent = fullReasoning;
              }
              // 正式回覆內容
              if (delta.content) {
                fullContent += delta.content;
                if (textarea) textarea.value = fullContent;
                if (render) render.innerHTML = renderSimpleMarkdown(fullContent);
              }
            }
          } catch (e) {
            // 忽略單個 chunk 解析例外
          }
        }
      }

      // 處理緩衝區殘餘
      if (buffer.trim()) {
        const trimmed = buffer.trim();
        if (trimmed.startsWith('data:')) {
          const dataStr = trimmed.replace(/^data:\s*/, '');
          if (dataStr !== '[DONE]') {
            try {
              const parsed = JSON.parse(dataStr);
              const delta = parsed.choices?.[0]?.delta;
              if (delta?.content) {
                fullContent += delta.content;
                if (textarea) textarea.value = fullContent;
                if (render) render.innerHTML = renderSimpleMarkdown(fullContent);
              }
            } catch (e) {}
          }
        }
      }

      showToast('🎉 DeepSeek AI 解卦分析完成！請檢閱並點擊「保存占卜記錄」。', 'success');

    } catch (err) {
      console.error('DeepSeek AI 呼叫失敗:', err);
      showToast('AI 解卦失敗：' + err.message, 'error');
      if (!fullContent && render) {
        render.innerHTML = `
          <div style="color: var(--c-red); padding: 1.5rem; text-align: center; line-height: 1.8;">
            <div style="font-size: 1.8rem; margin-bottom: 0.3rem;">⚠️</div>
            <strong>呼叫 DeepSeek API 發生錯誤</strong><br>
            <span style="font-size: 0.88rem; color: #718096;">${escapeHtml(err.message)}</span><br>
            <small style="color: var(--text-muted); display: block; margin-top: 0.5rem;">
              請點擊上方「<strong>⚙️ API 設定</strong>」檢查金鑰是否正確，或確認您的 DeepSeek 帳戶額度。
            </small>
          </div>
        `;
      }
    } finally {
      isAiGenerating = false;
      if (btnRun) btnRun.disabled = false;
      if (btnIcon) btnIcon.textContent = '✨';
      if (btnText) btnText.textContent = fullContent ? '重新執行 AI 解卦' : '啟動 AI 解卦';
      if (statusBar) statusBar.style.display = 'none';
    }
  }

  // 構造 DeepSeek 占筮大師提示詞 (Prompt)
  function buildDeepSeekPrompt(p) {
    const systemPrompt = `你是一位深諳《周易》哲理與義理象數的國學智慧大師兼現代決策思維顧問。
求卦者為現代人，請根據其提出的「占卜主題」、起得的「本卦」、「動爻」及「之卦」，並參酌《易經》古籍本義（卦名、彖辭、大象傳、爻辭）與朱熹占法方針，為求卦者提供深邃、通透且具體切實的解析與引導。

回答架構請包含以下四大部分：
### 一、 全局象意與當前局勢
- 剖析本卦的卦象、天地時位與大勢象徵。
- 本卦如何精準呼應求卦者當下面臨的主題問題或心境處境。

### 二、 動爻機微與關鍵轉折
- 深入剖析動爻（若六爻安靜無動爻，則就本卦卦辭核心發揮）。
- 揭示吉凶悔吝的樞紐所在、當前可能隱藏的盲點或轉化關鍵。

### 三、 之卦趨向與長遠演變
- 闡述經由爻變後，事態朝向之卦的可能走向與中長期態勢（若無之卦，則說明事態循序漸進之穩態）。
- 提醒事物發展的必然邏輯。

### 四、 現代決策指引與心法策略
- 【應為之良策】：具體可落實的正面行動、適合的心態調整。
- 【忌為之防患】：必須提防的失誤、戒忌與處事地雷。
- 【易道寄語】：一句賦予洞察、定力與信心的精要總結。

風格要求：請使用傳統繁體中文回答，條理分明、文辭雅正溫暖，不流於虛無玄學，旨在啟發智慧與提供高價值之決策參考。`;

    const userPrompt = `請大師為我解卦：

【占卜者】：${p.querent || '本人'}
【占卜時間】：${p.date}
【占卜主題】：${p.topic || '（未具體指明主題）'}

【本卦】：${p.originalHexName}
- 卦辭：${p.originalGuaci}
- 卦意：${p.originalGuayi}

【動爻變機】：${p.movingLinesNames}
- 動爻爻辭：${p.movingYaoci}
- 動爻爻義：${p.movingYaoyi}

【之卦趨向】：${p.changedHexName}
- 之卦卦辭：${p.changedGuaci}
- 之卦卦意：${p.changedGuayi}

【解卦方針參考】：${p.zhuxiRule}
${p.notes ? `【求卦者個人心得/備註】：\n${p.notes}` : ''}

請依據上述卦象與《周易》義理，為我提供深度剖析與行動決策指引。`;

    return { systemPrompt, userPrompt };
  }

  // 輕量級 Markdown 格式化解析器 (相容無外部依賴環境)
  function renderSimpleMarkdown(md) {
    if (!md) return '';
    const lines = md.split('\n');
    let html = '';
    let inList = false;
    let listType = '';
    let inBlockquote = false;

    function closeList() {
      if (inList) {
        html += `</${listType}>\n`;
        inList = false;
        listType = '';
      }
    }

    function closeBlockquote() {
      if (inBlockquote) {
        html += `</blockquote>\n`;
        inBlockquote = false;
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 引文區塊
      if (line.startsWith('> ')) {
        closeList();
        if (!inBlockquote) {
          html += `<blockquote style="border-left: 4px solid var(--c-blue); background: #f0f6ff; padding: 0.6rem 1rem; margin: 0.8rem 0; border-radius: 0 var(--radius-sm) var(--radius-sm) 0; color: #1e3a8a;">`;
          inBlockquote = true;
        }
        html += `<p style="margin: 0.2rem 0;">${formatInlineMd(line.substring(2))}</p>\n`;
        continue;
      } else {
        closeBlockquote();
      }

      // 標題
      if (line.startsWith('#### ')) {
        closeList();
        html += `<h5 style="margin: 1rem 0 0.35rem; color: var(--c-ink); font-size: 1.05rem; font-weight: 700;">${formatInlineMd(line.substring(5))}</h5>\n`;
        continue;
      }
      if (line.startsWith('### ')) {
        closeList();
        html += `<h4 style="margin: 1.25rem 0 0.5rem; color: var(--c-blue); font-size: 1.15rem; font-weight: 700; border-bottom: 1px dashed #cfe2ff; padding-bottom: 0.3rem;">${formatInlineMd(line.substring(4))}</h4>\n`;
        continue;
      }
      if (line.startsWith('## ')) {
        closeList();
        html += `<h3 style="margin: 1.4rem 0 0.6rem; color: var(--c-ink); font-size: 1.28rem; font-weight: 700; border-left: 4px solid var(--c-blue); padding-left: 0.5rem;">${formatInlineMd(line.substring(3))}</h3>\n`;
        continue;
      }
      if (line.startsWith('# ')) {
        closeList();
        html += `<h2 style="margin: 1.5rem 0 0.7rem; color: var(--c-ink); font-size: 1.4rem; font-weight: 700;">${formatInlineMd(line.substring(2))}</h2>\n`;
        continue;
      }

      // 水平分割線
      if (/^(\-{3,}|\*{3,})$/.test(line.trim())) {
        closeList();
        html += `<hr style="margin: 1.2rem 0; border: 0; border-top: 1px solid #e2e8f0;">\n`;
        continue;
      }

      // 無序清單 (* 或 -)
      const ulMatch = line.match(/^(\s*)([-*])\s+(.+)$/);
      if (ulMatch) {
        if (!inList || listType !== 'ul') {
          closeList();
          html += `<ul style="margin: 0.5rem 0; padding-left: 1.6rem; line-height: 1.8;">\n`;
          inList = true;
          listType = 'ul';
        }
        html += `<li style="margin-bottom: 0.3rem;">${formatInlineMd(ulMatch[3])}</li>\n`;
        continue;
      }

      // 有序清單 (1. 2. 等)
      const olMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
      if (olMatch) {
        if (!inList || listType !== 'ol') {
          closeList();
          html += `<ol style="margin: 0.5rem 0; padding-left: 1.6rem; line-height: 1.8;">\n`;
          inList = true;
          listType = 'ol';
        }
        html += `<li style="margin-bottom: 0.3rem;">${formatInlineMd(olMatch[2])}</li>\n`;
        continue;
      }

      closeList();

      const trimmed = line.trim();
      if (!trimmed) {
        html += `<div style="height: 0.45rem;"></div>\n`;
        continue;
      }

      html += `<p style="margin: 0.45rem 0; line-height: 1.85;">${formatInlineMd(line)}</p>\n`;
    }

    closeList();
    closeBlockquote();
    return html;
  }

  function formatInlineMd(text) {
    let s = escapeHtml(text);
    // 粗體 **text**
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong style="color: var(--c-ink); font-weight: 700;">$1</strong>');
    // 斜體 *text*
    s = s.replace(/\*([^*]+?)\*/g, '<em style="color: var(--text-muted);">$1</em>');
    // 行內代碼 `code`
    s = s.replace(/`([^`]+?)`/g, '<code style="background: #edf2f7; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 0.9em; color: var(--c-red);">$1</code>');
    return s;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // --- 16. 提示 Toast ---
  function showToast(msg, type = 'info') {
    const oldToast = document.querySelector('.toast-msg');
    if (oldToast) oldToast.remove();

    const toast = document.createElement('div');
    toast.className = `toast-msg ${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 3500);
  }

})();
