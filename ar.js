/* ==========================================================================
   الإعدادات — عدّل من هنا فقط
   ========================================================================== */
var CONFIG = {
  // 1) Google Sheet — الحل الأبسط والموصى به.
  //    الصق رابط Apps Script من ملف google-sheet.gs. يحفظ في الجدول ويرسل لك إشعارًا.
  sheetUrl: "",   // Apps Script — غير مستخدم الآن

  // 2) ✅ المسار الفعّال: ويب هوك Activepieces — يكتب مباشرة في جدولك.
  endpoint: "https://cloud.activepieces.com/api/v1/webhooks/AgT75WkSTGHn4OTftrx5F",   // ✅ التسجيل → Activepieces → الجدول + الإيميل

  // 3) اختياري: إشعار بريد إضافي عبر web3forms.com/#start
  web3formsKey: "",

  fallbackEmail: "anis@sondos-ai.com",
  seatsTotal: 500,
  seatsClaimed: null,                      // real number from the backend; null hides the seat meter and queue position
  deadline: null                           // real closing date from the backend; null hides the countdown
};

(function () {
  "use strict";
  var reduce = (window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false);
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var nav = $("#nav"), sticky = $("#sticky");
  function onScroll() {
    var y = window.scrollY;
    nav.classList.toggle("stuck", y > 20);
    var top = $("#join").getBoundingClientRect().top;
    sticky.classList.toggle("on", y > 760 && top > window.innerHeight * 0.4);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: 0.25, rootMargin: "0px 0px -6% 0px" });
  $$(".rv, .fade").forEach(function (el) { io.observe(el); });
  setTimeout(function () { $$(".hero .rv, .hero .fade").forEach(function (el) { el.classList.add("in"); }); }, 120);

  function countTo(el, to, ms) {
    if (reduce) { el.textContent = to; return; }
    var t0 = performance.now();
    (function step(t) {
      var p = Math.min((t - t0) / ms, 1);
      el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }
  var cio = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      countTo(e.target, parseInt(e.target.dataset.count, 10), 1100);
      cio.unobserve(e.target);
    });
  }, { threshold: 0.6 });
  $$("[data-count]").forEach(function (el) { cio.observe(el); });

  /* الكونسول الحي */
  var BRIEF = "أبي أحد يتابع كل عميل جديد خلال خمس دقائق، ويطالب بالفواتير اللي تأخرت أكثر من سبعة أيام، ويرد على أسئلة الدعم المتكررة على طول.";
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
        timers.push(setTimeout(type, 26));
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

  /* التبويبات */
  var tabs = $$(".tab");
  function select(i) {
    tabs.forEach(function (t, k) {
      var on = k === i;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
      $("#" + t.getAttribute("aria-controls")).classList.toggle("on", on);
    });
  }
  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () { select(i); });
    t.addEventListener("keydown", function (e) {
      var d = (e.key === "ArrowDown" || e.key === "ArrowLeft") ? 1 : ((e.key === "ArrowUp" || e.key === "ArrowRight") ? -1 : 0);
      if (!d) return;
      e.preventDefault();
      var n = (i + d + tabs.length) % tabs.length;
      tabs[n].focus(); select(n);
    });
  });

  /* الأسئلة */
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

  /* المقاعد والعدّاد */
  var hasSeats = typeof CONFIG.seatsClaimed === "number";
  var claimed = hasSeats ? Math.min(CONFIG.seatsClaimed, CONFIG.seatsTotal) : 0;
  var left = Math.max(CONFIG.seatsTotal - claimed, 0);
  if (!hasSeats) { $(".meter").hidden = true; $(".done__no").hidden = true; $(".sticky__t").textContent = $(".sticky__t").dataset.plain; }
  if (hasSeats) { $("#left").textContent = left; $("#leftMini").textContent = left; }
  var mio = new IntersectionObserver(function (es) {
    if (!es[0].isIntersecting) return;
    countTo($("#claimed"), claimed, 1500);
    $("#barfill").style.width = (claimed / CONFIG.seatsTotal * 100) + "%";
    mio.disconnect();
  }, { threshold: 0.4 });
  if (hasSeats) mio.observe($(".meter"));

  function countdown() {
    if (!CONFIG.deadline) { $("#cd").hidden = true; return; }
    var ms = CONFIG.deadline - new Date();
    if (ms < 0) ms = 0;
    $('[data-cd="d"]').textContent = two(Math.floor(ms / 864e5));
    $('[data-cd="h"]').textContent = two(Math.floor(ms / 36e5) % 24);
    $('[data-cd="m"]').textContent = two(Math.floor(ms / 6e4) % 60);
  }
  countdown(); setInterval(countdown, 30000);
  $("#yr").textContent = new Date().getFullYear();

  /* النموذج */
  var form = $("#waitlist"), card = $("#formCard"), btn = $("#submitBtn");
  var RX = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
  function mark(id, isBad) { $("#" + id).classList.toggle("bad", isBad); return !isBad; }
  function validate() {
    var ok = true;
    ok = mark("f-name", $("#name").value.trim().length < 3) && ok;
    ok = mark("f-email", !RX.test($("#email").value.trim())) && ok;
    ok = mark("f-phone", $("#phone").value.replace(/\D/g, "").length < 7) && ok;
    ok = mark("f-role", !$("#role").value) && ok;
    return ok;
  }
  ["name", "email", "phone", "role"].forEach(function (id) {
    var el = $("#" + id);
    el.addEventListener("input", function () { $("#f-" + id).classList.remove("bad"); });
    el.addEventListener("change", function () { $("#f-" + id).classList.remove("bad"); });
  });
  function succeed() {
    card.classList.add("sent");
    $("#done").classList.add("on");
    if (hasSeats) $("#rank").textContent = "#" + (claimed + 1);
    $("#done").scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }
  function mailtoFallback(d) {
    var body = "طلب حجز مقعد%0D%0A%0D%0A"
      + "الاسم: " + d.name + "%0D%0A"
      + "البريد: " + d.email + "%0D%0A"
      + "الجوال: " + d.country_code + " " + d.phone + "%0D%0A"
      + "الشركة: " + (d.company || "-") + "%0D%0A"
      + "الدور: " + d.role;
    window.location.href = "mailto:" + CONFIG.fallbackEmail
      + "?subject=" + encodeURIComponent("حجز مقعد — " + d.name) + "&body=" + body;
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
      country_code: $("#cc").value,
      phone: $("#phone").value.trim(),
      company: $("#company").value.trim(),
      role: $("#role").value,
      page: location.href,
      ref: document.referrer || "",
      ts: new Date().toISOString()
    };
    if (!CONFIG.sheetUrl && !CONFIG.endpoint && !CONFIG.web3formsKey) { mailtoFallback(data); succeed(); return; }

    btn.disabled = true;
    var label = btn.innerHTML;
    btn.textContent = "جاري الحجز…";

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
        subject: "تسجيل جديد - " + data.name,
        from_name: "Siyadah AI",
        replyto: data.email,
        Name: data.name,
        Email: data.email,
        Phone: data.country_code + " " + data.phone,
        Company: data.company || "-",
        Role: data.role,
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
