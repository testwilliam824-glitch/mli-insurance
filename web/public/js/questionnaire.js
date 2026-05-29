(function () {
  const insuranceType =
    document.querySelector('meta[name="insurance-type"]')?.content || 'life';
  const answers = { insurance_type: insuranceType };
  const params = new URLSearchParams(location.search);
  const lid = params.get('lid');
  if (lid) answers.lid = lid;
  let currentQuestion = 1;
  const totalQuestions = document.querySelectorAll('.question').length;

  const LABELS = {
    age: {
      '0-18': '0-18 歲', '19-30': '19-30 歲', '31-50': '31-50 歲',
      '51-65': '51-65 歲', '66+': '66 歲以上',
      under25: '25 歲以下', '25_40': '25-40 歲', '40_60': '40-60 歲', over60: '60 歲以上',
    },
    gender: { male: '男性', female: '女性' },
    job: {
      employee: '一般上班族', business_owner: '企業主/自營商',
      professional: '專業人士', sales: '業務/外勤', retired: '已退休',
    },
    income: {
      below_50: '50 萬以下', '50_100': '50 萬-100 萬',
      '100_200': '100 萬-200 萬', '200_500': '200 萬-500 萬', above_500: '500 萬以上',
    },
    asset: {
      below_500: '500 萬以下', '500_1000': '500 萬-1000 萬',
      '1000_3000': '1000 萬-3000 萬', '3000_10000': '3000 萬-1 億', above_10000: '1 億以上',
    },
    family: {
      single: '單身', couple: '已婚 / 同居', family_kids: '有子女家庭', senior: '退休 / 空巢期',
      married_no_kid: '已婚無子女', married_young_kid: '已婚有未成年子女',
      married_adult_kid: '已婚子女已成年', empty_nest: '空巢期',
    },
    home_type: { apartment: '公寓 / 大樓', house: '透天 / 別墅', rental: '租屋族', none: '無住家保險需求' },
    property_value: {
      under_30: '30 萬以下', '30_100': '30-100 萬',
      '100_300': '100-300 萬', over_300: '300 萬以上',
    },
    vehicle_type: {
      gasoline: '⛽ 汽油 / 柴油車', hybrid: '🔋 油電混合車',
      electric: '⚡ 電動車 (EV)', motorcycle: '🏍️ 機車',
    },
    vehicle_age: {
      new: '新車 (0-1 年)', nearly_new: '近新車 (1-3 年)',
      mid: '中齡車 (3-7 年)', old: '老車 (7 年以上)',
    },
    vehicle_value: {
      under_50: '50 萬以下', '50_100': '50-100 萬',
      '100_200': '100-200 萬', over_200: '200 萬以上',
    },
    usage: {
      commute: '每日通勤', regular: '週末為主',
      occasional: '偶爾使用', commercial: '商用 / 載客',
    },
    driving: {
      newbie: '新手 (3 年以下)', experienced: '經驗豐富',
      senior: '銀髮駕駛 (65+)',
    },
    budget: {
      economy: '經濟型', standard: '標準型', premium: '尊榮型',
      below_3000: '3,000 元以下', '3000_5000': '3,000-5,000 元',
      '5000_10000': '5,000-10,000 元', '10000_20000': '10,000-20,000 元', above_20000: '20,000+ 元',
    },
    property_items_label: {
      home: '🏠 住宅', content: '📺 動產', liability: '⚖️ 責任',
      accident: '🤕 意外', travel: '✈️ 旅遊', mobile: '📱 行動裝置', pet: '🐕 寵物',
    },
  };

  const SUMMARY_FIELDS = {
    life: [
      ['年齡', 'age'], ['性別', 'gender'], ['職業', 'job'],
      ['年收入', 'income'], ['資產規模', 'asset'],
    ],
    property: [
      ['投保項目', 'property_items', 'property_items_label'],
      ['住家類型', 'home_type'], ['年齡', 'age'],
      ['家庭狀況', 'family'], ['財產規模', 'property_value'],
      ['預算', 'budget'],
    ],
    auto: [
      ['車輛類型', 'vehicle_type'], ['車齡', 'vehicle_age'],
      ['車輛市價', 'vehicle_value'], ['用車頻率', 'usage'],
      ['駕駛經驗', 'driving'], ['年齡', 'age'], ['預算', 'budget'],
    ],
  };

  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return Array.from(document.querySelectorAll(sel)); }

  function updateProgress() {
    $('#progressBar').style.width = (currentQuestion / totalQuestions) * 100 + '%';
  }

  function getQuestion(q) { return document.querySelector(`.question[data-q="${q}"]`); }

  function goToQuestion(q) {
    $$('.question').forEach((el) => el.classList.remove('active'));
    getQuestion(q).classList.add('active');
    currentQuestion = q;
    updateProgress();
    $('#nextBtn').textContent = q === totalQuestions ? '🎯 查看我的推薦方案' : '下一題 →';
    $('#prevBtn').style.display = q === 1 ? 'none' : 'block';
  }

  function bindSingleOptions() {
    $$('.question[data-type="single"]').forEach((qEl) => {
      const key = qEl.dataset.key;
      qEl.querySelectorAll('.option').forEach((opt) => {
        opt.addEventListener('click', () => {
          qEl.querySelectorAll('.option').forEach((o) => o.classList.remove('selected'));
          opt.classList.add('selected');
          opt.querySelector('input').checked = true;
          answers[key] = opt.dataset.value;
          if (currentQuestion < totalQuestions) setTimeout(nextQuestion, 220);
        });
      });
    });
  }

  function bindMultiOptions() {
    $$('.question[data-type="multi"]').forEach((qEl) => {
      qEl.querySelectorAll('.checkbox-item').forEach((item) => {
        item.addEventListener('click', () => {
          const cb = item.querySelector('input');
          cb.checked = !cb.checked;
          item.classList.toggle('checked', cb.checked);
        });
      });
    });
  }

  function collectMulti(qEl) {
    return Array.from(qEl.querySelectorAll('input:checked'))
      .map((cb) => cb.parentElement.dataset.value);
  }

  function validateCurrent() {
    const qEl = getQuestion(currentQuestion);
    const type = qEl.dataset.type;
    if (type === 'single') {
      if (!answers[qEl.dataset.key]) { alert('請選擇一個選項'); return false; }
      return true;
    }
    if (type === 'multi') {
      const vals = collectMulti(qEl);
      if (vals.length === 0) { alert('請至少選擇一個選項'); return false; }
      answers[qEl.dataset.key] = vals;
      return true;
    }
    return true;
  }

  function collectContact() {
    const name = $('#name').value.trim();
    const phone = $('#phone').value.trim();
    if (!name || !phone) { alert('請填寫姓名和電話'); return false; }
    answers.name = name;
    answers.phone = phone;
    answers.line_id = $('#line_id').value.trim();
    answers.email = $('#email').value.trim();
    answers.contact_time = $('#contact_time').value;
    return true;
  }

  function nextQuestion() {
    if (!validateCurrent()) return;
    if (currentQuestion === totalQuestions) return showResult();
    goToQuestion(currentQuestion + 1);
  }

  function prevQuestion() {
    if (currentQuestion > 1) goToQuestion(currentQuestion - 1);
  }

  async function showResult() {
    $('#questionnaire').style.display = 'none';
    $('#result').classList.add('active');
    renderProfileSummary();
    await renderRecommendations();
  }

  function formatAnswerValue(key, labelKey) {
    const val = answers[key];
    if (val == null || val === '') return '-';
    if (Array.isArray(val)) {
      const map = LABELS[labelKey || key] || {};
      return val.map((v) => map[v] || v).join('、') || '-';
    }
    const map = LABELS[labelKey || key] || {};
    return map[val] || val;
  }

  function renderProfileSummary() {
    const row = (k, v) => `<div class="profile-item"><span>${k}</span><span>${v}</span></div>`;
    const fields = SUMMARY_FIELDS[insuranceType] || SUMMARY_FIELDS.life;
    $('#profileContent').innerHTML = fields
      .map(([label, key, labelKey]) => row(label, formatAnswerValue(key, labelKey)))
      .join('');
  }

  let allocationChart = null;
  let cachedResult = null; // 第一階段拿到的推薦結果（送出後才解鎖顯示）

  async function renderRecommendations() {
    let data = { recommendations: [], allocation: [], budget: null, disclaimer: '' };
    try {
      const res = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(answers),
      });
      data = await res.json();
    } catch (e) {
      console.error('取得推薦失敗', e);
    }

    cachedResult = data;
    // Phase A：只渲染預算配置圖表 + 摘要
    renderAllocation(data.allocation || [], data.budget);
    // Phase B（推薦保單 / 免責 / CTA）延後到 submit 成功才顯示
  }

  function unlockProposal(caseId) {
    if (!cachedResult) return;
    renderRecommendationCards(cachedResult.recommendations || []);
    $('#disclaimer').textContent = cachedResult.disclaimer || '';
    if ($('#proposalId')) $('#proposalId').textContent = 'SM' + String(caseId).padStart(6, '0');

    // LINE CTA 連結：優先使用 meta tag 設定，否則 fallback
    const lineUrl =
      document.querySelector('meta[name="line-contact-url"]')?.content ||
      'https://line.me/R/ti/p/@mli-insurance';
    const btn = document.getElementById('lineContactBtn');
    if (btn) btn.href = lineUrl;

    $('#contactSection').style.display = 'none';
    $('#proposalSection').style.display = 'block';
    // 捲到建議書頂部
    setTimeout(() => $('#proposalSection').scrollIntoView({ behavior: 'smooth' }), 100);
  }

  function renderAllocation(allocation, budget) {
    if (!allocation.length) return;

    if (budget) {
      $('#allocationBudget').innerHTML =
        `依您選擇的月繳預算 <strong>${budget.label}</strong>，建議配置如下（總額約 NT$${budget.total_estimate.toLocaleString()} / 月）：`;
    }

    const tableHtml = allocation.map((a) => `
      <div class="allocation-row">
        <span class="dot" style="background:${a.color}"></span>
        <span>${a.label}</span>
        <span class="pct">${a.percent}%</span>
        <span class="money">$${a.monthly.toLocaleString()}</span>
      </div>
    `).join('');
    $('#allocationTable').innerHTML = tableHtml;

    if (typeof Chart === 'undefined') return;
    const canvas = document.getElementById('allocationChart');
    if (allocationChart) allocationChart.destroy();
    allocationChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: allocation.map((a) => `${a.label} ${a.percent}%`),
        datasets: [{
          data: allocation.map((a) => a.percent),
          backgroundColor: allocation.map((a) => a.color),
          borderWidth: 2,
          borderColor: '#fff',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 12 }, padding: 8 } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const a = allocation[ctx.dataIndex];
                return `${a.label}: ${a.percent}% (約 $${a.monthly.toLocaleString()})`;
              },
            },
          },
        },
      },
    });
  }

  function renderRecommendationCards(recs) {
    if (recs.length === 0) {
      $('#recommendations').innerHTML = '<p style="padding:20px;color:#666;">暫無推薦結果，請聯絡我們的顧問。</p>';
      return;
    }
    $('#recommendations').innerHTML = recs.map((rec, i) => `
      <div class="recommendation-card priority-${rec.priority}">
        <span class="badge">${i + 1}</span>
        <h4>${rec.title}</h4>
        <p><strong>適合原因：</strong>${rec.reason}</p>
        <p style="margin-top:10px;"><strong>推薦保單：</strong>${rec.products.join('、')}</p>
        <ul>${rec.features.map((f) => `<li>${f}</li>`).join('')}</ul>
        ${rec.est_premium ? `<div class="est-premium">💵 預估保費：${rec.est_premium}</div>` : ''}
      </div>
    `).join('');
  }

  async function submitForm(e) {
    e.preventDefault();
    if (!collectContact()) return;
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = '送出中...';
    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(answers),
      });
      if (!res.ok) throw new Error('提交失敗');
      const data = await res.json();
      unlockProposal(data.id);
    } catch (err) {
      alert('提交失敗：' + err.message);
      btn.disabled = false;
      btn.textContent = '📑 取得個人化建議書';
    }
  }

  function init() {
    bindSingleOptions();
    bindMultiOptions();
    $('#nextBtn').addEventListener('click', nextQuestion);
    $('#prevBtn').addEventListener('click', prevQuestion);
    $('#submitBtn').addEventListener('click', submitForm);
    $('#prevBtn').style.display = 'none';
    updateProgress();
  }

  init();
})();
