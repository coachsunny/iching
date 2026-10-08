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
    const hasUnsavedContent = (topicInput && topicInput.value.trim().length > 0) || 
                              (notesInput && notesInput.value.trim().length > 0);

    if (askConfirm && hasUnsavedContent && !currentRecordId) {
      if (!confirm('是否確認開啟新的一卦？\n（當前尚未儲存的主題與心得內容將被清空）')) {
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
          currentRecordId = resData.id;
          savedViaServer = true;
          showToast(`✅ 占卜記錄已成功保存！\n檔案已存至 records/${resData.filename || ''}`, 'success');
        }
      } catch (e) {
        // Server not reachable (如 GitHub Pages 或無後端環境)
      }

      // LocalStorage 同步備份
      saveToLocalStorage(payload);

      if (!savedViaServer) {
        showToast('✅ 記錄已成功儲存至瀏覽器本地庫存！隨時可匯出備份。', 'success');
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
      showToast('📋 已複製完整 13 項占卦 Markdown 至剪貼簿！可直接貼上至筆記。', 'success');
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

  // 建構完整的 13 項標準 Markdown 文字
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
*產生自：周易占筮與研習記事系統*
`;
  }

  // 開啟存檔資料夾 (僅本機伺服器環境支援)
  async function openRecordsFolder() {
    try {
      const res = await fetch('/api/open-folder', { method: 'POST' });
      if (res.ok) {
        showToast('📂 已於本機檔案總管開啟 records 資料夾！', 'success');
      } else {
        showToast('本機檔案總管路徑為：D:\\易經\\records', 'info');
      }
    } catch (e) {
      showToast('本機檔案總管路徑為：D:\\易經\\records', 'info');
    }
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
      try {
        const res = await fetch('/api/records');
        if (res.ok) {
          list = await res.json();
        }
      } catch (e) {
        // fallback to localStorage
        list = JSON.parse(localStorage.getItem('iching_records') || '[]');
      }

      recordsList = list;
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
          <div style="font-size: 0.8rem; color: var(--c-gold); margin-bottom: 0.4rem; font-weight: 600;">
            動爻：${rec.movingLinesNames || '無動爻'}
          </div>
          <div class="hist-notes-snip">
            💬 ${rec.notes ? rec.notes : '尚無心得筆記'}
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

  // --- 15. 提示 Toast ---
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
