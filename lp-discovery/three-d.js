(function () {
  "use strict";

  const EPS = 1e-7;
  const constraintColors = ["#0066cc", "#d7191c", "#6a1b9a", "#008c95"];
  const defaults = {
    c: [3, 2, 4],
    constraints: [
      { n: [1, 1, 1], rhs: 8 },
      { n: [2, 1, 1], rhs: 10 },
      { n: [1, 3, 2], rhs: 15 },
      { n: [0, 0, 1], rhs: 5 }
    ],
    k: 28,
    kMax: 56
  };

  let state = clone(defaults);
  const view = { yaw: Math.PI / 4, pitch: 0.58, zoom: 1 };
  let dragging = null;
  const $ = (id) => document.getElementById(id);

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
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

  function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }

  function cross(a, b) {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ];
  }

  function norm(a) {
    return Math.hypot(a[0], a[1], a[2]);
  }

  function normalize(a) {
    const length = norm(a);
    return length < EPS ? [0, 0, 0] : a.map((value) => value / length);
  }

  function distance(a, b) {
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  }

  function buildForm() {
    const objective = $("objective-inputs-3d");
    objective.innerHTML = state.c.map((value, index) => `
      ${index ? "<span>+</span>" : ""}
      <label><span class="sr-only">Objective coefficient of x ${index + 1}</span><input id="c3d-${index}" type="number" step="0.25" value="${value}"></label>
      <i>x</i><sub>${index + 1}</sub>`).join("");

    const constraints = $("constraint-inputs-3d");
    constraints.innerHTML = "";
    state.constraints.forEach((constraint, rowIndex) => {
      const row = document.createElement("div");
      row.className = "lp-row lp-row-3d";
      const terms = constraint.n.map((value, columnIndex) => `
        ${columnIndex ? "<span>+</span>" : ""}
        <label><span class="sr-only">Coefficient of x ${columnIndex + 1} in constraint ${rowIndex + 1}</span><input id="a3d-${rowIndex}-${columnIndex}" type="number" step="0.25" value="${value}"></label>
        <i>x</i><sub>${columnIndex + 1}</sub>`).join("");
      row.innerHTML = `
        <span class="row-label">constraint ${rowIndex + 1}</span>
        <span class="expression">${terms}<span>≤</span>
          <label><span class="sr-only">Right hand side of constraint ${rowIndex + 1}</span><input class="rhs" id="rhs3d-${rowIndex}" type="number" step="0.25" value="${constraint.rhs}"></label>
        </span>`;
      constraints.appendChild(row);
    });
  }

  function syncInputs() {
    state.c.forEach((value, index) => { $("c3d-" + index).value = value; });
    state.constraints.forEach((constraint, rowIndex) => {
      constraint.n.forEach((value, columnIndex) => { $("a3d-" + rowIndex + "-" + columnIndex).value = value; });
      $("rhs3d-" + rowIndex).value = constraint.rhs;
    });
    $("k-slider-3d").max = state.kMax;
    $("k-slider-3d").value = state.k;
    $("k-max-3d").value = state.kMax;
  }

  function readForm() {
    state.c = state.c.map((old, index) => readNumber("c3d-" + index, old));
    state.constraints = state.constraints.map((old, rowIndex) => ({
      n: old.n.map((value, columnIndex) => readNumber("a3d-" + rowIndex + "-" + columnIndex, value)),
      rhs: readNumber("rhs3d-" + rowIndex, old.rhs)
    }));
    state.k = readNumber("k-slider-3d", state.k);
    state.kMax = Math.max(0.1, readNumber("k-max-3d", state.kMax));
    if (state.k > state.kMax) state.k = state.kMax;
  }

  function inequalities() {
    return [
      ...state.constraints.map((line) => ({ n: line.n.slice(), rhs: line.rhs })),
      { n: [-1, 0, 0], rhs: 0 },
      { n: [0, -1, 0], rhs: 0 },
      { n: [0, 0, -1], rhs: 0 }
    ];
  }

  function solveThree(lines, rhs) {
    const matrix = lines.map((row, index) => [...row, rhs[index]]);
    for (let column = 0; column < 3; column += 1) {
      let pivot = column;
      for (let row = column + 1; row < 3; row += 1) {
        if (Math.abs(matrix[row][column]) > Math.abs(matrix[pivot][column])) pivot = row;
      }
      if (Math.abs(matrix[pivot][column]) < EPS) return null;
      [matrix[column], matrix[pivot]] = [matrix[pivot], matrix[column]];
      const divisor = matrix[column][column];
      for (let j = column; j < 4; j += 1) matrix[column][j] /= divisor;
      for (let row = 0; row < 3; row += 1) {
        if (row === column) continue;
        const factor = matrix[row][column];
        for (let j = column; j < 4; j += 1) matrix[row][j] -= factor * matrix[column][j];
      }
    }
    return [matrix[0][3], matrix[1][3], matrix[2][3]];
  }

  function verticesFor(lines) {
    const points = [];
    for (let i = 0; i < lines.length; i += 1) {
      for (let j = i + 1; j < lines.length; j += 1) {
        for (let k = j + 1; k < lines.length; k += 1) {
          const point = solveThree([lines[i].n, lines[j].n, lines[k].n], [lines[i].rhs, lines[j].rhs, lines[k].rhs]);
          if (!point) continue;
          if (lines.every((line) => dot(line.n, point) <= line.rhs + 1e-6) &&
              !points.some((other) => distance(point, other) < 1e-5)) points.push(point);
        }
      }
    }
    return points;
  }

  function orderedFace(points, normal) {
    const center = [0, 1, 2].map((axis) => points.reduce((sum, point) => sum + point[axis], 0) / points.length);
    const unitNormal = normalize(normal);
    const reference = Math.abs(unitNormal[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0];
    const u = normalize(cross(unitNormal, reference));
    const v = cross(unitNormal, u);
    return points.slice().sort((first, second) => {
      const a = first.map((value, axis) => value - center[axis]);
      const b = second.map((value, axis) => value - center[axis]);
      return Math.atan2(dot(a, v), dot(a, u)) - Math.atan2(dot(b, v), dot(b, u));
    });
  }

  function facesFor(vertices, lines) {
    const faces = [];
    lines.forEach((line, source) => {
      const points = vertices.filter((point) => Math.abs(dot(line.n, point) - line.rhs) < 1e-5);
      if (points.length >= 3) faces.push({ points: orderedFace(points, line.n), source, normal: line.n });
    });
    return faces;
  }

  function hasImprovingRay() {
    for (let polar = 0; polar <= 90; polar += 3) {
      const phi = polar * Math.PI / 180;
      for (let angle = 0; angle <= 90; angle += 3) {
        const theta = angle * Math.PI / 180;
        const direction = [Math.sin(phi) * Math.cos(theta), Math.sin(phi) * Math.sin(theta), Math.cos(phi)];
        if (state.constraints.every((line) => dot(line.n, direction) <= 1e-6) && dot(state.c, direction) > 1e-6) return true;
      }
    }
    return false;
  }

  function solveLP() {
    const lines = inequalities();
    const vertices = verticesFor(lines);
    const originFeasible = lines.every((line) => line.rhs >= -1e-6);
    if (!vertices.length && !originFeasible) return { type: "infeasible", vertices: [] };
    if (hasImprovingRay()) return { type: "unbounded", vertices };
    if (!vertices.length) return { type: "no-vertex", vertices: [] };
    const values = vertices.map((point) => dot(state.c, point));
    const optimum = Math.max(...values);
    const optimalVertices = vertices.filter((point, index) => Math.abs(values[index] - optimum) < 1e-5);
    return { type: "finite", vertices, optimum, optimalVertices };
  }

  function axisMaximum(solution) {
    const candidates = [10];
    state.constraints.forEach((line) => {
      line.n.forEach((coefficient) => {
        if (coefficient > EPS && line.rhs / coefficient > 0) candidates.push(line.rhs / coefficient);
      });
    });
    solution.vertices.forEach((point) => candidates.push(...point));
    const required = Math.max(...candidates);
    return required > 10 + EPS ? Math.min(100, required * 1.1) : 10;
  }

  function renderMatrix() {
    const c = state.c.map((value) => `<span>${format(value)}</span>`).join("");
    const a = state.constraints.flatMap((line) => line.n).map((value) => `<span>${format(value)}</span>`).join("");
    const b = state.constraints.map((line) => `<span>${format(line.rhs)}</span>`).join("");
    $("matrix-values-3d").innerHTML = `
      <div class="matrix-item"><i>c</i> = <span class="matrix vector">${c}</span></div>
      <div class="matrix-item"><i>A</i> = <span class="matrix three-col">${a}</span></div>
      <div class="matrix-item"><i>b</i> = <span class="matrix vector">${b}</span></div>`;
  }

  function updateStatus(solution) {
    const status = $("problem-status-3d");
    status.className = "";
    if (solution.type === "finite") status.textContent = `Optimal value ${format(solution.optimum)}`;
    else if (solution.type === "unbounded") {
      status.textContent = "Objective unbounded";
      status.className = "warning";
    } else if (solution.type === "infeasible") {
      status.textContent = "Infeasible";
      status.className = "error";
    } else {
      status.textContent = "No vertex found";
      status.className = "warning";
    }
  }

  function makeProjection(axisMax, width, height) {
    const half = axisMax / 2;
    const cosYaw = Math.cos(view.yaw);
    const sinYaw = Math.sin(view.yaw);
    const cosPitch = Math.cos(view.pitch);
    const sinPitch = Math.sin(view.pitch);

    function raw(point) {
      const x = point[0] - half;
      const y = point[1] - half;
      const z = point[2] - half;
      const rotatedX = cosYaw * x - sinYaw * y;
      const rotatedY = sinYaw * x + cosYaw * y;
      const vertical = cosPitch * z - sinPitch * rotatedY;
      return { x: rotatedX, y: -vertical, depth: sinPitch * z + cosPitch * rotatedY };
    }

    const corners = [];
    [0, axisMax].forEach((x) => [0, axisMax].forEach((y) => [0, axisMax].forEach((z) => corners.push(raw([x, y, z])))));
    const xs = corners.map((point) => point.x);
    const ys = corners.map((point) => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const scale = Math.min((width - 94) / (maxX - minX), (height - 94) / (maxY - minY)) * view.zoom;
    const centerX = width / 2 - (minX + maxX) / 2 * scale;
    const centerY = height / 2 - (minY + maxY) / 2 * scale;
    return (point) => {
      const projected = raw(point);
      return { x: centerX + projected.x * scale, y: centerY + projected.y * scale, depth: projected.depth };
    };
  }

  function pathPolygon(ctx, points) {
    if (!points.length) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) ctx.lineTo(points[index].x, points[index].y);
    ctx.closePath();
  }

  function drawPolygon(ctx, face, project, fill, stroke, width, dash) {
    const projected = face.points.map(project);
    pathPolygon(ctx, projected);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width || 1;
      ctx.setLineDash(dash || []);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function drawLine(ctx, project, first, second, color, width, dash) {
    const a = project(first);
    const b = project(second);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash || []);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawArrow(ctx, project, start, end) {
    const from = project(start);
    const to = project(end);
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const head = 11;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.strokeStyle = "#a85e00";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x - head * Math.cos(angle - Math.PI / 6), to.y - head * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(to.x - head * Math.cos(angle + Math.PI / 6), to.y - head * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fillStyle = "#a85e00";
    ctx.fill();
    ctx.fillStyle = "#834900";
    ctx.font = "bold 15px Helvetica, Arial, sans-serif";
    ctx.fillText("c", to.x + 7, to.y - 5);
  }

  function centroid(points) {
    return [0, 1, 2].map((axis) => points.reduce((sum, point) => sum + point[axis], 0) / points.length);
  }

  function draw3D(solution) {
    const canvas = $("plot-3d");
    const rect = canvas.getBoundingClientRect();
    const cssWidth = rect.width || 650;
    const cssHeight = rect.height || 650;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(cssWidth * ratio) || canvas.height !== Math.round(cssHeight * ratio)) {
      canvas.width = Math.round(cssWidth * ratio);
      canvas.height = Math.round(cssHeight * ratio);
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const axisMax = axisMaximum(solution);
    const project = makeProjection(axisMax, cssWidth, cssHeight);

    ctx.strokeStyle = "#e1e1e1";
    ctx.lineWidth = 1;
    for (let index = 0; index <= 5; index += 1) {
      const value = axisMax * index / 5;
      drawLine(ctx, project, [value, 0, 0], [value, axisMax, 0], "#e1e1e1", 1);
      drawLine(ctx, project, [0, value, 0], [axisMax, value, 0], "#e1e1e1", 1);
    }

    const boxLines = [
      { n: [-1, 0, 0], rhs: 0 }, { n: [0, -1, 0], rhs: 0 }, { n: [0, 0, -1], rhs: 0 },
      { n: [1, 0, 0], rhs: axisMax }, { n: [0, 1, 0], rhs: axisMax }, { n: [0, 0, 1], rhs: axisMax }
    ];
    const objectiveLength = norm(state.c);
    let objectiveFace = null;
    if (objectiveLength > EPS) {
      const halfspaceLines = [...boxLines, { n: state.c.map((value) => -value), rhs: -state.k }];
      const halfspaceVertices = verticesFor(halfspaceLines);
      const halfspaceFaces = facesFor(halfspaceVertices, halfspaceLines);
      halfspaceFaces.sort((a, b) => project(centroid(a.points)).depth - project(centroid(b.points)).depth);
      halfspaceFaces.forEach((face) => {
        if (face.source === boxLines.length) objectiveFace = face;
        else drawPolygon(ctx, face, project, "rgba(244, 185, 66, 0.045)", null);
      });
    }

    const displayLines = [
      ...inequalities(),
      { n: [1, 0, 0], rhs: axisMax },
      { n: [0, 1, 0], rhs: axisMax },
      { n: [0, 0, 1], rhs: axisMax }
    ];
    const displayVertices = verticesFor(displayLines);
    const feasibleFaces = facesFor(displayVertices, displayLines);
    const constraintCount = state.constraints.length;
    const unclippedLineCount = inequalities().length;
    feasibleFaces.sort((first, second) => {
      const a = project(centroid(first.points)).depth;
      const b = project(centroid(second.points)).depth;
      return a - b;
    });
    feasibleFaces.forEach((face) => {
      const edgeColor = face.source < constraintCount ? constraintColors[face.source] : "#555";
      const dash = face.source >= unclippedLineCount ? [5, 5] : [];
      drawPolygon(ctx, face, project, "rgba(65, 135, 102, 0.20)", edgeColor, face.source < constraintCount ? 3 : 1.5, dash);
      if (face.source < constraintCount) {
        const label = project(centroid(face.points));
        ctx.font = "bold 14px Helvetica, Arial, sans-serif";
        ctx.fillStyle = constraintColors[face.source];
        ctx.fillText(String(face.source + 1), label.x + 4, label.y - 4);
      }
    });

    if (objectiveFace) {
      drawPolygon(ctx, objectiveFace, project, "rgba(244, 167, 38, 0.24)", "#a85e00", 3, [8, 5]);
      const start = centroid(objectiveFace.points);
      const direction = normalize(state.c);
      const end = start.map((value, index) => value + direction[index] * axisMax * 0.2);
      drawArrow(ctx, project, start, end);
    }

    drawLine(ctx, project, [0, 0, 0], [axisMax, 0, 0], "#111", 2);
    drawLine(ctx, project, [0, 0, 0], [0, axisMax, 0], "#111", 2);
    drawLine(ctx, project, [0, 0, 0], [0, 0, axisMax], "#111", 2);
    const labels = [
      { point: [axisMax, 0, 0], text: "x₁" },
      { point: [0, axisMax, 0], text: "x₂" },
      { point: [0, 0, axisMax], text: "x₃" }
    ];
    ctx.fillStyle = "#111";
    ctx.font = "italic bold 15px Helvetica, Arial, sans-serif";
    labels.forEach((label) => {
      const point = project(label.point);
      ctx.fillText(label.text, point.x + 6, point.y - 5);
    });

    solution.vertices.forEach((point) => {
      const projected = project(point);
      const optimal = solution.type === "finite" && solution.optimalVertices.some((candidate) => distance(candidate, point) < 1e-5);
      ctx.beginPath();
      ctx.arc(projected.x, projected.y, optimal ? 7 : 4.5, 0, Math.PI * 2);
      ctx.fillStyle = optimal ? "#ffc44d" : "white";
      ctx.fill();
      ctx.strokeStyle = "black";
      ctx.lineWidth = optimal ? 2.5 : 1.7;
      ctx.stroke();
    });
  }

  function render() {
    readForm();
    $("k-slider-3d").max = state.kMax;
    $("k-slider-3d").value = state.k;
    $("k-output-3d").value = Number(state.k).toFixed(2);
    renderMatrix();
    const solution = solveLP();
    updateStatus(solution);
    draw3D(solution);
  }

  function resetView() {
    view.yaw = Math.PI / 4;
    view.pitch = 0.58;
    view.zoom = 1;
    draw3D(solveLP());
  }

  function attachEvents() {
    $("lp-form-3d").addEventListener("input", render);
    $("k-slider-3d").addEventListener("input", render);
    $("k-max-3d").addEventListener("input", () => {
      state.kMax = Math.max(0.1, readNumber("k-max-3d", state.kMax));
      if (state.k > state.kMax) state.k = state.kMax;
      $("k-slider-3d").max = state.kMax;
      $("k-slider-3d").value = state.k;
      render();
    });
    $("set-optimum-3d").addEventListener("click", () => {
      readForm();
      const solution = solveLP();
      if (solution.type === "finite") {
        if (solution.optimum > state.kMax) {
          state.kMax = Math.max(0.1, solution.optimum * 2);
          $("k-max-3d").value = format(state.kMax);
          $("k-slider-3d").max = state.kMax;
        }
        state.k = Math.max(0, solution.optimum);
        $("k-slider-3d").value = state.k;
        render();
      }
    });
    $("reset-3d").addEventListener("click", () => {
      state = clone(defaults);
      syncInputs();
      resetView();
      render();
    });
    $("reset-view-3d").addEventListener("click", resetView);

    const canvas = $("plot-3d");
    canvas.addEventListener("pointerdown", (event) => {
      dragging = { x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
      canvas.classList.add("dragging");
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      const dx = event.clientX - dragging.x;
      const dy = event.clientY - dragging.y;
      dragging = { x: event.clientX, y: event.clientY };
      view.yaw += dx * 0.008;
      view.pitch = Math.max(-1.25, Math.min(1.25, view.pitch + dy * 0.008));
      draw3D(solveLP());
    });
    function stopDragging() {
      dragging = null;
      canvas.classList.remove("dragging");
    }
    canvas.addEventListener("pointerup", stopDragging);
    canvas.addEventListener("pointercancel", stopDragging);
    canvas.addEventListener("wheel", (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      view.zoom = Math.max(0.55, Math.min(2.4, view.zoom * Math.exp(-event.deltaY * 0.001)));
      draw3D(solveLP());
    }, { passive: false });
    window.addEventListener("resize", () => draw3D(solveLP()));
  }

  buildForm();
  syncInputs();
  attachEvents();
  render();
})();
