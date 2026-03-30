/**
 * Indeed応募通知 -> 本サービスDB取り込み（Gmail API / Thread単位）
 * - GmailApp は使用しません（Advanced Google services の Gmail API を使用）
 *
 * 実行関数:
 *   - run()    : 本番（API送信 + ラベル付与）
 *   - dryRun() : 検証（送信・ラベル付与なし、ログのみ）
 *   - runCatchUpToNewDeploy() / dryRunCatchUpToNewDeploy()
 *       : 新デプロイ先へ「直近N日（既定30日）」を追いつき転記
 *         ※ PROCESSED ラベル付きも対象に再送（PARSE_ERROR/API_ERROR は除外）
 *   - runRetryApiErrorAfterFix() / dryRunRetryApiErrorAfterFix()
 *       : APIキー修正後に API_ERROR ラベルのみを再送
 *
 * 強化ポイント:
 * - 検索クエリで「過去1週間以内」のスレッドに限定（newer_than:7d）
 * - company は「(半角/全角スペース)+候」の直前までで打ち切る
 * - API送信にリトライ（指数バックオフ）を追加
 * - スレッド取得のページネーション対応（100件超対応）
 */

/* =========================
 * 0) 設定
 * ========================= */
const APP_CONFIG = {
  pageSize: 100,

  gmail: {
    fromDomain: 'indeedemail.com',
    toAddress: 'form-rpo@masterkey-inc.com',
    subjectPrefix: '【新しい応募者のお知らせ】',
    excludeRePrefix: true,
    excludeLabeled: [
      'Indeed応募一覧/PROCESSED',
      'Indeed応募一覧/PARSE_ERROR',
      'Indeed応募一覧/API_ERROR',
    ],
    newerThanDays: 7, // newer_than:7d
  },

  labels: {
    base: 'Indeed応募一覧',
    processed: 'Indeed応募一覧/PROCESSED',
    parseError: 'Indeed応募一覧/PARSE_ERROR',
    apiError: 'Indeed応募一覧/API_ERROR',
  },

  api: {
    maxRetries: 3,
    retryBaseSleepMs: 800,
  },

  debug: {
    enabled: false,
    dumpPayloadTreeLimit: 3,
  },

  response: {
    nonJsonFallback: 'No body',
  },

  migration: {
    catchUpLookbackDaysDefault: 30,
  },
};

/* =========================
 * 1) エントリポイント
 * ========================= */
function run() {
  return App.run({ dryRun: false });
}

function dryRun() {
  return App.run({ dryRun: true });
}

/**
 * 新デプロイ先へ直近データを追いつき転記する（既定30日）。
 * 既に PROCESSED ラベルが付いたメールも再送対象に含める。
 */
function runCatchUpToNewDeploy() {
  return App.run({
    dryRun: false,
    queryOverrides: buildCatchUpQueryOverrides_(),
  });
}

function dryRunCatchUpToNewDeploy() {
  return App.run({
    dryRun: true,
    queryOverrides: buildCatchUpQueryOverrides_(),
  });
}

/**
 * 任意日数で追いつき転記する。
 * 例: runCatchUpDays(60), dryRunCatchUpDays(14)
 */
function runCatchUpDays(days) {
  return App.run({
    dryRun: false,
    queryOverrides: buildCatchUpQueryOverrides_(days),
  });
}

function dryRunCatchUpDays(days) {
  return App.run({
    dryRun: true,
    queryOverrides: buildCatchUpQueryOverrides_(days),
  });
}

/**
 * APIキー不一致などを修正した後、API_ERRORラベル対象のみを再送する。
 * 既定30日。必要に応じて runRetryApiErrorDays(60) で範囲拡張。
 */
function runRetryApiErrorAfterFix() {
  return App.run({
    dryRun: false,
    queryOverrides: buildRetryApiErrorQueryOverrides_(),
  });
}

function dryRunRetryApiErrorAfterFix() {
  return App.run({
    dryRun: true,
    queryOverrides: buildRetryApiErrorQueryOverrides_(),
  });
}

function runRetryApiErrorDays(days) {
  return App.run({
    dryRun: false,
    queryOverrides: buildRetryApiErrorQueryOverrides_(days),
  });
}

function dryRunRetryApiErrorDays(days) {
  return App.run({
    dryRun: true,
    queryOverrides: buildRetryApiErrorQueryOverrides_(days),
  });
}

function buildCatchUpQueryOverrides_(days) {
  var lookback = sanitizeLookbackDays_(days, APP_CONFIG.migration.catchUpLookbackDaysDefault);
  return {
    newerThanDays: lookback,
    excludeLabeled: [
      APP_CONFIG.labels.parseError,
      APP_CONFIG.labels.apiError,
    ],
  };
}

function buildRetryApiErrorQueryOverrides_(days) {
  var lookback = sanitizeLookbackDays_(days, APP_CONFIG.migration.catchUpLookbackDaysDefault);
  return {
    newerThanDays: lookback,
    includeLabeled: [
      APP_CONFIG.labels.apiError,
    ],
    excludeLabeled: [
      APP_CONFIG.labels.parseError,
    ],
  };
}

function sanitizeLookbackDays_(value, fallback) {
  var n = Number(value);
  if (isFinite(n) && n > 0) return Math.floor(n);
  var fb = Number(fallback);
  return (isFinite(fb) && fb > 0) ? Math.floor(fb) : 30;
}

/* =========================
 * 2) App（オーケストレーター）
 * ========================= */
const App = (function () {
  function run(opts) {
    opts = opts || {};
    var dryRun = !!opts.dryRun;
    var queryOverrides = opts.queryOverrides || null;
    Guard.requireAdvancedGmailApi();

    var lock = LockService.getScriptLock();
    if (!lock.tryLock(25 * 1000)) {
      Logger.log('Another execution is running. Skip this run.');
      return;
    }

    try {
      var labelIds = LabelService.ensureLabels();

      var query = GmailQueryBuilder.build(APP_CONFIG, queryOverrides);
      Logger.log('[' + (dryRun ? 'dryRun' : 'run') + '] queryOverrides: ' + JSON.stringify(queryOverrides || {}));
      Logger.log('[' + (dryRun ? 'dryRun' : 'run') + '] query: ' + query);

      var threads = GmailClient.listAllThreads(query, APP_CONFIG.pageSize);
      Logger.log('Found threads: ' + threads.length);

      var ok = 0;
      var parseErr = 0;
      var apiErr = 0;
      var skipped = 0;
      var payloadDumped = 0;

      if (!dryRun) {
        InboundClient.validateConfigOrThrow();
      }

      for (var i = 0; i < threads.length; i++) {
        var t = threads[i];
        try {
          var res = ThreadProcessor.process(t.id, labelIds, {
            dryRun: dryRun,
            payloadDumpedRef: function () { return payloadDumped; },
            incPayloadDumped: function () { payloadDumped++; }
          });

          if (res === 'OK') ok++;
          else if (res === 'PARSE_ERROR') parseErr++;
          else if (res === 'API_ERROR') apiErr++;
          else skipped++;
        } catch (e) {
          Logger.log('threadId=' + t.id + ' -> UNHANDLED ERROR: ' + (e && e.stack ? e.stack : e));
          if (!dryRun) {
            LabelService.safeApplyLabels(t.id, [labelIds.base, labelIds.parseError]);
          }
          parseErr++;
        }
      }

      Logger.log('Summary: OK=' + ok + ', PARSE_ERROR=' + parseErr + ', API_ERROR=' + apiErr + ', SKIPPED=' + skipped);
    } finally {
      lock.releaseLock();
    }
  }

  return { run: run };
})();

/* =========================
 * 2.5) Guard
 * ========================= */
const Guard = (function () {
  function requireAdvancedGmailApi() {
    var hasGmailObject = typeof Gmail !== 'undefined' && Gmail !== null;
    var hasUsers = hasGmailObject && Gmail.Users;
    if (hasUsers) return;

    throw new Error(
      'Advanced Gmail API が未有効です。' +
      ' Apps Script エディタの「サービス」から Gmail API を追加してください。' +
      ' 有効化後に dryRun() を再実行してください。'
    );
  }

  return { requireAdvancedGmailApi: requireAdvancedGmailApi };
})();

/* =========================
 * 3) GmailQueryBuilder
 * ========================= */
const GmailQueryBuilder = (function () {
  function build(cfg, overrides) {
    var g = cfg.gmail;
    var o = overrides || {};
    var newerThanDays = resolvePositiveInt_(o.newerThanDays, g.newerThanDays);
    var includeLabeled = Array.isArray(o.includeLabeled) ? o.includeLabeled : [];
    var excludeLabeled = Array.isArray(o.excludeLabeled) ? o.excludeLabeled : g.excludeLabeled;

    var parts = [
      'from:' + g.fromDomain,
      'to:' + g.toAddress,
      'subject:"' + g.subjectPrefix + '"'
    ];

    if (g.excludeRePrefix) parts.push('-subject:"Re:"');

    if (newerThanDays > 0) {
      parts.push('newer_than:' + newerThanDays + 'd');
    }

    for (var j = 0; j < includeLabeled.length; j++) {
      var includeLabel = String(includeLabeled[j] || '').trim();
      if (!includeLabel) continue;
      parts.push('label:"' + includeLabel + '"');
    }

    for (var i = 0; i < excludeLabeled.length; i++) {
      var excludeLabel = String(excludeLabeled[i] || '').trim();
      if (!excludeLabel) continue;
      parts.push('-label:"' + excludeLabel + '"');
    }

    return parts.join(' ');
  }

  function resolvePositiveInt_(value, fallback) {
    var n = Number(value);
    if (isFinite(n) && n > 0) return Math.floor(n);
    var fb = Number(fallback);
    return (isFinite(fb) && fb > 0) ? Math.floor(fb) : 0;
  }

  return { build: build };
})();

/* =========================
 * 4) GmailClient（Advanced Gmail Service Wrapper）
 * ========================= */
const GmailClient = (function () {
  // Paginated thread listing — handles 100+ unprocessed threads
  function listAllThreads(query, maxPerPage) {
    var all = [];
    var pageToken = '';
    do {
      var opts = {
        q: query,
        maxResults: maxPerPage,
        includeSpamTrash: false,
      };
      if (pageToken) opts.pageToken = pageToken;

      var res = Gmail.Users.Threads.list('me', opts);
      if (res && res.threads) {
        all.push.apply(all, res.threads);
      }
      pageToken = (res && res.nextPageToken) ? res.nextPageToken : '';
    } while (pageToken);
    return all;
  }

  function getThreadFull(threadId) {
    return Gmail.Users.Threads.get('me', threadId, { format: 'full' });
  }

  function modifyThreadLabels(threadId, addLabelIds, removeLabelIds) {
    return Gmail.Users.Threads.modify(
      { addLabelIds: addLabelIds, removeLabelIds: removeLabelIds || [] },
      'me',
      threadId
    );
  }

  function listLabels() {
    var res = Gmail.Users.Labels.list('me');
    return (res && res.labels) ? res.labels : [];
  }

  function createLabel(name) {
    return Gmail.Users.Labels.create(
      { name: name, labelListVisibility: 'labelShow', messageListVisibility: 'show' },
      'me'
    );
  }

  function getAttachment(messageId, attachmentId) {
    return Gmail.Users.Messages.Attachments.get('me', messageId, attachmentId);
  }

  return {
    listAllThreads: listAllThreads,
    getThreadFull: getThreadFull,
    modifyThreadLabels: modifyThreadLabels,
    listLabels: listLabels,
    createLabel: createLabel,
    getAttachment: getAttachment,
  };
})();

/* =========================
 * 5) LabelService（ラベル作成・付与）
 * ========================= */
const LabelService = (function () {
  function ensureLabels() {
    var need = [
      APP_CONFIG.labels.base,
      APP_CONFIG.labels.processed,
      APP_CONFIG.labels.parseError,
      APP_CONFIG.labels.apiError,
    ];

    var existing = GmailClient.listLabels();
    var map = {};
    for (var i = 0; i < existing.length; i++) {
      map[existing[i].name] = existing[i].id;
    }

    for (var j = 0; j < need.length; j++) {
      if (!map[need[j]]) {
        var created = GmailClient.createLabel(need[j]);
        map[need[j]] = created.id;
      }
    }

    return {
      base: map[APP_CONFIG.labels.base],
      processed: map[APP_CONFIG.labels.processed],
      parseError: map[APP_CONFIG.labels.parseError],
      apiError: map[APP_CONFIG.labels.apiError],
    };
  }

  function safeApplyLabels(threadId, labelIdsToAdd) {
    try {
      GmailClient.modifyThreadLabels(threadId, labelIdsToAdd, []);
      return true;
    } catch (e) {
      Logger.log('threadId=' + threadId + ' -> LABEL APPLY FAILED: ' + (e && e.message ? e.message : e));
      return false;
    }
  }

  function safeMarkProcessed(threadId, labelIds) {
    try {
      GmailClient.modifyThreadLabels(
        threadId,
        [labelIds.base, labelIds.processed],
        [labelIds.apiError, labelIds.parseError]
      );
      return true;
    } catch (e) {
      Logger.log('threadId=' + threadId + ' -> MARK PROCESSED FAILED: ' + (e && e.message ? e.message : e));
      return safeApplyLabels(threadId, [labelIds.base, labelIds.processed]);
    }
  }

  return { ensureLabels: ensureLabels, safeApplyLabels: safeApplyLabels, safeMarkProcessed: safeMarkProcessed };
})();

/* =========================
 * 6) ThreadProcessor（スレッド処理）
 * ========================= */
const ThreadProcessor = (function () {
  function process(threadId, labelIds, ctx) {
    Logger.log('[DEBUG:ThreadProcessor] === スレッド処理開始: threadId=' + threadId + ' ===');
    var thread = GmailClient.getThreadFull(threadId);
    var messages = thread.messages || [];
    Logger.log('[DEBUG:ThreadProcessor] messages count=' + messages.length);

    var targetMsg = MessageSelector.findTarget(messages, APP_CONFIG.gmail.subjectPrefix);
    if (!targetMsg) {
      Logger.log('[DEBUG:ThreadProcessor] threadId=' + threadId + ' -> target message not found');
      if (!ctx.dryRun) LabelService.safeApplyLabels(threadId, [labelIds.base, labelIds.parseError]);
      return 'PARSE_ERROR';
    }

    var headers = targetMsg.payload && targetMsg.payload.headers ? targetMsg.payload.headers : [];
    var subject = (Util.getHeader(headers, 'Subject') || '').trim();
    var from = Util.getHeader(headers, 'From') || '';
    var date = Util.getHeader(headers, 'Date') || '';

    Logger.log('[DEBUG:ThreadProcessor] messageId=' + (targetMsg.id || '') + ' subject=' + subject);
    Logger.log('[DEBUG:ThreadProcessor] from=' + from + ' date=' + date);

    if (APP_CONFIG.gmail.excludeRePrefix && /^Re:\s*/i.test(subject)) {
      Logger.log('[DEBUG:ThreadProcessor] threadId=' + threadId + ' -> Re: subject (skip): ' + subject);
      return 'SKIPPED';
    }

    var html = BodyExtractor.getBodyByMimeType(targetMsg, 'text/html', {
      threadId: threadId,
      payloadDumpedRef: ctx.payloadDumpedRef,
      incPayloadDumped: ctx.incPayloadDumped,
    }) || '';

    Logger.log('[DEBUG:ThreadProcessor] html length=' + html.length + (html.length > 0 ? ' preview=' + html.slice(0, 200) : ' (empty)'));

    var parsed = IndeedParser.parse({ subject: subject, from: from, html: html });
    if (!parsed) {
      Logger.log('[DEBUG:ThreadProcessor] threadId=' + threadId + ' -> IndeedParser.parse returned null');
      if (!ctx.dryRun) LabelService.safeApplyLabels(threadId, [labelIds.base, labelIds.parseError]);
      return 'PARSE_ERROR';
    }

    parsed.threadId = threadId;
    parsed.gmailMessageId = targetMsg.id || '';
    parsed.receivedAt = Util.toJstIsoString(Util.getHeader(headers, 'Date'));

    parsed.company = (parsed.company != null && String(parsed.company).trim() !== '')
      ? String(parsed.company).trim()
      : '';

    Logger.log('[DEBUG:ThreadProcessor] parsed result:');
    Logger.log(JSON.stringify({ dryRun: ctx.dryRun, parsed: parsed }, null, 2));

    if (ctx.dryRun) return 'OK';

    try {
      Logger.log('[DEBUG:ThreadProcessor] API送信開始...');
      InboundClient.submitParsedApplication({
        receivedAt: parsed.receivedAt,
        name: parsed.name,
        company: parsed.company,
        job: parsed.job,
        location: parsed.location,
        email: parsed.email,
        gmailMessageId: parsed.gmailMessageId,
        threadId: parsed.threadId,
      });
      Logger.log('[DEBUG:ThreadProcessor] API送信成功 -> PROCESSED ラベル付与');
      LabelService.safeMarkProcessed(threadId, labelIds);
      return 'OK';
    } catch (e) {
      Logger.log('[DEBUG:ThreadProcessor] API送信失敗: ' + (e && e.stack ? e.stack : e));
      LabelService.safeApplyLabels(threadId, [labelIds.base, labelIds.apiError]);
      return 'API_ERROR';
    }
  }

  return { process: process };
})();

/* =========================
 * 7) MessageSelector（対象メッセージ選定）
 * ========================= */
const MessageSelector = (function () {
  function findTarget(messages, subjectPrefix) {
    for (var i = 0; i < (messages || []).length; i++) {
      var msg = messages[i];
      var headers = msg.payload && msg.payload.headers ? msg.payload.headers : [];
      var subject = (Util.getHeader(headers, 'Subject') || '').trim();
      if (subject.startsWith(subjectPrefix) && !/^Re:\s*/i.test(subject)) {
        return msg;
      }
    }
    return null;
  }
  return { findTarget: findTarget };
})();

/* =========================
 * 8) BodyExtractor（本文取得）
 * ========================= */
const BodyExtractor = (function () {
  function getBodyByMimeType(msg, mimeType, ctx) {
    var payload = msg.payload;

    if (APP_CONFIG.debug.enabled && ctx.payloadDumpedRef() < APP_CONFIG.debug.dumpPayloadTreeLimit) {
      Logger.log('[DEBUG] threadId=' + ctx.threadId + ' messageId=' + msg.id + ' subject=' + Util.getHeader(payload.headers, 'Subject'));
      dumpPayloadTree(payload, { threadId: ctx.threadId, messageId: msg.id }, 0);
      ctx.incPayloadDumped();
    }

    return findBody(payload, mimeType, { threadId: ctx.threadId, messageId: msg.id, path: 'payload' });
  }

  function findBody(payload, mimeType, meta) {
    if (!payload) return '';

    if (payload.mimeType === mimeType) {
      var body = payload.body || {};

      if (body.data != null) {
        return decodeBodyData(body.data, { threadId: meta.threadId, messageId: meta.messageId, mimeType: payload.mimeType, source: 'body.data' });
      }

      if (body.attachmentId) {
        return fetchAndDecodeAttachment(meta.messageId, body.attachmentId, { threadId: meta.threadId, messageId: meta.messageId, mimeType: payload.mimeType, source: 'attachmentId' });
      }

      if (APP_CONFIG.debug.enabled) {
        Logger.log('[DEBUG] No data/attachmentId: ' + JSON.stringify({ threadId: meta.threadId, messageId: meta.messageId, bodyKeys: Object.keys(body) }));
      }
      return '';
    }

    var parts = payload.parts || [];
    for (var i = 0; i < parts.length; i++) {
      var found = findBody(parts[i], mimeType, { threadId: meta.threadId, messageId: meta.messageId, path: meta.path + '.parts[' + i + ']' });
      if (found) return found;
    }
    return '';
  }

  function fetchAndDecodeAttachment(messageId, attachmentId, meta) {
    try {
      var att = GmailClient.getAttachment(messageId, attachmentId);
      if (!att || att.data == null) {
        if (APP_CONFIG.debug.enabled) Logger.log('[DEBUG] attachment fetched but no data: ' + JSON.stringify(meta));
        return '';
      }
      return decodeBodyData(att.data, { threadId: meta.threadId, messageId: meta.messageId, source: 'attachment.data', attachmentId: attachmentId });
    } catch (e) {
      Logger.log('[DEBUG] attachment fetch failed: meta=' + JSON.stringify(meta) + ' err=' + (e && e.stack ? e.stack : e));
      return '';
    }
  }

  function decodeBodyData(data, meta) {
    try {
      var t = typeof data;

      if (t === 'string') {
        return Util.decodeBase64UrlString(data);
      }

      if (Array.isArray(data)) {
        if (APP_CONFIG.debug.enabled) Logger.log('[DEBUG] data is Array: meta=' + JSON.stringify(meta) + ' len=' + data.length);
        return Utilities.newBlob(data).getDataAsString('UTF-8');
      }

      if (data && data.constructor && data.constructor.name === 'Uint8Array') {
        if (APP_CONFIG.debug.enabled) Logger.log('[DEBUG] data is Uint8Array: meta=' + JSON.stringify(meta) + ' len=' + data.length);
        return Utilities.newBlob(Array.from(data)).getDataAsString('UTF-8');
      }

      Logger.log('[DEBUG] data is not string: typeof=' + t + ' meta=' + JSON.stringify(meta) + ' preview=' + Util.safePreview(data));
      return '';
    } catch (e) {
      Logger.log('[DEBUG] decodeBodyData failed: meta=' + JSON.stringify(meta) + ' err=' + (e && e.stack ? e.stack : e));
      return '';
    }
  }

  function dumpPayloadTree(payload, meta, depth) {
    var indent = '  '.repeat(depth);
    var body = payload.body || {};
    var info = {
      mimeType: payload.mimeType,
      filename: payload.filename || '',
      hasData: body.data != null,
      dataType: body.data != null ? typeof body.data : '',
      hasAttachmentId: !!body.attachmentId,
      size: body.size || 0,
    };
    Logger.log(indent + '[DEBUG] ' + meta.threadId + '/' + meta.messageId + ' mime=' + info.mimeType + ' data=' + info.hasData + '(' + info.dataType + ') att=' + info.hasAttachmentId + ' size=' + info.size + ' file=' + info.filename);

    var parts = payload.parts || [];
    for (var i = 0; i < parts.length; i++) {
      dumpPayloadTree(parts[i], meta, depth + 1);
    }
  }

  return { getBodyByMimeType: getBodyByMimeType };
})();

/* =========================
 * 9) IndeedParser
 * ========================= */
const IndeedParser = (function () {
  function parse(opts) {
    var subject = opts.subject;
    var from = opts.from;
    var html = opts.html;
    var s = (subject || '').trim();

    var reSub = /^【新しい応募者のお知らせ】\s*(.+?)さんが\s*(.+?)\s*(?:の自動アプローチを見て)?\s*(?:の)?求人に応募しました/;
    var m = s.match(reSub);
    if (!m) return null;

    var name = m[1].trim();
    var job = m[2].trim();
    var email = extractEmail(from);

    var text = Util.stripHtml(html);
    var locComp = extractLocationAndCompany(text);

    return { name: name, job: job, location: locComp.location, email: email, company: locComp.company };
  }

  function extractEmail(from) {
    var s = (from || '').trim();
    var m = s.match(/<([^>]+)>/);
    if (m) return m[1].trim();
    var m2 = s.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return m2 ? m2[0] : '';
  }

  function extractLocationAndCompany(text) {
    var t = (text || '').trim();

    var m = t.match(/•\s*([^•]+?)\s*•\s*([^•]+?)(?=[ 　]候|$)/);
    if (m) return { location: m[1].trim(), company: cutCompany_(m[2]) };

    m = t.match(/・\s*([^・]+?)\s*・\s*([^・]+?)(?=[ 　]候|$)/);
    if (m) return { location: m[1].trim(), company: cutCompany_(m[2]) };

    var loc = extractLocationFallback_(t);
    var comp = cutCompany_(extractCompanyFallback_(t));
    return { location: loc, company: comp };
  }

  function cutCompany_(companyRaw) {
    var s = (companyRaw || '').trim();
    if (!s) return '';
    var idx = s.search(/[ 　]候/);
    var cut = (idx > 0) ? s.slice(0, idx) : s;
    return trimCompanySuffix_(cut.replace(/[•・｜|]+$/g, '').trim());
  }

  function trimCompanySuffix_(companyRaw) {
    var s = (companyRaw || '').trim();
    if (!s) return '';
    return s
      .replace(/\s*自動アプローチからの応募者\s*$/u, '')
      .replace(/\s*自動アプローチを経由した応募者\s*$/u, '')
      .replace(/\s*からの応募者\s*$/u, '')
      .replace(/\s*からの応募\s*$/u, '')
      .trim();
  }

  function extractLocationFallback_(t) {
    var m = t.match(/•\s*([^•]+?)\s*•/);
    if (m) return m[1].trim();
    var m2 = t.match(/・\s*([^・]+?)\s*・/);
    if (m2) return m2[1].trim();
    var m3 = t.match(/の\s*([^。]+?)\s*の求人に応募しました/);
    return m3 ? m3[1].trim() : '';
  }

  function extractCompanyFallback_(t) {
    var m = t.match(/([^\s]{2,}?(?:株式会社|有限会社|合同会社|Inc\.|LLC))/);
    return m ? m[1].trim() : '';
  }

  return { parse: parse };
})();

/* =========================
 * 10) InboundClient（リトライ付きAPI送信）
 * ========================= */
const InboundClient = (function () {
  var endpointKey = 'RPO_INBOUND_URL';
  var endpointLegacyKey = 'RPO_API_URL';
  var apiKeyKey = 'RPO_API_KEY';

  function validateConfigOrThrow() {
    var endpointConfig = getEndpointConfig_();
    var endpoint = endpointConfig.value;
    var apiKey = getProperty_(apiKeyKey);

    Logger.log('[DEBUG:InboundClient] validateConfig: endpoint(' + (endpointConfig.key || 'none') + ')=' + (endpoint ? endpoint : '(empty)') + ', apiKey=' + (apiKey ? '***' + apiKey.slice(-4) : '(empty)'));

    if (!endpoint) {
      throw new Error('RPO_INBOUND_URL が未設定です。Script Properties に RPO_INBOUND_URL（互換: RPO_API_URL）を設定してください。');
    }

    if (!apiKey) {
      throw new Error('RPO_API_KEY が未設定です。Script Properties に RPO_API_KEY を設定してください。');
    }
  }

  function submitParsedApplication(data) {
    var endpoint = getEndpointConfig_().value;
    var apiKey = getProperty_(apiKeyKey);

    if (!endpoint || !apiKey) {
      throw new Error('受信API設定が不正です。RPO_INBOUND_URL（互換: RPO_API_URL） / RPO_API_KEY を確認してください。');
    }

    var payload = {
      receivedAt: data.receivedAt || '',
      name: data.name || '',
      company: data.company || '',
      job: data.job || '',
      location: data.location || '',
      email: data.email || '',
      gmailMessageId: data.gmailMessageId || '',
      threadId: data.threadId || '',
    };

    Logger.log('[DEBUG:InboundClient] === API送信開始 ===');
    Logger.log('[DEBUG:InboundClient] endpoint=' + endpoint);
    Logger.log('[DEBUG:InboundClient] apiKey=***' + (apiKey ? apiKey.slice(-4) : '(empty)'));
    Logger.log('[DEBUG:InboundClient] payload=' + JSON.stringify(payload, null, 2));

    var maxRetries = Math.max(1, Number(APP_CONFIG.api.maxRetries || 3));
    var baseSleep = Math.max(100, Number(APP_CONFIG.api.retryBaseSleepMs || 800));
    var lastErr = null;

    for (var attempt = 1; attempt <= maxRetries; attempt++) {
      Logger.log('[DEBUG:InboundClient] attempt=' + attempt + '/' + maxRetries);
      try {
        var fetchOptions = {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify(payload),
          headers: {
            'x-rpo-api-key': apiKey,
          },
          muteHttpExceptions: true,
          validateHttpsCertificates: true,
        };
        Logger.log('[DEBUG:InboundClient] fetchOptions=' + JSON.stringify({
          method: fetchOptions.method,
          contentType: fetchOptions.contentType,
          headers: { 'x-rpo-api-key': '***' + (apiKey ? apiKey.slice(-4) : '') },
          payloadLength: fetchOptions.payload.length,
        }));

        var response = UrlFetchApp.fetch(endpoint, fetchOptions);

        var status = response.getResponseCode();
        var responseHeaders = response.getHeaders();
        var responseText = response.getContentText();

        Logger.log('[DEBUG:InboundClient] status=' + status);
        Logger.log('[DEBUG:InboundClient] responseHeaders=' + JSON.stringify(responseHeaders));
        Logger.log('[DEBUG:InboundClient] responseBody=' + (responseText.length > 1000 ? responseText.slice(0, 1000) + '...(truncated)' : responseText));

        // Non-retryable success or client error
        if (status >= 200 && status < 300) {
          var body;
          try {
            body = responseText ? JSON.parse(responseText) : {};
          } catch (e) {
            Logger.log('[DEBUG:InboundClient] レスポンスJSONパース失敗: ' + (e && e.message ? e.message : e));
            throw new Error('API response parse failed: ' + (e && e.message ? e.message : e));
          }
          Logger.log('[DEBUG:InboundClient] parsedBody=' + JSON.stringify(body));
          if (!body || body.success !== true) {
            Logger.log('[DEBUG:InboundClient] body.success !== true -> invalid response');
            throw new Error('API response is invalid: ' + responseText);
          }
          Logger.log('[DEBUG:InboundClient] === API送信成功 ===');
          return;
        }

        // Non-retryable client errors (4xx except 408, 429)
        if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
          Logger.log('[DEBUG:InboundClient] 4xxクライアントエラー(リトライ不可): status=' + status);
          var errText = String(responseText || APP_CONFIG.response.nonJsonFallback);
          throw new Error('API Error (' + status + '): ' + errText);
        }

        // Retryable
        Logger.log('[DEBUG:InboundClient] リトライ可能エラー: status=' + status);
        if (attempt === maxRetries) {
          var errText2 = String(responseText || APP_CONFIG.response.nonJsonFallback);
          Logger.log('[DEBUG:InboundClient] 最終リトライ失敗: ' + errText2);
          throw new Error('API Error after retries (' + status + '): ' + errText2);
        }

        var waitMs = baseSleep * Math.pow(2, attempt - 1);
        Logger.log('[WARN] retryable API status attempt=' + attempt + '/' + maxRetries + ' status=' + status + ' waitMs=' + waitMs);
        Utilities.sleep(waitMs);
      } catch (e) {
        Logger.log('[DEBUG:InboundClient] catch例外: ' + (e && e.stack ? e.stack : e));
        // Network-level errors are retryable
        if (e.message && (e.message.indexOf('API Error') === 0 || e.message.indexOf('API response') === 0)) {
          Logger.log('[DEBUG:InboundClient] アプリケーションエラー(リトライ不可) -> rethrow');
          throw e; // Non-retryable application error
        }
        lastErr = e;
        if (attempt === maxRetries) {
          Logger.log('[DEBUG:InboundClient] 最終リトライ後の例外: ' + (lastErr && lastErr.stack ? lastErr.stack : lastErr));
          throw new Error('API request failed after retries: ' + (lastErr && lastErr.stack ? lastErr.stack : lastErr));
        }
        var waitMs2 = baseSleep * Math.pow(2, attempt - 1);
        Logger.log('[WARN] API request exception attempt=' + attempt + '/' + maxRetries + ' waitMs=' + waitMs2 + ' err=' + (e && e.message ? e.message : e));
        Utilities.sleep(waitMs2);
      }
    }
  }

  function getEndpointConfig_() {
    var endpoint = getProperty_(endpointKey);
    if (endpoint) {
      return { key: endpointKey, value: endpoint };
    }

    var legacy = getProperty_(endpointLegacyKey);
    if (legacy) {
      return { key: endpointLegacyKey, value: legacy };
    }

    return { key: '', value: '' };
  }

  return { validateConfigOrThrow: validateConfigOrThrow, submitParsedApplication: submitParsedApplication };
})();

function getProperty_(key) {
  return PropertiesService.getScriptProperties().getProperty(key) || '';
}

/* =========================
 * 11) Util
 * ========================= */
const Util = (function () {
  function getHeader(headers, name) {
    var target = (name || '').toLowerCase();
    for (var i = 0; i < (headers || []).length; i++) {
      var h = headers[i];
      if ((h.name || '').toLowerCase() === target) return h.value || '';
    }
    return '';
  }

  function decodeBase64UrlString(s) {
    var b64 = String(s).replace(/-/g, '+').replace(/_/g, '/');
    var bytes = Utilities.base64Decode(b64);
    return Utilities.newBlob(bytes).getDataAsString('UTF-8');
  }

  function stripHtml(html) {
    return (html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function safePreview(v) {
    try {
      if (v == null) return String(v);
      var s = JSON.stringify(v);
      return s.length > 300 ? s.slice(0, 300) + '...' : s;
    } catch (e) {
      return String(v);
    }
  }

  function toJstIsoString(value) {
    var raw = String(value || '').trim();
    if (!raw) return '';

    var date = new Date(raw);
    if (Number.isNaN(date.getTime())) return raw;

    var jst = Utilities.formatDate(date, 'Asia/Tokyo', "yyyy-MM-dd'T'HH:mm:ss");
    return jst + '+09:00';
  }

  return {
    getHeader: getHeader,
    decodeBase64UrlString: decodeBase64UrlString,
    stripHtml: stripHtml,
    safePreview: safePreview,
    toJstIsoString: toJstIsoString,
  };
})();
