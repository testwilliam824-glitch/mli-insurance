(function () {
  const TOKEN_KEY = 'mli_admin_token';

  // XSS 防護：HTML escape 所有用戶輸入
  function esc(v) {
    if (v == null) return '';
    return String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  const LABELS = {
    age: { '0-18': '0-18', '19-30': '19-30', '31-50': '31-50', '51-65': '51-65', '66+': '66+' },
    income: {
      below_50: '50 萬以下', '50_100': '50-100 萬', '100_200': '100-200 萬',
      '200_500': '200-500 萬', above_500: '500 萬+',
    },
    asset: {
      below_500: '500 萬以下', '500_1000': '500-1000 萬', '1000_3000': '1000-3000 萬',
      '3000_10000': '3000 萬-1 億', above_10000: '1 億以上',
    },
    job: {
      employee: '一般上班族', business_owner: '企業主/自營商',
      professional: '專業人士', sales: '業務/外勤', retired: '已退休',
    },
    family: {
      single: '單身', married_no_kid: '已婚無子女', married_young_kid: '已婚有未成年子女',
      married_adult_kid: '已婚子女已成年', empty_nest: '空巢期',
    },
    gender: { male: '男性', female: '女性' },
    goals: {
      protection: '基本保障', saving: '儲蓄理財', retirement: '退休規劃',
      inheritance: '遺產傳承', tax_saving: '節稅規劃', debt_isolation: '債務隔離',
    },
    existing: {
      life: '壽險', medical: '醫療險', accident: '意外險',
      cancer: '癌症險', saving: '儲蓄險', none: '無',
    },
    status: { new: '新案件', contacted: '已聯繫', closed: '已結案' },
    statusClass: { new: 'tag-new', contacted: 'tag-contacted', closed: 'tag-closed' },
    insType: { life: '💼 壽險', property: '🏠 產險', auto: '🚗 車險', claim: '📋 理賠' },
    insClass: { life: 'tag-new', property: 'tag-low', auto: 'tag-medium', claim: 'tag-high' },
  };

  let customers = [];
  let currentPage = 1;
  const PAGE_SIZE = 10;

  const $ = (s) => document.querySelector(s);

  function getToken() { return localStorage.getItem(TOKEN_KEY); }
  function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
  function clearToken() { localStorage.removeItem(TOKEN_KEY); }

  async function api(path, options = {}) {
    const opts = { ...options, headers: { ...(options.headers || {}) } };
    const token = getToken();
    if (token) opts.headers.Authorization = 'Basic ' + token;
    if (opts.body && typeof opts.body === 'object') {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(opts.body);
    }
    const res = await fetch(path, opts);
    if (res.status === 401) {
      clearToken();
      showLogin();
      throw new Error('unauthorized');
    }
    if (!res.ok) throw new Error('API error ' + res.status);
    return res.json();
  }

  function showLogin() {
    $('#loginPage').style.display = 'flex';
    $('#mainContent').classList.remove('active');
  }

  function showApp() {
    $('#loginPage').style.display = 'none';
    $('#mainContent').classList.add('active');
    loadCustomers();
  }

  async function login() {
    const username = $('#username').value.trim();
    const password = $('#password').value;
    $('#loginError').textContent = '';
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || '登入失敗');
      }
      const { token } = await res.json();
      setToken(token);
      showApp();
    } catch (e) {
      $('#loginError').textContent = e.message;
    }
  }

  function logout() {
    clearToken();
    location.reload();
  }

  async function loadCustomers() {
    try {
      const data = await api('/api/admin/customers');
      customers = (data.customers || []).sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      );
      updateStats();
      renderTable(1);
      loadLineStatus();
    } catch (e) {
      if (e.message !== 'unauthorized') console.error(e);
    }
  }

  function isHighAsset(c) {
    return c.income === 'above_500' || c.asset === '3000_10000' || c.asset === 'above_10000';
  }

  function updateStats() {
    $('#statTotal').textContent = customers.length;
    $('#statPending').textContent = customers.filter((c) => c.status === 'new').length;
    $('#statHigh').textContent = customers.filter(isHighAsset).length;
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    $('#statWeekly').textContent = customers.filter(
      (c) => new Date(c.timestamp).getTime() >= weekAgo
    ).length;
  }

  function getFiltered() {
    const q = $('#searchText').value.trim().toLowerCase();
    const type = $('#filterType').value;
    const age = $('#filterAge').value;
    const income = $('#filterIncome').value;
    const status = $('#filterStatus').value;
    return customers.filter((c) => {
      if (q && !(c.name || '').toLowerCase().includes(q) && !(c.phone || '').includes(q)) return false;
      if (type && (c.insurance_type || 'life') !== type) return false;
      if (age && c.age !== age) return false;
      if (income && c.income !== income) return false;
      if (status && c.status !== status) return false;
      return true;
    });
  }

  function renderTable(page) {
    currentPage = page;
    const filtered = getFiltered();
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageData = filtered.slice(start, start + PAGE_SIZE);

    const tbody = $('#tableBody');
    if (pageData.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" class="empty-state">尚無資料</td></tr>';
    } else {
      tbody.innerHTML = pageData.map((c) => {
        const date = new Date(c.timestamp).toLocaleString('zh-TW', { hour12: false });
        const statusTag = `<span class="tag ${LABELS.statusClass[c.status] || 'tag-new'}">${LABELS.status[c.status] || '新案件'}</span>`;
        const priority = isHighAsset(c) ? '<span class="tag tag-high">高資產</span> ' : '';
        const goals = (c.planning_goals || []).slice(0, 2).map((g) => LABELS.goals[g] || g).join('、');
        const topRec = (c.recommendations || [])[0]?.title || '-';
        return `
          <tr>
            <td>${date}</td>
            <td><span class="tag ${LABELS.insClass[c.insurance_type] || 'tag-new'}">${LABELS.insType[c.insurance_type] || '💼 壽險'}</span></td>
            <td><strong>${esc(c.name)}</strong>${c.line_user_id ? '<span class="line-badge">LINE</span>' : ''}</td>
            <td>${esc(c.phone)}</td>
            <td>${esc(LABELS.age[c.age] || c.age)}</td>
            <td>${LABELS.income[c.income] || ''}</td>
            <td>${goals}</td>
            <td>${esc(topRec)}</td>
            <td>${priority}${statusTag}</td>
            <td>
              <button class="action-btn btn-view" data-action="view" data-id="${c.id}">查看</button>
              <button class="action-btn btn-call" data-action="call" data-phone="${c.phone}">電話</button>
            </td>
          </tr>
        `;
      }).join('');
    }
    $('#totalRecords').textContent = filtered.length;
    renderPagination(totalPages);
  }

  function renderPagination(totalPages) {
    const p = $('#pagination');
    let html = `<button ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">上一頁</button>`;
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
        html += `<button class="${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
      } else if (i === currentPage - 3 || i === currentPage + 3) {
        html += '<span>...</span>';
      }
    }
    html += `<button ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">下一頁</button>`;
    p.innerHTML = html;
  }

  function viewCustomer(id) {
    const c = customers.find((x) => x.id === Number(id));
    if (!c) return;
    const item = (label, value) => `<div class="detail-item"><div class="label">${label}</div><div class="value">${value ? esc(value) : '-'}</div></div>`;
    const recsHtml = (c.recommendations || []).map((r) => `
      <div class="recommendation-card priority-${esc(r.priority)}" style="margin-bottom:12px;">
        <h4>${esc(r.title)}</h4>
        <p style="margin-top:6px;"><strong>原因：</strong>${esc(r.reason)}</p>
        <p style="margin-top:6px;"><strong>保單：</strong>${(r.products || []).map(esc).join('、')}</p>
      </div>
    `).join('') || '<p style="color:#666;">無推薦資料</p>';

    $('#modalBody').innerHTML = `
      <div class="detail-grid">
        ${item('姓名', c.name)}
        ${item('電話', c.phone)}
        ${item('Email', c.email)}
        ${item('LINE ID', c.line_id)}
        ${item('年齡', LABELS.age[c.age])}
        ${item('性別', LABELS.gender[c.gender])}
        ${item('職業', LABELS.job[c.job])}
        ${item('年收入', LABELS.income[c.income])}
        ${item('資產規模', LABELS.asset[c.asset])}
        ${item('家庭狀況', LABELS.family[c.family])}
        ${item('聯絡時間', c.contact_time || '-')}
      </div>
      <h4 style="color:var(--primary);margin-bottom:10px;">🎯 規劃目標</h4>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px;">
        ${(c.planning_goals || []).map((g) => `<span class="tag tag-medium">${esc(LABELS.goals[g] || g)}</span>`).join('') || '無'}
      </div>
      ${c.insurance_type === 'claim' ? renderClaimDetails(c) : `
      <h4 style="color:var(--primary);margin-bottom:10px;">📋 既有保單</h4>
      <p style="margin-bottom:18px;">${(c.existing_insurance || []).map((e) => esc(LABELS.existing[e] || e)).join('、') || '無'}</p>
      <h4 style="color:var(--primary);margin-bottom:10px;">🏆 系統推薦</h4>
      ${recsHtml}`}
      <div class="modal-actions">
        <button class="btn btn-primary" data-action="status" data-id="${c.id}" data-status="contacted">標記已聯繫</button>
        <button class="btn btn-secondary" data-action="status" data-id="${c.id}" data-status="closed">標記已結案</button>
        <button class="btn btn-success" data-action="call" data-phone="${c.phone}">撥打電話</button>
        ${c.line_user_id
          ? `<button class="btn btn-primary" data-action="line-push" data-id="${c.id}">💬 送 LINE 訊息</button>`
          : '<span style="font-size:12px;color:var(--muted);align-self:center;">未綁定 LINE</span>'}
      </div>
    `;
    $('#customerModal').classList.add('active');
  }

  async function updateStatus(id, status) {
    try {
      await api(`/api/admin/customers/${id}`, { method: 'PATCH', body: { status } });
      const c = customers.find((x) => x.id === Number(id));
      if (c) c.status = status;
      renderTable(currentPage);
      updateStats();
      closeModal();
    } catch (e) {
      alert('更新失敗：' + e.message);
    }
  }

  function closeModal() { $('#customerModal').classList.remove('active'); }

  const POLICY_TYPE_LABELS = {
    medical: '醫療險', accident: '意外險', life: '壽險', cancer: '癌症險',
    critical: '重大疾病險', ltc: '長照險', annuity: '年金險', saving: '儲蓄險',
    auto: '車險', property: '產險 / 住宅火險', other: '其他',
  };

  const EVENT_TYPE_LABELS = {
    illness: '🏥 疾病就醫', accident: '🚑 意外傷害',
    hospital: '🛏️ 住院手術', major: '⚠️ 重大疾病',
  };

  function renderClaimDetails(c) {
    const policies = c.policies || [];
    const files = c.uploaded_files || [];
    return `
      <h4 style="color:var(--primary);margin-bottom:10px;">📋 客戶填寫的保單 (${policies.length} 張)</h4>
      ${policies.length === 0
        ? '<p style="color:var(--muted);margin-bottom:18px;">客戶未填寫保單資訊</p>'
        : `<div style="margin-bottom:18px;display:flex;flex-direction:column;gap:8px;">
          ${policies.map((p, i) => `
            <div style="background:#f8f9fa;border-left:4px solid var(--accent);padding:12px 14px;border-radius:6px;">
              <div style="font-weight:bold;color:var(--primary);margin-bottom:4px;">保單 #${i + 1} ${p.insurer ? '· ' + esc(p.insurer) : ''}</div>
              <div style="font-size:13px;color:#555;line-height:1.7;">
                ${p.policy_number ? `保單號：<strong>${esc(p.policy_number)}</strong><br>` : ''}
                ${p.type ? `險種：${esc(POLICY_TYPE_LABELS[p.type] || p.type)}<br>` : ''}
                ${p.date ? `投保日：${esc(p.date)}<br>` : ''}
                ${p.coverage ? `保額/保障：${esc(p.coverage)}` : ''}
              </div>
            </div>
          `).join('')}
        </div>`}

      <h4 style="color:var(--primary);margin-bottom:10px;">📎 上傳檔案 (${files.length} 個)</h4>
      ${files.length === 0
        ? '<p style="color:var(--muted);margin-bottom:18px;">無上傳檔案</p>'
        : `<ul style="margin-bottom:18px;padding-left:20px;">
            ${files.map((f) => `<li style="margin:4px 0;">${esc(f.name)} <span style="color:#999;font-size:12px;">(${(f.size / 1024).toFixed(1)} KB)</span></li>`).join('')}
          </ul>`}

      <h4 style="color:var(--primary);margin-bottom:10px;">🩺 事件資訊</h4>
      <div style="background:#fff7ed;border-left:4px solid var(--warning);padding:12px 14px;border-radius:6px;margin-bottom:18px;">
        <div style="line-height:1.8;font-size:14px;">
          ${c.event_type ? `<div><strong>事件類型：</strong>${esc(EVENT_TYPE_LABELS[c.event_type] || c.event_type)}</div>` : ''}
          ${c.hospital ? `<div><strong>就醫醫院：</strong>${esc(c.hospital)}</div>` : ''}
          ${c.event_date ? `<div><strong>發生日期：</strong>${esc(c.event_date)}</div>` : ''}
          ${c.medical_cost ? `<div><strong>預估醫療費：</strong>$${Number(c.medical_cost).toLocaleString()}</div>` : ''}
          ${c.event_description ? `<div style="margin-top:8px;"><strong>事件描述：</strong><br>${esc(c.event_description)}</div>` : ''}
        </div>
      </div>
    `;
  }

  async function pushLineMessage(id) {
    const c = customers.find((x) => x.id === Number(id));
    if (!c || !c.line_user_id) return;
    const text = prompt(`要發送什麼訊息給 ${c.name}？`,
      `${c.name} 您好，關於您的保單諮詢，方便週間下午撥空電話討論嗎？`);
    if (!text) return;
    try {
      const res = await fetch(`/api/admin/customers/${id}/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Basic ' + getToken(),
        },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'push failed');
      alert('✅ 已透過 LINE 發送');
    } catch (e) {
      alert('發送失敗：' + e.message);
    }
  }

  async function loadLineStatus() {
    try {
      const data = await api('/api/admin/line/status');
      const el = $('#lineStatus');
      if (el) {
        el.textContent = data.enabled
          ? `✅ LINE 已啟用（${data.followers} 位追蹤者）`
          : '⚠️ LINE 未設定';
        el.className = data.enabled ? 'line-status on' : 'line-status off';
      }
    } catch {}
  }

  function exportCSV() {
    const filtered = getFiltered();
    const headers = ['時間', '姓名', '電話', 'Email', '年齡', '性別', '職業', '年收入', '資產', '家庭', '規劃目標', '既有保單', '推薦保單', 'LINE ID', '狀態'];
    const rows = filtered.map((c) => [
      new Date(c.timestamp).toLocaleString('zh-TW', { hour12: false }),
      c.name, c.phone, c.email || '',
      LABELS.age[c.age] || '', LABELS.gender[c.gender] || '',
      LABELS.job[c.job] || '', LABELS.income[c.income] || '',
      LABELS.asset[c.asset] || '', LABELS.family[c.family] || '',
      (c.planning_goals || []).map((g) => LABELS.goals[g] || g).join(';'),
      (c.existing_insurance || []).map((e) => LABELS.existing[e] || e).join(';'),
      (c.recommendations || []).map((r) => r.title).join(';'),
      c.line_id || '',
      LABELS.status[c.status] || c.status,
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`));
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `三商美邦客戶資料_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  }

  function bindEvents() {
    $('#loginBtn').addEventListener('click', login);
    $('#password').addEventListener('keypress', (e) => e.key === 'Enter' && login());
    $('#logoutBtn').addEventListener('click', logout);
    $('#searchBtn').addEventListener('click', () => renderTable(1));
    $('#resetBtn').addEventListener('click', () => {
      ['searchText', 'filterType', 'filterAge', 'filterIncome', 'filterStatus'].forEach((id) => { $('#' + id).value = ''; });
      renderTable(1);
    });
    $('#exportBtn').addEventListener('click', exportCSV);
    $('#reloadBtn').addEventListener('click', loadCustomers);
    $('#modalClose').addEventListener('click', closeModal);
    $('#customerModal').addEventListener('click', (e) => {
      if (e.target.id === 'customerModal') closeModal();
    });

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === 'view') viewCustomer(btn.dataset.id);
      else if (action === 'call') window.open('tel:' + btn.dataset.phone);
      else if (action === 'status') updateStatus(btn.dataset.id, btn.dataset.status);
      else if (action === 'line-push') pushLineMessage(btn.dataset.id);
    });

    $('#pagination').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-page]');
      if (btn && !btn.disabled) renderTable(Number(btn.dataset.page));
    });
  }

  function init() {
    bindEvents();
    if (getToken()) showApp();
    else showLogin();
  }

  init();
})();
