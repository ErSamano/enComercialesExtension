import { formatCurrency } from "../utils/currency.js";

export function prepareHistory(history = []) {
  return history.map((point) => ({ ...point, price: Number(point.price), date: String(point.date || "") })).filter((point) => Number.isFinite(point.price) && point.date).sort((a, b) => a.date.localeCompare(b.date));
}

function svgElement(name, attributes = {}, text = "") {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  if (text) element.textContent = text;
  return element;
}

export function buildChartModel(history = [], options = {}) {
  const points = prepareHistory(history);
  const values = points.map((point) => point.price).concat([options.currentPrice, options.average]).filter(Number.isFinite);
  if (points.length < 2 || !values.length) return { points, min: null, max: null };
  return { points, min: Math.min(...values), max: Math.max(...values) };
}

export function renderPriceHistory(container, history = [], options = {}) {
  container.replaceChildren();
  const model = buildChartModel(history, options); const points = model.points;
  if (points.length < 2) { container.textContent = "No hay suficientes datos históricos para graficar."; return; }
  const width = 320; const height = 150; const pad = { left: 48, right: 10, top: 14, bottom: 32 };
  const min = model.min; const max = model.max; const span = max - min || 1;
  const x = (index) => pad.left + index * (width - pad.left - pad.right) / Math.max(points.length - 1, 1);
  const y = (price) => pad.top + (max - price) * (height - pad.top - pad.bottom) / span;
  const svg = svgElement("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": "Precios históricos por fecha" });
  svg.append(svgElement("line", { x1: pad.left, y1: pad.top, x2: pad.left, y2: height - pad.bottom, class: "chart-axis" }));
  svg.append(svgElement("line", { x1: pad.left, y1: height - pad.bottom, x2: width - pad.right, y2: height - pad.bottom, class: "chart-axis" }));
  [max, min].forEach((price) => svg.append(svgElement("text", { x: pad.left - 6, y: y(price) + 3, "text-anchor": "end", class: "chart-label" }, formatCurrency(price, options.currency || "MXN"))));
  const reference = (price, className, label) => { if (!Number.isFinite(price)) return; const line = svgElement("line", { x1: pad.left, y1: y(price), x2: width - pad.right, y2: y(price), class: className }); line.append(svgElement("title", {}, `${label}: ${formatCurrency(price, options.currency || "MXN")}`)); svg.append(line); };
  reference(options.currentPrice, "chart-current", "Precio actual"); reference(options.average, "chart-average", "Promedio histórico");
  const path = points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(2)},${y(point.price).toFixed(2)}`).join(" ");
  svg.append(svgElement("path", { d: path, class: "chart-line" }));
  points.forEach((point, index) => { const circle = svgElement("circle", { cx: x(index), cy: y(point.price), r: 2.5, class: "chart-point" }); circle.append(svgElement("title", {}, `${point.date}: ${formatCurrency(point.price, options.currency || "MXN")}`)); svg.append(circle); });
  [0, points.length - 1].forEach((index) => svg.append(svgElement("text", { x: x(index), y: height - 10, "text-anchor": index ? "end" : "start", class: "chart-label" }, points[index].date)));
  container.append(svg);
}
