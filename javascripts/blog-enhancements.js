'use strict';

(function () {
  const CHART_COLORS = ['#0d9488', '#2563eb', '#7c3aed', '#dc2626', '#d97706', '#059669'];
  const MONO = 'JetBrains Mono, SF Mono, Fira Code, Consolas, Liberation Mono, monospace';
  const BODY_FONT = 'Inter, -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif';

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function textFromBlock(pre) {
    const lines = pre.querySelectorAll('.code-line-content');
    if (lines.length) {
      return Array.prototype.map.call(lines, function (line) {
        return line.innerText;
      }).join('\n');
    }

    const code = pre.querySelector('code');
    return (code || pre).innerText.replace(/\n?copy$/, '').replace(/\n?copied$/, '');
  }

  function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();

    try {
      document.execCommand('copy');
    } finally {
      textarea.remove();
    }
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }

    fallbackCopy(text);
    return Promise.resolve();
  }

  function wrapCodeLines(pre) {
    const code = pre.querySelector('code');
    if (!code || code.querySelector('.code-line')) return;
    if (pre.classList.contains('md-table-code-block')) {
      pre.classList.add('is-table-code-block');
      return;
    }

    const htmlLines = code.innerHTML.replace(/\n$/, '').split('\n');
    if (htmlLines.length < 2) {
      pre.classList.add('is-compact-code');
      return;
    }

    var openTags = [];
    code.innerHTML = htmlLines.map(function (line, index) {
      var reopen = openTags.join('');
      var opens = (line.match(/<span[^>]*>/g) || []);
      var closes = (line.match(/<\/span>/g) || []).length;

      var stack = openTags.slice();
      for (var k = 0; k < opens.length; k++) { stack.push(opens[k]); }
      for (var k = 0; k < closes; k++) { stack.pop(); }
      var closeAll = Array(openTags.length + opens.length - closes > 0 ? openTags.length + opens.length - closes : 0);
      var closeSuffix = '';
      var unclosed = openTags.length + opens.length - closes;
      if (unclosed > 0) {
        closeSuffix = new Array(unclosed + 1).join('</span>');
      }

      openTags = stack;

      return [
        '<span class="code-line">',
        '<span class="code-line-number" aria-hidden="true">' + String(index + 1) + '</span>',
        '<span class="code-line-content">' + reopen + (line || '&#8203;') + closeSuffix + '</span>',
        '</span>'
      ].join('');
    }).join('');

    pre.classList.add('has-code-lines');
  }

  function copyIcon() {
    return [
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">',
      '<path d="M8 7.5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-9Z"></path>',
      '<path d="M5 14.5V5.75A2.75 2.75 0 0 1 7.75 3H15"></path>',
      '</svg>'
    ].join('');
  }

  function enhanceCodeBlocks() {
    const blocks = document.querySelectorAll('.post .article .article-entry pre');

    blocks.forEach(function (pre) {
      wrapCodeLines(pre);
      addLanguageLabel(pre);
      if (pre.querySelector('.code-copy-button')) return;

      pre.classList.add('code-copy-block');

      const button = document.createElement('button');
      button.className = 'code-copy-button';
      button.type = 'button';
      button.innerHTML = copyIcon();
      button.setAttribute('aria-label', 'Copy code');
      button.setAttribute('title', 'Copy code');

      button.addEventListener('click', function () {
        copyText(textFromBlock(pre)).then(function () {
          button.classList.add('is-copied');
          button.setAttribute('aria-label', 'Copied');
          button.setAttribute('title', 'Copied');

          window.setTimeout(function () {
            button.classList.remove('is-copied');
            button.setAttribute('aria-label', 'Copy code');
            button.setAttribute('title', 'Copy code');
          }, 1200);
        }).catch(function () {
          button.classList.add('is-error');

          window.setTimeout(function () {
            button.classList.remove('is-error');
          }, 1200);
        });
      });

      pre.appendChild(button);
    });
  }

  function multilineCodeCellLines(cell) {
    const lines = [];
    let codeOnly = true;

    Array.prototype.forEach.call(cell.childNodes, function (node) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.textContent.trim()) codeOnly = false;
        return;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) return;

      const tag = node.tagName.toLowerCase();
      if (tag === 'br') return;
      if (tag === 'code') {
        lines.push(node.textContent.replace(/\u00a0/g, ' '));
        return;
      }

      if (node.textContent.trim()) codeOnly = false;
    });

    if (!codeOnly || lines.length < 2) return [];
    return lines;
  }

  function shouldPromoteCodeCell(lines) {
    if (lines.length >= 3) return true;
    return lines.some(function (line) {
      return line.length >= 72;
    }) || lines.join('\n').length >= 120;
  }

  function enhanceMultilineTableCodeCells() {
    const cells = document.querySelectorAll('.post .article .article-entry table td');

    cells.forEach(function (cell) {
      if (cell.closest('.md-chart') || cell.querySelector('pre')) return;

      const lines = multilineCodeCellLines(cell);
      if (!lines.length || !shouldPromoteCodeCell(lines)) return;

      const pre = document.createElement('pre');
      const code = document.createElement('code');
      pre.className = 'md-table-code-block';
      code.className = 'language-text';
      code.textContent = lines.join('\n');
      pre.appendChild(code);

      cell.innerHTML = '';
      cell.appendChild(pre);
      cell.classList.add('md-table-cell--code-block');

      const table = cell.closest('table');
      if (table) table.classList.add('md-table--has-code-blocks');
    });
  }

  function enhanceTables() {
    const tables = document.querySelectorAll('.post .article .article-entry table');

    tables.forEach(function (table) {
      if (table.closest('.md-table-shell') || table.closest('.md-chart')) return;
      // Self-contained card components bring their own container styling, so the
      // generic scroll-shell would only double-box them. Leave them standalone.
      if (table.classList.contains('step-timeline-table')) return;

      const tableKind = classifyTable(table);

      const shell = document.createElement('div');
      const viewport = document.createElement('div');
      const scrollbar = document.createElement('div');
      const thumb = document.createElement('button');

      shell.className = 'md-table-shell md-table-shell--' + tableKind;
      viewport.className = 'md-table-viewport';
      scrollbar.className = 'md-table-scrollbar';
      thumb.className = 'md-table-scrollbar__thumb';
      thumb.type = 'button';
      thumb.setAttribute('aria-label', 'Scroll table horizontally');

      table.classList.add('md-table');
      table.parentNode.insertBefore(shell, table);
      viewport.appendChild(table);
      scrollbar.appendChild(thumb);
      shell.appendChild(viewport);
      shell.appendChild(scrollbar);
      attachTableScrollbar(shell, viewport, scrollbar, thumb);
    });
  }

  function classifyTable(table) {
    const rows = Array.prototype.slice.call(table.rows || []);
    if (!rows.length) return 'comparison';

    const columnCount = rows.reduce(function (count, row) {
      return Math.max(count, row.cells.length);
    }, 0);
    const stats = {
      bodyCells: 0,
      codeCells: 0,
      maxTextLength: 0,
      totalTextLength: 0,
      numericColumns: 0,
      tokenColumns: 0
    };

    for (let column = 0; column < columnCount; column += 1) {
      const cells = rows.map(function (row) {
        return row.cells[column];
      }).filter(Boolean);
      const bodyCells = cells.filter(function (cell) {
        return cell.tagName && cell.tagName.toLowerCase() === 'td';
      });
      const values = bodyCells.map(function (cell) {
        return cell.innerText.trim();
      }).filter(Boolean);
      const numericCount = values.filter(isNumericCell).length;
      const tokenCount = values.filter(isTokenCell).length;
      const numericColumn = values.length > 0 && numericCount === values.length;
      const tokenColumn = values.length > 0 && tokenCount / values.length >= 0.75;
      const headerCell = cells.find(function (cell) {
        return cell.tagName && cell.tagName.toLowerCase() === 'th';
      });
      const role = tableColumnRole(headerCell ? headerCell.innerText.trim() : '', values, numericColumn, tokenColumn);

      if (numericColumn) stats.numericColumns += 1;
      if (tokenColumn && !numericColumn) stats.tokenColumns += 1;

      bodyCells.forEach(function (cell) {
        const text = cell.innerText.trim();
        stats.bodyCells += 1;
        stats.totalTextLength += text.length;
        stats.maxTextLength = Math.max(stats.maxTextLength, text.length);
        if (cell.querySelector('code')) stats.codeCells += 1;
      });

      cells.forEach(function (cell) {
        cell.style.textAlign = '';
        if (numericColumn) cell.classList.add('md-table-cell--number');
        if (tokenColumn && !numericColumn) cell.classList.add('md-table-cell--token');
        if (role) cell.classList.add('md-table-column--' + role);
        enhanceTableCellTokens(cell);
      });
    }

    const kind = tableKind(rows, columnCount, stats);
    table.classList.add('md-table--' + kind);
    table.setAttribute('data-table-kind', kind);
    return kind;
  }

  function tableKind(rows, columnCount, stats) {
    const bodyRowCount = Math.max(rows.length - 1, 0);
    const averageLength = stats.bodyCells ? stats.totalTextLength / stats.bodyCells : 0;
    const codeRatio = stats.bodyCells ? stats.codeCells / stats.bodyCells : 0;
    const numericRatio = columnCount ? stats.numericColumns / columnCount : 0;

    if (bodyRowCount <= 3 && columnCount <= 4 && stats.maxTextLength < 44) return 'compact';
    if (stats.numericColumns >= 2 && numericRatio >= 0.45) return 'numeric';
    if (columnCount >= 5 || stats.maxTextLength >= 86 || averageLength >= 34 || codeRatio >= 0.34) return 'evidence';
    return 'comparison';
  }

  function tableColumnRole(header, values, numericColumn, tokenColumn) {
    const label = String(header || '').trim().toLowerCase();
    const booleanColumn = values.length > 0 && values.every(isBooleanCell);

    if (/^(step|round|iter|iteration|轮次|步骤)$/i.test(label)) return 'step';
    if (numericColumn && /(loss|score|分数|困惑|ppl|perplexity)/i.test(label)) return 'metric';
    if (booleanColumn || /(命中|是否|成功|通过|hit|match|success)/i.test(label)) return 'boolean';
    if (tokenColumn) return 'token';
    if (numericColumn) return 'number';
    return '';
  }

  function isNumericCell(value) {
    const text = String(value || '').replace(/,/g, '').trim();
    return /^[-+]?(\d+(\.\d+)?|\.\d+)(%|ms|s|x)?$/i.test(text)
      || /^[-+]?(\d+(\.\d+)?|\.\d+)\s*->\s*[-+]?(\d+(\.\d+)?|\.\d+)(%|ms|s|x)?$/i.test(text);
  }

  function isTokenCell(value) {
    const text = String(value || '').trim();
    if (text.length > 34 || /\s/.test(text)) return false;
    return /^[A-Za-z0-9_./:+-]+$/.test(text) || /^[A-Z_]+(\s*->\s*[A-Z_]+)?$/.test(text);
  }

  function isBooleanCell(value) {
    const text = String(value || '').trim().toLowerCase();
    return /^(是|否|yes|no|true|false|y|n)$/.test(text);
  }

  function enhanceTableCellTokens(cell) {
    const codes = cell.querySelectorAll('code');
    codes.forEach(function (code) {
      const value = code.innerText.trim().toLowerCase();
      if (/^(high|critical|block|deny|fail|false|否)$/.test(value)) code.classList.add('md-token--strong');
      if (/^(medium|review|watchlist|pending)$/.test(value)) code.classList.add('md-token--medium');
      if (/^(low|allow|normal|noop|ls|success|true|是)$/.test(value)) code.classList.add('md-token--quiet');
    });
  }

  function attachTableScrollbar(shell, viewport, scrollbar, thumb) {
    let dragging = false;
    let startX = 0;
    let startLeft = 0;

    function metrics() {
      const maxScroll = viewport.scrollWidth - viewport.clientWidth;
      const trackWidth = scrollbar.clientWidth;
      const visibleRatio = viewport.clientWidth / Math.max(viewport.scrollWidth, 1);
      const thumbWidth = Math.max(44, Math.round(trackWidth * Math.min(visibleRatio, 1)));
      const maxThumb = Math.max(trackWidth - thumbWidth, 0);
      return { maxScroll, trackWidth, thumbWidth, maxThumb };
    }

    function update() {
      const state = metrics();
      const scrollable = state.maxScroll > 1 && state.maxThumb > 0;

      shell.classList.toggle('is-scrollable', scrollable);
      thumb.style.width = state.thumbWidth + 'px';

      if (!scrollable) {
        thumb.style.transform = 'translateX(0)';
        return;
      }

      const progress = viewport.scrollLeft / state.maxScroll;
      thumb.style.transform = 'translateX(' + Math.round(progress * state.maxThumb) + 'px)';
    }

    function moveThumb(clientX) {
      const state = metrics();
      if (state.maxScroll <= 0 || state.maxThumb <= 0) return;

      const delta = clientX - startX;
      const nextThumbLeft = Math.max(0, Math.min(startLeft + delta, state.maxThumb));
      viewport.scrollLeft = (nextThumbLeft / state.maxThumb) * state.maxScroll;
    }

    viewport.addEventListener('scroll', update, { passive: true });

    scrollbar.addEventListener('click', function (event) {
      if (event.target === thumb) return;

      const state = metrics();
      if (state.maxScroll <= 0 || state.trackWidth <= 0) return;

      const rect = scrollbar.getBoundingClientRect();
      const target = Math.max(0, Math.min(event.clientX - rect.left - state.thumbWidth / 2, state.maxThumb));
      viewport.scrollLeft = (target / state.maxThumb) * state.maxScroll;
    });

    thumb.addEventListener('pointerdown', function (event) {
      const state = metrics();

      dragging = true;
      startX = event.clientX;
      startLeft = state.maxThumb > 0 ? (viewport.scrollLeft / state.maxScroll) * state.maxThumb : 0;
      thumb.setPointerCapture(event.pointerId);
      thumb.classList.add('is-dragging');
      event.preventDefault();
    });

    thumb.addEventListener('pointermove', function (event) {
      if (!dragging) return;
      moveThumb(event.clientX);
    });

    function stopDrag(event) {
      if (!dragging) return;
      dragging = false;
      thumb.classList.remove('is-dragging');
      if (event && thumb.hasPointerCapture(event.pointerId)) {
        thumb.releasePointerCapture(event.pointerId);
      }
    }

    thumb.addEventListener('pointerup', stopDrag);
    thumb.addEventListener('pointercancel', stopDrag);

    if (window.ResizeObserver) {
      const observer = new ResizeObserver(update);
      observer.observe(viewport);
      observer.observe(viewport.querySelector('table'));
    }

    window.addEventListener('resize', update, { passive: true });
    window.requestAnimationFrame(update);
  }

  function numericValues(group) {
    return group.series.reduce(function (points, series) {
      return points.concat(series.values.map(function (point) {
        return point.y;
      }));
    }, []).filter(function (value) {
      return Number.isFinite(value);
    });
  }

  function niceRange(values) {
    if (!values.length) return { min: 0, max: 1 };

    const min = Math.min.apply(null, values);
    const max = Math.max.apply(null, values);

    if (min === max) {
      return {
        min: min > 0 ? 0 : min - 1,
        max: max + 1
      };
    }

    const padding = (max - min) * 0.12;
    return {
      min: Math.min(0, min - padding),
      max: max + padding
    };
  }

  function formatValue(value, unit) {
    if (!Number.isFinite(value)) return '';
    const magnitude = Math.abs(value);
    const rounded = magnitude >= 100 ? value.toFixed(0) : magnitude >= 10 ? value.toFixed(1) : value.toFixed(2);
    return rounded.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1') + (unit || '');
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(value, Math.max(min, max)));
  }

  function getActiveGroup(chart, state) {
    const key = state.activeControl || chart.activeControl;
    return chart.groups.find(function (group) {
      return group.key === key || group.label === key;
    }) || chart.groups[0];
  }

  function visibleSeries(group, state) {
    return group.series.filter(function (_, index) {
      return state.activeSeries[index] !== false;
    });
  }

  function pointGeometry(chart, group, state) {
    const width = 800;
    const height = 340;
    const pad = { top: 28, right: 34, bottom: 58, left: 58 };
    const innerWidth = width - pad.left - pad.right;
    const innerHeight = height - pad.top - pad.bottom;
    const series = visibleSeries(group, state);
    const values = numericValues({ series: series.length ? series : group.series });
    const range = niceRange(values);
    if (chart.unit === '%') {
      const maxData = values.length ? Math.max.apply(null, values) : 100;
      range.min = Math.max(0, range.min);
      range.max = maxData <= 100 ? 100 : range.max;
    }
    const count = Math.max.apply(null, group.series.map(function (item) {
      return item.values.length;
    }).concat([1]));

    function x(index) {
      return pad.left + (count <= 1 ? innerWidth / 2 : (innerWidth * index) / (count - 1));
    }

    function y(value) {
      return pad.top + innerHeight - ((value - range.min) / (range.max - range.min)) * innerHeight;
    }

    return { width: width, height: height, pad: pad, innerWidth: innerWidth, innerHeight: innerHeight, range: range, count: count, x: x, y: y };
  }

  function renderAxis(geometry, unit) {
    const ticks = [0, 0.25, 0.5, 0.75, 1].map(function (ratio) {
      const value = geometry.range.min + (geometry.range.max - geometry.range.min) * ratio;
      const yy = geometry.y(value);
      return [
        '<line x1="' + geometry.pad.left + '" x2="' + (geometry.width - geometry.pad.right) + '" y1="' + yy + '" y2="' + yy + '" class="md-chart__grid-line"></line>',
        '<text x="' + (geometry.pad.left - 12) + '" y="' + (yy + 4) + '" text-anchor="end" class="md-chart__axis-label">' + escapeHtml(formatValue(value, unit)) + '</text>'
      ].join('');
    }).join('');

    return [
      ticks,
      '<line x1="' + geometry.pad.left + '" x2="' + (geometry.width - geometry.pad.right) + '" y1="' + (geometry.height - geometry.pad.bottom) + '" y2="' + (geometry.height - geometry.pad.bottom) + '" class="md-chart__axis"></line>'
    ].join('');
  }

  function renderLineChart(chart, group, state) {
    const geometry = pointGeometry(chart, group, state);
    const series = visibleSeries(group, state);
    const labels = (group.series[0] && group.series[0].values || []).map(function (point, index) {
      if (index !== 0 && index !== geometry.count - 1 && index % Math.ceil(geometry.count / 4) !== 0) return '';
      return '<text x="' + geometry.x(index) + '" y="' + (geometry.height - 22) + '" text-anchor="middle" class="md-chart__axis-label">' + escapeHtml(point.x) + '</text>';
    }).join('');

    const paths = series.map(function (item, visibleIndex) {
      const originalIndex = group.series.indexOf(item);
      const color = CHART_COLORS[originalIndex % CHART_COLORS.length];
      const d = item.values.map(function (point, index) {
        return (index === 0 ? 'M' : 'L') + ' ' + geometry.x(index).toFixed(2) + ' ' + geometry.y(point.y).toFixed(2);
      }).join(' ');
      const area = item.values.length > 1
        ? d + ' L ' + geometry.x(item.values.length - 1).toFixed(2) + ' ' + (geometry.height - geometry.pad.bottom) + ' L ' + geometry.x(0).toFixed(2) + ' ' + (geometry.height - geometry.pad.bottom) + ' Z'
        : '';
      const dots = item.values.map(function (point, index) {
        return '<circle class="md-chart__dot" data-series="' + originalIndex + '" data-index="' + index + '" cx="' + geometry.x(index).toFixed(2) + '" cy="' + geometry.y(point.y).toFixed(2) + '" r="3.2" fill="' + color + '"></circle>';
      }).join('');

      return [
        visibleIndex === 0 && area ? '<path d="' + area + '" fill="' + color + '" class="md-chart__area"></path>' : '',
        '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="md-chart__path"></path>',
        dots
      ].join('');
    }).join('');

    return [
      '<svg viewBox="0 0 ' + geometry.width + ' ' + geometry.height + '" class="md-chart__svg" aria-label="' + escapeHtml(chart.title) + '" data-count="' + geometry.count + '">',
      renderAxis(geometry, chart.unit),
      labels,
      '<g class="md-chart__series">' + paths + '</g>',
      renderAnnotations(chart, group, state, geometry),
      '<line class="md-chart__cursor" x1="' + geometry.pad.left + '" x2="' + geometry.pad.left + '" y1="' + geometry.pad.top + '" y2="' + (geometry.height - geometry.pad.bottom) + '"></line>',
      '<rect class="md-chart__hitbox" x="' + geometry.pad.left + '" y="' + geometry.pad.top + '" width="' + geometry.innerWidth + '" height="' + geometry.innerHeight + '" fill="transparent"></rect>',
      '</svg>'
    ].join('');
  }

  // Permanent callouts for key points. Geometry only here; final label placement
  // (which needs real text measurement) happens in placeAnnotations after layout.
  function renderAnnotations(chart, group, state, geometry) {
    if (!group.annotations || !group.annotations.length) return '';
    const primaryIndex = group.series.findIndex(function (s) {
      return s.name === (group.annotations[0] && group.annotations[0].series);
    });
    const seriesIndex = primaryIndex >= 0 ? primaryIndex : 0;
    if (state.activeSeries[seriesIndex] === false) return '';
    const color = CHART_COLORS[seriesIndex % CHART_COLORS.length];

    const markers = group.annotations.map(function (note) {
      const series = group.series[seriesIndex];
      const point = series && series.values[note.index];
      if (!point || !Number.isFinite(point.y)) return '';
      const cx = geometry.x(note.index);
      const cy = geometry.y(point.y);
      return [
        '<g class="md-chart__annotation" data-index="' + note.index + '" data-cx="' + cx.toFixed(2) + '" data-cy="' + cy.toFixed(2) + '">',
        '<line class="md-chart__annotation-leader" x1="' + cx.toFixed(2) + '" y1="' + cy.toFixed(2) + '" x2="' + cx.toFixed(2) + '" y2="' + cy.toFixed(2) + '"></line>',
        '<circle class="md-chart__annotation-ring" cx="' + cx.toFixed(2) + '" cy="' + cy.toFixed(2) + '" r="5.4" style="--annotation-color:' + color + '"></circle>',
        '<g class="md-chart__annotation-label">',
        '<rect class="md-chart__annotation-box" rx="6"></rect>',
        '<text class="md-chart__annotation-text">' + escapeHtml(note.text) + '</text>',
        '</g>',
        '</g>'
      ].join('');
    }).join('');

    return '<g class="md-chart__annotations" data-series="' + seriesIndex + '">' + markers + '</g>';
  }

  // Measure each label and place it clear of the plotted point, clamped inside the SVG.
  function placeAnnotations(figure, geometry) {
    const svg = figure.querySelector('.md-chart__svg');
    if (!svg) return;
    const groups = svg.querySelectorAll('.md-chart__annotation');
    if (!groups.length) return;

    const padX = 6;
    const minX = geometry.pad.left + 2;
    const maxX = geometry.width - geometry.pad.right - 2;
    const minY = geometry.pad.top + 2;

    groups.forEach(function (g) {
      const cx = parseFloat(g.getAttribute('data-cx'));
      const cy = parseFloat(g.getAttribute('data-cy'));
      const label = g.querySelector('.md-chart__annotation-label');
      const box = g.querySelector('.md-chart__annotation-box');
      const text = g.querySelector('.md-chart__annotation-text');
      const leader = g.querySelector('.md-chart__annotation-leader');
      if (!label || !box || !text) return;

      let bbox;
      try { bbox = text.getBBox(); } catch (_) { return; }
      const boxW = bbox.width + padX * 2;
      const boxH = bbox.height + 6;

      // Prefer placing the label above the point; flip below if it would clip the top.
      const above = cy - 34 - boxH >= minY;
      const anchorY = above ? cy - 34 : cy + 34;
      let labelX = cx - boxW / 2;
      labelX = Math.max(minX, Math.min(labelX, maxX - boxW));
      const labelY = above ? anchorY - boxH : anchorY;

      box.setAttribute('x', labelX.toFixed(2));
      box.setAttribute('y', labelY.toFixed(2));
      box.setAttribute('width', boxW.toFixed(2));
      box.setAttribute('height', boxH.toFixed(2));
      text.setAttribute('x', (labelX + boxW / 2).toFixed(2));
      text.setAttribute('y', (labelY + boxH / 2).toFixed(2));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'central');

      // Leader connects the ring to the nearest edge of the label box.
      const leaderEndY = above ? labelY + boxH : labelY;
      leader.setAttribute('x2', cx.toFixed(2));
      leader.setAttribute('y2', (leaderEndY + (above ? -1 : 1)).toFixed(2));
    });
  }

  function renderBarChart(chart, group, state) {
    const geometry = pointGeometry(chart, group, state);
    const series = visibleSeries(group, state);
    const categories = (group.series[0] && group.series[0].values || []).map(function (point) {
      return point.x;
    });
    const groupWidth = geometry.innerWidth / Math.max(categories.length, 1);
    const barWidth = Math.max(8, (groupWidth * 0.66) / Math.max(series.length, 1));
    const zeroY = geometry.y(Math.max(geometry.range.min, 0));

    const bars = series.map(function (item, seriesIndex) {
      const originalIndex = group.series.indexOf(item);
      const color = CHART_COLORS[originalIndex % CHART_COLORS.length];
      return item.values.map(function (point, index) {
        const x = geometry.pad.left + groupWidth * index + groupWidth * 0.17 + barWidth * seriesIndex;
        const yy = geometry.y(point.y);
        const h = Math.abs(zeroY - yy);
        return '<rect class="md-chart__bar" data-series="' + originalIndex + '" data-index="' + index + '" x="' + x.toFixed(2) + '" y="' + Math.min(yy, zeroY).toFixed(2) + '" width="' + barWidth.toFixed(2) + '" height="' + h.toFixed(2) + '" rx="5" fill="' + color + '"></rect>';
      }).join('');
    }).join('');

    const labels = categories.map(function (category, index) {
      return '<text x="' + (geometry.pad.left + groupWidth * index + groupWidth / 2).toFixed(2) + '" y="' + (geometry.height - 24) + '" text-anchor="middle" class="md-chart__axis-label">' + escapeHtml(category) + '</text>';
    }).join('');

    return [
      '<svg viewBox="0 0 ' + geometry.width + ' ' + geometry.height + '" class="md-chart__svg" aria-label="' + escapeHtml(chart.title) + '" data-count="' + categories.length + '">',
      renderAxis(geometry, chart.unit),
      '<line x1="' + geometry.pad.left + '" x2="' + (geometry.width - geometry.pad.right) + '" y1="' + zeroY + '" y2="' + zeroY + '" class="md-chart__axis"></line>',
      '<g class="md-chart__series">' + bars + '</g>',
      labels,
      '<rect class="md-chart__hitbox" x="' + geometry.pad.left + '" y="' + geometry.pad.top + '" width="' + geometry.innerWidth + '" height="' + geometry.innerHeight + '" fill="transparent"></rect>',
      '</svg>'
    ].join('');
  }

  function renderTooltip(figure, chart, group, state, index, pointX, pointY) {
    let tooltip = figure.querySelector('.md-chart__tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.className = 'md-chart__tooltip';
      figure.querySelector('.md-chart__canvas').appendChild(tooltip);
    }

    const rows = visibleSeries(group, state).map(function (series) {
      const point = series.values[index];
      const originalIndex = group.series.indexOf(series);
      if (!point) return '';
      return [
        '<div class="md-chart__tooltip-row">',
        '<span style="--tooltip-color:' + CHART_COLORS[originalIndex % CHART_COLORS.length] + '"></span>',
        '<strong>' + escapeHtml(series.name) + '</strong>',
        '<em>' + escapeHtml(formatValue(point.y, chart.unit)) + '</em>',
        '</div>'
      ].join('');
    }).join('');
    const xLabel = (group.series[0] && group.series[0].values[index] && group.series[0].values[index].x) || '';
    const extra = group.tooltips && group.tooltips[index] && group.tooltips[index].fields
      ? group.tooltips[index].fields.map(function (field) {
        return [
          '<div class="md-chart__tooltip-row md-chart__tooltip-row--muted">',
          '<span></span>',
          '<strong>' + escapeHtml(field.name) + '</strong>',
          '<em>' + escapeHtml(field.value) + '</em>',
          '</div>'
        ].join('');
      }).join('')
      : '';

    tooltip.innerHTML = '<div class="md-chart__tooltip-title">' + escapeHtml(chart.xLabel || 'x') + ' = ' + escapeHtml(xLabel) + '</div>' + rows + extra;
    const bounds = figure.querySelector('.md-chart__canvas').getBoundingClientRect();
    const tooltipWidth = tooltip.offsetWidth || 190;
    const tooltipHeight = tooltip.offsetHeight || 120;
    const gap = 14; // space between the point and the card (room for the arrow)

    // Lock horizontally centered over the data point, clamped inside the canvas.
    const left = clamp(pointX - tooltipWidth / 2, 8, bounds.width - tooltipWidth - 8);

    // Prefer above the point; flip below if it would clip the top edge.
    const above = pointY - gap - tooltipHeight >= 8;
    const top = above ? pointY - gap - tooltipHeight : pointY + gap;

    // Point the arrow at the data point, clamped to stay within the card width.
    const arrowX = clamp(pointX - left, 14, tooltipWidth - 14);
    tooltip.style.setProperty('--arrow-x', arrowX + 'px');
    tooltip.classList.toggle('is-below', !above);

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
    tooltip.classList.add('is-visible');
  }

  function attachChartPointer(figure, chart, group, state) {
    const canvas = figure.querySelector('.md-chart__canvas');
    const svg = figure.querySelector('.md-chart__svg');
    const cursor = figure.querySelector('.md-chart__cursor');
    const hitbox = figure.querySelector('.md-chart__hitbox');

    if (!canvas || !svg || !hitbox) return;

    function hide() {
      const tooltip = figure.querySelector('.md-chart__tooltip');
      if (tooltip) tooltip.classList.remove('is-visible');
      if (cursor) cursor.classList.remove('is-visible');
      svg.querySelectorAll('.md-chart__dot.is-current').forEach(function (dot) {
        dot.classList.remove('is-current');
        dot.setAttribute('r', '3.2');
      });
    }

    hitbox.addEventListener('mousemove', function (event) {
      const geometry = pointGeometry(chart, group, state);
      const rect = svg.getBoundingClientRect();
      const ratio = (event.clientX - rect.left) / rect.width;
      const svgX = ratio * geometry.width;
      const bounded = Math.max(geometry.pad.left, Math.min(svgX, geometry.width - geometry.pad.right));
      const index = Math.round(((bounded - geometry.pad.left) / geometry.innerWidth) * Math.max(geometry.count - 1, 1));

      if (cursor) {
        const cx = geometry.x(index);
        cursor.setAttribute('x1', cx);
        cursor.setAttribute('x2', cx);
        cursor.classList.add('is-visible');
      }

      svg.querySelectorAll('.md-chart__dot.is-current').forEach(function (dot) {
        dot.classList.remove('is-current');
        dot.setAttribute('r', '3.2');
      });
      svg.querySelectorAll('.md-chart__dot[data-index="' + index + '"]').forEach(function (dot) {
        dot.classList.add('is-current');
        dot.setAttribute('r', '4.7');
      });

      const clampedIndex = Math.max(0, Math.min(index, geometry.count - 1));

      // Map the data point from SVG space to canvas-local pixels so the card can
      // lock onto the point itself rather than chase the cursor.
      const local = canvas.getBoundingClientRect();
      const scaleX = rect.width / geometry.width;
      const scaleY = rect.height / geometry.height;
      const offsetX = rect.left - local.left;
      const offsetY = rect.top - local.top;
      const visible = visibleSeries(group, state);
      const topValue = visible.reduce(function (max, series) {
        const p = series.values[clampedIndex];
        return p && Number.isFinite(p.y) ? Math.max(max, p.y) : max;
      }, -Infinity);
      const anchorSvgY = Number.isFinite(topValue) ? geometry.y(topValue) : geometry.pad.top;
      const pointX = offsetX + geometry.x(clampedIndex) * scaleX;
      const pointY = offsetY + anchorSvgY * scaleY;

      renderTooltip(figure, chart, group, state, clampedIndex, pointX, pointY);
    });

    hitbox.addEventListener('mouseleave', hide);
  }

  function renderChart(figure, chart, state) {
    const canvas = figure.querySelector('.md-chart__canvas');
    const legend = figure.querySelector('.md-chart__legend');
    const controls = figure.querySelector('.md-chart__controls');
    const meta = figure.querySelector('.md-chart__meta');
    const group = getActiveGroup(chart, state);

    if (!canvas || !legend || !group) return;

    canvas.innerHTML = chart.type === 'bar'
      ? renderBarChart(chart, group, state)
      : renderLineChart(chart, group, state);
    figure.classList.toggle('md-chart--bar', chart.type === 'bar');
    figure.classList.toggle('md-chart--line', chart.type !== 'bar');

    if (chart.type !== 'bar') {
      placeAnnotations(figure, pointGeometry(chart, group, state));
    }

    if (meta) {
      meta.innerHTML = [
        chart.yLabel ? '<span>' + escapeHtml(chart.yLabel) + '</span>' : '',
        group.label && chart.controls && chart.controls.length > 1 ? '<span>' + escapeHtml(group.label) + '</span>' : ''
      ].filter(Boolean).join('');
    }

    legend.innerHTML = group.series.map(function (series, index) {
      const active = state.activeSeries[index] !== false;
      return '<button type="button" class="md-chart__legend-item' + (active ? ' is-active' : '') + '" data-series="' + index + '" style="--legend-color: ' + CHART_COLORS[index % CHART_COLORS.length] + '"><span></span>' + escapeHtml(series.name) + '</button>';
    }).join('');

    legend.querySelectorAll('button').forEach(function (button) {
      button.addEventListener('click', function () {
        const index = Number(button.getAttribute('data-series'));
        state.activeSeries[index] = state.activeSeries[index] === false;
        renderChart(figure, chart, state);
      });
    });

    if (controls) {
      controls.innerHTML = chart.controls && chart.controls.length > 1
        ? chart.controls.map(function (control) {
          const active = group.key === control.key;
          return '<button type="button" class="md-chart__control' + (active ? ' is-active' : '') + '" data-control="' + escapeHtml(control.key) + '">' + escapeHtml(control.label) + '</button>';
        }).join('')
        : '';

      controls.querySelectorAll('button').forEach(function (button) {
        button.addEventListener('click', function () {
          state.activeControl = button.getAttribute('data-control');
          state.activeSeries = (getActiveGroup(chart, state).series || []).map(function () { return true; });
          renderChart(figure, chart, state);
        });
      });
    }

    attachChartPointer(figure, chart, group, state);
    figure.classList.add('is-rendered');
  }

  function enhanceCharts() {
    document.querySelectorAll('.md-chart[data-chart]').forEach(function (figure) {
      let chart;

      try {
        chart = JSON.parse(figure.getAttribute('data-chart'));
      } catch (_) {
        return;
      }

      const activeGroup = chart.groups && chart.groups[0];
      if (!activeGroup) return;

      const state = {
        activeControl: chart.activeControl,
        activeSeries: activeGroup.series.map(function () { return true; })
      };
      renderChart(figure, chart, state);
    });
  }

  function loadInterFont() {
    if (document.querySelector('link[href*="fonts.googleapis.com/css2"][href*="Inter"]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;450;500;520;550;600;620;640;660;700&display=swap';
    document.head.appendChild(link);
  }

  function addLanguageLabel(pre) {
    var code = pre.querySelector('code');
    if (!code || pre.querySelector('.code-lang-label')) return;

    var classes = (code.className || '').split(/\s+/);
    var lang = '';
    for (var i = 0; i < classes.length; i++) {
      var cls = classes[i];
      if (cls.startsWith('language-')) { lang = cls.slice(9); break; }
      if (/^(python|javascript|js|bash|json|yaml|yml|go|rust|c|cpp|java|typescript|ts|sql|html|css|shell|sh|ruby|php|swift|kotlin|dockerfile|toml|xml|markdown|md|lua|perl|r|scala|haskell|elixir|clojure|zig|nim|makefile|nginx|apache|ini|diff)$/.test(cls)) {
        lang = cls; break;
      }
    }
    if (!lang || lang === 'text' || lang === 'plaintext') return;

    var label = document.createElement('span');
    label.className = 'code-lang-label';
    label.textContent = lang.toUpperCase();
    label.setAttribute('aria-hidden', 'true');
    pre.appendChild(label);
  }

  function enhanceSeriesGrouping() {
    if (!document.querySelector('.index')) return;
    var articles = document.querySelectorAll('.index > article[id^="post-"]');
    if (!articles.length) return;

    var seriesRe = /^post-(.+?)（[一二三四五六七八九十\d]+）/;
    var groups = [];
    var current = null;

    articles.forEach(function (el) {
      var m = (el.id || '').match(seriesRe);
      var key = m ? m[1] : null;
      if (key && current && current.key === key) {
        current.els.push(el);
      } else if (key) {
        current = { key: key, els: [el] };
        groups.push(current);
      } else {
        current = null;
      }
    });

    groups.forEach(function (g) {
      if (g.els.length < 2) return;
      g.els.forEach(function (el, i) {
        el.classList.add('series-group');
        if (i === 0) el.classList.add('series-group--first');
        if (i === g.els.length - 1) el.classList.add('series-group--last');
      });
    });
  }

  function formatVisitCounter() {
    var el = document.getElementById('busuanzi_value_site_pv');
    if (!el) return;
    var observer = new MutationObserver(function () {
      var raw = el.textContent.trim();
      if (/^\d+$/.test(raw) && raw.length > 3) {
        el.textContent = Number(raw).toLocaleString();
        observer.disconnect();
      }
    });
    observer.observe(el, { childList: true, characterData: true, subtree: true });
  }

  function enhanceTraceScroll() {
    var traces = document.querySelectorAll('.md-trace__list');
    traces.forEach(function (el) {
      var isDown = false, startX, scrollLeft;
      el.addEventListener('mousedown', function (e) {
        isDown = true;
        el.style.cursor = 'grabbing';
        startX = e.pageX - el.offsetLeft;
        scrollLeft = el.scrollLeft;
      });
      el.addEventListener('mouseleave', function () { isDown = false; el.style.cursor = 'grab'; });
      el.addEventListener('mouseup', function () { isDown = false; el.style.cursor = 'grab'; });
      el.addEventListener('mousemove', function (e) {
        if (!isDown) return;
        e.preventDefault();
        var x = e.pageX - el.offsetLeft;
        el.scrollLeft = scrollLeft - (x - startX);
      });
    });
  }

  function addReadingTime() {
    var entry = document.querySelector('.post .article .article-entry');
    var moreInfo = document.querySelector('.post .article .article-more-info');
    if (!entry || !moreInfo) return;

    var text = entry.textContent || '';
    var cjk = (text.match(/[一-鿿㐀-䶿]/g) || []).length;
    var words = text.replace(/[一-鿿㐀-䶿]/g, ' ').split(/\s+/).filter(Boolean).length;
    var total = cjk + words;
    var minutes = Math.max(1, Math.round((cjk / 300) + (words / 200)));

    var countStr = total >= 1000 ? (total / 1000).toFixed(1) + 'k' : String(total);
    var el = document.createElement('div');
    el.className = 'article-reading-info';
    el.innerHTML = '<span>' + countStr + ' 字</span><span>·</span><span>约 ' + minutes + ' 分钟</span>';
    moreInfo.appendChild(el);
  }

  function runEnhancements() {
    loadInterFont();
    document.documentElement.style.setProperty('--ink-font-body', BODY_FONT);
    document.documentElement.style.setProperty('--ink-font-mono', MONO);
    document.documentElement.style.setProperty('--blog-code-font', MONO);
    enhanceMultilineTableCodeCells();
    enhanceCodeBlocks();
    enhanceTables();
    enhanceCharts();
    enhanceSeriesGrouping();
    formatVisitCounter();
    enhanceTraceScroll();
    addReadingTime();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runEnhancements);
  } else {
    runEnhancements();
  }
}());
