/* ==========================================================================
   Карточка-био · app.js
   Тема, вкладки, печатная машинка, копирование, счётчики, шаринг.
   Ванильный JS, без зависимостей. Всё в IIFE, чтобы не засорять глобальную область.
   ========================================================================== */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------------------------------------------------------------------
     1. Тема: переключатель + запоминание выбора
     --------------------------------------------------------------------- */
  const themeBtn = $('#themeToggle');
  const themeMeta = $('meta[name="theme-color"]');

  const applyTheme = (theme) => {
    root.setAttribute('data-theme', theme);
    if (themeMeta) themeMeta.setAttribute('content', theme === 'light' ? '#efecf7' : '#07070d');
    if (themeBtn) {
      themeBtn.setAttribute('aria-pressed', String(theme === 'light'));
      themeBtn.title = theme === 'light' ? 'Включить тёмную тему' : 'Включить светлую тему';
    }
  };

  applyTheme(root.getAttribute('data-theme') === 'light' ? 'light' : 'dark');

  themeBtn?.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    applyTheme(next);
    try { localStorage.setItem('bio-theme', next); } catch (e) { /* приватный режим */ }
  });

  /* ---------------------------------------------------------------------
     2. Тосты — короткие ненавязчивые уведомления
     --------------------------------------------------------------------- */
  const toastEl = $('#toast');
  let toastTimer;

  const toast = (message, duration = 2200) => {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), duration);
  };

  /* ---------------------------------------------------------------------
     3. Печатная машинка в подзаголовке
     --------------------------------------------------------------------- */
  const roles = [
    'Frontend-разработчик',
    'UI-инженер',
    'Любитель чистого кода',
    'Разбираюсь в железе и нейросетях'
  ];

  const twEl = $('#typewriter');

  const startTypewriter = () => {
    if (!twEl) return;
    if (reduceMotion.matches) {
      twEl.textContent = roles[0];
      return;
    }

    let roleIndex = 0;
    // Стартуем с уже написанной первой фразы (она есть в HTML), потом стираем
    let charIndex = roles[0].length;
    let deleting = true;

    twEl.textContent = roles[0];

    const tick = () => {
      const current = roles[roleIndex];

      if (!deleting) {
        charIndex += 1;
        twEl.textContent = current.slice(0, charIndex);
        if (charIndex === current.length) {
          deleting = true;
          setTimeout(tick, 1900);
          return;
        }
        setTimeout(tick, 62 + Math.random() * 46);
      } else {
        charIndex -= 1;
        twEl.textContent = current.slice(0, charIndex);
        if (charIndex === 0) {
          deleting = false;
          roleIndex = (roleIndex + 1) % roles.length;
          setTimeout(tick, 320);
          return;
        }
        setTimeout(tick, 26);
      }
    };

    setTimeout(tick, 2100);
    reduceMotion.addEventListener?.('change', (e) => {
      if (e.matches) twEl.textContent = roles[0];
    });
  };

  startTypewriter();

  /* ---------------------------------------------------------------------
     4. Вкладки: клик, клавиатура, плавный индикатор
     --------------------------------------------------------------------- */
  const tabs = $$('.tab');
  const indicator = $('.tabs__indicator');

  // Индикатор ставим по реальной геометрии активной вкладки — надёжнее процентов
  const syncIndicator = () => {
    const activeTab = tabs.find((t) => t.classList.contains('is-active')) || tabs[0];
    if (!indicator || !activeTab) return;

    // Сравниваем offsetLeft двух соседей в одной системе координат — так позиция
    // точна при любых отступах и рамках. offset-метрики не зависят от transform,
    // поэтому верны даже во время анимации появления карточки.
    indicator.style.transform = 'none';
    const base = indicator.offsetLeft;

    indicator.style.width = `${activeTab.offsetWidth}px`;
    indicator.style.transform = `translateX(${activeTab.offsetLeft - base}px)`;
  };

  const activateTab = (index, { focus = false } = {}) => {
    tabs.forEach((tab, i) => {
      const isActive = i === index;
      const panel = document.getElementById(tab.getAttribute('aria-controls'));

      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
      tab.tabIndex = isActive ? 0 : -1;

      if (panel) {
        panel.classList.toggle('is-active', isActive);
        // Скрытые панели прячем и от скринридеров, активную — «раскрываем»
        if (isActive) {
          panel.removeAttribute('aria-hidden');
        } else {
          panel.setAttribute('aria-hidden', 'true');
        }
        // inert не даёт попасть в скрытую панель табом и скринридером
        panel.toggleAttribute('inert', !isActive);
      }
    });

    syncIndicator();
    if (focus) tabs[index]?.focus();
  };

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => activateTab(i));

    tab.addEventListener('keydown', (e) => {
      const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
      if (!keys.includes(e.key)) return;
      e.preventDefault();

      let next = i;
      if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
      if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
      if (e.key === 'Home') next = 0;
      if (e.key === 'End') next = tabs.length - 1;

      activateTab(next, { focus: true });
    });
  });

  // Приводим разметку в согласованное состояние сразу при загрузке
  activateTab(Math.max(tabs.findIndex((t) => t.classList.contains('is-active')), 0));

  syncIndicator();
  window.addEventListener('resize', syncIndicator);
  window.addEventListener('orientationchange', syncIndicator);
  document.fonts?.ready.then(syncIndicator).catch(() => {});

  /* ---------------------------------------------------------------------
     5. Копирование в буфер обмена
     --------------------------------------------------------------------- */
  const copyText = async (text) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      throw new Error('clipboard api недоступен');
    } catch (e) {
      // Запасной путь для file:// и старых браузеров
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      ta.remove();
      return ok;
    }
  };

  $$('.copy').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const text = btn.dataset.copy || '';
      const ok = await copyText(text);
      const icon = btn.innerHTML;

      if (ok) {
        btn.classList.add('is-done');
        btn.innerHTML = '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="m5 12.6 4.4 4.4L19 7.4"/></svg>';
        toast(`Скопировано: ${text}`);
        setTimeout(() => {
          btn.classList.remove('is-done');
          btn.innerHTML = icon;
        }, 1800);
      } else {
        toast('Не получилось скопировать — скопируйте вручную');
      }
    });
  });

  /* ---------------------------------------------------------------------
     6. «Поделиться»
     --------------------------------------------------------------------- */
  const shareBtn = $('#shareBtn');
  shareBtn?.addEventListener('click', async () => {
    const shareData = {
      title: 'Qcoldu — карточка-био',
      text: 'Карточка-био: навыки, контакты и проекты.',
      url: window.location.href
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      throw new Error('share api недоступен');
    } catch (e) {
      if (e && e.name === 'AbortError') return; // пользователь передумал
      const ok = await copyText(window.location.href);
      toast(ok ? 'Ссылка на карточку скопирована' : 'Скопируйте адрес из строки браузера');
    }
  });

  /* ---------------------------------------------------------------------
     7. Анимированные счётчики
     --------------------------------------------------------------------- */
  const counters = $$('[data-count-to]');

  // Формат числа: 1.5 -> «1,5», 5 -> «5»
  const formatStat = (value, el) => {
    const decimals = Number(el.dataset.decimals) || 0;
    return value.toFixed(decimals).replace('.', ',') + (el.dataset.suffix || '');
  };

  const animateCount = (el) => {
    const target = Number(el.dataset.countTo) || 0;
    const duration = 1300;

    if (reduceMotion.matches) {
      el.textContent = formatStat(target, el);
      return;
    }

    const start = performance.now();
    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const precision = Number(el.dataset.decimals) ? 1 : 0;
      const value = precision ? target * eased : Math.round(target * eased);
      el.textContent = formatStat(value, el);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  // Сбрасываем значения до старта анимации, чтобы не мигали итоговые цифры
  if (!reduceMotion.matches) {
    counters.forEach((el) => { el.textContent = formatStat(0, el); });
  }

  if ('IntersectionObserver' in window && counters.length) {
    const io = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        animateCount(entry.target);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.6 });

    counters.forEach((el) => io.observe(el));
  } else {
    counters.forEach((el) => {
      el.textContent = formatStat(Number(el.dataset.countTo), el);
    });
  }

  // Если IO почему-то не сработал — через 2.5 с показываем реальные цифры
  setTimeout(() => {
    counters.forEach((el) => {
      if (el.textContent === '0') {
        el.textContent = formatStat(Number(el.dataset.countTo), el);
      }
    });
  }, 2500);

  /* ---------------------------------------------------------------------
     8. Местное время (Хабаровск, UTC+10)
     --------------------------------------------------------------------- */
  const clockEl = $('#localClock');
  const timeFmt = new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Vladivostok'
  });

  const tickClock = () => {
    if (!clockEl) return;
    try {
      clockEl.textContent = timeFmt.format(new Date());
    } catch (e) {
      clockEl.textContent = '';
    }
  };

  tickClock();
  setInterval(tickClock, 15000);

  /* ---------------------------------------------------------------------
     9. Свечение, следующее за курсором, и лёгкий наклон карточки
     --------------------------------------------------------------------- */
  const card = $('#card');

  if (card) {
    let raf = null;
    let targetX = 50;
    let targetY = 0;

    card.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || reduceMotion.matches) return;
      const rect = card.getBoundingClientRect();
      targetX = ((e.clientX - rect.left) / rect.width) * 100;
      targetY = ((e.clientY - rect.top) / rect.height) * 100;

      if (raf) return;
      raf = requestAnimationFrame(() => {
        card.style.setProperty('--mx', `${targetX}%`);
        card.style.setProperty('--my', `${targetY}%`);
        raf = null;
      });
    });

    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--mx', '50%');
      card.style.setProperty('--my', '0%');
    });
  }

  /* ---------------------------------------------------------------------
     10. Пауза фоновых анимаций, пока вкладка неактивна
     --------------------------------------------------------------------- */
  document.addEventListener('visibilitychange', () => {
    root.dataset.idle = document.hidden ? 'true' : 'false';
  });

  /* ---------------------------------------------------------------------
     11. Год в подвале и запасной вариант для аватара
     --------------------------------------------------------------------- */
  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  const avatar = $('#avatar');
  avatar?.addEventListener('error', () => {
    // Если картинка не загрузилась — показываем монограмму вместо «битой» иконки
    const wrap = avatar.parentElement;
    if (!wrap || wrap.querySelector('.avatar--fallback')) return;
    const fallback = document.createElement('div');
    fallback.className = 'avatar avatar--fallback';
    fallback.setAttribute('role', 'img');
    fallback.setAttribute('aria-label', 'Qcoldu');
    fallback.textContent = 'Qc';
    avatar.replaceWith(fallback);
  });

  /* ---------------------------------------------------------------------
     12. Пасхалка: нажмите «С» — конфетти из точек
     (не мешает работе, отключается при reduced-motion)
     --------------------------------------------------------------------- */
  const burst = (x, y) => {
    if (reduceMotion.matches) return;
    const colors = ['#8b5cf6', '#22d3ee', '#f472b6', '#4ade80'];
    for (let i = 0; i < 18; i += 1) {
      const p = document.createElement('span');
      const angle = (Math.PI * 2 * i) / 18;
      const distance = 40 + Math.random() * 60;
      p.style.cssText = [
        'position:fixed',
        `left:${x}px`, `top:${y}px`,
        'width:7px', 'height:7px',
        'border-radius:50%',
        `background:${colors[i % colors.length]}`,
        'pointer-events:none',
        'z-index:70',
        'transition:transform .75s cubic-bezier(.22,1,.36,1), opacity .75s'
      ].join(';');
      document.body.appendChild(p);
      requestAnimationFrame(() => {
        p.style.transform = `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px) scale(.2)`;
        p.style.opacity = '0';
      });
      setTimeout(() => p.remove(), 820);
    }
  };

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return; // не мешаем копированию
    if (e.key.toLowerCase() !== 'с' && e.key.toLowerCase() !== 'c') return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (['input', 'textarea', 'select'].includes(tag) || e.target.isContentEditable) return;
    burst(window.innerWidth / 2, window.innerHeight / 2);
    toast('Спасибо, что заглянули ✨', 1600);
  });
})();
