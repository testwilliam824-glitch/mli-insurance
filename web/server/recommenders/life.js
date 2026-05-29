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
      products: ['三商美邦人壽好平安終身保險', '三商美邦人壽安心醫靠住院醫療定期健康保險(A型)', '三商美邦人壽漾健康終身醫療健康保險'],
      reason: '建立終身醫療基礎，早投保享低費率',
      features: ['保費低廉', '終身保障', '住院 + 手術醫療雙重保障'],
      est_premium: '1,500 - 3,000 / 月',
    });
  } else if (answers.age === '19-30') {
    if (answers.income === 'below_50' || answers.budget === 'below_3000') {
      recommendations.push({
        priority: 'high',
        category: 'life',
        title: '入門高保障方案',
        products: ['三商美邦人壽好平安終身保險', '三商美邦人壽新33醫靠醫療定期健康保險'],
        reason: '年輕時以低保費建立高保障',
        features: ['保費便宜', '高保障額度', '醫療給付彈性'],
        est_premium: '1,500 - 3,500 / 月',
      });
    } else {
      recommendations.push({
        priority: 'medium',
        category: 'saving',
        title: '青年理財儲蓄方案',
        products: ['三商美邦人壽好加倍終身保險(定期給付型)', '三商美邦人壽漾健康終身醫療健康保險'],
        reason: '兼顧保障與資產累積',
        features: ['定期生存金給付', '保單價值累積', '醫療終身保障'],
        est_premium: '4,000 - 8,000 / 月',
      });
    }
  } else if (answers.age === '31-50') {
    recommendations.push({
      priority: 'high',
      category: 'life',
      title: '家庭支柱保障方案',
      products: ['三商美邦人壽增加倍終身保險(定期給付型)', '三商美邦人壽愛關心重大傷病終身健康保險'],
      reason: '家庭主要收入者必備保障',
      features: ['保額遞增', '重大傷病一次給付', '終身壽險保障家人'],
      est_premium: '5,000 - 12,000 / 月',
    });
    if (answers.income === '200_500' || answers.income === 'above_500') {
      recommendations.push({
        priority: 'medium',
        category: 'saving',
        title: '資產增值方案',
        products: ['三商美邦人壽增吉利美元利率變動型增額終身壽險(定期給付型)', '三商美邦人壽好加倍終身保險(定期給付型)'],
        reason: '穩定現金流 + 美元資產配置',
        features: ['美元計價', '宣告利率分享', '定期生存金'],
        est_premium: '8,000 - 20,000 / 月',
      });
    }
  } else if (answers.age === '51-65') {
    recommendations.push({
      priority: 'high',
      category: 'retirement',
      title: '退休準備方案',
      products: ['三商美邦人壽珍愛樂活長期照顧終身保險', '三商美邦人壽心守健康手術醫療終身健康保險'],
      reason: '準備退休後長照需求與醫療保障',
      features: ['長照給付', '手術醫療終身保障', '退休安心'],
      est_premium: '8,000 - 18,000 / 月',
    });
  } else if (answers.age === '66+') {
    recommendations.push({
      priority: 'high',
      category: 'ltc',
      title: '長照與傳承方案',
      products: ['三商美邦人壽溢起樂活長期照顧終身保險', '三商美邦人壽守安康防癌終身健康保險'],
      reason: '退休期長照與防癌保障，並可作為資產傳承工具',
      features: ['長期照護分期給付', '罹癌一次金 + 療程金', '指定受益人傳承'],
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
        products: ['三商美邦人壽金增吉利美元利率變動型增額終身壽險(定期給付型)', '三商美邦人壽金增多利美元利率變動型增額終身壽險(定期給付型)'],
        reason: '將應稅資產轉為保險資產，保險給付依規定可享稅務優惠',
        features: ['美元計價節稅效益', '保額逐年遞增', '指定受益人傳承'],
        est_premium: '15,000 - 50,000 / 月',
      });
    }
    if (answers.debt_risk === 'yes_business' || answers.debt_risk === 'yes_professional') {
      recommendations.push({
        priority: 'high',
        category: 'inheritance',
        title: '資產保護 / 債務隔離方案',
        products: ['三商美邦人壽吉美永盛美元利率變動型終身壽險(定期給付型)', '三商美邦人壽吉美永達美元利率變動型終身壽險(定期給付型)'],
        reason: '保險金原則上不得扣押，保護家族資產',
        features: ['銀行通路規劃', '保單價值累積', '美元計價'],
        est_premium: '20,000 - 60,000 / 月',
      });
    }
    if (answers.inheritance === 'yes_plan' || answers.inheritance === 'yes_consider') {
      recommendations.push({
        priority: 'medium',
        category: 'inheritance',
        title: '多世代傳承方案',
        products: ['三商美邦人壽增加倍終身保險(定期給付型)', '三商美邦人壽好加倍終身保險(定期給付型)'],
        reason: '直接指定受益人，跨代傳承規劃',
        features: ['保額遞增', '定期生存金回流', '指定受益人'],
        est_premium: '10,000 - 30,000 / 月',
      });
    }
  }

  if (
    (answers.foreign_currency === 'yes_usd' || answers.foreign_currency === 'yes_aud') &&
    !recommendations.some((r) => r.products.some((p) => p.includes('美元')))
  ) {
    recommendations.push({
      priority: 'low',
      category: 'foreign',
      title: '外幣資產配置方案',
      products: ['三商美邦人壽增吉利美元利率變動型增額終身壽險(定期給付型)', '三商美邦人壽增多利美元利率變動型增額終身壽險(定期給付型)'],
      reason: '美元資產配置，匯率避險與長期增值',
      features: ['美元計價', '資產分散', '宣告利率分享'],
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
