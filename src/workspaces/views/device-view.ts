// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Device Workspace View Module (v0.4.5): Serial Monitor, Live Plotter, Browser Flasher, Multi-Server Compile & L0 Self-Test
import { state, escapeHtml, getProjectSlug } from '../../core/state';
import { CATALOG } from '../../catalog';
import { parseCharList } from '../../core/code-blocks';
import { buildSelfTestSpec, generateSelfTestSketch } from '../../core/selftest';
import {
  COMMON_BAUD_RATES,
  buildSimulatorContextFromBoard,
  createEspSingleBinArtifact,
  createIHexArtifact,
  deviceSession,
  evaluateSelfTestReport,
  formatTimestampMs,
  getCompilerProvider,
  hasPairedMcp2221WebHid,
  inspectEspBinary,
  isWebHidAvailable,
  isWebSerialAvailable,
  parseFlashOffset,
  requestMcp2221WebHidPairing,
  type CompileDiagnostic,
  type CompileMemoryUsage,
  type CompileRequest,
  type CompileResult,
  type CompilerHealthStatus,
  type DeviceSessionSnapshot,
  type FirmwareArtifact,
  type FlashResetPreference,
  type LineEndingMode,
  type SelfTestCheckItem,
  type SelfTestSpec,
  type SerialLogEntry
} from '../../services';
import { appBus, type DerivedWorkspace } from '../../store/bus';
import { settingsStore } from '../../store/settings';
import { uiSessionStore } from '../../store/ui-session';
import type { WorkspaceContext, WorkspaceModule } from '../types';
import { createDevicePlotter, type DevicePlotterController } from './device-plotter';

export type DeviceViewMode = 'monitor' | 'split' | 'plotter';

function extractSketchLibraries(source: string): string[] {
  const libs = new Set<string>();
  const re = /^\s*#include\s*<([^>]+)>/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const hdr = m[1].trim();
    if (hdr) libs.add(hdr);
  }
  return Array.from(libs).sort();
}

function formatByteCount(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function createDeviceWorkspaceModule(): WorkspaceModule {
  let host: HTMLElement | null = null;
  let context: WorkspaceContext | null = null;
  let currentDerived: DerivedWorkspace | null = null;
  let sessionUnsub: (() => void) | null = null;
  let themeUnsub: (() => void) | null = null;
  let settingsUnsub: (() => void) | null = null;
  let compilerBusUnsub: (() => void) | null = null;
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
  let resetPreference: FlashResetPreference = 'auto';
  let flashOffsetSelection = 'auto';
  let mcp2221HidPaired = false;
  let flashInfoModalOpen = false;
  let flashInfoEscHandler: ((ev: KeyboardEvent) => void) | null = null;

  // v0.4.5-c1: Compiler Health, Build & Diagnostics State
  let compilerHealth: CompilerHealthStatus | null = null;
  let compilerChecking = false;
  let compileActive = false;
  let compileAbortController: AbortController | null = null;
  let healthAbortController: AbortController | null = null;
  let lastCompileResult: CompileResult | null = null;
  let compilePanelVisible = false;
  let selfTestPanelOpen = false;

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
    if (snap.portState === 'flashing' || snap.portState === 'releasing') {
      return { cls: 'is-busy', label: t('dev.statusFlashing') };
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

  function buildCurrentCompileRequest(derived: DerivedWorkspace): CompileRequest {
    const invoked = appBus.invoke('codegen:getSketch');
    const source = typeof invoked === 'string' && invoked.length > 0 ? invoked : (state.latestSketch || '');
    return {
      boardId: derived.board.id,
      mcu: derived.board.mcu,
      codeProfile: state.codeProfile,
      files: [{ path: 'main.ino', content: source }],
      libraries: extractSketchLibraries(source),
      optimizeForSize: false
    };
  }

  function refreshCompilerHealth(): void {
    if (healthAbortController) {
      healthAbortController.abort();
      healthAbortController = null;
    }
    const provider = getCompilerProvider();
    if (!provider) {
      compilerHealth = null;
      compilerChecking = false;
      updateCompilerDom();
      return;
    }
    const ac = new AbortController();
    healthAbortController = ac;
    compilerChecking = true;
    updateCompilerDom();

    void provider
      .checkHealth(ac.signal)
      .then((status) => {
        if (healthAbortController !== ac) return;
        healthAbortController = null;
        compilerChecking = false;
        compilerHealth = status;
        updateCompilerDom();
      })
      .catch(() => {
        if (healthAbortController !== ac) return;
        healthAbortController = null;
        compilerChecking = false;
        updateCompilerDom();
      });
  }

  function renderMemoryMeterHtml(label: string, used: number, max: number): string {
    const pct = Math.max(0, Math.min(100, Math.round((used / Math.max(1, max)) * 100)));
    const levelCls = pct >= 90 ? 'is-crit' : (pct >= 75 ? 'is-warn' : 'is-ok');
    return `
      <div class="dev-mem-meter ${levelCls}">
        <span class="dev-mem-lbl">${escapeHtml(label)}</span>
        <div class="dev-mem-track" aria-hidden="true"><div class="dev-mem-fill" style="width:${pct}%"></div></div>
        <span class="dev-mem-val">${escapeHtml(formatByteCount(used))} / ${escapeHtml(formatByteCount(max))} (${pct}%)</span>
      </div>`;
  }

  function renderDiagnosticRowHtml(diag: CompileDiagnostic): string {
    const loc = diag.column ? `${diag.file}:${diag.line}:${diag.column}` : `${diag.file}:${diag.line}`;
    const tag = diag.severity === 'error' ? 'ERR' : (diag.severity === 'warning' ? 'WARN' : 'NOTE');
    return `
      <div class="dev-diag-row is-${diag.severity}">
        <span class="dev-diag-sev">${tag}</span>
        <code class="dev-diag-loc">${escapeHtml(loc)}</code>
        <span class="dev-diag-msg">${escapeHtml(diag.message)}</span>
      </div>`;
  }

  function updateCompilerDom(): void {
    if (!host || !context) return;
    const { t } = context;
    const snap = deviceSession.getSnapshot();
    const derived = currentDerived || context.getDerived();
    const board = derived.board;
    const provider = getCompilerProvider();
    const webSerialOk = isWebSerialAvailable();
    const simActive = snap.portState === 'monitoring' && snap.mode === 'simulator';
    const protoId = board.flashProfile?.protocol ?? board.targetMeta?.flashProtocol ?? 'none';
    const flashSupported = protoId === 'stk500v1' || protoId === 'esptool' || simActive;

    // 1. Pending ?compiler= URL confirmation banner
    const urlBanner = host.querySelector<HTMLElement>('#devCompilerUrlBanner');
    if (urlBanner) {
      const pendingUrl = settingsStore.getPendingCompilerUrl();
      if (pendingUrl) {
        urlBanner.classList.remove('hidden');
        const urlCode = urlBanner.querySelector<HTMLElement>('#devPendingCompilerUrl');
        if (urlCode) urlCode.textContent = pendingUrl;
      } else {
        urlBanner.classList.add('hidden');
      }
    }

    // 2. Server Health Chip in toolbar
    const chipBtn = host.querySelector<HTMLButtonElement>('#btnDevCompilerChip');
    if (chipBtn) {
      chipBtn.classList.remove('is-online', 'is-offline', 'is-checking', 'is-serverless');
      if (!provider) {
        chipBtn.classList.add('is-serverless');
        chipBtn.innerHTML = `<span class="dev-srv-dot" aria-hidden="true"></span><span>${escapeHtml(t('dev.compilerServerless'))}</span>`;
        chipBtn.title = t('dev.compilerChipTitleServerless');
      } else if (compilerChecking) {
        chipBtn.classList.add('is-checking');
        chipBtn.innerHTML = `<span class="dev-srv-dot" aria-hidden="true"></span><span>${escapeHtml(provider.name)} · ${escapeHtml(t('dev.compilerChecking'))}</span>`;
        chipBtn.title = t('dev.compilerChipTitle');
      } else if (compilerHealth?.online) {
        chipBtn.classList.add('is-online');
        const lat = compilerHealth.latencyMs !== undefined ? ` · ${compilerHealth.latencyMs} ms` : '';
        chipBtn.innerHTML = `<span class="dev-srv-dot" aria-hidden="true"></span><span>${escapeHtml(provider.name)}${escapeHtml(lat)}</span>`;
        chipBtn.title = t('dev.compilerChipTitle');
      } else {
        chipBtn.classList.add('is-offline');
        chipBtn.innerHTML = `<span class="dev-srv-dot" aria-hidden="true"></span><span>${escapeHtml(provider.name)} · ${escapeHtml(t('dev.compilerOffline'))}</span>`;
        chipBtn.title = compilerHealth?.message || t('dev.compilerChipTitle');
      }
    }

    // 3. Verify & Build+Flash buttons (only visible when a CompilerProvider is active)
    const btnVerify = host.querySelector<HTMLButtonElement>('#btnDevVerify');
    if (btnVerify) {
      btnVerify.classList.toggle('hidden', !provider);
      btnVerify.disabled = !provider || compileActive || snap.flashActive;
    }

    const btnBuildFlash = host.querySelector<HTMLButtonElement>('#btnDevBuildFlash');
    if (btnBuildFlash) {
      btnBuildFlash.classList.toggle('hidden', !provider);
      btnBuildFlash.disabled =
        !provider || compileActive || snap.flashActive || !flashSupported || (!webSerialOk && !simActive);
    }

    // 4. Target chip text
    const targetChip = host.querySelector<HTMLElement>('.dev-target-chip');
    if (targetChip) {
      const proto = (board.targetMeta?.flashProtocol || 'none').toUpperCase();
      targetChip.textContent = `${board.shortName} · ${proto}`;
    }

    // 5. Compile Status / Memory / Diagnostics Panel
    const panel = host.querySelector<HTMLElement>('#devCompilePanel');
    if (panel) {
      if (!compilePanelVisible && !compileActive) {
        panel.classList.add('hidden');
      } else {
        panel.classList.remove('hidden');
        panel.classList.toggle('is-busy', compileActive);
        panel.classList.toggle('is-ok', !compileActive && Boolean(lastCompileResult?.ok));
        panel.classList.toggle('is-err', !compileActive && Boolean(lastCompileResult && !lastCompileResult.ok));

        const statusEl = panel.querySelector<HTMLElement>('#devCompileStatus');
        const memEl = panel.querySelector<HTMLElement>('#devCompileMem');
        const diagsEl = panel.querySelector<HTMLElement>('#devCompileDiags');
        const cancelBtn = panel.querySelector<HTMLButtonElement>('#btnDevCompileCancel');
        const closeBtn = panel.querySelector<HTMLButtonElement>('#btnDevCompileClose');

        if (cancelBtn) cancelBtn.classList.toggle('hidden', !compileActive);
        if (closeBtn) closeBtn.classList.toggle('hidden', compileActive);

        if (compileActive) {
          if (statusEl) {
            statusEl.textContent = t('dev.compilingMsg', { board: board.shortName });
          }
          if (memEl) memEl.innerHTML = '';
          if (diagsEl) diagsEl.innerHTML = '';
        } else if (lastCompileResult) {
          const res = lastCompileResult;
          const errCount = res.diagnostics.filter((d) => d.severity === 'error').length;
          const warnCount = res.diagnostics.filter((d) => d.severity === 'warning').length;
          if (statusEl) {
            if (res.ok) {
              const cacheTag = res.cacheHit ? ` · ${t('dev.compileCached')}` : '';
              const warnTag = warnCount > 0 ? ` · ${t('dev.compileWarnCount', { count: warnCount })}` : '';
              statusEl.textContent = `${t('dev.compileOk', { ms: res.durationMs })}${cacheTag}${warnTag}`;
            } else if (res.error && errCount === 0) {
              statusEl.textContent = `${t('dev.compileFailed')}: ${res.error}`;
            } else {
              statusEl.textContent = t('dev.compileFailSummary', { errors: errCount, warnings: warnCount });
            }
          }

          if (memEl) {
            const mem: CompileMemoryUsage | undefined = res.memory;
            if (mem) {
              memEl.innerHTML =
                renderMemoryMeterHtml('Flash', mem.flashUsed, mem.flashMax) +
                renderMemoryMeterHtml('RAM', mem.ramUsed, mem.ramMax);
              memEl.classList.remove('hidden');
            } else {
              memEl.innerHTML = '';
              memEl.classList.add('hidden');
            }
          }

          if (diagsEl) {
            if (res.diagnostics.length > 0) {
              diagsEl.innerHTML = res.diagnostics.map(renderDiagnosticRowHtml).join('');
              diagsEl.classList.remove('hidden');
            } else {
              diagsEl.innerHTML = '';
              diagsEl.classList.add('hidden');
            }
          }
        }
      }
    }
  }

  function getCurrentSelfTestSpec(derived: DerivedWorkspace): SelfTestSpec {
    return buildSelfTestSpec({
      board: derived.board,
      catalog: state.catalog || CATALOG,
      active: state.active || [],
      onboard: state.onboard || {},
      dipStates: derived.dipStates,
      netlist: derived.netlist
    });
  }

  function renderSelfTestItemHtml(item: SelfTestCheckItem): string {
    const icon =
      item.status === 'pass'
        ? '✓'
        : (item.status === 'fail'
            ? '✕'
            : (item.status === 'warn' ? '⚠' : (item.status === 'info' ? '•' : '○')));
    const hintHtml = item.hint ? `<span class="dev-st-hint">${escapeHtml(item.hint)}</span>` : '';
    return `
      <div class="dev-st-row is-${item.status}">
        <span class="dev-st-ico" aria-hidden="true">${icon}</span>
        <span class="dev-st-lbl">${escapeHtml(item.label)}</span>
        <code class="dev-st-detail">${escapeHtml(item.detail)}</code>
        ${hintHtml}
      </div>`;
  }

  function updateSelfTestDom(): void {
    if (!host || !context) return;
    const { t } = context;
    const snap = deviceSession.getSnapshot();
    const derived = currentDerived || context.getDerived();
    const spec = getCurrentSelfTestSpec(derived);
    const report = evaluateSelfTestReport(spec, snap.latestSelfTestFrame);
    const provider = getCompilerProvider();
    const connected = snap.portState === 'monitoring';
    const webSerialOk = isWebSerialAvailable();
    const simActive = connected && snap.mode === 'simulator';
    const protoId = derived.board.flashProfile?.protocol ?? derived.board.targetMeta?.flashProtocol ?? 'none';
    const flashSupported = protoId === 'stk500v1' || protoId === 'esptool' || simActive;

    const toggleBtn = host.querySelector<HTMLButtonElement>('#btnDevSelfTest');
    if (toggleBtn) {
      toggleBtn.classList.toggle('is-active', selfTestPanelOpen);
      toggleBtn.setAttribute('aria-expanded', String(selfTestPanelOpen));
    }

    const panel = host.querySelector<HTMLElement>('#devSelfTestPanel');
    if (!panel) return;
    panel.classList.toggle('hidden', !selfTestPanelOpen);
    if (!selfTestPanelOpen) return;

    const badgeEl = panel.querySelector<HTMLElement>('#devSelfTestBadge');
    if (badgeEl) {
      badgeEl.className = `dev-st-badge is-${report.overall}`;
      const lblKey =
        report.overall === 'pass'
          ? 'dev.selfTestPass'
          : (report.overall === 'fail'
              ? 'dev.selfTestFail'
              : (report.overall === 'warn' ? 'dev.selfTestWarn' : 'dev.selfTestPending'));
      badgeEl.textContent = t(lblKey);
    }

    const metaEl = panel.querySelector<HTMLElement>('#devSelfTestMeta');
    if (metaEl) {
      metaEl.textContent = t('dev.selfTestBusMeta', {
        board: spec.boardShortName,
        sda: spec.i2cPins.sda,
        scl: spec.i2cPins.scl,
        i2c: spec.expectedI2c.length,
        pins: spec.inputPins.length
      });
    }

    const btnFlashSt = panel.querySelector<HTMLButtonElement>('#btnDevSelfTestFlash');
    if (btnFlashSt) {
      btnFlashSt.classList.toggle('hidden', !provider);
      btnFlashSt.disabled = !provider || compileActive || snap.flashActive || !flashSupported || (!webSerialOk && !simActive);
    }

    const btnScan = panel.querySelector<HTMLButtonElement>('#btnDevSelfTestScan');
    if (btnScan) {
      btnScan.disabled = !connected || snap.flashActive;
    }

    const btnAct = panel.querySelector<HTMLButtonElement>('#btnDevSelfTestAct');
    if (btnAct) {
      btnAct.classList.toggle('hidden', spec.actuators.length === 0);
      btnAct.disabled = !connected || snap.flashActive;
    }

    const listEl = panel.querySelector<HTMLElement>('#devSelfTestList');
    if (listEl) {
      if (report.items.length === 0) {
        listEl.innerHTML = `<div class="dev-st-empty">${escapeHtml(t('dev.selfTestEmptyBoard'))}</div>`;
      } else {
        listEl.innerHTML = report.items.map(renderSelfTestItemHtml).join('');
      }
    }

    const noteEl = panel.querySelector<HTMLElement>('#devSelfTestFootNote');
    if (noteEl) {
      if (spec.actuators.length > 0 && spec.deadmanPin) {
        noteEl.textContent = t('dev.selfTestDeadmanNote', { pin: spec.deadmanPin.label });
      } else {
        noteEl.textContent = t('dev.selfTestStandaloneNote');
      }
    }
  }

  async function runCompileFlow(
    alsoFlash: boolean,
    customRequest?: { filename: string; content: string; label?: string }
  ): Promise<void> {
    if (!context || compileActive) return;
    const provider = getCompilerProvider();
    if (!provider) {
      appBus.emit('ui:toast', { msg: context.t('dev.compilerRequiredToast') });
      return;
    }

    const d = currentDerived || context.getDerived();
    const targetBoard = d.board;
    const req: CompileRequest = customRequest
      ? {
          boardId: targetBoard.id,
          mcu: targetBoard.mcu,
          codeProfile: state.codeProfile,
          files: [{ path: customRequest.filename, content: customRequest.content }],
          libraries: extractSketchLibraries(customRequest.content),
          optimizeForSize: false
        }
      : buildCurrentCompileRequest(d);
    const ac = new AbortController();
    compileAbortController = ac;
    compileActive = true;
    compilePanelVisible = true;
    lastCompileResult = null;
    updateCompilerDom();
    updateLiveDom();

    deviceSession.logSystem(
      `[BUILD] Compiling ${req.files[0]?.path || 'main.ino'} for ${targetBoard.shortName} via ${provider.name}…`
    );

    try {
      const result = await provider.compile(req, { signal: ac.signal });
      lastCompileResult = result;
      compileActive = false;
      compileAbortController = null;

      if (result.ok) {
        const memNote = result.memory
          ? ` · Flash ${formatByteCount(result.memory.flashUsed)}/${formatByteCount(result.memory.flashMax)} · RAM ${formatByteCount(result.memory.ramUsed)}/${formatByteCount(result.memory.ramMax)}`
          : '';
        const cacheNote = result.cacheHit ? ' (cached)' : '';
        deviceSession.logSystem(`[BUILD] Succeeded in ${result.durationMs} ms${cacheNote}${memNote}.`);
        for (const diag of result.diagnostics) {
          if (diag.severity === 'warning') {
            deviceSession.logSystem(`[BUILD WARN] ${diag.file}:${diag.line}: ${diag.message}`);
          }
        }
      } else {
        const errCount = result.diagnostics.filter((dg) => dg.severity === 'error').length;
        deviceSession.logError(
          `[BUILD FAILED] ${result.error || `${errCount} compiler error(s) in ${targetBoard.shortName}.`}`
        );
        for (const diag of result.diagnostics) {
          deviceSession.logError(`[${diag.severity.toUpperCase()}] ${diag.file}:${diag.line}: ${diag.message}`);
        }
      }

      updateCompilerDom();
      updateLiveDom();

      if (!result.ok) {
        appBus.emit('ui:toast', { msg: context.t('dev.compileFailed') });
        return;
      }

      if (!alsoFlash) {
        appBus.emit('ui:toast', { msg: context.t('dev.compileOk', { ms: result.durationMs }) });
        return;
      }

      if (!result.firmwareArtifact) {
        deviceSession.logError('[BUILD] Server returned ok=true without a flashable firmware artifact.');
        appBus.emit('ui:toast', { msg: context.t('dev.compileNoArtifact') });
        return;
      }

      const autoResetDipId = targetBoard.flashProfile?.autoResetDipSwitchId;
      const s1 = autoResetDipId !== undefined
        ? d.dipStates.find((dip) => dip.id === autoResetDipId)
        : undefined;

      const flashRes = await deviceSession.flashArtifact(result.firmwareArtifact, targetBoard, {
        verify: targetBoard.flashProfile?.supportsVerify ?? true,
        resetPreference,
        autoResetDipOff: Boolean(s1 && !s1.on)
      });
      appBus.emit('ui:toast', {
        msg: context.t('dev.flashSuccess', { bytes: flashRes.bytesWritten, board: targetBoard.shortName })
      });
    } catch (err: unknown) {
      compileActive = false;
      compileAbortController = null;
      const isAbort = err instanceof Error && err.name === 'AbortError';
      const isCancel = err instanceof Error && err.name === 'NotFoundError';
      if (isAbort) {
        deviceSession.logSystem('[BUILD] Compilation canceled.');
        if (!lastCompileResult) compilePanelVisible = false;
      } else if (!isCancel) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!lastCompileResult) {
          lastCompileResult = {
            ok: false,
            durationMs: 0,
            diagnostics: [],
            artifacts: [],
            error: msg
          };
        }
        appBus.emit('ui:toast', { msg });
      }
      updateCompilerDom();
      updateLiveDom();
    }
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
    if (btnReset) btnReset.disabled = !connected || snap.flashActive;

    const btnFlashFile = host.querySelector<HTMLButtonElement>('#btnDevFlashFile');
    const flashInput = host.querySelector<HTMLInputElement>('#devFlashFileInput');
    const protoId = board.flashProfile?.protocol ?? board.targetMeta?.flashProtocol ?? 'none';
    const simActive = connected && snap.mode === 'simulator';
    const flashSupported = protoId === 'stk500v1' || protoId === 'esptool' || simActive;
    const isEspBoard = protoId === 'esptool';
    if (btnFlashFile) {
      const flashLabel = isEspBoard ? t('dev.flashBin') : t('dev.flashHex');
      btnFlashFile.innerHTML = `⚡ ${escapeHtml(flashLabel)} <span class="dev-beta-badge">${escapeHtml(t('dev.flashBetaBadge'))}</span>`;
      btnFlashFile.disabled = snap.flashActive || compileActive || !flashSupported || (!webSerialOk && !simActive);
      btnFlashFile.title = !flashSupported
        ? t('dev.flashUnsupportedBoard')
        : (isEspBoard ? t('dev.flashBinTitle') : t('dev.flashHexTitle'));
    }
    if (flashInput) {
      flashInput.accept = (
        board.flashProfile?.acceptedFileExtensions ?? (isEspBoard ? ['.bin'] : ['.hex', '.ihex'])
      ).join(',');
    }

    const resetModeSel = host.querySelector<HTMLSelectElement>('#devResetModeSelect');
    if (resetModeSel) {
      const showResetSel =
        (protoId === 'stk500v1' || protoId === 'esptool') &&
        (board.flashProfile?.resetChain.length ?? 0) > 1 &&
        settingsStore.get().preset !== 'beginner';
      resetModeSel.classList.toggle('hidden', !showResetSel);
      resetModeSel.disabled = snap.flashActive;
      if (resetModeSel.value !== resetPreference) {
        resetModeSel.value = resetPreference;
      }
    }

    const btnPairHid = host.querySelector<HTMLButtonElement>('#btnDevPairHid');
    if (btnPairHid) {
      const needsMcp2221 = Boolean(board.flashProfile?.resetChain.includes('mcp2221-webhid'));
      const showPairHid = needsMcp2221 && !simActive && isWebHidAvailable();
      btnPairHid.classList.toggle('hidden', !showPairHid);
      btnPairHid.disabled = snap.flashActive;
      btnPairHid.classList.toggle('is-active', mcp2221HidPaired);
      btnPairHid.textContent = `${mcp2221HidPaired ? '✓' : '🔌'} ${t('dev.pairMcp2221')}`;
    }

    const offsetSel = host.querySelector<HTMLSelectElement>('#devFlashOffsetSelect');
    if (offsetSel) {
      const presets = board.flashProfile?.flashOffsetPresets ?? [];
      const showOffsetSel =
        isEspBoard && presets.length > 0 && settingsStore.get().preset !== 'beginner';
      offsetSel.classList.toggle('hidden', !showOffsetSel);
      offsetSel.disabled = snap.flashActive;
      const expectedKey = `${board.id}:${presets.map((p) => p.offset).join(',')}`;
      if (offsetSel.dataset.boardKey !== expectedKey) {
        offsetSel.dataset.boardKey = expectedKey;
        offsetSel.innerHTML = [
          `<option value="auto">${escapeHtml(t('dev.flashOffsetAuto'))}</option>`,
          ...presets.map((p) => `<option value="0x${p.offset.toString(16)}">${escapeHtml(p.label)}</option>`)
        ].join('');
        flashOffsetSelection = 'auto';
      }
      if (offsetSel.value !== flashOffsetSelection) {
        offsetSel.value = flashOffsetSelection;
      }
    }

    const flashBanner = host.querySelector<HTMLElement>('#devFlashBanner');
    if (flashBanner) {
      const prog = snap.flashProgress;
      if (snap.flashActive && prog) {
        flashBanner.classList.remove('hidden');
        const phaseEl = flashBanner.querySelector<HTMLElement>('#devFlashPhase');
        const msgEl = flashBanner.querySelector<HTMLElement>('#devFlashMsg');
        const barEl = flashBanner.querySelector<HTMLElement>('#devFlashBarFill');
        const pctEl = flashBanner.querySelector<HTMLElement>('#devFlashPct');
        if (phaseEl) phaseEl.textContent = prog.phase.toUpperCase();
        if (msgEl) msgEl.textContent = prog.message;
        const pct = Math.max(0, Math.min(100, Math.round(prog.percent)));
        if (barEl) barEl.style.width = `${pct}%`;
        if (pctEl) pctEl.textContent = `${pct}%`;
      } else {
        flashBanner.classList.add('hidden');
      }
    }

    updateCompilerDom();
    updateSelfTestDom();

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
           <button type="button" class="btn btn-ghost btn-sm dev-cap-info-btn" data-open-flash-info="1">ⓘ ${escapeHtml(t('dev.flashInfoBtnShort'))}</button>
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
            <button type="button" id="btnDevVerify" class="btn btn-ghost btn-sm hidden" title="${escapeHtml(t('dev.verifyTitle'))}">✓ ${escapeHtml(t('dev.verify'))}</button>
            <button type="button" id="btnDevBuildFlash" class="btn btn-primary btn-sm dev-flash-btn hidden" title="${escapeHtml(t('dev.buildFlashTitle'))}">⚡ ${escapeHtml(t('dev.buildFlash'))} <span class="dev-beta-badge">${escapeHtml(t('dev.flashBetaBadge'))}</span></button>
            <button type="button" id="btnDevSelfTest" class="btn btn-ghost btn-sm" aria-expanded="false" title="${escapeHtml(t('dev.selfTestBtnTitle'))}">🧪 ${escapeHtml(t('dev.selfTestBtn'))}</button>
            <div class="dev-flash-btn-group">
              <button type="button" id="btnDevFlashFile" class="btn btn-ghost btn-sm dev-flash-btn" title="${escapeHtml(t('dev.flashHexTitle'))}">⚡ ${escapeHtml(t('dev.flashHex'))} <span class="dev-beta-badge">${escapeHtml(t('dev.flashBetaBadge'))}</span></button>
              <button type="button" id="btnDevFlashInfo" class="btn btn-ghost btn-sm dev-info-icon-btn" title="${escapeHtml(t('dev.flashInfoBtnTitle'))}" aria-label="${escapeHtml(t('dev.flashInfoBtnTitle'))}" aria-haspopup="dialog">ⓘ</button>
            </div>
            <input type="file" id="devFlashFileInput" accept=".hex,.ihex" hidden />
            <select id="devFlashOffsetSelect" class="dev-select dev-select-sm hidden" aria-label="${escapeHtml(t('dev.flashOffsetLabel'))}" title="${escapeHtml(t('dev.flashOffsetLabel'))}">
              <option value="auto">${escapeHtml(t('dev.flashOffsetAuto'))}</option>
            </select>
            <select id="devResetModeSelect" class="dev-select dev-select-sm hidden" aria-label="${escapeHtml(t('dev.resetModeLabel'))}" title="${escapeHtml(t('dev.resetModeLabel'))}">
              <option value="auto" ${resetPreference === 'auto' ? 'selected' : ''}>${escapeHtml(t('dev.resetModeAuto'))}</option>
              <option value="manual" ${resetPreference === 'manual' ? 'selected' : ''}>${escapeHtml(t('dev.resetModeManual'))}</option>
            </select>
            <button type="button" id="btnDevPairHid" class="btn btn-ghost btn-sm hidden" title="${escapeHtml(t('dev.pairMcp2221Title'))}">🔌 ${escapeHtml(t('dev.pairMcp2221'))}</button>
            <span id="devStatusPill" class="dev-status-pill is-idle"></span>
          </div>
          <div class="dev-toolbar-right">
            <div class="dev-view-switch" role="group" aria-label="${escapeHtml(t('dev.viewModeLabel'))}">
              <button type="button" class="dev-vmode-btn ${viewMode === 'monitor' ? 'active' : ''}" data-dev-view-mode="monitor" aria-pressed="${String(viewMode === 'monitor')}">${escapeHtml(t('dev.viewMonitor'))}</button>
              <button type="button" class="dev-vmode-btn ${viewMode === 'split' ? 'active' : ''}" data-dev-view-mode="split" aria-pressed="${String(viewMode === 'split')}">${escapeHtml(t('dev.viewSplit'))}</button>
              <button type="button" class="dev-vmode-btn ${viewMode === 'plotter' ? 'active' : ''}" data-dev-view-mode="plotter" aria-pressed="${String(viewMode === 'plotter')}">${escapeHtml(t('dev.viewPlotter'))}</button>
            </div>
            <button type="button" id="btnDevCompilerChip" class="dev-compiler-chip is-serverless" title="${escapeHtml(t('dev.compilerChipTitleServerless'))}"></button>
            <span class="dev-target-chip" title="${escapeHtml(t('ws.kpiFlashProto'))}">${escapeHtml(board.shortName)} · ${escapeHtml(proto)}</span>
            <button type="button" id="btnDevPause" class="btn btn-ghost btn-sm">⏸ ${escapeHtml(t('dev.pause'))}</button>
            <button type="button" id="btnDevClear" class="btn btn-ghost btn-sm" title="${escapeHtml(t('dev.clearTitle'))}">⌫ ${escapeHtml(t('dev.clear'))}</button>
            <button type="button" class="btn btn-ghost btn-sm" data-ws-return="hardware">← ${escapeHtml(t('ws.backToHardware'))}</button>
          </div>
        </div>

        ${browserGateHtml}
        <div id="devErrorBanner" class="dev-error-banner hidden" role="alert"></div>

        <div id="devCompilerUrlBanner" class="dev-compiler-url-banner hidden" role="region" aria-label="${escapeHtml(t('compiler.urlConfirmTitle'))}">
          <div class="dev-compiler-url-txt">
            <strong>${escapeHtml(t('compiler.urlConfirmTitle'))}</strong>
            <code id="devPendingCompilerUrl"></code>
            <span>${escapeHtml(t('compiler.urlConfirmDesc'))}</span>
          </div>
          <div class="dev-compiler-url-actions">
            <button type="button" id="btnDevConfirmCompilerUrl" class="btn btn-primary btn-sm">✓ ${escapeHtml(t('compiler.urlConfirmAccept'))}</button>
            <button type="button" id="btnDevDismissCompilerUrl" class="btn btn-ghost btn-sm">✕ ${escapeHtml(t('compiler.urlConfirmDismiss'))}</button>
          </div>
        </div>

        <div id="devFlashBanner" class="dev-flash-banner hidden" role="status" aria-live="polite">
          <span id="devFlashPhase" class="dev-flash-phase">SYNC</span>
          <div class="dev-flash-bar-track" aria-hidden="true"><div id="devFlashBarFill" class="dev-flash-bar-fill"></div></div>
          <span id="devFlashPct" class="dev-flash-pct">0%</span>
          <span id="devFlashMsg" class="dev-flash-msg"></span>
          <button type="button" id="btnDevFlashCancel" class="btn btn-ghost btn-sm">✕ ${escapeHtml(t('dev.flashCancel'))}</button>
        </div>

        <div id="devCompilePanel" class="dev-compile-panel hidden" role="status" aria-live="polite">
          <div class="dev-compile-head">
            <span id="devCompileStatus" class="dev-compile-status"></span>
            <div id="devCompileMem" class="dev-compile-mem hidden"></div>
            <div class="dev-compile-head-actions">
              <button type="button" id="btnDevCompileCancel" class="btn btn-ghost btn-sm hidden">✕ ${escapeHtml(t('dev.flashCancel'))}</button>
              <button type="button" id="btnDevCompileClose" class="btn btn-ghost btn-sm" aria-label="${escapeHtml(t('dev.flashInfoClose'))}">✕</button>
            </div>
          </div>
          <div id="devCompileDiags" class="dev-compile-diags hidden"></div>
        </div>

        <div id="devSelfTestPanel" class="dev-selftest-panel hidden" role="region" aria-label="${escapeHtml(t('dev.selfTestTitle'))}">
          <div class="dev-st-head">
            <div class="dev-st-head-left">
              <strong class="dev-st-title">🧪 ${escapeHtml(t('dev.selfTestTitle'))}</strong>
              <span id="devSelfTestBadge" class="dev-st-badge is-pending">${escapeHtml(t('dev.selfTestPending'))}</span>
              <span id="devSelfTestMeta" class="dev-st-meta"></span>
            </div>
            <div class="dev-st-actions">
              <button type="button" id="btnDevSelfTestFlash" class="btn btn-primary btn-sm hidden" title="${escapeHtml(t('dev.selfTestFlashTitle'))}">⚡ ${escapeHtml(t('dev.selfTestFlashBtn'))}</button>
              <button type="button" id="btnDevSelfTestScan" class="btn btn-ghost btn-sm" title="${escapeHtml(t('dev.selfTestScanTitle'))}">↻ ${escapeHtml(t('dev.selfTestScanBtn'))}</button>
              <button type="button" id="btnDevSelfTestAct" class="btn btn-ghost btn-sm hidden" title="${escapeHtml(t('dev.selfTestActTitle'))}">⚡ ${escapeHtml(t('dev.selfTestActBtn'))}</button>
              <button type="button" id="btnDevSelfTestCopy" class="btn btn-ghost btn-sm" title="${escapeHtml(t('dev.selfTestCopyTitle'))}">📋 ${escapeHtml(t('dev.selfTestCopyBtn'))}</button>
              <button type="button" id="btnDevSelfTestDownload" class="btn btn-ghost btn-sm" title="${escapeHtml(t('dev.selfTestDownloadTitle'))}">⬇ .ino</button>
              <button type="button" id="btnDevSelfTestClose" class="btn btn-ghost btn-sm" aria-label="${escapeHtml(t('dev.flashInfoClose'))}">✕</button>
            </div>
          </div>
          <div id="devSelfTestList" class="dev-st-list"></div>
          <div id="devSelfTestFootNote" class="dev-st-foot"></div>
        </div>

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
                <option value="lf" ${snap.lineEnding === 'lf' ? 'selected' : ''}>LF (\n)</option>
                <option value="crlf" ${snap.lineEnding === 'crlf' ? 'selected' : ''}>CRLF (\r\n)</option>
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

        <div id="devFlashInfoModal" class="dev-flash-modal-backdrop hidden" role="dialog" aria-modal="true" aria-labelledby="devFlashInfoTitle">
          <div class="dev-flash-modal-card">
            <div class="dev-flash-modal-head">
              <div class="dev-flash-modal-title-wrap">
                <h3 id="devFlashInfoTitle">${escapeHtml(t('dev.flashInfoTitle'))}</h3>
                <span class="dev-beta-badge">${escapeHtml(t('dev.flashBetaBadge'))}</span>
              </div>
              <button type="button" id="btnDevFlashInfoCloseX" class="btn btn-ghost btn-sm" aria-label="${escapeHtml(t('dev.flashInfoClose'))}">✕</button>
            </div>
            <div id="devFlashInfoBody" class="dev-flash-modal-body"></div>
            <div class="dev-flash-modal-foot">
              <button type="button" id="btnDevFlashInfoClose" class="btn btn-primary btn-sm">${escapeHtml(t('dev.flashInfoClose'))}</button>
            </div>
          </div>
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

    host.querySelector<HTMLButtonElement>('#btnDevCompilerChip')?.addEventListener('click', () => {
      appBus.emit('modal:openSettings');
    });

    host.querySelector<HTMLButtonElement>('#btnDevVerify')?.addEventListener('click', () => {
      void runCompileFlow(false);
    });

    host.querySelector<HTMLButtonElement>('#btnDevBuildFlash')?.addEventListener('click', () => {
      void runCompileFlow(true);
    });

    host.querySelector<HTMLButtonElement>('#btnDevCompileCancel')?.addEventListener('click', () => {
      compileAbortController?.abort();
    });

    host.querySelector<HTMLButtonElement>('#btnDevCompileClose')?.addEventListener('click', () => {
      compilePanelVisible = false;
      updateCompilerDom();
    });

    host.querySelector<HTMLButtonElement>('#btnDevSelfTest')?.addEventListener('click', () => {
      selfTestPanelOpen = !selfTestPanelOpen;
      updateSelfTestDom();
    });

    host.querySelector<HTMLButtonElement>('#btnDevSelfTestClose')?.addEventListener('click', () => {
      selfTestPanelOpen = false;
      updateSelfTestDom();
    });

    host.querySelector<HTMLButtonElement>('#btnDevSelfTestFlash')?.addEventListener('click', () => {
      if (!context) return;
      const d = currentDerived || context.getDerived();
      const spec = getCurrentSelfTestSpec(d);
      const sketch = generateSelfTestSketch(spec);
      void runCompileFlow(true, { filename: 'kcomp_selftest.ino', content: sketch, label: 'L0 Self-Test' });
    });

    host.querySelector<HTMLButtonElement>('#btnDevSelfTestScan')?.addEventListener('click', () => {
      if (!deviceSession.isConnected()) return;
      void deviceSession.sendText('SCAN');
    });

    host.querySelector<HTMLButtonElement>('#btnDevSelfTestAct')?.addEventListener('click', () => {
      if (!deviceSession.isConnected()) return;
      void deviceSession.sendText('ACT');
    });

    host.querySelector<HTMLButtonElement>('#btnDevSelfTestCopy')?.addEventListener('click', async () => {
      if (!context) return;
      const d = currentDerived || context.getDerived();
      const sketch = generateSelfTestSketch(getCurrentSelfTestSpec(d));
      try {
        await navigator.clipboard.writeText(sketch);
        appBus.emit('ui:toast', { msg: context.t('dev.selfTestCopied') });
      } catch {
        appBus.emit('ui:toast', { msg: context.t('dev.selfTestDownloadTitle') });
      }
    });

    host.querySelector<HTMLButtonElement>('#btnDevSelfTestDownload')?.addEventListener('click', () => {
      if (!context) return;
      const d = currentDerived || context.getDerived();
      const sketch = generateSelfTestSketch(getCurrentSelfTestSpec(d));
      triggerDownload(`${getProjectSlug(d.board.id)}_selftest_l0.ino`, sketch, 'text/plain;charset=utf-8');
    });

    host.querySelector<HTMLButtonElement>('#btnDevConfirmCompilerUrl')?.addEventListener('click', () => {
      const added = settingsStore.confirmPendingCompilerUrl();
      if (added && context) {
        appBus.emit('ui:toast', { msg: context.t('compiler.urlConfirmActivated', { label: added.label }) });
      }
      updateCompilerDom();
    });

    host.querySelector<HTMLButtonElement>('#btnDevDismissCompilerUrl')?.addEventListener('click', () => {
      settingsStore.dismissPendingCompilerUrl();
      updateCompilerDom();
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
        const spec = getCurrentSelfTestSpec(d);
        return buildSimulatorContextFromBoard(
          d.board,
          state.active.map((a) => a.compId),
          state.onboard,
          {
            expectedI2cAddrs: spec.expectedI2c.map((dev) => dev.address),
            inputPinIds: spec.inputPins.map((p) => p.boardPinId)
          }
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

    host.querySelector<HTMLSelectElement>('#devFlashOffsetSelect')?.addEventListener('change', (ev) => {
      flashOffsetSelection = (ev.target as HTMLSelectElement).value || 'auto';
    });

    host.querySelector<HTMLSelectElement>('#devResetModeSelect')?.addEventListener('change', (ev) => {
      const val = (ev.target as HTMLSelectElement).value;
      resetPreference = val === 'manual' ? 'manual' : 'auto';
    });

    host.querySelector<HTMLButtonElement>('#btnDevFlashCancel')?.addEventListener('click', () => {
      deviceSession.cancelFlash();
    });

    const closeFlashInfoModal = (): void => {
      flashInfoModalOpen = false;
      host?.querySelector<HTMLElement>('#devFlashInfoModal')?.classList.add('hidden');
      if (flashInfoEscHandler) {
        document.removeEventListener('keydown', flashInfoEscHandler);
        flashInfoEscHandler = null;
      }
    };

    const renderFlashInfoModalBody = (): void => {
      if (!host || !context) return;
      const bodyEl = host.querySelector<HTMLElement>('#devFlashInfoBody');
      if (!bodyEl) return;
      const { t: tr } = context;
      const serialNow = isWebSerialAvailable();
      const hidNow = isWebHidAvailable();
      const secureNow = typeof window !== 'undefined' && Boolean(window.isSecureContext);

      const chip = (ok: boolean, label: string): string =>
        `<span class="dev-cap-chip ${ok ? 'is-ok' : 'is-no'}">${ok ? '✓' : '✕'} ${escapeHtml(label)}</span>`;

      bodyEl.innerHTML = `
        <p class="dev-info-lead">${escapeHtml(tr('dev.flashInfoIntro'))}</p>

        <div class="dev-cap-check-row" aria-label="${escapeHtml(tr('dev.flashInfoDetectLabel'))}">
          <span class="dev-cap-check-lbl">${escapeHtml(tr('dev.flashInfoDetectLabel'))}</span>
          ${chip(serialNow, `Web Serial: ${serialNow ? tr('dev.flashInfoYes') : tr('dev.flashInfoNo')}`)}
          ${chip(hidNow, `WebHID: ${hidNow ? tr('dev.flashInfoYes') : tr('dev.flashInfoNo')}`)}
          ${chip(secureNow, `${tr('dev.flashInfoSecureCtx')}: ${secureNow ? tr('dev.flashInfoYes') : tr('dev.flashInfoNo')}`)}
        </div>

        <h4 class="dev-info-subhead">${escapeHtml(tr('dev.flashInfoBrowserHead'))}</h4>
        <table class="dev-compat-table">
          <thead>
            <tr>
              <th>${escapeHtml(tr('dev.flashInfoColBrowser'))}</th>
              <th>${escapeHtml(tr('dev.flashInfoColSerial'))}</th>
              <th>${escapeHtml(tr('dev.flashInfoColHid'))}</th>
              <th>${escapeHtml(tr('dev.flashInfoColNotes'))}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Chrome / Edge</strong></td>
              <td><span class="dev-compat-ok">✓</span></td>
              <td><span class="dev-compat-ok">✓</span></td>
              <td>${escapeHtml(tr('dev.flashInfoRowChrome'))}</td>
            </tr>
            <tr>
              <td><strong>Brave / Opera</strong></td>
              <td><span class="dev-compat-ok">✓</span></td>
              <td><span class="dev-compat-warn">~</span></td>
              <td>${escapeHtml(tr('dev.flashInfoRowBrave'))}</td>
            </tr>
            <tr>
              <td><strong>Firefox / Safari</strong></td>
              <td><span class="dev-compat-no">✕</span></td>
              <td><span class="dev-compat-no">✕</span></td>
              <td>${escapeHtml(tr('dev.flashInfoRowFirefox'))}</td>
            </tr>
          </tbody>
        </table>

        <h4 class="dev-info-subhead">${escapeHtml(tr('dev.flashInfoTechHead'))}</h4>
        <ul class="dev-info-list">
          <li><strong>${escapeHtml(tr('dev.flashInfoKcompTitle'))}</strong> ${escapeHtml(tr('dev.flashInfoKcompDesc'))}</li>
          <li><strong>${escapeHtml(tr('dev.flashInfoEspTitle'))}</strong> ${escapeHtml(tr('dev.flashInfoEspDesc'))}</li>
          <li><strong>${escapeHtml(tr('dev.flashInfoLinuxTitle'))}</strong> ${escapeHtml(tr('dev.flashInfoLinuxDesc'))}</li>
          <li><strong>${escapeHtml(tr('dev.flashInfoContextTitle'))}</strong> ${escapeHtml(tr('dev.flashInfoContextDesc'))}</li>
        </ul>

        <p class="dev-info-foot-note">${escapeHtml(tr('dev.flashInfoAlwaysWorks'))}</p>`;
    };

    const openFlashInfoModal = (): void => {
      if (!host) return;
      renderFlashInfoModalBody();
      const modal = host.querySelector<HTMLElement>('#devFlashInfoModal');
      if (!modal) return;
      flashInfoModalOpen = true;
      modal.classList.remove('hidden');
      if (flashInfoEscHandler) {
        document.removeEventListener('keydown', flashInfoEscHandler);
      }
      flashInfoEscHandler = (ev: KeyboardEvent) => {
        if (ev.key === 'Escape' && flashInfoModalOpen) {
          closeFlashInfoModal();
        }
      };
      document.addEventListener('keydown', flashInfoEscHandler);
    };

    host.querySelector<HTMLButtonElement>('#btnDevFlashInfo')?.addEventListener('click', openFlashInfoModal);
    host.querySelectorAll<HTMLButtonElement>('[data-open-flash-info]').forEach((btn) => {
      btn.addEventListener('click', openFlashInfoModal);
    });
    host.querySelector<HTMLButtonElement>('#btnDevFlashInfoClose')?.addEventListener('click', closeFlashInfoModal);
    host.querySelector<HTMLButtonElement>('#btnDevFlashInfoCloseX')?.addEventListener('click', closeFlashInfoModal);
    host.querySelector<HTMLElement>('#devFlashInfoModal')?.addEventListener('click', (ev) => {
      if (ev.target === ev.currentTarget) {
        closeFlashInfoModal();
      }
    });

    host.querySelector<HTMLButtonElement>('#btnDevPairHid')?.addEventListener('click', () => {
      if (!context) return;
      const ctxRef = context;
      // Call requestMcp2221WebHidPairing() synchronously inside the click event so Chrome's WebHID picker ALWAYS opens!
      void requestMcp2221WebHidPairing().then((res) => {
        if (res.ok) {
          mcp2221HidPaired = true;
          deviceSession.logSystem(`[HID] Paired MCP2221 WebHID auto-reset: ${res.deviceName || '04D8:00DD'}.`);
          appBus.emit('ui:toast', { msg: ctxRef.t('dev.pairMcp2221Ok') });
        } else {
          deviceSession.logError(`[HID] ${res.error || 'MCP2221 WebHID pairing failed.'}`);
          appBus.emit('ui:toast', { msg: res.error || ctxRef.t('dev.pairMcp2221Skipped') });
        }
        updateLiveDom();
      });
    });

    if (isWebHidAvailable()) {
      void hasPairedMcp2221WebHid().then((paired) => {
        if (paired !== mcp2221HidPaired) {
          mcp2221HidPaired = paired;
          updateLiveDom();
        }
      });
    }

    const flashFileInput = host.querySelector<HTMLInputElement>('#devFlashFileInput');
    host.querySelector<HTMLButtonElement>('#btnDevFlashFile')?.addEventListener('click', () => {
      if (!flashFileInput) return;
      flashFileInput.value = '';
      flashFileInput.click();
    });

    flashFileInput?.addEventListener('change', async () => {
      const file = flashFileInput.files?.[0];
      if (!file || !context) return;
      const d = currentDerived || context.getDerived();
      const targetBoard = d.board;
      try {
        const proto = targetBoard.flashProfile?.protocol ?? targetBoard.targetMeta?.flashProtocol ?? 'none';
        const isBinFile = proto === 'esptool' || file.name.toLowerCase().endsWith('.bin');
        let artifact: FirmwareArtifact;
        if (isBinFile) {
          const bytes = new Uint8Array(await file.arrayBuffer());
          const defaultAppOffset = targetBoard.flashProfile?.defaultAppOffset ?? 0x10000;
          const offset =
            flashOffsetSelection === 'auto'
              ? inspectEspBinary(bytes, defaultAppOffset).recommendedOffset
              : parseFlashOffset(flashOffsetSelection);
          artifact = createEspSingleBinArtifact(bytes, offset, file.name, targetBoard.id);
        } else {
          const rawText = await file.text();
          artifact = createIHexArtifact(rawText, file.name, targetBoard.id);
        }
        const autoResetDipId = targetBoard.flashProfile?.autoResetDipSwitchId;
        const s1 = autoResetDipId !== undefined
          ? d.dipStates.find((dip) => dip.id === autoResetDipId)
          : undefined;
        const res = await deviceSession.flashArtifact(artifact, targetBoard, {
          verify: targetBoard.flashProfile?.supportsVerify ?? true,
          resetPreference,
          autoResetDipOff: Boolean(s1 && !s1.on)
        });
        appBus.emit('ui:toast', {
          msg: context.t('dev.flashSuccess', { bytes: res.bytesWritten, board: targetBoard.shortName })
        });
      } catch (err: unknown) {
        if (!(err instanceof Error && (err.name === 'AbortError' || err.name === 'NotFoundError'))) {
          appBus.emit('ui:toast', { msg: err instanceof Error ? err.message : String(err) });
        }
      }
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
    refreshCompilerHealth();
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

      if (settingsUnsub) settingsUnsub();
      settingsUnsub = settingsStore.subscribe(() => {
        updateCompilerDom();
      });

      if (compilerBusUnsub) compilerBusUnsub();
      compilerBusUnsub = appBus.on('compiler:changed', () => {
        refreshCompilerHealth();
      });
    },
    unmount(): void {
      if (rafId && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      if (compileAbortController) {
        compileAbortController.abort();
        compileAbortController = null;
      }
      if (healthAbortController) {
        healthAbortController.abort();
        healthAbortController = null;
      }
      compileActive = false;
      compilerChecking = false;
      if (sessionUnsub) {
        sessionUnsub();
        sessionUnsub = null;
      }
      if (themeUnsub) {
        themeUnsub();
        themeUnsub = null;
      }
      if (settingsUnsub) {
        settingsUnsub();
        settingsUnsub = null;
      }
      if (compilerBusUnsub) {
        compilerBusUnsub();
        compilerBusUnsub = null;
      }
      if (flashInfoEscHandler) {
        document.removeEventListener('keydown', flashInfoEscHandler);
        flashInfoEscHandler = null;
      }
      flashInfoModalOpen = false;
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
