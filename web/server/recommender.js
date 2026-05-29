// Dispatcher：人壽 + 理賠
const life = require('./recommenders/life');

function generateRecommendations(answers) {
  const type = answers.insurance_type || 'life';
  if (type === 'claim') {
    return {
      recommendations: [],
      allocation: [],
      budget: null,
      disclaimer: '本系統分析僅為初步參考，實際理賠以三商美邦人壽核保結果為準。',
    };
  }
  return life.generateRecommendations(answers);
}

module.exports = { generateRecommendations };
