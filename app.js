(function () {
  "use strict";

  var state = {
    session: null,
    data: null,
    currentPanel: "overview",
    leaderboardTrackId: "",
    recordKeyword: ""
  };

  var kartTypeLabels = {
    "200cc": "200cc",
    "270cc": "270cc",
    "super4t200": "超级4T(200)",
    "super4t206": "超级4T(206)",
    "gpmax": "GPMAX",
    "x30": "X30"
  };

  var serverMessageMap = {
    "AUTH_REQUIRED": "请先登录。",
    "FORBIDDEN": "你没有权限执行这个操作。",
    "API_NOT_FOUND": "接口不存在。",
    "Lap time is required.": "请输入圈速。",
    "Lap time format is invalid. Use 59.876 or 1:02.345.": "圈速格式不正确，请输入 59.876 或 1:02.345。",
    "Minute section is invalid.": "圈速分钟部分不正确。",
    "Seconds must be less than 60.": "秒数必须小于 60。",
    "Second section is invalid.": "圈速秒数部分不正确。",
    "Screenshot is required.": "请上传成绩截图。",
    "Screenshot format is invalid.": "截图格式不正确，请重新上传。",
    "Only PNG, JPG, WEBP or GIF is supported.": "仅支持 PNG、JPG、WEBP 或 GIF 图片。",
    "Screenshot content is invalid.": "截图内容有误，请重新上传。",
    "Screenshot must be smaller than 8MB.": "截图请控制在 8MB 以内。",
    "Username must be 3-20 letters, numbers or underscores.": "用户名只能使用 3 到 20 位字母、数字或下划线。",
    "Password must be at least 6 characters.": "密码至少需要 6 位。",
    "Display name is required.": "请输入会员姓名。",
    "Username already exists.": "这个用户名已经被使用。",
    "Username or password is incorrect.": "用户名或密码不正确。",
    "Track name is required.": "请输入赛道名称。",
    "Please choose a valid track.": "请选择有效赛道。",
    "Please choose a valid kart type.": "请选择有效车型。",
    "Please choose a valid member.": "请选择有效会员。",
    "Submission not found.": "找不到这条待审批成绩。",
    "Submission has already been reviewed.": "这条成绩已经处理过了。",
    "Review note is required when rejecting.": "驳回时请填写原因。",
    "Member not found.": "找不到这个会员账号。",
    "Track not found.": "找不到这条赛道。",
    "Official record not found.": "找不到这条正式成绩。",
    "Cannot delete member with existing records or submissions.": "该会员已有成绩或提交记录，暂时不能删除。",
    "Cannot delete track with existing records or submissions.": "该赛道已有成绩或提交记录，暂时不能删除。",
    "Delete the linked official record first.": "请先删除关联的正式成绩。",
    "Malformed request.": "请求格式不正确。"
  };

  var tabs = {
    common: [
      { id: "overview", label: "总览" },
      { id: "records", label: "正式成绩" }
    ],
    member: [
      { id: "member-submit", label: "提交成绩" },
      { id: "member-history", label: "我的记录" }
    ],
    admin: [
      { id: "admin-approve", label: "审批中心" },
      { id: "admin-record", label: "管理员录入" },
      { id: "admin-members", label: "会员管理" },
      { id: "admin-tracks", label: "赛道管理" }
    ]
  };

  var toastTimer = null;
  var elements = {
    authScreen: document.getElementById("authScreen"),
    appScreen: document.getElementById("appScreen"),
    loginForm: document.getElementById("loginForm"),
    registerForm: document.getElementById("registerForm"),
    logoutButton: document.getElementById("logoutButton"),
    refreshButton: document.getElementById("refreshButton"),
    tabBar: document.getElementById("tabBar"),
    statsGrid: document.getElementById("statsGrid"),
    userSummary: document.getElementById("userSummary"),
    toast: document.getElementById("toast"),
    overviewTrackFilter: document.getElementById("overviewTrackFilter"),
    leaderboardBody: document.getElementById("leaderboardBody"),
    pbBody: document.getElementById("pbBody"),
    officialRecordsBody: document.getElementById("officialRecordsBody"),
    recordKeyword: document.getElementById("recordKeyword"),
    memberSubmissionForm: document.getElementById("memberSubmissionForm"),
    submissionTrackId: document.getElementById("submissionTrackId"),
    submissionDate: document.getElementById("submissionDate"),
    submissionKartType: document.getElementById("submissionKartType"),
    memberSubmissionsBody: document.getElementById("memberSubmissionsBody"),
    pendingSubmissionList: document.getElementById("pendingSubmissionList"),
    adminRecordForm: document.getElementById("adminRecordForm"),
    adminRecordMemberId: document.getElementById("adminRecordMemberId"),
    adminRecordTrackId: document.getElementById("adminRecordTrackId"),
    adminRecordDate: document.getElementById("adminRecordDate"),
    adminRecordKartType: document.getElementById("adminRecordKartType"),
    adminMemberForm: document.getElementById("adminMemberForm"),
    memberAccountsBody: document.getElementById("memberAccountsBody"),
    trackForm: document.getElementById("trackForm"),
    trackListBody: document.getElementById("trackListBody")
  };

  bindEvents();
  setDefaultDates();
  checkSession();

  function bindEvents() {
    elements.loginForm.addEventListener("submit", handleLogin);
    elements.registerForm.addEventListener("submit", handleRegister);
    elements.logoutButton.addEventListener("click", handleLogout);
    elements.refreshButton.addEventListener("click", loadDashboard);
    elements.overviewTrackFilter.addEventListener("change", function () {
      state.leaderboardTrackId = elements.overviewTrackFilter.value;
      renderOverview();
    });
    elements.recordKeyword.addEventListener("input", function () {
      state.recordKeyword = elements.recordKeyword.value.trim().toLowerCase();
      renderOfficialRecords();
    });

    if (elements.memberSubmissionForm) {
      elements.memberSubmissionForm.addEventListener("submit", handleMemberSubmission);
    }

    if (elements.adminRecordForm) {
      elements.adminRecordForm.addEventListener("submit", handleAdminRecord);
    }

    if (elements.adminMemberForm) {
      elements.adminMemberForm.addEventListener("submit", handleAdminMemberCreate);
    }

    if (elements.trackForm) {
      elements.trackForm.addEventListener("submit", handleTrackCreate);
    }

    elements.tabBar.addEventListener("click", function (event) {
      var button = event.target.closest("[data-tab]");
      if (!button) {
        return;
      }

      setActivePanel(button.getAttribute("data-tab"));
    });

    document.body.addEventListener("click", function (event) {
      var trigger = event.target.closest("[data-action]");
      if (!trigger) {
        return;
      }

      var action = trigger.getAttribute("data-action");
      var id = trigger.getAttribute("data-id");

      if (action === "approve-submission") {
        approveSubmission(id);
      }

      if (action === "reject-submission") {
        rejectSubmission(id);
      }

      if (action === "delete-submission") {
        deleteSubmission(id);
      }

      if (action === "delete-member") {
        deleteMember(id);
      }

      if (action === "delete-track") {
        deleteTrack(id);
      }

      if (action === "delete-record") {
        deleteOfficialRecord(id);
      }

      if (action === "delete-my-submission") {
        deleteMySubmission(id);
      }

      if (action === "approve-member") {
        approveMember(id);
      }

      if (action === "reject-member") {
        rejectMember(id);
      }
    });
  }

  function setDefaultDates() {
    var today = todayString();
    if (elements.submissionDate) {
      elements.submissionDate.value = today;
    }
    if (elements.adminRecordDate) {
      elements.adminRecordDate.value = today;
    }
  }

  async function checkSession() {
    try {
      var result = await request("GET", "/api/session");
      state.session = result;
      if (result.authenticated) {
        await loadDashboard();
      } else {
        renderAuth();
      }
    } catch (error) {
      renderAuth();
      showToast(error.message, "warning");
    }
  }
  async function loadDashboard() {
    try {
      var result = await request("GET", "/api/dashboard");
      state.session = { authenticated: true, user: result.data.user };
      state.data = result.data;
      hydrateStateSelections();
      renderApp();
    } catch (error) {
      if (error.status === 401) {
        state.session = null;
        state.data = null;
        renderAuth();
      }
      showToast(error.message, "warning");
    }
  }

  function hydrateStateSelections() {
    var tracks = state.data ? asArray(state.data.tracks) : [];
    if (!tracks.length) {
      state.leaderboardTrackId = "";
      return;
    }

    var stillExists = tracks.some(function (track) {
      return track.id === state.leaderboardTrackId;
    });
    if (!stillExists) {
      state.leaderboardTrackId = tracks[0].id;
    }

    if (!panelAllowed(state.currentPanel)) {
      state.currentPanel = "overview";
    }
  }

  function renderAuth() {
    elements.authScreen.classList.remove("hidden");
    elements.appScreen.classList.add("hidden");
  }

  function renderApp() {
    elements.authScreen.classList.add("hidden");
    elements.appScreen.classList.remove("hidden");
    renderUserSummary();
    renderStats();
    renderTabs();
    fillSharedSelects();
    renderOverview();
    renderOfficialRecords();
    renderMemberSubmissions();
    renderPendingSubmissions();
    renderMemberAccounts();
    renderTrackList();
    setActivePanel(state.currentPanel);
  }

  function renderUserSummary() {
    var user = state.data.user;
    var roleLabel = user.role === "admin" ? "管理员" : "会员";
    elements.userSummary.innerHTML = [
      "<strong>" + escapeHtml(user.nickname || user.username) + "</strong>",
      '<div class="muted">' + escapeHtml(user.username) + " · " + escapeHtml(roleLabel) + "</div>"
    ].join("");
  }

  function renderStats() {
    var stats = state.data.stats;
    var cards = [
      { label: "会员总数", value: String(stats.memberCount || 0), meta: "已通过审核、可正常使用的会员账号" },
      { label: "赛道总数", value: String(stats.trackCount || 0), meta: "可录入正式成绩的赛道" },
      { label: "正式成绩数", value: String(stats.officialRecordCount || 0), meta: "已进入榜单的正式成绩" },
      {
        label: "待审成绩",
        value: String(stats.pendingSubmissionCount || 0),
        meta: state.data.user.role === "admin" ? "等待管理员处理的会员成绩提交" : "提交后需等待管理员审核"
      }
    ];

    if (state.data.user.role === "admin") {
      cards.splice(1, 0, {
        label: "待审注册",
        value: String(stats.pendingMemberApprovalCount || 0),
        meta: "新注册会员，等待管理员审核通过"
      });
    }

    elements.statsGrid.innerHTML = cards.map(function (item) {
      return [
        '<article class="stat-card">',
        '<div class="label">' + escapeHtml(item.label) + "</div>",
        '<div class="value">' + escapeHtml(item.value) + "</div>",
        '<div class="meta">' + escapeHtml(item.meta) + "</div>",
        "</article>"
      ].join("");
    }).join("");
  }
  function renderTabs() {
    var role = state.data.user.role;
    var items = tabs.common.slice();
    if (role === "member") {
      items = items.concat(tabs.member);
    }
    if (role === "admin") {
      items = items.concat(tabs.admin);
    }

    elements.tabBar.innerHTML = items.map(function (item) {
      var active = item.id === state.currentPanel ? " is-active" : "";
      return '<button class="tab-button' + active + '" type="button" data-tab="' + escapeHtml(item.id) + '">' + escapeHtml(item.label) + "</button>";
    }).join("");
  }

  function fillSharedSelects() {
    fillSelect(elements.overviewTrackFilter, asArray(state.data.tracks), {
      placeholder: "选择赛道",
      valueKey: "id",
      labelKey: "name",
      includeEmpty: false,
      fallbackValue: state.leaderboardTrackId
    });

    fillSelect(elements.submissionTrackId, asArray(state.data.tracks), {
      placeholder: "请选择赛道",
      valueKey: "id",
      labelKey: "name",
      includeEmpty: true
    });

    fillSelect(elements.adminRecordTrackId, asArray(state.data.tracks), {
      placeholder: "请选择赛道",
      valueKey: "id",
      labelKey: "name",
      includeEmpty: true
    });

    fillSelect(elements.adminRecordMemberId, asArray(state.data.memberAccounts).filter(function (member) {
      return member.approvalStatus === "approved";
    }), {
      placeholder: "请选择会员",
      valueKey: "id",
      labelKey: "nickname",
      includeEmpty: true
    });

    fillPlainOptions(elements.submissionKartType, asArray(state.data.kartTypes));
    fillPlainOptions(elements.adminRecordKartType, asArray(state.data.kartTypes));
    elements.overviewTrackFilter.value = state.leaderboardTrackId;
  }

  function renderOverview() {
    renderLeaderboard();
    renderPersonalBests();
  }

  function renderLeaderboard() {
    var leaderboard = asArray(state.data.leaderboards).find(function (item) {
      return item.trackId === state.leaderboardTrackId;
    });

    if (!leaderboard || !leaderboard.rows.length) {
      elements.leaderboardBody.innerHTML = buildEmptyRow("该赛道还没有正式成绩。", 6);
      return;
    }

    elements.leaderboardBody.innerHTML = leaderboard.rows.map(function (row) {
      return [
        "<tr>",
        "<td><span class=\"chip\">#" + escapeHtml(String(row.rank)) + "</span></td>",
        "<td>" + escapeHtml(row.memberName) + "</td>",
        "<td>" + escapeHtml(row.lapTime || formatLapTime(row.lapTimeMs)) + "</td>",
        "<td>" + escapeHtml(row.date || "--") + "</td>",
        "<td>" + escapeHtml(kartTypeLabel(row.kartType)) + "</td>",
        "<td>" + escapeHtml(row.ranking || "--") + "</td>",
        "</tr>"
      ].join("");
    }).join("");
  }

  function renderPersonalBests() {
    var rows = asArray(state.data.personalBests).filter(function (row) {
      return !state.leaderboardTrackId || row.trackId === state.leaderboardTrackId;
    });

    if (!rows.length) {
      elements.pbBody.innerHTML = buildEmptyRow("还没有个人 PB 数据。", 5);
      return;
    }

    elements.pbBody.innerHTML = rows.map(function (row) {
      var gap = row.gapToTrackBestMs === 0 ? '<span class="chip success">赛道第一</span>' : "+" + formatLapTime(row.gapToTrackBestMs);
      return [
        "<tr>",
        "<td>" + escapeHtml(row.memberName) + "</td>",
        "<td>" + escapeHtml(row.trackName) + "</td>",
        "<td>" + escapeHtml(row.lapTime || formatLapTime(row.lapTimeMs)) + "</td>",
        "<td>" + escapeHtml(kartTypeLabel(row.kartType)) + "</td>",
        "<td>" + gap + "</td>",
        "</tr>"
      ].join("");
    }).join("");
  }

  function renderOfficialRecords() {
    var keyword = state.recordKeyword || "";
    var rows = asArray(state.data.officialRecords).filter(function (record) {
      if (!keyword) {
        return true;
      }

      var text = [
        record.memberName,
        record.trackName,
        kartTypeLabel(record.kartType),
        record.note,
        record.weather,
        record.kartNo,
        record.source
      ].join(" ").toLowerCase();

      return text.indexOf(keyword) !== -1;
    });

    if (!rows.length) {
      elements.officialRecordsBody.innerHTML = buildEmptyRow("没有符合条件的正式成绩。", 10);
      return;
    }

    elements.officialRecordsBody.innerHTML = rows.map(function (record) {
      var actionCell = isAdmin()
        ? '<button class="button ghost small" type="button" data-action="delete-record" data-id="' + escapeHtml(record.id) + '">删除</button>'
        : "--";
      return [
        "<tr>",
        "<td>" + escapeHtml(record.date || "--") + "</td>",
        "<td>" + escapeHtml(record.memberName) + "</td>",
        "<td>" + escapeHtml(record.trackName) + "</td>",
        "<td>" + escapeHtml(record.lapTime || formatLapTime(record.lapTimeMs)) + "</td>",
        "<td>" + escapeHtml(kartTypeLabel(record.kartType)) + "</td>",
        "<td>" + escapeHtml(record.ranking || "--") + "</td>",
        "<td>" + escapeHtml(record.kartNo || "--") + "</td>",
        "<td>" + escapeHtml(record.source === "submission" ? "会员审批" : "管理员录入") + "</td>",
        "<td>" + renderScreenshotLink(record.screenshotUrl) + "</td>",
        "<td>" + actionCell + "</td>",
        "</tr>"
      ].join("");
    }).join("");
  }

  function renderMemberSubmissions() {
    if (!elements.memberSubmissionsBody) {
      return;
    }

    var rows = asArray(state.data.mySubmissions);
    if (!rows.length) {
      elements.memberSubmissionsBody.innerHTML = buildEmptyRow("你还没有提交过成绩。", 9);
      return;
    }

    elements.memberSubmissionsBody.innerHTML = rows.map(function (row) {
      var actionCell = row.status === "approved"
        ? "--"
        : '<button class="button ghost small" type="button" data-action="delete-my-submission" data-id="' + escapeHtml(row.id) + '">删除</button>';
      return [
        "<tr>",
        "<td>" + escapeHtml(formatDateTime(row.createdAt)) + "</td>",
        "<td>" + escapeHtml(row.trackName) + "</td>",
        "<td>" + escapeHtml(row.lapTime || formatLapTime(row.lapTimeMs)) + "</td>",
        "<td>" + escapeHtml(kartTypeLabel(row.kartType)) + "</td>",
        "<td>" + escapeHtml(row.ranking || "--") + "</td>",
        "<td>" + renderStatusChip(row.status) + "</td>",
        "<td>" + escapeHtml(humanizeReviewNote(row.reviewNote)) + "</td>",
        "<td>" + renderScreenshotLink(row.screenshotUrl) + "</td>",
        "<td>" + actionCell + "</td>",
        "</tr>"
      ].join("");
    }).join("");
  }

  function renderPendingSubmissions() {
    if (!elements.pendingSubmissionList) {
      return;
    }

    var rows = asArray(state.data.pendingSubmissions);
    if (!rows.length) {
      elements.pendingSubmissionList.innerHTML = '<div class="subcard muted">当前没有待审批成绩。</div>';
      return;
    }

    elements.pendingSubmissionList.innerHTML = rows.map(function (row) {
      return [
        '<article class="review-card">',
        "<h3>" + escapeHtml(row.memberName) + " · " + escapeHtml(row.trackName) + "</h3>",
        '<div class="review-meta">',
        "<p>圈速：<strong>" + escapeHtml(row.lapTime || formatLapTime(row.lapTimeMs)) + "</strong></p>",
        "<p>车型：" + escapeHtml(kartTypeLabel(row.kartType)) + "</p>",
        "<p>最终排名：" + escapeHtml(row.ranking || "--") + "</p>",
        "<p>日期：" + escapeHtml(row.date || "--") + "</p>",
        "<p>车号：" + escapeHtml(row.kartNo || "--") + "</p>",
        "<p>天气：" + escapeHtml(row.weather || "--") + "</p>",
        "<p>备注：" + escapeHtml(row.note || "--") + "</p>",
        "</div>",
        row.screenshotUrl ? '<a class="link-button" href="' + escapeHtml(row.screenshotUrl) + '" target="_blank" rel="noreferrer"><img class="thumb" src="' + escapeHtml(row.screenshotUrl) + '" alt="成绩截图"></a>' : "",
        '<div class="review-actions">',
        '<button class="button small" type="button" data-action="approve-submission" data-id="' + escapeHtml(row.id) + '">通过审批</button>',
        '<button class="button ghost small" type="button" data-action="reject-submission" data-id="' + escapeHtml(row.id) + '">驳回</button>',
        '<button class="button ghost small" type="button" data-action="delete-submission" data-id="' + escapeHtml(row.id) + '">删除</button>',
        "</div>",
        "</article>"
      ].join("");
    }).join("");
  }

  function renderMemberAccounts() {
    if (!elements.memberAccountsBody) {
      return;
    }

    var rows = asArray(state.data.memberAccounts);
    if (!rows.length) {
      elements.memberAccountsBody.innerHTML = buildEmptyRow("还没有会员账号。", 7);
      return;
    }

    elements.memberAccountsBody.innerHTML = rows.map(function (row) {
      return [
        "<tr>",
        "<td>" + escapeHtml(row.nickname) + "</td>",
        "<td>" + escapeHtml(row.username) + "</td>",
        "<td>" + renderMemberApprovalMeta(row) + "</td>",
        "<td>" + escapeHtml(String(row.officialRecordCount || 0)) + "</td>",
        "<td>" + escapeHtml(String(row.pendingSubmissionCount || 0)) + "</td>",
        "<td>" + escapeHtml(row.bestLapTime ? row.bestLapTime + " · " + row.bestLapTrackName : "--") + "</td>",
        '<td><button class="button ghost small" type="button" data-action="delete-member" data-id="' + escapeHtml(row.id) + '">删除</button></td>',
        "</tr>"
      ].join("");
    }).join("");
  }
  function renderTrackList() {
    if (!elements.trackListBody) {
      return;
    }

    var rows = asArray(state.data.tracks);
    if (!rows.length) {
      elements.trackListBody.innerHTML = buildEmptyRow("还没有赛道。", 5);
      return;
    }

    elements.trackListBody.innerHTML = rows.map(function (row) {
      return [
        "<tr>",
        "<td>" + escapeHtml(row.name) + "</td>",
        "<td>" + escapeHtml(row.location || "--") + "</td>",
        "<td>" + escapeHtml(row.length ? String(row.length) + " m" : "--") + "</td>",
        "<td>" + escapeHtml(row.layout || "--") + "</td>",
        '<td><button class="button ghost small" type="button" data-action="delete-track" data-id="' + escapeHtml(row.id) + '">删除</button></td>',
        "</tr>"
      ].join("");
    }).join("");
  }

  function setActivePanel(panelId) {
    state.currentPanel = panelId;
    document.querySelectorAll("[data-panel]").forEach(function (panel) {
      var isActive = panel.getAttribute("data-panel") === panelId;
      panel.classList.toggle("is-active", isActive);
    });

    document.querySelectorAll("[data-role-panel]").forEach(function (panel) {
      var role = panel.getAttribute("data-role-panel");
      var allowed = panelAllowed(panel.getAttribute("data-panel")) && state.data && state.data.user.role === role;
      panel.classList.toggle("hidden", !allowed);
    });

    document.querySelectorAll("[data-tab]").forEach(function (button) {
      button.classList.toggle("is-active", button.getAttribute("data-tab") === panelId);
    });
  }

  function panelAllowed(panelId) {
    var role = state.data && state.data.user ? state.data.user.role : "";
    if (tabs.common.some(function (item) { return item.id === panelId; })) {
      return true;
    }
    if (role === "member" && tabs.member.some(function (item) { return item.id === panelId; })) {
      return true;
    }
    if (role === "admin" && tabs.admin.some(function (item) { return item.id === panelId; })) {
      return true;
    }
    return false;
  }

  async function handleLogin(event) {
    event.preventDefault();
    var form = new FormData(elements.loginForm);

    try {
      await request("POST", "/api/auth/login", {
        username: cleanText(form.get("username")),
        password: cleanText(form.get("password"))
      });
      elements.loginForm.reset();
      await loadDashboard();
      showToast("登录成功。", "success");
    } catch (error) {
      showToast(error.message, "danger");
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    var form = new FormData(elements.registerForm);

    try {
      await request("POST", "/api/auth/register", {
        username: cleanText(form.get("username")),
        password: cleanText(form.get("password")),
        nickname: cleanText(form.get("nickname")),
        displayName: cleanText(form.get("nickname")),
        phone: ""
      });
      elements.registerForm.reset();
      showToast("注册申请已提交，等待管理员审核。审核通过后即可登录。", "success");
    } catch (error) {
      showToast(error.message, "danger");
    }
  }
  async function handleLogout() {
    try {
      await request("POST", "/api/auth/logout");
    } catch (error) {
      showToast(error.message, "warning");
    } finally {
      state.session = null;
      state.data = null;
      renderAuth();
    }
  }

  async function handleMemberSubmission(event) {
    event.preventDefault();
    var form = new FormData(elements.memberSubmissionForm);
    var file = document.getElementById("submissionScreenshot").files[0];

    try {
      if (!file) {
        throw new Error("请上传成绩截图。");
      }

      var screenshotDataUrl = await readFileAsDataUrl(file);
      await request("POST", "/api/member/submissions", {
        trackId: cleanText(form.get("trackId")),
        date: cleanText(form.get("date")),
        lapTime: cleanText(form.get("lapTime")),
        ranking: cleanText(form.get("ranking")),
        kartType: cleanText(form.get("kartType")),
        kartNo: cleanText(form.get("kartNo")),
        weather: cleanText(form.get("weather")),
        note: cleanText(form.get("note")),
        screenshotDataUrl: screenshotDataUrl
      });

      elements.memberSubmissionForm.reset();
      elements.submissionDate.value = todayString();
      fillPlainOptions(elements.submissionKartType, state.data.kartTypes || []);
      await loadDashboard();
      setActivePanel("member-history");
      showToast("成绩已提交，等待管理员审批。", "success");
    } catch (error) {
      showToast(error.message, "danger");
    }
  }

  async function handleAdminRecord(event) {
    event.preventDefault();
    var form = new FormData(elements.adminRecordForm);

    try {
      await request("POST", "/api/admin/records", {
        memberId: cleanText(form.get("memberId")),
        trackId: cleanText(form.get("trackId")),
        lapTime: cleanText(form.get("lapTime")),
        date: cleanText(form.get("date")),
        ranking: cleanText(form.get("ranking")),
        kartType: cleanText(form.get("kartType")),
        kartNo: cleanText(form.get("kartNo")),
        weather: cleanText(form.get("weather")),
        note: cleanText(form.get("note"))
      });

      elements.adminRecordForm.reset();
      elements.adminRecordDate.value = todayString();
      fillPlainOptions(elements.adminRecordKartType, state.data.kartTypes || []);
      await loadDashboard();
      setActivePanel("records");
      showToast("正式成绩已录入。", "success");
    } catch (error) {
      showToast(error.message, "danger");
    }
  }

  async function handleAdminMemberCreate(event) {
    event.preventDefault();
    var form = new FormData(elements.adminMemberForm);

    try {
      await request("POST", "/api/admin/members", {
        username: cleanText(form.get("username")),
        password: cleanText(form.get("password")),
        nickname: cleanText(form.get("nickname")),
        displayName: cleanText(form.get("nickname")),
        phone: ""
      });

      elements.adminMemberForm.reset();
      await loadDashboard();
      setActivePanel("admin-members");
      showToast("会员账号已创建并直接审核通过。", "success");
    } catch (error) {
      showToast(error.message, "danger");
    }
  }
  async function handleTrackCreate(event) {
    event.preventDefault();
    var form = new FormData(elements.trackForm);

    try {
      await request("POST", "/api/admin/tracks", {
        name: cleanText(form.get("name")),
        location: cleanText(form.get("location")),
        length: cleanText(form.get("length")),
        layout: cleanText(form.get("layout")),
        note: cleanText(form.get("note"))
      });

      elements.trackForm.reset();
      await loadDashboard();
      showToast("赛道已创建。", "success");
    } catch (error) {
      showToast(error.message, "danger");
    }
  }

  async function approveSubmission(id) {
    try {
      await request("POST", "/api/admin/submissions/" + encodeURIComponent(id) + "/approve");
      await loadDashboard();
      showToast("成绩已审批通过。", "success");
    } catch (error) {
      showToast(error.message, "danger");
    }
  }

  async function rejectSubmission(id) {
    var reason = window.prompt("请输入驳回原因：", "截图不清晰，请重新提交");
    if (reason == null) {
      return;
    }

    try {
      await request("POST", "/api/admin/submissions/" + encodeURIComponent(id) + "/reject", {
        reviewNote: reason
      });
      await loadDashboard();
      showToast("成绩已驳回。", "success");
    } catch (error) {
      showToast(error.message, "danger");
    }
  }

  async function deleteSubmission(id) {
    if (!window.confirm("确定删除这条提交记录吗？这会同时删除对应截图。")) {
      return;
    }

    try {
      await request("DELETE", "/api/admin/submissions/" + encodeURIComponent(id));
      await loadDashboard();
      showToast("提交记录已删除。", "success");
    } catch (error) {
      showToast(error.message, "danger");
    }
  }

  async function deleteMySubmission(id) {
    if (!window.confirm("确定删除这条提交记录吗？已通过审批的记录不能直接从这里删除。")) {
      return;
    }

    try {
      await request("DELETE", "/api/member/submissions/" + encodeURIComponent(id));
      await loadDashboard();
      showToast("提交记录已删除。", "success");
    } catch (error) {
      showToast(error.message, "danger");
    }
  }

  async function deleteMember(id) {
    if (!window.confirm("确定删除这个会员账号吗？如果该会员已有成绩或提交记录，将无法删除。")) {
      return;
    }

    try {
      await request("DELETE", "/api/admin/members/" + encodeURIComponent(id));
      await loadDashboard();
      showToast("会员账号已删除。", "success");
    } catch (error) {
      showToast(error.message, "danger");
    }
  }

  async function deleteTrack(id) {
    if (!window.confirm("确定删除这条赛道吗？如果赛道已有成绩或提交记录，将无法删除。")) {
      return;
    }

    try {
      await request("DELETE", "/api/admin/tracks/" + encodeURIComponent(id));
      await loadDashboard();
      showToast("赛道已删除。", "success");
    } catch (error) {
      showToast(error.message, "danger");
    }
  }

  async function deleteOfficialRecord(id) {
    if (!window.confirm("确定删除这条正式成绩吗？如果它来自会员提交，删除后会回到待审批列表。")) {
      return;
    }

    try {
      await request("DELETE", "/api/admin/records/" + encodeURIComponent(id));
      await loadDashboard();
      showToast("正式成绩已删除。", "success");
    } catch (error) {
      showToast(error.message, "danger");
    }
  }

  async function approveMember(id) {
    try {
      await request("POST", "/api/admin/members/" + encodeURIComponent(id) + "/approve");
      await loadDashboard();
      setActivePanel("admin-members");
      showToast("新会员已审核通过。", "success");
    } catch (error) {
      showToast(error.message, "danger");
    }
  }

  async function rejectMember(id) {
    var reason = window.prompt("请输入驳回注册申请的原因：", "请先修改群昵称后重新注册");
    if (reason == null) {
      return;
    }

    try {
      await request("POST", "/api/admin/members/" + encodeURIComponent(id) + "/reject", {
        reviewNote: reason
      });
      await loadDashboard();
      setActivePanel("admin-members");
      showToast("注册申请已驳回。", "success");
    } catch (error) {
      showToast(error.message, "danger");
    }
  }

  async function request(method, path, payload) {
    var options = {
      method: method,
      credentials: "same-origin",
      headers: {}
    };

    if (payload) {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(payload);
    }

    var response = await fetch(path, options);
    var contentType = response.headers.get("content-type") || "";
    var data = contentType.indexOf("application/json") >= 0 ? await response.json() : await response.text();

    if (!response.ok) {
      var message = data && data.error ? translateServerMessage(data.error) : "请求失败。";
      var error = new Error(message);
      error.status = response.status;
      throw error;
    }

    return data;
  }

  function fillSelect(selectElement, items, config) {
    if (!selectElement) {
      return;
    }

    items = asArray(items);
    var previousValue = config.fallbackValue || selectElement.value;
    var options = [];

    if (config.includeEmpty !== false) {
      options.push('<option value="">' + escapeHtml(config.placeholder || "请选择") + "</option>");
    }

    items.forEach(function (item) {
      options.push('<option value="' + escapeHtml(item[config.valueKey]) + '">' + escapeHtml(item[config.labelKey]) + "</option>");
    });

    selectElement.innerHTML = options.join("");

    var hasPrevious = items.some(function (item) {
      return item[config.valueKey] === previousValue;
    });
    if (hasPrevious) {
      selectElement.value = previousValue;
    }
  }

  function fillPlainOptions(selectElement, items) {
    if (!selectElement) {
      return;
    }

    items = asArray(items);
    var previousValue = selectElement.value;
    selectElement.innerHTML = ['<option value="">请选择车型</option>'].concat(items.map(function (item) {
      return '<option value="' + escapeHtml(item) + '">' + escapeHtml(kartTypeLabel(item)) + "</option>";
    })).join("");

    if (items.indexOf(previousValue) >= 0) {
      selectElement.value = previousValue;
    }
  }

  function renderScreenshotLink(url) {
    if (!url) {
      return "--";
    }

    return '<a class="link-button" href="' + escapeHtml(url) + '" target="_blank" rel="noreferrer">查看截图</a>';
  }

  function renderStatusChip(status) {
    var map = {
      pending: { label: "待审批", className: "warning" },
      approved: { label: "已通过", className: "success" },
      rejected: { label: "已驳回", className: "danger" }
    };
    var meta = map[status] || { label: status || "--", className: "" };
    return '<span class="chip ' + escapeHtml(meta.className) + '">' + escapeHtml(meta.label) + "</span>";
  }
  function renderMemberApprovalMeta(row) {
    var parts = [renderStatusChip(row.approvalStatus)];

    if (row.approvalStatus === "pending") {
      parts.push('<div class="review-actions"><button class="button small" type="button" data-action="approve-member" data-id="' + escapeHtml(row.id) + '">通过</button><button class="button ghost small" type="button" data-action="reject-member" data-id="' + escapeHtml(row.id) + '">驳回</button></div>');
    }

    if (row.approvalStatus === "rejected") {
      parts.push('<div class="review-actions"><button class="button small" type="button" data-action="approve-member" data-id="' + escapeHtml(row.id) + '">重新通过</button></div>');
    }

    if (row.approvalStatus === "rejected" && row.reviewNote) {
      parts.push('<div class="muted">' + escapeHtml(row.reviewNote) + "</div>");
    }

    return parts.join("");
  }

  function buildEmptyRow(message, colSpan) {
    return '<tr class="empty-row"><td colspan="' + colSpan + '">' + escapeHtml(message) + "</td></tr>";
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result || ""));
      };
      reader.onerror = function () {
        reject(new Error("读取截图失败，请重试。"));
      };
      reader.readAsDataURL(file);
    });
  }

  function formatLapTime(milliseconds) {
    if (!Number.isFinite(Number(milliseconds))) {
      return "--";
    }

    var total = Math.max(0, Math.round(Number(milliseconds)));
    var minutes = Math.floor(total / 60000);
    var seconds = Math.floor((total % 60000) / 1000);
    var ms = total % 1000;
    return minutes + ":" + pad(seconds, 2) + "." + pad(ms, 3);
  }

  function formatDateTime(value) {
    if (!value) {
      return "--";
    }

    var date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return [
      date.getFullYear(),
      "-",
      pad(date.getMonth() + 1, 2),
      "-",
      pad(date.getDate(), 2),
      " ",
      pad(date.getHours(), 2),
      ":",
      pad(date.getMinutes(), 2)
    ].join("");
  }

  function todayString() {
    var now = new Date();
    return [
      now.getFullYear(),
      "-",
      pad(now.getMonth() + 1, 2),
      "-",
      pad(now.getDate(), 2)
    ].join("");
  }

  function cleanText(value) {
    return String(value == null ? "" : value).trim();
  }

  function kartTypeLabel(value) {
    return kartTypeLabels[value] || value || "--";
  }

  function humanizeReviewNote(note) {
    if (!note) {
      return "--";
    }

    if (note === "Approved by admin.") {
      return "管理员已通过";
    }

    if (note === "Created by admin.") {
      return "管理员创建";
    }

    return note;
  }

  function translateServerMessage(message) {
    if (message === "Nickname is required.") {
      return "请输入微信/抖音群昵称。";
    }
    if (message === "Member registration is pending approval.") {
      return "该会员账号还在等待管理员审核，暂时不能登录。";
    }
    if (message === "Member registration was rejected.") {
      return "该注册申请已被管理员驳回，请联系管理员。";
    }
    if (message === "Member account has already been approved.") {
      return "这个会员账号已经审核通过了。";
    }
    if (message === "Approved member cannot be rejected.") {
      return "已通过审核的会员账号不能直接驳回。";
    }
    if (message === "Review note is required when rejecting member registration.") {
      return "驳回注册申请时请填写原因。";
    }

    return serverMessageMap[message] || message;
  }

  function isAdmin() {
    return !!(state.data && state.data.user && state.data.user.role === "admin");
  }

  function asArray(value) {
    if (Array.isArray(value)) {
      return value;
    }

    if (value == null || value === "") {
      return [];
    }

    return [value];
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function pad(value, size) {
    return String(value).padStart(size, "0");
  }

  function showToast(message, tone) {
    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");
    elements.toast.dataset.tone = tone || "info";

    if (toastTimer) {
      window.clearTimeout(toastTimer);
    }

    toastTimer = window.setTimeout(function () {
      elements.toast.classList.remove("is-visible");
    }, 2600);
  }
})();

