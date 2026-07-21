// strata-ai · 数学公式回退（KaTeX 不可用时启用 MathJax）
window.MathJax = {
  tex: {
    inlineMath: [['$', '$'], ['\\(', '\\)']],
    displayMath: [['$$', '$$'], ['\\[', '\\]']],
  },
  svg: { fontCache: 'global' },
};