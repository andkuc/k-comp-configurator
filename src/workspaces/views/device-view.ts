// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Device Workspace View Module (v0.4.1): Web Serial Monitor, Canvas 2D Live Plotter & Monitor/Split/Plotter Switcher
import { state, escapeHtml, getProjectSlug } from '../../core/state';
import { parseCharList } from '../../core/code-blocks';
import {
  COMMON_BAUD_RATES,
  buildSimulatorContextFromBoard,
  deviceSession,
  formatTimestampMs,
  getCompilerProvider,
  isWebSerialAvailable,
  type DeviceSessionSnapshot,
  type LineEndingMode,
  type SerialLogEntry
} from '../../services';
import { appBus, type DerivedWorkspace } from '../../store/bus';
import { uiSessionStore } from '../../store/ui-session';
import type { WorkspaceContext, WorkspaceModule } from '../types';
import { createDevicePlotter, type DevicePlotterController } from './device-plotter';

export type DeviceViewMode = 'monitor' | 'split' | 'plotter';

export function createDeviceWorkspaceModule(): WorkspaceModule {
  let host: HTMLElement | null = null;
  let context: WorkspaceContext | null = null;
  let currentDerived: DerivedWorkspace | null = null;
  let sessionUnsub: (() => void) | null = null;
  let themeUnsub: (() => void) | null = null;
  let plotter: DevicePlotterController | null = null;
  let viewMode: DeviceViewMode = 'split';
  let rafId = 0;
  let dirty = false;
  let filterQuery = '';
  let autoScroll = true;
  let historyIndex = -1;
  let draftInput = '';
  let lastRenderedEntryId = 0;
  let lastRenderedFilter = '';
  let lastRenderedTimestamps = true;
  let initializedBaudForBoard: string | null = null;

  function triggerDownload(filename: string, content: string, mime: string): void {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function triggerDataUrlDownload(filename: string, dataUrl: string): void {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
  }

  function getQuickParserCommands(): string[] {
    const parserBlk = (state.codeBlocks || []).find((b) => b.type === 'char_parser');
    if (!parserBlk) return [];
    return parseCharList(parserBlk.config?.chars);
  }

  function getStatusMeta(snap: DeviceSessionSnapshot, t: WorkspaceContext['t']): { cls: string; label: string } {
    if (snap.portState === 'monitoring') {
      if (snap.mode === 'simulator') {
        return { cls: 'is-sim', label: t('dev.statusSim') };
      }
      return { cls: 'is-connected', label: t('dev.statusConnected') };
    }
    if (snap.portState === 'connecting' || snap.portState === 'reconnecting') {
      return { cls: 'is-busy', label: t('dev.statusConnecting') };
    }
    if (snap.portState === 'error') {
      return { cls: 'is-error', label: t('dev.statusError') };
    }
    return { cls: 'is-idle', label: t('dev.statusDisconnected') };
  }

  function renderEntryHtml(entry: SerialLogEntry, showTs: boolean): string {
    const tsHtml = showTs
      ? `<span class="dev-log-ts">${escapeHtml(formatTimestampMs(entry.timestampMs))}</span>`
      : '';
    const prefix = entry.dir === 'tx' ? '<span class="dev-log-dir">TX &gt;</span>' : '';
    return `<div class="dev-log-line is-${entry.dir}">${tsHtml}${prefix}<span class="dev-log-txt">${escapeHtml(entry.text)}</span></div>`;
  }

  function applyViewModeToDom(): void {
    if (!host) return;
    const bodyGrid = host.querySelector<HTMLElement>('#devBodyGrid');
    if (bodyGrid) {
      bodyGrid.classList.remove('mode-monitor', 'mode-split', 'mode-plotter');
      bodyGrid.classList.add(`mode-${viewMode}`);
    }
    host.querySelectorAll<HTMLButtonElement>('[data-dev-view-mode]').forEach((btn) => {
      const isAct = btn.dataset.devViewMode === viewMode;
      btn.classList.toggle('active', isAct);
      btn.setAttribute('aria-pressed', String(isAct));
    });
    if (viewMode !== 'monitor') {
      plotter?.render();
    }
  }

  function updateLiveDom(): void {
    if (!host || !context) return;
    const { t } = context;
    const snap = deviceSession.getSnapshot();
    const derived = currentDerived || context.getDerived();
    const board = derived.board;
    const connected = snap.portState === 'monitoring';
    const webSerialOk = isWebSerialAvailable();

    // 1. Connection status badge + connect/disconnect buttons
    const statusEl = host.querySelector<HTMLElement>('#devStatusPill');
    if (statusEl) {
      const meta = getStatusMeta(snap, t);
      statusEl.className = `dev-status-pill ${meta.cls}`;
      const portText = snap.deviceInfo
        ? `${meta.label} · ${snap.deviceInfo.portLabel} (${snap.deviceInfo.baudRate})`
        : meta.label;
      statusEl.innerHTML = `<span class="dev-status-dot" aria-hidden="true"></span><span>${escapeHtml(portText)}</span>`;
    }

    const btnConn = host.querySelector<HTMLButtonElement>('#btnDevConnect');
    if (btnConn) {
      if (connected && snap.mode === 'web-serial') {
        btnConn.textContent = t('dev.disconnect');
        btnConn.className = 'btn btn-danger btn-sm';
        btnConn.disabled = false;
      } else {
        btnConn.textContent = t('dev.connectUsb');
        btnConn.className = 'btn btn-primary btn-sm';
        btnConn.disabled = !webSerialOk || snap.portState === 'connecting';
      }
    }

    const btnSim = host.querySelector<HTMLButtonElement>('#btnDevSim');
    if (btnSim) {
      const simActive = connected && snap.mode === 'simulator';
      btnSim.textContent = simActive ? t('dev.stopSim') : t('dev.startSim');
      btnSim.className = simActive ? 'btn btn-danger btn-sm' : 'btn btn-ghost btn-sm';
    }

    const baudSel = host.querySelector<HTMLSelectElement>('#devBaudSelect');
    if (baudSel) {
      if (String(snap.baudRate) !== baudSel.value) {
        baudSel.value = String(snap.baudRate);
      }
      baudSel.disabled = connected;
    }

    const btnReset = host.querySelector<HTMLButtonElement>('#btnDevReset');
    if (btnReset) btnReset.disabled = !connected;

    const btnPause = host.querySelector<HTMLButtonElement>('#btnDevPause');
    if (btnPause) {
      btnPause.classList.toggle('is-active', snap.paused);
      btnPause.textContent = snap.paused ? `▶ ${t('dev.resume')}` : `⏸ ${t('dev.pause')}`;
    }

    const btnTs = host.querySelector<HTMLButtonElement>('#btnDevTimestamps');
    if (btnTs) {
      btnTs.classList.toggle('is-active', snap.showTimestamps);
      btnTs.setAttribute('aria-pressed', String(snap.showTimestamps));
    }

    const sendInp = host.querySelector<HTMLInputElement>('#devSendInput');
    const sendBtn = host.querySelector<HTMLButtonElement>('#btnDevSend');
    if (sendInp) sendInp.disabled = !connected;
    if (sendBtn) sendBtn.disabled = !connected;
    host.querySelectorAll<HTMLButtonElement>('[data-dev-quick-cmd]').forEach((b) => {
      b.disabled = !connected;
    });

    // 2. Telemetry live channel pills in Monitor-only mode
    const chStrip = host.querySelector<HTMLElement>('#devTelemetryStrip');
    if (chStrip) {
      if (viewMode === 'monitor' && snap.plotChannels.length && snap.latestSample) {
        const latest = snap.latestSample;
        const pills = snap.plotChannels.map((ch) => {
          const val = latest.channels[ch];
          const valStr = val !== undefined ? String(val) : '—';
          return `<span class="dev-ch-pill"><span class="dev-ch-name">${escapeHtml(ch)}</span><strong>${escapeHtml(valStr)}</strong></span>`;
        }).join('');
        chStrip.innerHTML = `<span class="dev-ch-head">${escapeHtml(t('dev.liveChannels'))}</span>${pills}<span class="dev-ch-meta">${snap.sampleCount} ${escapeHtml(t('dev.samples'))}</span>`;
        chStrip.classList.remove('hidden');
      } else {
        chStrip.classList.add('hidden');
        chStrip.innerHTML = '';
      }
    }

    // 3. Stats footer (RX lines / bytes / USB target info)
    const statsEl = host.querySelector<HTMLElement>('#devMonitorStats');
    if (statsEl) {
      const kb = snap.rxBytesTotal >= 1024 ? `${(snap.rxBytesTotal / 1024).toFixed(1)} KB` : `${snap.rxBytesTotal} B`;
      const dropStr = snap.droppedLines > 0 ? ` · ${t('dev.dropped', { count: snap.droppedLines })}` : '';
      statsEl.textContent = `${snap.rxLinesTotal} ${t('dev.lines')} · ${kb}${dropStr} · ${board.shortName} (~${derived.usbCurrent.total}/${board.electrical.usbMaxMa} mA)`;
    }

    // 4. Error banner
    const errBox = host.querySelector<HTMLElement>('#devErrorBanner');
    if (errBox) {
      if (snap.lastError) {
        errBox.textContent = snap.lastError;
        errBox.classList.remove('hidden');
      } else {
        errBox.classList.add('hidden');
        errBox.textContent = '';
      }
    }

    // 5. Log output viewport (incremental when appending without filter changes, full rebuild otherwise)
    const outEl = host.querySelector<HTMLElement>('#devLogViewport');
    if (outEl) {
      const entries = deviceSession.getEntries();
      const q = filterQuery.trim().toLowerCase();
      const needsFullRebuild =
        q !== lastRenderedFilter ||
        snap.showTimestamps !== lastRenderedTimestamps ||
        entries.length === 0 ||
        (entries.length > 0 && entries[0].id > lastRenderedEntryId) ||
        lastRenderedEntryId === 0;

      if (entries.length === 0) {
        outEl.innerHTML = `<div class="dev-log-empty">${escapeHtml(t('dev.emptyLog'))}</div>`;
        lastRenderedEntryId = 0;
      } else if (needsFullRebuild) {
        const filtered = q ? entries.filter((e) => e.text.toLowerCase().includes(q)) : entries;
        if (!filtered.length) {
          outEl.innerHTML = `<div class="dev-log-empty">${escapeHtml(t('dev.noFilterMatch'))}</div>`;
        } else {
          outEl.innerHTML = filtered.map((e) => renderEntryHtml(e, snap.showTimestamps)).join('');
        }
        lastRenderedEntryId = entries[entries.length - 1].id;
      } else {
        const fresh = entries.filter((e) => e.id > lastRenderedEntryId && (!q || e.text.toLowerCase().includes(q)));
        if (fresh.length) {
          const emptyPlaceholder = outEl.querySelector('.dev-log-empty');
          if (emptyPlaceholder) emptyPlaceholder.remove();
          outEl.insertAdjacentHTML('beforeend', fresh.map((e) => renderEntryHtml(e, snap.showTimestamps)).join(''));
          while (outEl.childElementCount > 2000 && outEl.firstElementChild) {
            outEl.firstElementChild.remove();
          }
        }
        lastRenderedEntryId = entries[entries.length - 1].id;
      }

      lastRenderedFilter = q;
      lastRenderedTimestamps = snap.showTimestamps;

      if (autoScroll) {
        outEl.scrollTop = outEl.scrollHeight;
      }
    }

    const jumpBtn = host.querySelector<HTMLElement>('#btnDevJumpLive');
    if (jumpBtn) {
      jumpBtn.classList.toggle('hidden', autoScroll);
    }

    const btnExportCsv = host.querySelector<HTMLButtonElement>('#btnDevExportCsv');
    if (btnExportCsv) {
      btnExportCsv.disabled = snap.sampleCount === 0;
    }
    const btnExportLog = host.querySelector<HTMLButtonElement>('#btnDevExportLog');
    if (btnExportLog) {
      btnExportLog.disabled = deviceSession.getEntries().length === 0;
    }

    // 6. Update Canvas 2D Live Plotter cleanly within the same rAF pass!
    if (plotter) {
      plotter.update(deviceSession.getPlotSamples(), deviceSession.getPlotChannels());
    }
  }

  function scheduleUpdate(): void {
    dirty = true;
    if (rafId) return;
    if (typeof requestAnimationFrame === 'function') {
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        if (dirty) {
          dirty = false;
          updateLiveDom();
        }
      });
    } else {
      dirty = false;
      updateLiveDom();
    }
  }

  function renderQuickSendRow(): void {
    if (!host || !context) return;
    const row = host.querySelector<HTMLElement>('#devQuickSendRow');
    if (!row) return;
    const cmds = getQuickParserCommands();
    if (!cmds.length) {
      row.classList.add('hidden');
      row.innerHTML = '';
      return;
    }
    const connected = deviceSession.isConnected();
    row.classList.remove('hidden');
    row.innerHTML = `
      <span class="dev-quick-lbl">${escapeHtml(context.t('dev.quickSend'))}</span>
      ${cmds.map((ch) => `<button type="button" class="dev-quick-chip" data-dev-quick-cmd="${escapeHtml(ch)}" ${connected ? '' : 'disabled'}>${escapeHtml(ch)}</button>`).join('')}`;
    row.querySelectorAll<HTMLButtonElement>('[data-dev-quick-cmd]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cmd = btn.dataset.devQuickCmd;
        if (cmd) void deviceSession.sendText(cmd);
      });
    });
  }

  function renderShell(derived: DerivedWorkspace): void {
    if (!host || !context) return;
    const { t } = context;
    const board = derived.board;
    const snap = deviceSession.getSnapshot();
    const webSerialOk = isWebSerialAvailable();
    const compiler = getCompilerProvider();
    const proto = (board.targetMeta?.flashProtocol || 'none').toUpperCase();
    const defaultBaud = board.targetMeta?.defaultBaud || 115200;

    if (!deviceSession.isConnected() && initializedBaudForBoard !== board.id) {
      initializedBaudForBoard = board.id;
      deviceSession.setBaudRate(defaultBaud);
    }

    const activeBaud = deviceSession.getSnapshot().baudRate;
    const baudOptions = COMMON_BAUD_RATES.map((b) =>
      `<option value="${b}" ${b === activeBaud ? 'selected' : ''}>${b} baud</option>`
    ).join('');

    const browserGateHtml = !webSerialOk
      ? `<div class="dev-capability-banner" role="status">
           <strong>${escapeHtml(t('dev.noWebSerialTitle'))}</strong>
           <span>${escapeHtml(t('dev.noWebSerialDesc'))}</span>
         </div>`
      : '';

    host.innerHTML = `
      <div class="dev-workspace-shell">
        <div class="dev-toolbar">
          <div class="dev-toolbar-left">
            <button type="button" id="btnDevConnect" class="btn btn-primary btn-sm">${escapeHtml(t('dev.connectUsb'))}</button>
            <button type="button" id="btnDevSim" class="btn btn-ghost btn-sm">${escapeHtml(t('dev.startSim'))}</button>
            <select id="devBaudSelect" class="dev-select" aria-label="${escapeHtml(t('dev.baudLabel'))}">${baudOptions}</select>
            <button type="button" id="btnDevReset" class="btn btn-ghost btn-sm" title="${escapeHtml(t('dev.resetTitle'))}">↻ ${escapeHtml(t('dev.reset'))}</button>
            <span id="devStatusPill" class="dev-status-pill is-idle"></span>
          </div>
          <div class="dev-toolbar-right">
            <div class="dev-view-switch" role="group" aria-label="${escapeHtml(t('dev.viewModeLabel'))}">
              <button type="button" class="dev-vmode-btn ${viewMode === 'monitor' ? 'active' : ''}" data-dev-view-mode="monitor" aria-pressed="${String(viewMode === 'monitor')}">${escapeHtml(t('dev.viewMonitor'))}</button>
              <button type="button" class="dev-vmode-btn ${viewMode === 'split' ? 'active' : ''}" data-dev-view-mode="split" aria-pressed="${String(viewMode === 'split')}">${escapeHtml(t('dev.viewSplit'))}</button>
              <button type="button" class="dev-vmode-btn ${viewMode === 'plotter' ? 'active' : ''}" data-dev-view-mode="plotter" aria-pressed="${String(viewMode === 'plotter')}">${escapeHtml(t('dev.viewPlotter'))}</button>
            </div>
            <span class="dev-target-chip" title="${escapeHtml(t('ws.kpiFlashProto'))}">${escapeHtml(board.shortName)} · ${escapeHtml(proto)}${compiler ? ` · ${escapeHtml(compiler.name)}` : ''}</span>
            <button type="button" id="btnDevPause" class="btn btn-ghost btn-sm">⏸ ${escapeHtml(t('dev.pause'))}</button>
            <button type="button" id="btnDevClear" class="btn btn-ghost btn-sm" title="${escapeHtml(t('dev.clearTitle'))}">⌫ ${escapeHtml(t('dev.clear'))}</button>
            <button type="button" class="btn btn-ghost btn-sm" data-ws-return="hardware">← ${escapeHtml(t('ws.backToHardware'))}</button>
          </div>
        </div>

        ${browserGateHtml}
        <div id="devErrorBanner" class="dev-error-banner hidden" role="alert"></div>

        <div id="devBodyGrid" class="dev-body-grid mode-${viewMode}">
          <div class="dev-monitor-card">
            <div class="dev-monitor-subbar">
              <div class="dev-monitor-subbar-left">
                <span class="dev-panel-title">${escapeHtml(t('dev.monitorTitle'))}</span>
                <input type="search" id="devFilterInput" class="dev-filter-input" value="${escapeHtml(filterQuery)}" placeholder="${escapeHtml(t('dev.filterPlaceholder'))}" aria-label="${escapeHtml(t('dev.filterPlaceholder'))}" />
              </div>
              <div class="dev-monitor-subbar-right">
                <button type="button" id="btnDevTimestamps" class="dev-mini-toggle ${snap.showTimestamps ? 'is-active' : ''}" aria-pressed="${String(snap.showTimestamps)}">${escapeHtml(t('dev.timestamps'))}</button>
                <button type="button" id="btnDevExportLog" class="dev-mini-toggle" title="${escapeHtml(t('dev.exportLogTitle'))}">⬇ .txt</button>
                <button type="button" id="btnDevExportCsv" class="dev-mini-toggle" title="${escapeHtml(t('dev.exportCsvTitle'))}">⬇ .csv</button>
              </div>
            </div>

            <div id="devTelemetryStrip" class="dev-telemetry-strip hidden"></div>

            <div class="dev-log-wrap">
              <div id="devLogViewport" class="dev-log-viewport" role="log" aria-live="off"></div>
              <button type="button" id="btnDevJumpLive" class="dev-jump-live hidden">↓ ${escapeHtml(t('dev.jumpLive'))}</button>
            </div>

            <div id="devQuickSendRow" class="dev-quick-send-row hidden"></div>

            <form id="devSendForm" class="dev-send-bar" autocomplete="off">
              <input type="text" id="devSendInput" class="dev-send-input" placeholder="${escapeHtml(t('dev.sendPlaceholder'))}" aria-label="${escapeHtml(t('dev.sendPlaceholder'))}" />
              <select id="devLineEndingSelect" class="dev-select" aria-label="${escapeHtml(t('dev.lineEndingLabel'))}">
                <option value="lf" ${snap.lineEnding === 'lf' ? 'selected' : ''}>LF (\\n)</option>
                <option value="crlf" ${snap.lineEnding === 'crlf' ? 'selected' : ''}>CRLF (\\r\\n)</option>
                <option value="none" ${snap.lineEnding === 'none' ? 'selected' : ''}>${escapeHtml(t('dev.lineEndingNone'))}</option>
              </select>
              <button type="submit" id="btnDevSend" class="btn btn-primary btn-sm">${escapeHtml(t('dev.send'))}</button>
            </form>
          </div>

          <div id="devPlotterPane" class="dev-plotter-card"></div>
        </div>

        <div class="dev-monitor-foot">
          <span id="devMonitorStats" class="dev-stats-text"></span>
          <span class="dev-next-hint">${escapeHtml(t('dev.plotFormatHint'))}</span>
        </div>
      </div>`;

    // Mount HiDPI Canvas 2D Live Plotter into #devPlotterPane
    const plotPane = host.querySelector<HTMLElement>('#devPlotterPane');
    if (plotPane) {
      if (plotter) {
        plotter.destroy();
        plotter = null;
      }
      plotter = createDevicePlotter(plotPane, t, (dataUrl) => {
        triggerDataUrlDownload(`${getProjectSlug('kcomp')}-plot.png`, dataUrl);
      });
    }

    // Bind interactive controls
    host.querySelector<HTMLElement>('[data-ws-return]')?.addEventListener('click', () => {
      void context?.switchWorkspace('hardware');
    });

    host.querySelectorAll<HTMLButtonElement>('[data-dev-view-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const m = btn.dataset.devViewMode;
        if (m === 'monitor' || m === 'split' || m === 'plotter') {
          viewMode = m;
          applyViewModeToDom();
          updateLiveDom();
        }
      });
    });

    host.querySelector<HTMLButtonElement>('#btnDevConnect')?.addEventListener('click', async () => {
      const s = deviceSession.getSnapshot();
      if (s.portState === 'monitoring' && s.mode === 'web-serial') {
        await deviceSession.disconnect();
        return;
      }
      try {
        await deviceSession.connectWebSerial(s.baudRate);
      } catch (err: unknown) {
        if (!(err instanceof Error && err.name === 'NotFoundError')) {
          appBus.emit('ui:toast', { msg: err instanceof Error ? err.message : String(err) });
        }
      }
    });

    host.querySelector<HTMLButtonElement>('#btnDevSim')?.addEventListener('click', async () => {
      const s = deviceSession.getSnapshot();
      if (s.portState === 'monitoring' && s.mode === 'simulator') {
        await deviceSession.disconnect();
        return;
      }
      await deviceSession.connectSimulator(() => {
        const d = currentDerived || context!.getDerived();
        return buildSimulatorContextFromBoard(
          d.board,
          state.active.map((a) => a.compId),
          state.onboard
        );
      }, s.baudRate);
    });

    host.querySelector<HTMLSelectElement>('#devBaudSelect')?.addEventListener('change', (ev) => {
      const val = parseInt((ev.target as HTMLSelectElement).value, 10);
      if (Number.isFinite(val)) deviceSession.setBaudRate(val);
    });

    host.querySelector<HTMLButtonElement>('#btnDevReset')?.addEventListener('click', () => {
      const d = currentDerived || context?.getDerived();
      if (d) void deviceSession.resetBoard(d.board.mcu);
    });

    host.querySelector<HTMLButtonElement>('#btnDevPause')?.addEventListener('click', () => {
      deviceSession.togglePaused();
    });

    host.querySelector<HTMLButtonElement>('#btnDevClear')?.addEventListener('click', () => {
      deviceSession.clear();
      plotter?.resetBounds();
    });

    host.querySelector<HTMLButtonElement>('#btnDevTimestamps')?.addEventListener('click', () => {
      deviceSession.setShowTimestamps(!deviceSession.getSnapshot().showTimestamps);
    });

    host.querySelector<HTMLInputElement>('#devFilterInput')?.addEventListener('input', (ev) => {
      filterQuery = (ev.target as HTMLInputElement).value;
      updateLiveDom();
    });

    host.querySelector<HTMLSelectElement>('#devLineEndingSelect')?.addEventListener('change', (ev) => {
      const val = (ev.target as HTMLSelectElement).value;
      const mode: LineEndingMode = val === 'crlf' ? 'crlf' : (val === 'none' ? 'none' : 'lf');
      deviceSession.setLineEnding(mode);
    });

    host.querySelector<HTMLButtonElement>('#btnDevExportLog')?.addEventListener('click', () => {
      const txt = deviceSession.exportLogText();
      if (!txt) return;
      triggerDownload(`${getProjectSlug('kcomp')}-serial.txt`, txt, 'text/plain;charset=utf-8');
    });

    host.querySelector<HTMLButtonElement>('#btnDevExportCsv')?.addEventListener('click', () => {
      const csv = deviceSession.exportPlotCsv();
      if (!csv) return;
      triggerDownload(`${getProjectSlug('kcomp')}-telemetry.csv`, csv, 'text/csv;charset=utf-8');
    });

    const logViewport = host.querySelector<HTMLElement>('#devLogViewport');
    if (logViewport) {
      logViewport.addEventListener('scroll', () => {
        const nearBottom = logViewport.scrollHeight - logViewport.scrollTop - logViewport.clientHeight <= 24;
        if (autoScroll !== nearBottom) {
          autoScroll = nearBottom;
          const jb = host?.querySelector<HTMLElement>('#btnDevJumpLive');
          if (jb) jb.classList.toggle('hidden', autoScroll);
        }
      });
    }

    host.querySelector<HTMLButtonElement>('#btnDevJumpLive')?.addEventListener('click', () => {
      autoScroll = true;
      const vp = host?.querySelector<HTMLElement>('#devLogViewport');
      if (vp) vp.scrollTop = vp.scrollHeight;
      host?.querySelector<HTMLElement>('#btnDevJumpLive')?.classList.add('hidden');
    });

    const sendInp = host.querySelector<HTMLInputElement>('#devSendInput');
    if (sendInp) {
      sendInp.addEventListener('keydown', (ev: KeyboardEvent) => {
        const hist = deviceSession.getTxHistory();
        if (!hist.length) return;
        if (ev.key === 'ArrowUp') {
          ev.preventDefault();
          if (historyIndex === -1) {
            draftInput = sendInp.value;
            historyIndex = hist.length - 1;
          } else if (historyIndex > 0) {
            historyIndex--;
          }
          sendInp.value = hist[historyIndex] || '';
        } else if (ev.key === 'ArrowDown' && historyIndex !== -1) {
          ev.preventDefault();
          if (historyIndex < hist.length - 1) {
            historyIndex++;
            sendInp.value = hist[historyIndex] || '';
          } else {
            historyIndex = -1;
            sendInp.value = draftInput;
          }
        }
      });
    }

    host.querySelector<HTMLFormElement>('#devSendForm')?.addEventListener('submit', (ev) => {
      ev.preventDefault();
      if (!sendInp || !deviceSession.isConnected()) return;
      const text = sendInp.value;
      sendInp.value = '';
      historyIndex = -1;
      draftInput = '';
      void deviceSession.sendText(text);
    });

    lastRenderedEntryId = 0;
    applyViewModeToDom();
    renderQuickSendRow();
    updateLiveDom();
  }

  return {
    id: 'device',
    mount(container: HTMLElement, ctx: WorkspaceContext): void {
      host = container;
      context = ctx;
      currentDerived = ctx.getDerived();
      autoScroll = true;
      renderShell(currentDerived);

      if (sessionUnsub) sessionUnsub();
      sessionUnsub = deviceSession.subscribe(() => {
        scheduleUpdate();
      });

      if (themeUnsub) themeUnsub();
      themeUnsub = uiSessionStore.subscribe((_snap, keys) => {
        if (keys.includes('theme')) {
          plotter?.render();
        }
      });
    },
    unmount(): void {
      if (rafId && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      if (sessionUnsub) {
        sessionUnsub();
        sessionUnsub = null;
      }
      if (themeUnsub) {
        themeUnsub();
        themeUnsub = null;
      }
      if (plotter) {
        plotter.destroy();
        plotter = null;
      }
      if (host) host.innerHTML = '';
      host = null;
      context = null;
      lastRenderedEntryId = 0;
    },
    onProjectChange(derived: DerivedWorkspace): void {
      currentDerived = derived;
      if (!host || !context) return;
      const board = derived.board;
      const targetChip = host.querySelector<HTMLElement>('.dev-target-chip');
      if (targetChip) {
        const compiler = getCompilerProvider();
        const proto = (board.targetMeta?.flashProtocol || 'none').toUpperCase();
        targetChip.textContent = `${board.shortName} · ${proto}${compiler ? ` · ${compiler.name}` : ''}`;
      }
      if (!deviceSession.isConnected() && initializedBaudForBoard !== board.id) {
        initializedBaudForBoard = board.id;
        deviceSession.setBaudRate(board.targetMeta?.defaultBaud || 115200);
      }
      renderQuickSendRow();
      updateLiveDom();
    },
    onActiveNodeChange(): void {
      if (context) {
        this.onProjectChange?.(context.getDerived());
      }
    }
  };
}
