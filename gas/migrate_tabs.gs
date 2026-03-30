/**
 * 全リンク済みシートにテンプレートタブをコピーし、DBの紐付けを更新
 *
 * エントリポイント:
 *   migrateAllSheets()    : 全シートを移行（本番実行）
 *   dryRunMigration()     : 変更内容のプレビューのみ（書き込みなし）
 *
 * 処理フロー:
 *   1. company-sheets APIから全リンク済みシートを取得
 *   2. テンプレートのタブ(GID=465742923)を各スプレッドシートにコピー
 *   3. コピーしたタブを「応募者一覧」にリネームし先頭に移動
 *   4. DBの紐付けGIDを新タブのGIDに一括更新
 *   ※ データ反映は別途 syncAll() を実行
 *
 * Script Properties:
 *   RPO_API_URL
 *   RPO_API_KEY
 *   RPO_COMPANY_SHEETS_API_URL (省略時はRPO_API_URLから推定)
 */

var TEMPLATE_SPREADSHEET_ID = '1-ixh_LBlJJnD8iwntYZb2hMciA1HwIpvmSM5U037sWk';
var TEMPLATE_TAB_GID = 465742923;
var NEW_TAB_NAME = '応募者一覧';
var OLD_GIDS_PROPERTY_KEY = 'MIGRATE_OLD_GIDS'; // 旧GID記録用
var LEGACY_TAB_NAMES = ['候補者管理シート', '候補者管理_RPO同期用'];

/* ==========================
 * エントリポイント
 * ========================== */

function migrateAllSheets() {
  return runMigration_({ dryRun: false });
}

function dryRunMigration() {
  return runMigration_({ dryRun: true });
}

function deleteOldTabs() {
  return runDeleteOldTabs_({ dryRun: false });
}

function dryRunDeleteOldTabs() {
  return runDeleteOldTabs_({ dryRun: true });
}

function deleteLegacyCandidateTabs() {
  return runDeleteTabsByNames_({ dryRun: false, tabNames: LEGACY_TAB_NAMES });
}

function dryRunDeleteLegacyCandidateTabs() {
  return runDeleteTabsByNames_({ dryRun: true, tabNames: LEGACY_TAB_NAMES });
}

/* ==========================
 * メイン処理
 * ========================== */

function runMigration_(opts) {
  var dryRun = opts.dryRun;
  var startTime = Date.now();

  // 1. 対象シート一覧を取得
  var sheets = fetchSheetList_();
  Logger.log('[MIGRATE] 対象シート数: ' + sheets.length + (dryRun ? ' (DRY RUN)' : ''));

  // spreadsheetId でユニーク化（同じスプレッドシートに複数企業が紐づく場合）
  var ssMap = {};
  var ssOrder = [];
  for (var i = 0; i < sheets.length; i++) {
    var s = sheets[i];
    Logger.log('[INFO] ' + s.companyName + ': spreadsheet=' + s.spreadsheetId + ' gid=' + s.gid + ' id=' + s.id);
    if (!ssMap[s.spreadsheetId]) {
      ssMap[s.spreadsheetId] = [];
      ssOrder.push(s.spreadsheetId);
    }
    ssMap[s.spreadsheetId].push(s);
  }

  Logger.log('[INFO] ユニークスプレッドシート数: ' + ssOrder.length);

  // テンプレートのタブを取得（コピー元確認）
  var templateSs = SpreadsheetApp.openById(TEMPLATE_SPREADSHEET_ID);
  var templateTab = null;
  var templateSheets = templateSs.getSheets();
  for (var t = 0; t < templateSheets.length; t++) {
    if (templateSheets[t].getSheetId() === TEMPLATE_TAB_GID) {
      templateTab = templateSheets[t];
      break;
    }
  }
  if (!templateTab) {
    throw new Error('テンプレートタブ(GID=' + TEMPLATE_TAB_GID + ')が見つかりません');
  }
  Logger.log('[INFO] テンプレートタブ: "' + templateTab.getName() + '" GID=' + TEMPLATE_TAB_GID);

  var summary = { total: ssOrder.length, success: 0, skipped: 0, failed: 0 };
  var gidUpdates = []; // {id, gid} — DB更新用
  var oldGidRecords = []; // {spreadsheetId, gid} — 旧タブ削除用に記録

  // 2. 各スプレッドシートにテンプレートタブをコピー
  for (var j = 0; j < ssOrder.length; j++) {
    if ((Date.now() - startTime) > 5 * 60 * 1000) {
      Logger.log('[WARN] 時間制限のため残り ' + (ssOrder.length - j) + ' 件をスキップ');
      break;
    }

    var ssId = ssOrder[j];
    var entries = ssMap[ssId];
    var companyNames = entries.map(function(e) { return e.companyName; }).join(', ');

    try {
      var result = migrateOneSpreadsheet_(templateTab, ssId, companyNames, dryRun);
      Logger.log('[' + result.status.toUpperCase() + '] ' + companyNames + ' (' + ssId + ') — ' + result.message);

      if (result.status === 'success' && result.newGid !== undefined) {
        summary.success++;
        // この spreadsheetId に紐づく全 company_sheet の GID を更新
        for (var k = 0; k < entries.length; k++) {
          gidUpdates.push({ id: entries[k].id, gid: result.newGid });
        }
        // 旧GIDを記録（重複排除）
        var oldGids = {};
        for (var og = 0; og < entries.length; og++) {
          oldGids[entries[og].gid] = true;
        }
        for (var gidKey in oldGids) {
          var oldGidNum = Number(gidKey);
          if (oldGidNum !== result.newGid) {
            oldGidRecords.push({ spreadsheetId: ssId, gid: oldGidNum });
          }
        }
      } else if (result.status === 'skipped') {
        summary.skipped++;
        // スキップでも newGid があれば DB更新（既存タブのGIDに合わせる）
        if (result.newGid !== undefined) {
          for (var m = 0; m < entries.length; m++) {
            if (entries[m].gid !== result.newGid) {
              gidUpdates.push({ id: entries[m].id, gid: result.newGid });
            }
          }
        }
      }
    } catch (e) {
      summary.failed++;
      Logger.log('[ERROR] ' + companyNames + ' (' + ssId + '): ' + migrateErrMsg_(e));
    }
  }

  // 3. DBの紐付けGIDを一括更新
  if (!dryRun && gidUpdates.length > 0) {
    Logger.log('[INFO] DBのGIDを ' + gidUpdates.length + ' 件更新します...');
    try {
      updateSheetGidsInDb_(gidUpdates);
      Logger.log('[INFO] DB更新完了');
    } catch (e) {
      Logger.log('[ERROR] DB更新失敗: ' + migrateErrMsg_(e));
    }
  } else if (dryRun && gidUpdates.length > 0) {
    Logger.log('[DRYRUN] DB更新予定: ' + gidUpdates.length + ' 件');
    for (var u = 0; u < gidUpdates.length; u++) {
      Logger.log('  id=' + gidUpdates[u].id + ' → newGid=' + gidUpdates[u].gid);
    }
  }

  // 4. 旧GIDをScript Propertiesに保存（削除用）
  if (!dryRun && oldGidRecords.length > 0) {
    PropertiesService.getScriptProperties().setProperty(OLD_GIDS_PROPERTY_KEY, JSON.stringify(oldGidRecords));
    Logger.log('[INFO] 旧GIDを ' + oldGidRecords.length + ' 件記録しました（deleteOldTabs() で削除可能）');
    for (var p = 0; p < oldGidRecords.length; p++) {
      Logger.log('  ' + oldGidRecords[p].spreadsheetId + ' GID=' + oldGidRecords[p].gid);
    }
  } else if (dryRun && oldGidRecords.length > 0) {
    Logger.log('[DRYRUN] 旧GID記録予定: ' + oldGidRecords.length + ' 件');
  }

  Logger.log(JSON.stringify({ mode: dryRun ? 'dryRun' : 'migrate', summary: summary }, null, 2));
  Logger.log('[INFO] データ反映するには syncAll() を別途実行してください');
  Logger.log('[INFO] 旧タブ削除するには deleteOldTabs() を実行してください（dryRunDeleteOldTabs() でプレビュー可）');
  return summary;
}

/* ==========================
 * 1スプレッドシートのマイグレーション
 * ========================== */

function migrateOneSpreadsheet_(templateTab, spreadsheetId, companyNames, dryRun) {
  var ss = SpreadsheetApp.openById(spreadsheetId);
  var allTabs = ss.getSheets();

  // デバッグ: 全タブ一覧
  Logger.log('[DEBUG] ' + companyNames + ' のタブ一覧:');
  for (var t = 0; t < allTabs.length; t++) {
    Logger.log('  "' + allTabs[t].getName() + '" GID=' + allTabs[t].getSheetId());
  }

  // 既に「応募者一覧」タブが存在するかチェック
  var existingTab = null;
  for (var i = 0; i < allTabs.length; i++) {
    if (allTabs[i].getName() === NEW_TAB_NAME) {
      existingTab = allTabs[i];
      break;
    }
  }

  if (existingTab) {
    Logger.log('[DEBUG] "' + NEW_TAB_NAME + '" タブが既に存在 (GID=' + existingTab.getSheetId() + ')');
    return {
      status: 'skipped',
      message: '"' + NEW_TAB_NAME + '" タブが既に存在します (GID=' + existingTab.getSheetId() + ')',
      newGid: existingTab.getSheetId(),
    };
  }

  if (dryRun) {
    return {
      status: 'success',
      message: '[DRY RUN] テンプレートタブを "' + NEW_TAB_NAME + '" としてコピー予定',
      newGid: 0,
    };
  }

  // === 本番実行 ===

  // テンプレートタブをこのスプレッドシートにコピー
  var copiedTab = templateTab.copyTo(ss);
  var newGid = copiedTab.getSheetId();
  Logger.log('[INFO] テンプレートコピー完了: GID=' + newGid + ' 名前="' + copiedTab.getName() + '"');

  // タブ名をリネーム
  copiedTab.setName(NEW_TAB_NAME);

  // 先頭に移動
  ss.setActiveSheet(copiedTab);
  ss.moveActiveSheet(1);

  return {
    status: 'success',
    message: '新タブ "' + NEW_TAB_NAME + '" (GID=' + newGid + ') を作成',
    newGid: newGid,
  };
}

/* ==========================
 * API通信
 * ========================== */

function fetchSheetList_() {
  var url = getMigrateCompanySheetsUrl_();
  var apiKey = getMigrateProp_('RPO_API_KEY');
  if (!url || !apiKey) throw new Error('RPO_API_URL / RPO_API_KEY が未設定です');

  var response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { 'x-rpo-api-key': apiKey },
    muteHttpExceptions: true,
  });

  var status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error('company-sheets API error (' + status + '): ' + response.getContentText().slice(0, 300));
  }

  var body = JSON.parse(response.getContentText());
  var rawSheets = (body.data && body.data.sheets) ? body.data.sheets : [];

  var result = [];
  for (var i = 0; i < rawSheets.length; i++) {
    var s = rawSheets[i];
    if (!s.spreadsheetId) continue;
    result.push({
      id: s.id,
      spreadsheetId: s.spreadsheetId,
      gid: s.gid || 0,
      companyName: s.companyName || '',
    });
  }
  return result;
}

function updateSheetGidsInDb_(updates) {
  var baseUrl = getMigrateProp_('RPO_API_URL');
  if (!baseUrl) throw new Error('RPO_API_URL が未設定です');
  var apiKey = getMigrateProp_('RPO_API_KEY');

  var url = baseUrl.replace(/\/api\/sync\/applicants\b/, '/api/admin/update-sheet-gids');

  var response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-rpo-api-key': apiKey },
    payload: JSON.stringify({ updates: updates }),
    muteHttpExceptions: true,
  });

  var status = response.getResponseCode();
  var text = response.getContentText();
  if (status < 200 || status >= 300) {
    throw new Error('update-sheet-gids API error (' + status + '): ' + text.slice(0, 300));
  }

  var body = JSON.parse(text);
  Logger.log('[INFO] DB更新結果: ' + JSON.stringify(body));
  return body;
}

function getMigrateCompanySheetsUrl_() {
  var explicit = getMigrateProp_('RPO_COMPANY_SHEETS_API_URL');
  if (explicit) return explicit;
  var base = getMigrateProp_('RPO_API_URL');
  if (!base) return '';
  return base.replace(/\/api\/sync\/applicants\b/, '/api/sync/company-sheets');
}

function getMigrateProp_(key) {
  return (PropertiesService.getScriptProperties().getProperty(key) || '').trim();
}

function migrateErrMsg_(e) {
  if (!e) return 'unknown error';
  if (e instanceof Error) return e.stack || e.message || String(e);
  return String(e);
}

/* ==========================
 * 旧タブ一括削除
 * ========================== */

function runDeleteOldTabs_(opts) {
  var dryRun = opts.dryRun;
  var raw = PropertiesService.getScriptProperties().getProperty(OLD_GIDS_PROPERTY_KEY);

  if (!raw) {
    Logger.log('[INFO] 削除対象の旧GIDが記録されていません。先に migrateAllSheets() を実行してください。');
    return { total: 0, deleted: 0, failed: 0, notFound: 0 };
  }

  var oldGidRecords = JSON.parse(raw);
  Logger.log('[DELETE] 削除対象: ' + oldGidRecords.length + ' タブ' + (dryRun ? ' (DRY RUN)' : ''));

  var summary = { total: oldGidRecords.length, deleted: 0, failed: 0, notFound: 0 };

  for (var i = 0; i < oldGidRecords.length; i++) {
    var record = oldGidRecords[i];
    try {
      var ss = SpreadsheetApp.openById(record.spreadsheetId);
      var sheets = ss.getSheets();

      // スプレッドシートにタブが1つしかない場合は削除不可
      if (sheets.length <= 1) {
        Logger.log('[WARN] ' + record.spreadsheetId + ' GID=' + record.gid + ': タブが1つしかないため削除スキップ');
        summary.notFound++;
        continue;
      }

      var targetTab = null;
      for (var j = 0; j < sheets.length; j++) {
        if (sheets[j].getSheetId() === record.gid) {
          targetTab = sheets[j];
          break;
        }
      }

      if (!targetTab) {
        Logger.log('[WARN] ' + record.spreadsheetId + ' GID=' + record.gid + ': タブが見つかりません（既に削除済み？）');
        summary.notFound++;
        continue;
      }

      var tabName = targetTab.getName();

      if (dryRun) {
        Logger.log('[DRYRUN] 削除予定: ' + record.spreadsheetId + ' "' + tabName + '" GID=' + record.gid);
        summary.deleted++;
        continue;
      }

      ss.deleteSheet(targetTab);
      Logger.log('[DELETED] ' + record.spreadsheetId + ' "' + tabName + '" GID=' + record.gid);
      summary.deleted++;

    } catch (e) {
      summary.failed++;
      Logger.log('[ERROR] ' + record.spreadsheetId + ' GID=' + record.gid + ': ' + migrateErrMsg_(e));
    }
  }

  // 削除完了後、記録をクリア
  if (!dryRun) {
    PropertiesService.getScriptProperties().deleteProperty(OLD_GIDS_PROPERTY_KEY);
    Logger.log('[INFO] 旧GID記録をクリアしました');
  }

  Logger.log(JSON.stringify({ mode: dryRun ? 'dryRun' : 'delete', summary: summary }, null, 2));
  return summary;
}

/* ==========================
 * 指定タブ名の一括削除
 * ========================== */

function runDeleteTabsByNames_(opts) {
  var dryRun = opts.dryRun;
  var tabNames = opts.tabNames || [];
  if (!tabNames.length) {
    throw new Error('削除対象のタブ名が指定されていません');
  }

  var sheets = fetchSheetList_();
  var ssMap = {};
  for (var i = 0; i < sheets.length; i++) {
    ssMap[sheets[i].spreadsheetId] = true;
  }
  var spreadsheetIds = Object.keys(ssMap);
  Logger.log('[DELETE_BY_NAME] 対象スプレッドシート数: ' + spreadsheetIds.length + (dryRun ? ' (DRY RUN)' : ''));
  Logger.log('[DELETE_BY_NAME] 対象タブ名: ' + tabNames.join(', '));

  var targetNameSet = {};
  for (var n = 0; n < tabNames.length; n++) {
    targetNameSet[tabNames[n]] = true;
  }

  var summary = { total: spreadsheetIds.length, deleted: 0, failed: 0, notFound: 0, skipped: 0 };

  for (var j = 0; j < spreadsheetIds.length; j++) {
    var ssId = spreadsheetIds[j];
    try {
      var ss = SpreadsheetApp.openById(ssId);
      var tabs = ss.getSheets();
      var targets = [];

      for (var t = 0; t < tabs.length; t++) {
        var tabName = tabs[t].getName();
        if (targetNameSet[tabName] && tabName !== NEW_TAB_NAME) {
          targets.push(tabs[t]);
        }
      }

      if (targets.length === 0) {
        summary.notFound++;
        Logger.log('[NOT_FOUND] ' + ssId + ' — 対象タブなし');
        continue;
      }

      if (dryRun) {
        for (var d = 0; d < targets.length; d++) {
          Logger.log('[DRYRUN] 削除予定: ' + ssId + ' "' + targets[d].getName() + '" GID=' + targets[d].getSheetId());
        }
        summary.deleted += targets.length;
        continue;
      }

      for (var k = 0; k < targets.length; k++) {
        if (ss.getSheets().length <= 1) {
          Logger.log('[WARN] ' + ssId + ' — タブが1つ以下になるため残りをスキップ');
          summary.skipped++;
          break;
        }
        var target = targets[k];
        var targetName = target.getName();
        var targetGid = target.getSheetId();
        ss.deleteSheet(target);
        summary.deleted++;
        Logger.log('[DELETED] ' + ssId + ' "' + targetName + '" GID=' + targetGid);
      }
    } catch (e) {
      summary.failed++;
      Logger.log('[ERROR] ' + ssId + ': ' + migrateErrMsg_(e));
    }
  }

  Logger.log(JSON.stringify({ mode: dryRun ? 'dryRunDeleteByName' : 'deleteByName', summary: summary }, null, 2));
  return summary;
}
