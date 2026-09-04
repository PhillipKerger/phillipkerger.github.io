(function () {
  "use strict";

  const defaults = {
    c: [3, 2],
    constraints: [
      { a: 1, b: 1, rhs: 6 },
      { a: 2, b: 1, rhs: 8 },
      { a: 1, b: 3, rhs: 12 }
    ],
    k: 13.6,
    kMax: 27.2
  };

  const colors = ["#4a67b2", "#b04b55", "#7c5aa6"];
  const margin = { left: 64, right: 32, top: 24, bottom: 56 };
  const width = 720;
  const height = 590;
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const EPS = 1e-7;
  let state = JSON.parse(JSON.stringify(defaults));

  const svgNS = "http://www.w3.org/2000/svg";
  const $ = (id) => document.getElementById(id);

  function svgElement(name, attrs, text) {
    const el = document.createElementNS(svgNS, name);
    Object.entries(attrs || {}).forEach(([key, value]) => el.setAttribute(key, value));
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function format(value, digits = 2) {
    if (!Number.isFinite(value)) return "—";
    const rounded = Math.abs(value) < EPS ? 0 : Number(value.toFixed(digits));
    return String(rounded);
  }

  function readNumber(id, fallback) {
    const value = Number($(id).value);
    return Number.isFinite(value) ? value : fallback;
  }

  function buildConstraintInputs() {
    const container = $("constraint-inputs");
    container.innerHTML = "";
    state.constraints.forEach((constraint, index) => {
      const row = document.createElement("div");
      row.className = "lp-row constraint-row";
      row.innerHTML = `
        <span class="row-label">constraint ${index + 1}</span>
        <span class="expression">
          <label><span class="sr-only">Coefficient of x 1 in constraint ${index + 1}</span><input id="a${index}" type="number" step="0.25" value="${constraint.a}"></label>
          <i>x</i><sub>1</sub>
          <span class="operator">+</span>
          <label><span class="sr-only">Coefficient of x 2 in constraint ${index + 1}</span><input id="b${index}" type="number" step="0.25" value="${constraint.b}"></label>
          <i>x</i><sub>2</sub>
          <span class="relation">≤</span>
          <label><span class="sr-only">Right hand side of constraint ${index + 1}</span><input class="rhs" id="rhs${index}" type="number" step="0.25" value="${constraint.rhs}"></label>
        </span>`;
      container.appendChild(row);
    });
  }

  function syncInputsFromState() {
    $("c1").value = state.c[0];
    $("c2").value = state.c[1];
    state.constraints.forEach((constraint, index) => {
      $("a" + index).value = constraint.a;
      $("b" + index).value = constraint.b;
      $("rhs" + index).value = constraint.rhs;
    });
    $("k-slider").value = state.k;
    $("k-slider").max = state.kMax;
    $("k-max").value = state.kMax;
  }

  function readForm() {
    state.c = [readNumber("c1", state.c[0]), readNumber("c2", state.c[1])];
    state.constraints = state.constraints.map((old, index) => ({
      a: readNumber("a" + index, old.a),
      b: readNumber("b" + index, old.b),
      rhs: readNumber("rhs" + index, old.rhs)
    }));
    state.k = readNumber("k-slider", state.k);
    state.kMax = Math.max(0.1, readNumber("k-max", state.kMax));
    if (state.k > state.kMax) state.k = state.kMax;
  }

  function inequalities() {
    return [
      ...state.constraints,
      { a: -1, b: 0, rhs: 0 },
      { a: 0, b: -1, rhs: 0 }
    ];
  }

  function intersection(first, second) {
    const det = first.a * second.b - second.a * first.b;
    if (Math.abs(det) < EPS) return null;
    return {
      x: (first.rhs * second.b - second.rhs * first.b) / det,
      y: (first.a * second.rhs - second.a * first.rhs) / det
    };
  }

  function isFeasible(point) {
    return inequalities().every((line) => line.a * point.x + line.b * point.y <= line.rhs + 1e-6);
  }

  function uniquePoints(points) {
    return points.filter((point, index) => points.findIndex((other) => Math.hypot(point.x - other.x, point.y - other.y) < 1e-5) === index);
  }

  function feasibleVertices() {
    const lines = inequalities();
    const points = [];
    for (let i = 0; i < lines.length; i += 1) {
      for (let j = i + 1; j < lines.length; j += 1) {
        const point = intersection(lines[i], lines[j]);
        if (point && isFeasible(point)) points.push(point);
      }
    }
    return uniquePoints(points);
  }

  function hasFeasibleRecessionDirection(improvingOnly) {
    for (let degree = 0; degree <= 90; degree += 0.125) {
      const radians = degree * Math.PI / 180;
      const dx = Math.cos(radians);
      const dy = Math.sin(radians);
      const respectsConstraints = state.constraints.every((line) => line.a * dx + line.b * dy <= 1e-6);
      const improves = state.c[0] * dx + state.c[1] * dy > 1e-6;
      if (respectsConstraints && (!improvingOnly || improves)) return true;
    }
    return false;
  }

  function solve() {
    const vertices = feasibleVertices();
    const originFeasible = isFeasible({ x: 0, y: 0 });
    if (!vertices.length && !originFeasible) return { type: "infeasible", vertices: [] };
    if (hasFeasibleRecessionDirection(true)) return { type: "unbounded", vertices };
    if (!vertices.length) return { type: "no-vertex", vertices: [] };
    const values = vertices.map((point) => state.c[0] * point.x + state.c[1] * point.y);
    const optimum = Math.max(...values);
    const optimalVertices = vertices.filter((point, index) => Math.abs(values[index] - optimum) < 1e-5);
    return { type: "finite", vertices, optimum, optimalVertices };
  }

  function clipPolygon(polygon, line) {
    const result = [];
    for (let i = 0; i < polygon.length; i += 1) {
      const current = polygon[i];
      const previous = polygon[(i + polygon.length - 1) % polygon.length];
      const currentValue = line.a * current.x + line.b * current.y - line.rhs;
      const previousValue = line.a * previous.x + line.b * previous.y - line.rhs;
      const currentInside = currentValue <= EPS;
      const previousInside = previousValue <= EPS;
      if (currentInside !== previousInside) {
        const t = previousValue / (previousValue - currentValue);
        result.push({
          x: previous.x + t * (current.x - previous.x),
          y: previous.y + t * (current.y - previous.y)
        });
      }
      if (currentInside) result.push(current);
    }
    return result;
  }

  function graphBounds(solution) {
    const xCandidates = [5];
    const yCandidates = [5];
    state.constraints.forEach((line) => {
      if (line.a > EPS && line.rhs / line.a > 0) xCandidates.push(line.rhs / line.a);
      if (line.b > EPS && line.rhs / line.b > 0) yCandidates.push(line.rhs / line.b);
    });
    solution.vertices.forEach((point) => {
      xCandidates.push(point.x);
      yCandidates.push(point.y);
    });
    if (state.c[0] > EPS) xCandidates.push(state.kMax / state.c[0]);
    if (state.c[1] > EPS) yCandidates.push(state.kMax / state.c[1]);

    const rawXMax = Math.min(100, Math.max(...xCandidates) * 1.1);
    const rawYMax = Math.min(100, Math.max(...yCandidates) * 1.1);
    const pixelsPerUnit = Math.min(innerWidth / rawXMax, innerHeight / rawYMax);
    return {
      xMax: innerWidth / pixelsPerUnit,
      yMax: innerHeight / pixelsPerUnit
    };
  }

  function polygonPoints(polygon, scales) {
    return polygon.map((point) => `${scales.x(point.x)},${scales.y(point.y)}`).join(" ");
  }

  function lineSegmentInBox(line, bounds) {
    const edges = [
      { a: 1, b: 0, rhs: 0 }, { a: 1, b: 0, rhs: bounds.xMax },
      { a: 0, b: 1, rhs: 0 }, { a: 0, b: 1, rhs: bounds.yMax }
    ];
    const points = edges.map((edge) => intersection(line, edge)).filter((point) => point && point.x >= -EPS && point.x <= bounds.xMax + EPS && point.y >= -EPS && point.y <= bounds.yMax + EPS);
    const unique = uniquePoints(points);
    return unique.length >= 2 ? [unique[0], unique[1]] : null;
  }

  function renderMatrix() {
    const c = state.c.map((value) => `<span>${format(value)}</span>`).join("");
    const a = state.constraints.flatMap((line) => [line.a, line.b]).map((value) => `<span>${format(value)}</span>`).join("");
    const b = state.constraints.map((line) => `<span>${format(line.rhs)}</span>`).join("");
    $("matrix-values").innerHTML = `
      <div class="matrix-item"><i>c</i> = <span class="matrix vector">${c}</span></div>
      <div class="matrix-item"><i>A</i> = <span class="matrix two-col">${a}</span></div>
      <div class="matrix-item"><i>b</i> = <span class="matrix vector">${b}</span></div>`;
  }

  function renderAxes(scales, bounds) {
    const grid = $("grid-layer");
    const axes = $("axis-layer");
    grid.innerHTML = "";
    axes.innerHTML = "";
    const ticks = 5;
    for (let i = 0; i <= ticks; i += 1) {
      const xValue = bounds.xMax * i / ticks;
      const yValue = bounds.yMax * i / ticks;
      const x = scales.x(xValue);
      const y = scales.y(yValue);
      grid.appendChild(svgElement("line", { x1: x, y1: margin.top, x2: x, y2: margin.top + innerHeight, class: "grid-line" }));
      grid.appendChild(svgElement("line", { x1: margin.left, y1: y, x2: margin.left + innerWidth, y2: y, class: "grid-line" }));
      axes.appendChild(svgElement("text", { x, y: margin.top + innerHeight + 22, class: "tick-label", "text-anchor": "middle" }, format(xValue, 1)));
      if (i > 0) axes.appendChild(svgElement("text", { x: margin.left - 12, y: y + 4, class: "tick-label", "text-anchor": "end" }, format(yValue, 1)));
    }
    axes.appendChild(svgElement("line", { x1: margin.left, y1: margin.top + innerHeight, x2: margin.left + innerWidth, y2: margin.top + innerHeight, class: "axis-line" }));
    axes.appendChild(svgElement("line", { x1: margin.left, y1: margin.top, x2: margin.left, y2: margin.top + innerHeight, class: "axis-line" }));
    axes.appendChild(svgElement("text", { x: margin.left + innerWidth + 12, y: margin.top + innerHeight + 5, class: "axis-label" }, "x₁"));
    axes.appendChild(svgElement("text", { x: margin.left - 5, y: margin.top - 8, class: "axis-label" }, "x₂"));
  }

  function renderPlot(solution) {
    const bounds = graphBounds(solution);
    const scales = {
      x: (value) => margin.left + value / bounds.xMax * innerWidth,
      y: (value) => margin.top + innerHeight - value / bounds.yMax * innerHeight
    };
    renderAxes(scales, bounds);
    ["objective-halfspace-layer", "constraint-shading-layer", "feasible-layer", "constraint-lines-layer", "objective-layer", "vertex-layer"].forEach((id) => { $(id).innerHTML = ""; });

    const box = [{ x: 0, y: 0 }, { x: bounds.xMax, y: 0 }, { x: bounds.xMax, y: bounds.yMax }, { x: 0, y: bounds.yMax }];
    const objectiveHalfspace = clipPolygon(box, { a: -state.c[0], b: -state.c[1], rhs: -state.k });
    if (objectiveHalfspace.length) {
      $("objective-halfspace-layer").appendChild(svgElement("polygon", { points: polygonPoints(objectiveHalfspace, scales), fill: "url(#objective-hatch)" }));
    }

    let feasiblePolygon = box;
    state.constraints.forEach((line, index) => {
      const region = clipPolygon(box, line);
      if (region.length) $("constraint-shading-layer").appendChild(svgElement("polygon", { points: polygonPoints(region, scales), fill: colors[index], class: "constraint-fill" }));
      feasiblePolygon = clipPolygon(feasiblePolygon, line);
      const segment = lineSegmentInBox(line, bounds);
      if (segment) {
        $("constraint-lines-layer").appendChild(svgElement("line", { x1: scales.x(segment[0].x), y1: scales.y(segment[0].y), x2: scales.x(segment[1].x), y2: scales.y(segment[1].y), stroke: colors[index], class: "constraint-line" }));
        const labelPoint = segment[1].y >= segment[0].y ? segment[1] : segment[0];
        $("constraint-lines-layer").appendChild(svgElement("text", { x: scales.x(labelPoint.x) + 7, y: scales.y(labelPoint.y) - 7, fill: colors[index], class: "line-label" }, String(index + 1)));
      }
    });
    if (feasiblePolygon.length) $("feasible-layer").appendChild(svgElement("polygon", { points: polygonPoints(feasiblePolygon, scales), class: "feasible-region" }));

    const objectiveLine = { a: state.c[0], b: state.c[1], rhs: state.k };
    const segment = lineSegmentInBox(objectiveLine, bounds);
    if (segment) {
      const layer = $("objective-layer");
      layer.appendChild(svgElement("line", { x1: scales.x(segment[0].x), y1: scales.y(segment[0].y), x2: scales.x(segment[1].x), y2: scales.y(segment[1].y), class: "objective-line" }));
      const anchor = { x: (segment[0].x + segment[1].x) / 2, y: (segment[0].y + segment[1].y) / 2 };
      const norm = Math.hypot(state.c[0] / bounds.xMax * innerWidth, state.c[1] / bounds.yMax * innerHeight);
      if (norm > EPS) {
        const dx = state.c[0] / bounds.xMax * innerWidth / norm * 62;
        const dy = -state.c[1] / bounds.yMax * innerHeight / norm * 62;
        const ax = scales.x(anchor.x);
        const ay = scales.y(anchor.y);
        layer.appendChild(svgElement("line", { x1: ax, y1: ay, x2: ax + dx, y2: ay + dy, class: "objective-arrow", "marker-end": "url(#arrowhead)" }));
        layer.appendChild(svgElement("text", { x: ax + dx + 8, y: ay + dy - 5, class: "objective-label" }, "c"));
      }
    }

    solution.vertices.forEach((point) => {
      const optimal = solution.type === "finite" && solution.optimalVertices.some((candidate) => Math.hypot(candidate.x - point.x, candidate.y - point.y) < EPS);
      $("vertex-layer").appendChild(svgElement("circle", { cx: scales.x(point.x), cy: scales.y(point.y), r: optimal ? 7 : 5, class: optimal ? "vertex optimal" : "vertex" }));
    });
  }

  function statusText(solution) {
    const pill = $("problem-status");
    pill.className = "status-pill";
    if (solution.type === "infeasible") {
      pill.textContent = "Infeasible";
      pill.classList.add("error");
    } else if (solution.type === "unbounded") {
      pill.textContent = "Objective unbounded";
      pill.classList.add("warning");
    } else if (solution.type === "finite") {
      pill.textContent = `Optimal value ${format(solution.optimum)}`;
    } else {
      pill.textContent = "No vertex found";
      pill.classList.add("warning");
    }
  }

  function render() {
    readForm();
    $("k-slider").max = state.kMax;
    $("k-slider").value = state.k;
    $("k-output").value = Number(state.k).toFixed(2);
    renderMatrix();
    const solution = solve();
    statusText(solution);
    renderPlot(solution);
  }

  function attachEvents() {
    $("lp-form").addEventListener("input", render);
    $("k-slider").addEventListener("input", render);
    $("k-max").addEventListener("input", () => {
      const max = Math.max(0.1, readNumber("k-max", state.kMax));
      state.kMax = max;
      if (state.k > max) state.k = max;
      $("k-slider").max = max;
      $("k-slider").value = state.k;
      render();
    });
    $("set-optimum").addEventListener("click", () => {
      readForm();
      const solution = solve();
      if (solution.type === "finite") {
        if (solution.optimum > state.kMax) {
          state.kMax = Math.max(0.1, solution.optimum * 2);
          $("k-max").value = format(state.kMax);
          $("k-slider").max = state.kMax;
        }
        state.k = Math.max(0, solution.optimum);
        $("k-slider").value = state.k;
        render();
      }
    });
    $("reset-button").addEventListener("click", () => {
      state = JSON.parse(JSON.stringify(defaults));
      syncInputsFromState();
      render();
    });
  }

  buildConstraintInputs();
  syncInputsFromState();
  attachEvents();
  render();
})();
