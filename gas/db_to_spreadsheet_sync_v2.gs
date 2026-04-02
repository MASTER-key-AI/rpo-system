/**
 * DB -> Google Spreadsheet 全件同期（v2: A-W列フォーマット）
 *
 * エントリポイント:
 *   syncAll()           : 全企業を同期（本番）
 *   dryRunAll()         : 全企業を同期（ログのみ、書き込みなし）
 *   syncBySheet(ssId)   : 特定スプレッドシートのみ同期
 *
 * Script Properties:
 *   RPO_API_URL                 (例: https://rpo-app.yukipono-rpo.workers.dev/api/sync/applicants)
 *   RPO_API_KEY                 (APIキー)
 *   RPO_COMPANY_SHEETS_API_URL  (例: https://rpo-app.yukipono-rpo.workers.dev/api/sync/company-sheets)
 *     ※省略時は RPO_API_URL から自動推定
 */

/* ==========================
 * 設定
 * ========================== */
var CONFIG = {
  api: {
    maxRetries: 3,
    retryBaseSleepMs: 800,
    pageSize: 500,
    maxPages: 100,
  },
  timing: {
    safeLimitMs: 5 * 60 * 1000, // 5分（GAS上限6分）
    lockWaitMs: 25000,
  },
  sheet: {
    headerRow: 1,
    dataStartRow: 2,
    targetGid: 465742923,
  },
  properties: {
    apiUrl: 'RPO_API_URL',
    apiKey: 'RPO_API_KEY',
    companySheetsUrl: 'RPO_COMPANY_SHEETS_API_URL',
  },
};

/**
 * A-W列のマッピング定義
 * col: 1始まりの列番号, key: APIレスポンスのフィールド名, type: 書き込み時の変換方式
 */
var COLUMNS = [
  { col: 1,  header: '応募日',             key: 'appliedAt',            type: 'date' },
  { col: 2,  header: '会社名',             key: '_companyName',         type: 'text' },
  { col: 3,  header: '案件名',             key: 'caseName',             type: 'text' },
  { col: 4,  header: '氏名',               key: 'name',                 type: 'text' },
  { col: 5,  header: 'mail',               key: 'email',                type: 'text' },
  { col: 6,  header: '応募職種名',         key: 'appliedJob',           type: 'text' },
  { col: 7,  header: '勤務地',             key: 'appliedLocation',      type: 'text' },
  { col: 8,  header: '電話番号',           key: 'phone',                type: 'text' },
  { col: 9,  header: '年齢',               key: 'age',                  type: 'number' },
  { col: 10, header: '生年月日',           key: 'birthDate',            type: 'date' },
  { col: 11, header: '性別',               key: 'gender',               type: 'text' },
  { col: 12, header: '担当者名',           key: 'assigneeName',         type: 'text' },
  { col: 13, header: '有効応募',           key: 'validApply',           type: 'checkbox' },
  { col: 14, header: '対応状況',           key: 'responseStatus',       type: 'text' },
  { col: 15, header: '備考',               key: 'notes',                type: 'text' },
  { col: 16, header: '次回アクション日',   key: 'nextActionDate',       type: 'date' },
  { col: 17, header: '通電日',             key: 'connectedAt',          type: 'date' },
  { col: 18, header: '面接予定日',         key: 'primaryScheduledDate', type: 'date' },
  { col: 19, header: '実施可否',           key: 'primaryConducted',     type: 'checkbox' },
  { col: 20, header: '二次/最終面接予定日', key: 'secScheduledDate',     type: 'date' },
  { col: 21, header: '二次/最終実施可否',   key: 'secConducted',         type: 'checkbox' },
  { col: 22, header: '内定可否',           key: 'offer',                type: 'checkbox' },
  { col: 23, header: '入社日',             key: 'joinedDate',           type: 'date' },
];

var KEY_COL = 24; // X列: _applicant_id（非表示キー列）
var TOTAL_COLS = 24; // A-X
var NOTES_COL = 15; // O列: 備考

/* ==========================
 * エントリポイント
 * ========================== */

function syncAll() {
  return SyncApp.runAll({ dryRun: false });
}

function dryRunAll() {
  return SyncApp.runAll({ dryRun: true });
}

function syncBySheet(spreadsheetId) {
  return SyncApp.runBySheet(spreadsheetId, { dryRun: false });
}

/* ==========================
 * SyncApp（オーケストレーター）
 * ========================== */

var SyncApp = (function () {
  var startTime_ = 0;

  function runAll(opts) {
    startTime_ = Date.now();
    var dryRun = opts.dryRun;
    validateConfig_();

    var lock = LockService.getScriptLock();
    if (!lock.tryLock(CONFIG.timing.lockWaitMs)) {
      throw new Error('別の同期が実行中です。');
    }

    try {
      var groups = fetchAndGroupSheets_();
      Logger.log('[INFO] スプレッドシートグループ数: ' + groups.length);

      var summary = { groups: groups.length, processed: 0, success: 0, failed: 0, skippedByTime: 0, totalRecords: 0 };

      for (var i = 0; i < groups.length; i++) {
        if (isTimeUp_()) {
          summary.skippedByTime = groups.length - i;
          Logger.log('[WARN] 時間制限のため残り ' + summary.skippedByTime + ' グループをスキップ');
          break;
        }

        summary.processed++;
        try {
          var count = syncOneGroup_(groups[i], { dryRun: dryRun });
          summary.success++;
          summary.totalRecords += count;
        } catch (e) {
          summary.failed++;
          Logger.log('[ERROR] ' + groups[i].spreadsheetId + ': ' + errMsg_(e));
        }
      }

      Logger.log(JSON.stringify({ mode: dryRun ? 'dryRun' : 'sync', summary: summary }, null, 2));
      return summary;
    } finally {
      lock.releaseLock();
    }
  }

  function runBySheet(spreadsheetId, opts) {
    startTime_ = Date.now();
    validateConfig_();

    var groups = fetchAndGroupSheets_();
    var target = null;
    for (var i = 0; i < groups.length; i++) {
      if (groups[i].spreadsheetId === spreadsheetId) {
        target = groups[i];
        break;
      }
    }
    if (!target) throw new Error('スプレッドシートが見つかりません: ' + spreadsheetId);
    return syncOneGroup_(target, opts);
  }

  /**
   * company-sheets APIからシート一覧を取得し、同一spreadsheetIdでグループ化
   */
  function fetchAndGroupSheets_() {
    var url = getCompanySheetsUrl_();
    var apiKey = getProp_(CONFIG.properties.apiKey);
    var response = apiGet_(url, apiKey);
    var sheets = response.data && response.data.sheets ? response.data.sheets : [];

    // spreadsheetId でグループ化
    var map = {};
    var order = [];
    for (var i = 0; i < sheets.length; i++) {
      var s = sheets[i];
      if (!s.spreadsheetId) continue;
      if (!map[s.spreadsheetId]) {
        map[s.spreadsheetId] = {
          spreadsheetId: s.spreadsheetId,
          gid: s.gid || CONFIG.sheet.targetGid,
          companies: [],
        };
        order.push(s.spreadsheetId);
      }
      map[s.spreadsheetId].companies.push({
        companyId: s.companyId,
        companyName: s.companyName || '',
      });
    }

    return order.map(function (id) { return map[id]; });
  }

  /**
   * 1グループ（= 1スプレッドシート）の同期処理
   * 複数企業が同一シートに入る場合はまとめて取得・書き込み
   */
  function syncOneGroup_(group, opts) {
    var dryRun = opts.dryRun;
    Logger.log('[INFO] 同期開始: ' + group.spreadsheetId + ' (' + group.companies.length + '社)');

    // 1. 全企業の応募者を取得
    var allRecords = [];
    for (var i = 0; i < group.companies.length; i++) {
      var co = group.companies[i];
      var records = fetchAllApplicants_(co);
      // 各レコードに会社名を付与
      for (var j = 0; j < records.length; j++) {
        records[j]._companyName = co.companyName;
      }
      allRecords = allRecords.concat(records);
    }

    // 応募日の降順でソート（新しい応募が上）
    allRecords.sort(function (a, b) {
      var da = a.appliedAt || '';
      var db = b.appliedAt || '';
      if (da > db) return -1;
      if (da < db) return 1;
      return 0;
    });

    Logger.log('[INFO] 取得レコード数: ' + allRecords.length);

    if (dryRun) {
      Logger.log('[DRYRUN] 書き込みスキップ: ' + group.spreadsheetId);
      return allRecords.length;
    }

    // 2. スプレッドシートを開いてターゲットシートを取得
    var sheet = getTargetSheet_(group.spreadsheetId, group.gid);

    // 3. ヘッダー行を書き込み（初回 or ヘッダー変更時）
    writeHeaderIfNeeded_(sheet);

    // 4. 備考(O列)の手入力値を優先保持
    var manualNotesByApplicantId = readExistingNotesByApplicantId_(sheet);
    mergeManualNotes_(allRecords, manualNotesByApplicantId);

    // 5. データ行をクリア
    clearDataRows_(sheet);

    // 6. 全件書き込み
    if (allRecords.length > 0) {
      writeAllRecords_(sheet, allRecords);
    }

    // 7. チェックボックスバリデーション設定
    setupCheckboxValidation_(sheet, allRecords.length);

    Logger.log('[INFO] 同期完了: ' + group.spreadsheetId + ' → ' + allRecords.length + '件');
    return allRecords.length;
  }

  /* --- API通信 --- */

  function fetchAllApplicants_(company) {
    var url = getProp_(CONFIG.properties.apiUrl);
    var apiKey = getProp_(CONFIG.properties.apiKey);
    var allRecords = [];
    var cursor = '';
    var companyName = company && company.companyName ? String(company.companyName) : '';
    var companyId = company && company.companyId ? String(company.companyId) : '';

    for (var page = 0; page < CONFIG.api.maxPages; page++) {
      if (isTimeUp_()) {
        Logger.log('[WARN] 時間制限のためページネーション中断: ' + companyName + ' page=' + page);
        break;
      }

      var payload = {
        pageSize: CONFIG.api.pageSize,
      };
      if (companyId) payload.companyId = companyId;
      if (companyName) payload.companyName = companyName;
      if (cursor) payload.cursor = cursor;

      var body = apiPost_(url, apiKey, payload);
      var data = body.data || {};
      var records = data.records || [];
      allRecords = allRecords.concat(records);

      cursor = data.nextCursor || '';
      if (!cursor || records.length === 0) break;
    }

    return allRecords;
  }

  /* --- シート操作 --- */

  function getTargetSheet_(spreadsheetId, gid) {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheets = ss.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      if (sheets[i].getSheetId() === gid) return sheets[i];
    }
    // gidが見つからない場合は最初のシートを使用
    return sheets[0];
  }

  function writeHeaderIfNeeded_(sheet) {
    var existingHeaders = sheet.getRange(CONFIG.sheet.headerRow, 1, 1, TOTAL_COLS).getValues()[0];
    var expected = [];
    for (var i = 0; i < COLUMNS.length; i++) {
      expected[COLUMNS[i].col - 1] = COLUMNS[i].header;
    }
    expected[KEY_COL - 1] = '_applicant_id';

    var needsUpdate = false;
    for (var j = 0; j < TOTAL_COLS; j++) {
      if (String(existingHeaders[j] || '') !== String(expected[j] || '')) {
        needsUpdate = true;
        break;
      }
    }

    if (needsUpdate) {
      sheet.getRange(CONFIG.sheet.headerRow, 1, 1, TOTAL_COLS).setValues([expected]);
      // X列（キー列）を非表示
      sheet.hideColumns(KEY_COL);
    }
  }

  function clearDataRows_(sheet) {
    var lastRow = sheet.getLastRow();
    if (lastRow >= CONFIG.sheet.dataStartRow) {
      var range = sheet.getRange(CONFIG.sheet.dataStartRow, 1, lastRow - CONFIG.sheet.dataStartRow + 1, TOTAL_COLS);
      range.clearContent();
      range.clearDataValidations();
    }
  }

  function readExistingNotesByApplicantId_(sheet) {
    var map = {};
    var lastRow = sheet.getLastRow();
    if (lastRow < CONFIG.sheet.dataStartRow) return map;

    var rowCount = lastRow - CONFIG.sheet.dataStartRow + 1;
    var notes = sheet.getRange(CONFIG.sheet.dataStartRow, NOTES_COL, rowCount, 1).getValues();
    var ids = sheet.getRange(CONFIG.sheet.dataStartRow, KEY_COL, rowCount, 1).getValues();

    for (var i = 0; i < rowCount; i++) {
      var id = String(ids[i][0] || '').trim();
      if (!id) continue;
      var note = String(notes[i][0] || '').trim();
      if (!note) continue;
      map[id] = note;
    }
    return map;
  }

  function mergeManualNotes_(records, manualNotesByApplicantId) {
    if (!records || records.length === 0) return;
    if (!manualNotesByApplicantId) return;

    for (var i = 0; i < records.length; i++) {
      var rec = records[i] || {};
      var id = String(rec.applicantId || rec.id || '').trim();
      if (!id) continue;
      var manualNote = String(manualNotesByApplicantId[id] || '').trim();
      if (!manualNote) continue;
      // Keep manually entered sheet notes as source of truth to avoid accidental overwrite.
      rec.notes = manualNote;
    }
  }

  function writeAllRecords_(sheet, records) {
    var rows = [];
    for (var i = 0; i < records.length; i++) {
      rows.push(recordToRow_(records[i]));
    }

    var startRow = CONFIG.sheet.dataStartRow;
    var range = sheet.getRange(startRow, 1, rows.length, TOTAL_COLS);
    range.clearDataValidations();
    range.setValues(rows);

    // 日付列のフォーマット設定
    var dateColIndexes = [];
    for (var j = 0; j < COLUMNS.length; j++) {
      if (COLUMNS[j].type === 'date') dateColIndexes.push(COLUMNS[j].col);
    }
    for (var k = 0; k < dateColIndexes.length; k++) {
      sheet.getRange(startRow, dateColIndexes[k], rows.length, 1).setNumberFormat('yyyy-mm-dd');
    }
  }

  function recordToRow_(rec) {
    var row = new Array(TOTAL_COLS);
    for (var i = 0; i < TOTAL_COLS; i++) row[i] = '';

    for (var j = 0; j < COLUMNS.length; j++) {
      var def = COLUMNS[j];
      var val = rec[def.key];
      row[def.col - 1] = convertValue_(val, def.type);
    }

    // キー列
    row[KEY_COL - 1] = rec.applicantId || rec.id || '';
    return row;
  }

  function convertValue_(val, type) {
    if (val === null || val === undefined || val === '') return '';

    switch (type) {
      case 'date':
        return parseDateValue_(val);
      case 'checkbox':
        return val === 1 || val === true;
      case 'number':
        var n = Number(val);
        return Number.isFinite(n) ? n : '';
      case 'text':
      default:
        return String(val);
    }
  }

  function parseDateValue_(val) {
    if (!val) return '';
    var s = String(val).trim();
    if (!s) return '';

    // yyyy-mm-dd 形式の場合はそのまま Date に変換
    var match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }

    // ISO文字列の場合
    var d = new Date(s);
    if (!isNaN(d.getTime())) {
      // 日付のみ（時刻なし）として返す
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    return '';
  }

  function setupCheckboxValidation_(sheet, rowCount) {
    if (rowCount <= 0) return;
    var startRow = CONFIG.sheet.dataStartRow;
    var cbRule = SpreadsheetApp.newDataValidation().requireCheckbox().build();

    for (var i = 0; i < COLUMNS.length; i++) {
      if (COLUMNS[i].type === 'checkbox') {
        sheet.getRange(startRow, COLUMNS[i].col, rowCount, 1).setDataValidation(cbRule);
      }
    }
  }

  /* --- ユーティリティ --- */

  function isTimeUp_() {
    return (Date.now() - startTime_) > CONFIG.timing.safeLimitMs;
  }

  function validateConfig_() {
    if (!getProp_(CONFIG.properties.apiUrl)) throw new Error('Script Property 未設定: ' + CONFIG.properties.apiUrl);
    if (!getProp_(CONFIG.properties.apiKey)) throw new Error('Script Property 未設定: ' + CONFIG.properties.apiKey);
  }

  function getCompanySheetsUrl_() {
    var explicit = getProp_(CONFIG.properties.companySheetsUrl);
    if (explicit) return explicit;
    var base = getProp_(CONFIG.properties.apiUrl);
    if (!base) throw new Error('RPO_API_URL が未設定です');
    return base.replace(/\/api\/sync\/applicants\b/, '/api/sync/company-sheets');
  }

  return { runAll: runAll, runBySheet: runBySheet };
})();

/* ==========================
 * HTTP通信（リトライ付き）
 * ========================== */

function apiGet_(url, apiKey) {
  return apiRequest_('get', url, apiKey, null);
}

function apiPost_(url, apiKey, payload) {
  return apiRequest_('post', url, apiKey, payload);
}

function apiRequest_(method, url, apiKey, payload) {
  var maxRetries = CONFIG.api.maxRetries;
  var baseSleep = CONFIG.api.retryBaseSleepMs;

  for (var attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      var options = {
        method: method,
        headers: { 'x-rpo-api-key': apiKey },
        muteHttpExceptions: true,
        validateHttpsCertificates: true,
      };
      if (payload) {
        options.contentType = 'application/json';
        options.payload = JSON.stringify(payload);
      }

      var response = UrlFetchApp.fetch(url, options);
      var status = response.getResponseCode();
      var text = response.getContentText() || '';

      if (status >= 200 && status < 300) {
        var body = text ? JSON.parse(text) : {};
        if (body.success === false) {
          throw new Error('API error: ' + (body.error || text));
        }
        return body;
      }

      // 4xx（408, 429以外）はリトライ不要
      if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
        throw new Error('API error (' + status + '): ' + truncText_(text, 500));
      }

      // リトライ可能エラー
      if (attempt === maxRetries) {
        throw new Error('API error after ' + maxRetries + ' retries (' + status + '): ' + truncText_(text, 300));
      }

      var waitMs = baseSleep * Math.pow(2, attempt - 1);
      Logger.log('[WARN] API retry attempt=' + attempt + ' status=' + status + ' wait=' + waitMs + 'ms');
      Utilities.sleep(waitMs);

    } catch (e) {
      if (e.message && e.message.indexOf('API error') === 0) throw e;
      if (attempt === maxRetries) {
        throw new Error('API request failed after ' + maxRetries + ' retries: ' + errMsg_(e));
      }
      var waitMs2 = baseSleep * Math.pow(2, attempt - 1);
      Utilities.sleep(waitMs2);
    }
  }
}

/* ==========================
 * ユーティリティ
 * ========================== */

function getProp_(key) {
  return (PropertiesService.getScriptProperties().getProperty(key) || '').trim();
}

function errMsg_(e) {
  if (!e) return 'unknown error';
  if (e instanceof Error) return e.stack || e.message || String(e);
  return String(e);
}

function truncText_(text, maxLen) {
  var s = String(text || '');
  return s.length > maxLen ? s.slice(0, maxLen) + '...' : s;
}
