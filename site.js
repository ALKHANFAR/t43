/* ==========================================================================
   CONFIG — edit here only (shared by index.html and ar.html; strings below are picked by <html lang>)
   ========================================================================== */
var CONFIG = {
  // 1) Google Sheet — الحل الأبسط والموصى به.
  //    رابط Apps Script إن أردت الحفظ في Google Sheet مباشرة.
  sheetUrl: "",   // Apps Script — غير مستخدم الآن

  // 2) ✅ المسار الفعّال: ويب هوك Activepieces — يكتب مباشرة في جدولك.
  endpoint: "https://cloud.activepieces.com/api/v1/webhooks/AgT75WkSTGHn4OTftrx5F",   // ✅ التسجيل → Activepieces → الجدول + الإيميل

  // 3) اختياري: إشعار بريد إضافي عبر web3forms.com/#start
  web3formsKey: "",

  fallbackEmail: "info@siyadah-ai.com",
  countryCode: "+966",                     // fixed prefix shown in the form and sent with the payload
  seatsClaimed: null,                      // real number from the backend; null hides the queue position

  // Pricing — the only place numbers live. Markup holds labels; site.js fills the numbers.
  //   starter: null hides the Starter card. Set { price, early, employees, actions } to show it (2 → 3 cards).
  //   early:   private-beta price; when present the public price is shown struck through.
  //   actions: monthly action allowance as a number, or null for the generic "monthly allowance" line.
  pricing: {
    currency: "SAR",
    vatNote: true,
    starter: null,
    business: { price: 998, early: 499, employees: 4, actions: 3000 },
    credits: { price: 100, actions: 500 },   // prepaid pack: price in SAR → actions
    enterprise: true,
    earlyDiscount: 50
  }
};

(function () {
  "use strict";
  var AR = document.documentElement.lang === "ar";
  var L = AR ? {
    brief: "أبي أحد يتابع كل عميل جديد خلال خمس دقائق، ويطالب بالفواتير اللي تأخرت أكثر من سبعة أيام، ويرد على أسئلة الدعم المتكررة على طول.",
    typeMs: 26,
    reserving: "جاري الحجز…",
    mailSubject: "حجز مقعد — ",
    mailBody: ["طلب حجز مقعد", "الاسم", "البريد", "الجوال", "الشركة"],
    notifySubject: "تسجيل جديد - ",
    billMonth: "تُدفع شهريًا",
    billYear: function (total) { return "تُدفع سنويًا: " + total + " ر.س (شهران مجانًا)"; },
    early: function (pct) { return "الوصول المبكر: خصم " + pct + "% على سعر الخطة، مدى الحياة"; },
    employees: function (n) { return n + " موظفين بالذكاء الاصطناعي"; },
    actions: function (n) { return n + " إجراء / شهر"; },
    actionsAllowance: "رصيد شهري من الإجراءات"
  } : {
    brief: "Follow up with every new lead within five minutes, chase invoices more than seven days late, and answer the support questions we get over and over.",
    typeMs: 22,
    reserving: "Reserving…",
    mailSubject: "Seat request - ",
    mailBody: ["Seat request", "Name", "Email", "Phone", "Company"],
    notifySubject: "New seat request - ",
    billMonth: "Billed monthly",
    billYear: function (total) { return "Billed yearly: " + total + " SAR (2 months free)"; },
    early: function (pct) { return "Private beta: " + pct + "% off the plan price, for life"; },
    employees: function (n) { return n + " AI employees"; },
    actions: function (n) { return n + " actions / month"; },
    actionsAllowance: "A monthly action allowance"
  };
  var reduce = (window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false);
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* header */
  var nav = $("#nav");

  /* mobile menu */
  var menuBtn = $(".nav__menu"), links = $("#nav-links");
  function setMenu(open) { nav.classList.toggle("open", open); if (menuBtn) menuBtn.setAttribute("aria-expanded", open ? "true" : "false"); }
  if (menuBtn) {
    menuBtn.addEventListener("click", function () { var open = !nav.classList.contains("open"); setMenu(open); if (open) { var first = $("a", links); if (first) first.focus(); } });
    links.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && nav.classList.contains("open")) { setMenu(false); menuBtn.focus(); } });
    document.addEventListener("click", function (e) { if (nav.classList.contains("open") && !e.target.closest(".nav")) setMenu(false); });
  }

  function onScroll() { nav.classList.toggle("stuck", window.scrollY > 20); }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* reveals */
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: 0.25, rootMargin: "0px 0px -6% 0px" });
  $$(".rv, .fade").forEach(function (el) { io.observe(el); });
  setTimeout(function () { $$(".hero .rv, .hero .fade").forEach(function (el) { el.classList.add("in"); }); }, 120);

  /* live console */
  var BRIEF = L.brief;
  var typed = $("#typed"), caret = $("#caret"), status = $("#status"), cfoot = $("#cfoot"), clock = $("#clock");
  var units = $$(".unit"), timers = [], tick = null, sec = 0;

  function two(n) { return (n < 10 ? "0" : "") + n; }
  function startClock() {
    sec = 0; clearInterval(tick);
    tick = setInterval(function () { sec++; clock.textContent = two(Math.floor(sec / 60)) + ":" + two(sec % 60); }, 1000);
  }
  function play() {
    timers.forEach(clearTimeout); timers = [];
    typed.textContent = ""; caret.classList.remove("off");
    status.classList.remove("on"); cfoot.classList.remove("on");
    units.forEach(function (u) { u.classList.remove("on"); });
    startClock();

    if (reduce) {
      typed.textContent = BRIEF; caret.classList.add("off");
      units.forEach(function (u) { u.classList.add("on"); });
      cfoot.classList.add("on");
      return;
    }
    var i = 0;
    (function type() {
      if (i <= BRIEF.length) {
        typed.textContent = BRIEF.slice(0, i++);
        timers.push(setTimeout(type, L.typeMs));
      } else {
        caret.classList.add("off");
        status.classList.add("on");
        units.forEach(function (u, k) {
          timers.push(setTimeout(function () { u.classList.add("on"); }, 800 + k * 480));
        });
        timers.push(setTimeout(function () {
          status.classList.remove("on"); cfoot.classList.add("on");
        }, 800 + units.length * 480));
      }
    })();
  }
  var tio = new IntersectionObserver(function (es) {
    if (es[0].isIntersecting) { play(); tio.disconnect(); }
  }, { threshold: 0.3 });
  tio.observe($("#console"));
  $("#replay").addEventListener("click", play);

  /* pricing — numbers from CONFIG.pricing, labels from markup */
  var P = CONFIG.pricing, plans = $("#plans");
  var annual = false;
  $$("[data-credits]").forEach(function (el) { if (P.credits) el.textContent = money(P.credits.price) + (el.dataset.credits === "ar" ? " ر.س = " : " SAR = ") + money(P.credits.actions) + (el.dataset.credits === "ar" ? " إجراء" : " actions"); });
  function money(n) { return Number(n).toLocaleString("en-US"); }          // Western digits in both languages
  function perMonth(n) { return annual ? Math.round(n * 10 / 12) : n; }   // annual = 10 months for 12
  function fillPlan(key, plan, card) {
    var v = (typeof plan.early === "number") ? plan.early : plan.price;
    $('[data-price="' + key + '"]', card).textContent = money(perMonth(v));
    var was = $('[data-was="' + key + '"]', card);
    if (was) { was.hidden = !(typeof plan.early === "number"); was.textContent = money(perMonth(plan.price)); }
    var bill = $("[data-bill]", card);
    if (bill) bill.textContent = annual ? L.billYear(money(v * 10)) : L.billMonth;
    var early = $("[data-early]", card);
    if (early) { early.hidden = !(typeof plan.early === "number"); early.textContent = L.early(P.earlyDiscount); }
    var emp = $("[data-employees]", card);
    if (emp && typeof plan.employees === "number") emp.textContent = L.employees(plan.employees);
    var act = $("[data-actions]", card);
    if (act) act.textContent = (typeof plan.actions === "number") ? L.actions(money(plan.actions)) : L.actionsAllowance;
  }
  function renderPricing() {
    if (!plans) return;
    if (P.starter && typeof P.starter === "object") {
      var starter = $("#plan-starter");
      if (!starter) {
        var tpl = $("#planStarter");
        plans.insertBefore(tpl.content.cloneNode(true), plans.firstChild);
        starter = $("#plan-starter");
        plans.setAttribute("data-cols", "3");
      }
      fillPlan("starter", P.starter, starter);
    }
    fillPlan("business", P.business, $("#plan-business"));
    var ent = $("#plan-enterprise");
    if (ent) ent.hidden = !P.enterprise;
    var vat = $("#vatNote");
    if (vat) vat.hidden = !P.vatNote;
  }
  $$(".bill__b").forEach(function (b) {
    b.addEventListener("click", function () {
      annual = b.getAttribute("data-period") === "annual";
      $$(".bill__b").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      renderPricing();
    });
  });
  renderPricing();

  /* faq */
  $$(".q").forEach(function (q) {
    var b = $(".q__b", q), a = $(".q__a", q);
    b.addEventListener("click", function () {
      if (q.hasAttribute("data-open")) {
        a.style.height = a.scrollHeight + "px";
        requestAnimationFrame(function () { a.style.height = "0px"; });
        q.removeAttribute("data-open"); b.setAttribute("aria-expanded", "false");
      } else {
        q.setAttribute("data-open", ""); b.setAttribute("aria-expanded", "true");
        a.style.height = a.scrollHeight + "px";
        setTimeout(function () { if (q.hasAttribute("data-open")) a.style.height = "auto"; }, 460);
      }
    });
  });

  /* queue position (only when the backend reports a real number) */
  var hasSeats = typeof CONFIG.seatsClaimed === "number";
  if (!hasSeats) $(".done__no").hidden = true;
  $("#yr").textContent = new Date().getFullYear();

  /* form */
  var form = $("#waitlist"), card = $("#formCard"), btn = $("#submitBtn");
  var RX = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
  function mark(id, isBad) { $("#" + id).classList.toggle("bad", isBad); return !isBad; }
  function validate() {
    var ok = true;
    ok = mark("f-name", $("#name").value.trim().length < 3) && ok;
    ok = mark("f-phone", $("#phone").value.replace(/\D/g, "").length < 7) && ok;
    ok = mark("f-email", !RX.test($("#email").value.trim())) && ok;
    return ok;
  }
  ["name", "phone", "email"].forEach(function (id) {
    var el = $("#" + id);
    el.addEventListener("input", function () { $("#f-" + id).classList.remove("bad"); });
    el.addEventListener("change", function () { $("#f-" + id).classList.remove("bad"); });
  });
  function succeed() {
    card.classList.add("sent");
    $("#done").classList.add("on");
    if (hasSeats) $("#rank").textContent = "#" + (CONFIG.seatsClaimed + 1);
    $("#done").scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }
  function mailtoFallback(d) {
    var M = L.mailBody;
    var body = M[0] + "%0D%0A%0D%0A"
      + M[1] + ": " + d.name + "%0D%0A"
      + M[2] + ": " + d.email + "%0D%0A"
      + M[3] + ": " + d.country_code + " " + d.phone + "%0D%0A"
      + M[4] + ": " + (d.company || "-");
    window.location.href = "mailto:" + CONFIG.fallbackEmail
      + "?subject=" + encodeURIComponent(L.mailSubject + d.name) + "&body=" + body;
  }
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if ($("#website").value) return;
    if (!validate()) {
      var bad = $(".field.bad");
      if (bad) bad.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    var data = {
      name: $("#name").value.trim(),
      email: $("#email").value.trim(),
      country_code: CONFIG.countryCode,
      phone: $("#phone").value.trim(),
      company: $("#company").value.trim(),
      page: location.href,
      ref: document.referrer || "",
      ts: new Date().toISOString()
    };
    if (!CONFIG.sheetUrl && !CONFIG.endpoint && !CONFIG.web3formsKey) { mailtoFallback(data); succeed(); return; }

    btn.disabled = true;
    var label = btn.innerHTML;
    btn.textContent = L.reserving;

    function post(url, payload) {
      return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload)
      }).then(function (r) {
        if (!r.ok) throw new Error("bad status " + r.status);
        return r.json().catch(function () { return {}; });
      });
    }

    var jobs = [];

    // أ) Google Sheet — نرسل بنوع text/plain عشان نتفادى preflight الذي يرفضه Apps Script
    if (CONFIG.sheetUrl) {
      jobs.push(
        fetch(CONFIG.sheetUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(data)
        }).then(function (r) {
          if (!r.ok) throw new Error("sheet " + r.status);
          return r.json().catch(function () { return {}; });
        }).catch(function (err) {
          // بعض المتصفحات تحجب قراءة رد Apps Script — نعيد الإرسال بلا قراءة
          return fetch(CONFIG.sheetUrl, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(data)
          }).then(function () { return { ok: true, opaque: true }; });
        })
      );
    }

    // ب) الحفظ على سيرفرك (leads.csv)
    if (CONFIG.endpoint) { jobs.push(post(CONFIG.endpoint, data)); }

    // ج) إشعار بريد إضافي — يشتغل من أي استضافة
    if (CONFIG.web3formsKey) {
      jobs.push(post("https://api.web3forms.com/submit", {
        access_key: CONFIG.web3formsKey,
        subject: L.notifySubject + data.name,
        from_name: "Siyadah AI",
        replyto: data.email,
        Name: data.name,
        Email: data.email,
        Phone: data.country_code + " " + data.phone,
        Company: data.company || "-",
        Page: data.page,
        Source: data.ref || "direct"
      }));
    }

    Promise.allSettled(jobs).then(function (res) {
      var anyOk = res.some(function (r) { return r.status === "fulfilled"; });
      if (!anyOk) { mailtoFallback(data); }
      succeed();
      btn.disabled = false; btn.innerHTML = label;
    });
  });
})();
