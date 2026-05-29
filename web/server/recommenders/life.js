// 三商美邦人壽保單推薦引擎
// 依年齡、收入、職業、規劃目標推薦保單組合 + 預算配置

const BUDGET_RANGES = {
  below_3000: { min: 1500, max: 3000, label: '3,000 元以下' },
  '3000_5000': { min: 3000, max: 5000, label: '3,000-5,000 元' },
  '5000_10000': { min: 5000, max: 10000, label: '5,000-10,000 元' },
  '10000_20000': { min: 10000, max: 20000, label: '10,000-20,000 元' },
  above_20000: { min: 20000, max: 35000, label: '20,000 元以上' },
};

// 依年齡 + 規劃目標 + 資產狀況計算預算配置（%）
function calculateAllocation(answers) {
  const { age, income, asset, planning_goals = [], tax_need, inheritance } = answers;
  const isHighAsset = income === 'above_500' || asset === '3000_10000' || asset === 'above_10000';
  const wantsTax = tax_need === 'yes_urgent' || tax_need === 'yes_consider';
  const wantsInheritance = inheritance === 'yes_plan' || inheritance === 'yes_consider';

  let alloc;
  if (age === '0-18') {
    alloc = { life: 35, medical: 40, accident: 15, saving: 10 };
  } else if (age === '19-30') {
    alloc = isHighAsset
      ? { life: 30, medical: 20, accident: 10, saving: 25, foreign: 15 }
      : { life: 40, medical: 30, accident: 20, saving: 10 };
  } else if (age === '31-50') {
    alloc = isHighAsset
      ? { life: 25, medical: 20, accident: 5, saving: 20, tax: 20, inheritance: 10 }
      : { life: 35, medical: 25, accident: 10, saving: 20, critical: 10 };
  } else if (age === '51-65') {
    alloc = isHighAsset
      ? { life: 20, medical: 20, ltc: 15, retirement: 15, tax: 20, inheritance: 10 }
      : { life: 25, medical: 25, ltc: 20, retirement: 25, accident: 5 };
  } else {
    alloc = { ltc: 35, annuity: 30, medical: 25, inheritance: 10 };
  }

  // 微調：節稅 / 傳承權重提升
  if (wantsTax && alloc.tax !== undefined) alloc.tax = Math.min(35, alloc.tax + 10);
  if (wantsInheritance && alloc.inheritance !== undefined) {
    alloc.inheritance = Math.min(25, alloc.inheritance + 5);
  }
  if (planning_goals.includes('debt_isolation')) {
    alloc.life = (alloc.life || 0) + 5;
  }

  // 歸一化到 100%
  const sum = Object.values(alloc).reduce((a, b) => a + b, 0);
  const normalized = {};
  for (const [k, v] of Object.entries(alloc)) {
    normalized[k] = Math.round((v / sum) * 100);
  }
  return normalized;
}

const ALLOCATION_LABELS = {
  life: { label: '壽險保障', color: '#1e3a5f' },
  medical: { label: '醫療險', color: '#dc2626' },
  accident: { label: '意外險', color: '#f59e0b' },
  saving: { label: '儲蓄理財', color: '#10b981' },
  critical: { label: '重大疾病險', color: '#7c3aed' },
  ltc: { label: '長照險', color: '#ec4899' },
  retirement: { label: '退休年金', color: '#06b6d4' },
  tax: { label: '節稅規劃', color: '#c9a227' },
  inheritance: { label: '傳承規劃', color: '#8b5cf6' },
  foreign: { label: '外幣配置', color: '#0ea5e9' },
  annuity: { label: '年金險', color: '#06b6d4' },
};

// 估算每月保費（給定總預算範圍 + 配置比例）
function estimatePremiums(allocation, budgetKey) {
  const range = BUDGET_RANGES[budgetKey] || BUDGET_RANGES['5000_10000'];
  const total = Math.round((range.min + range.max) / 2);
  const breakdown = {};
  for (const [key, pct] of Object.entries(allocation)) {
    breakdown[key] = Math.round((total * pct) / 100);
  }
  return { total, breakdown, range };
}

function generateRecommendations(answers) {
  const recommendations = [];

  if (answers.age === '0-18') {
    recommendations.push({
      priority: 'high',
      category: 'medical',
      title: '兒少基礎保障組合',
      products: ['金來寶小額終身壽險', '平安系列意外險', '安心醫療系列附約'],
      reason: '建立終身醫療基礎，早投保享低費率',
      features: ['保費低廉', '終身保障', '醫療附約彈性'],
      est_premium: '1,500 - 3,000 / 月',
    });
  } else if (answers.age === '19-30') {
    if (answers.income === 'below_50' || answers.budget === 'below_3000') {
      recommendations.push({
        priority: 'high',
        category: 'life',
        title: '入門高保障方案',
        products: ['安心好漾定期保險', '平安系列意外險'],
        reason: '年輕時以低保費建立高保障',
        features: ['保費便宜', '高保障額度', '可轉換終身險'],
        est_premium: '1,500 - 3,500 / 月',
      });
    } else {
      recommendations.push({
        priority: 'medium',
        category: 'saving',
        title: '青年理財儲蓄方案',
        products: ['珍吉利利率變動型增額終身壽險', '新平準終身壽險'],
        reason: '兼顧保障與資產累積',
        features: ['保障遞增', '保單價值累積', '利率變動分享'],
        est_premium: '4,000 - 8,000 / 月',
      });
    }
  } else if (answers.age === '31-50') {
    recommendations.push({
      priority: 'high',
      category: 'life',
      title: '家庭支柱保障方案',
      products: ['新富享人生還本終身保險', '金享福保本終身健康保險'],
      reason: '家庭主要收入者必備保障',
      features: ['保費返還', '重大疾病保障', '保單質借功能'],
      est_premium: '5,000 - 12,000 / 月',
    });
    if (answers.income === '200_500' || answers.income === 'above_500') {
      recommendations.push({
        priority: 'medium',
        category: 'saving',
        title: '資產增值方案',
        products: ['月月吉利利率變動型還本終身保險', '吉鑽利利率變動型還本終身保險'],
        reason: '穩定現金流 + 資產增值',
        features: ['每月生存金', '宣告利率分享', '保單質借'],
        est_premium: '8,000 - 20,000 / 月',
      });
    }
  } else if (answers.age === '51-65') {
    recommendations.push({
      priority: 'high',
      category: 'retirement',
      title: '退休準備方案',
      products: ['金萬利終身保險', '金鑽豐利利率變動型還本終身保險'],
      reason: '準備退休收入與長照規劃',
      features: ['滿期金給付', '長照銜接', '年金轉換'],
      est_premium: '8,000 - 18,000 / 月',
    });
  } else if (answers.age === '66+') {
    recommendations.push({
      priority: 'high',
      category: 'ltc',
      title: '長照與傳承方案',
      products: ['長照險系列', '年金險系列'],
      reason: '退休期醫療保障與資產傳承',
      features: ['長期照護給付', '穩定年金收入', '資產傳承'],
      est_premium: '6,000 - 15,000 / 月',
    });
  }

  const isHighAsset =
    answers.income === 'above_500' ||
    answers.asset === '3000_10000' ||
    answers.asset === 'above_10000';

  if (isHighAsset) {
    if (answers.tax_need === 'yes_urgent' || answers.tax_need === 'yes_consider') {
      recommendations.unshift({
        priority: 'high',
        category: 'tax',
        title: '⭐ 高資產節稅傳承方案（優先）',
        products: ['新吉好利利率變動型增額終身壽險', '珍吉利利率變動型增額終身壽險'],
        reason: '將應稅資產轉為保險資產，保險給付免計入遺產',
        features: ['節稅效益顯著', '保額逐年遞增', '指定受益人傳承'],
        est_premium: '15,000 - 50,000 / 月',
      });
    }
    if (answers.debt_risk === 'yes_business' || answers.debt_risk === 'yes_professional') {
      recommendations.push({
        priority: 'high',
        category: 'inheritance',
        title: '資產保護 / 債務隔離方案',
        products: ['金好運萬能終身壽險(V1)', '吉鑽利利率變動型還本終身壽險'],
        reason: '保險金原則上不得扣押，保護家族資產',
        features: ['債權隔離', '保單價值累積', '質借靈活運用'],
        est_premium: '20,000 - 60,000 / 月',
      });
    }
    if (answers.inheritance === 'yes_plan' || answers.inheritance === 'yes_consider') {
      recommendations.push({
        priority: 'medium',
        category: 'inheritance',
        title: '多世代傳承方案',
        products: ['金來寶小額終身壽險', '新富享人生還本終身保險'],
        reason: '直接指定受益人，跨代傳承節稅',
        features: ['跨代給付', '避免繼承程序', '結合家族信託'],
        est_premium: '10,000 - 30,000 / 月',
      });
    }
  }

  if (
    (answers.foreign_currency === 'yes_usd' || answers.foreign_currency === 'yes_aud') &&
    !recommendations.some((r) => r.products.includes('加美利外幣利率變動型增額終身壽險'))
  ) {
    recommendations.push({
      priority: 'low',
      category: 'foreign',
      title: '外幣資產配置方案',
      products: ['加美利外幣利率變動型增額終身壽險'],
      reason: '美元 / 澳幣資產配置，匯率避險 + 節稅',
      features: ['外幣計價', '資產分散', '節稅傳承'],
      est_premium: '8,000 - 25,000 / 月',
    });
  }

  const allocation = calculateAllocation(answers);
  const premiums = estimatePremiums(allocation, answers.budget);

  const allocationDetail = Object.entries(allocation).map(([key, pct]) => ({
    key,
    label: ALLOCATION_LABELS[key]?.label || key,
    color: ALLOCATION_LABELS[key]?.color || '#999',
    percent: pct,
    monthly: premiums.breakdown[key],
  }));

  return {
    recommendations,
    allocation: allocationDetail,
    budget: {
      label: premiums.range.label,
      total_estimate: premiums.total,
      min: premiums.range.min,
      max: premiums.range.max,
    },
    disclaimer:
      '本系統推薦僅為初步參考，實際保費、保額、給付條件與適用條款須由三商美邦人壽合格保險經紀員根據您完整的財務狀況、健康告知與需求面談後規劃。最終商品內容以保單條款為準。',
  };
}

module.exports = { generateRecommendations };
