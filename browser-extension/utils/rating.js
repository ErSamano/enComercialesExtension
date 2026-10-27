export function ratePrice({ currentPrice, historicalAverage, historicalLow, historicalHigh, observations = 0 }) {
  if (!Number.isFinite(currentPrice) || observations < 3 || !Number.isFinite(historicalAverage)) return { category: "INSUFFICIENT DATA", reason: "No hay suficientes observaciones históricas." };
  const delta = (currentPrice - historicalAverage) / historicalAverage;
  if (Number.isFinite(historicalLow) && currentPrice <= historicalLow * 1.02) return { category: "GREAT DEAL", reason: "El precio está dentro de 2% del mínimo histórico." };
  if (delta <= -0.10) return { category: "GREAT DEAL", reason: `Está ${Math.abs(delta * 100).toFixed(1)}% por debajo del promedio histórico.` };
  if (delta <= -0.03) return { category: "GOOD DEAL", reason: `Está ${Math.abs(delta * 100).toFixed(1)}% por debajo del promedio histórico.` };
  if (delta <= 0.10) return { category: "NORMAL PRICE", reason: "Está dentro del rango normal frente al promedio histórico." };
  return { category: "EXPENSIVE", reason: `Está ${(delta * 100).toFixed(1)}% por encima del promedio histórico.` };
}
