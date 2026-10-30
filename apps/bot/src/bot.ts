import { Markup, Telegraf } from 'telegraf';
import { botApi } from './api.js';

type Wizard =
  | { kind: 'login'; step: 'user' | 'pass'; username?: string }
  | {
      kind: 'leave';
      step: 'date' | 'reason';
      type: 'DAILY' | 'HOURLY';
      leaveDate?: string;
    }
  | {
      kind: 'salary';
      step: 'amount' | 'desc';
      type: 'SALARY' | 'ADVANCE';
      amount?: number;
    }
  | { kind: 'reject_leave'; id: string }
  | { kind: 'reject_salary'; id: string };

const wizards = new Map<number, Wizard>();

function tgId(ctx: { from?: { id: number } }) {
  return String(ctx.from?.id || '');
}

function mainKeyboard(labels: string[]) {
  const rows: string[][] = [];
  for (let i = 0; i < labels.length; i += 2) {
    rows.push(labels.slice(i, i + 2));
  }
  rows.push(['🔌 قطع اتصال', '🏠 منو']);
  return Markup.keyboard(rows).resize();
}

async function ensureLinked(ctx: any) {
  try {
    return await botApi.me(tgId(ctx));
  } catch {
    return null;
  }
}

async function showMenu(ctx: any) {
  const menu = await botApi.menu(tgId(ctx));
  const labels = menu.items.map((i) => i.label);
  await ctx.reply(
    `سلام <b>${menu.displayName}</b> 👋\nاز منوی زیر بخش موردنظر را انتخاب کنید.`,
    { parse_mode: 'HTML', ...mainKeyboard(labels) }
  );
}

function fmtDate(d: string | Date) {
  try {
    return new Date(d).toLocaleDateString('fa-IR');
  } catch {
    return String(d);
  }
}

export function createBot(token: string) {
  const bot = new Telegraf(token);

  bot.start(async (ctx) => {
    const linked = await ensureLinked(ctx);
    if (linked) {
      await ctx.reply('حساب شما قبلاً متصل است.');
      await showMenu(ctx);
      return;
    }
    wizards.set(ctx.from!.id, { kind: 'login', step: 'user' });
    await ctx.reply(
      'به <b>بات فروشگاه سامی</b> خوش آمدید.\n\nبرای اتصال به پنل، <b>نام کاربری</b> خود را بفرستید:',
      { parse_mode: 'HTML', ...Markup.removeKeyboard() }
    );
  });

  bot.command('menu', async (ctx) => {
    try {
      await showMenu(ctx);
    } catch {
      await ctx.reply('ابتدا با /start وارد شوید.');
    }
  });

  bot.command('unlink', async (ctx) => {
    await botApi.unlink(tgId(ctx));
    wizards.delete(ctx.from!.id);
    await ctx.reply('اتصال قطع شد. برای ورود دوباره /start را بزنید.', Markup.removeKeyboard());
  });

  bot.hears('🏠 منو', async (ctx) => {
    try {
      await showMenu(ctx);
    } catch (e: any) {
      await ctx.reply(e?.message || 'خطا');
    }
  });

  bot.hears('🔌 قطع اتصال', async (ctx) => {
    await botApi.unlink(tgId(ctx));
    wizards.delete(ctx.from!.id);
    await ctx.reply('اتصال قطع شد. برای ورود دوباره /start را بزنید.', Markup.removeKeyboard());
  });

  async function safe(ctx: any, fn: () => Promise<void>) {
    try {
      await fn();
    } catch (e: any) {
      const msg = e?.message || 'خطا';
      if (e?.code === 'NOT_LINKED' || /متصل نیست/.test(msg)) {
        await ctx.reply('ابتدا با /start وارد شوید.');
        return;
      }
      await ctx.reply(msg);
    }
  }

  bot.hears(/📊 داشبورد/, (ctx) =>
    safe(ctx, async () => {
      const d = await botApi.dashboard(tgId(ctx));
      await ctx.reply(
        `<b>داشبورد</b>\n` +
          `مرخصی در انتظار: <b>${d.leavePending}</b>\n` +
          `مالی در انتظار: <b>${d.salaryPending}</b>\n` +
          `وظایف باز: <b>${d.tasksOpen}</b>\n` +
          `وظایف من: <b>${d.tasksMine}</b>\n` +
          `اعلان خوانده‌نشده: <b>${d.unread}</b>`,
        { parse_mode: 'HTML' }
      );
    })
  );

  bot.hears(/🏖️ مرخصی/, (ctx) =>
    safe(ctx, async () => {
    const data = await botApi.leave(tgId(ctx), 'PENDING');
    const me = await botApi.me(tgId(ctx));
    const canApprove = me.permissions.includes('leave.approve');
    if (!data.items.length) {
      await ctx.reply(
        'درخواست معلقی نیست.',
        Markup.inlineKeyboard([
          [Markup.button.callback('➕ ثبت مرخصی روزانه', 'leave:new:DAILY')],
          [Markup.button.callback('➕ ثبت مرخصی ساعتی', 'leave:new:HOURLY')],
        ])
      );
      return;
    }
    for (const item of data.items.slice(0, 8)) {
      const name = `${item.employee?.firstName || ''} ${item.employee?.lastName || ''}`.trim();
      const buttons = [];
      if (canApprove && item.status === 'PENDING') {
        buttons.push([
          Markup.button.callback('✅ تأیید', `leave:ok:${item.id}`),
          Markup.button.callback('❌ رد', `leave:no:${item.id}`),
        ]);
      }
      await ctx.reply(
        `<b>${item.type === 'HOURLY' ? 'ساعتی' : 'روزانه'}</b> — ${name}\n` +
          `تاریخ: ${fmtDate(item.leaveDate)}\n` +
          `وضعیت: ${item.status}\n` +
          `${item.reason ? `دلیل: ${item.reason}` : ''}`,
        { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) }
      );
    }
    await ctx.reply(
      'عملیات:',
      Markup.inlineKeyboard([
        [Markup.button.callback('➕ ثبت مرخصی روزانه', 'leave:new:DAILY')],
        [Markup.button.callback('➕ ثبت مرخصی ساعتی', 'leave:new:HOURLY')],
      ])
    );
    })
  );

  bot.hears(/💰 مالی/, (ctx) =>
    safe(ctx, async () => {
    const data = await botApi.salary(tgId(ctx), 'PENDING');
    const me = await botApi.me(tgId(ctx));
    const canApprove = me.permissions.includes('salary.approve');
    if (!data.items.length) {
      await ctx.reply(
        'درخواست مالی معلقی نیست.',
        Markup.inlineKeyboard([
          [Markup.button.callback('➕ درخواست حقوق', 'salary:new:SALARY')],
          [Markup.button.callback('➕ درخواست مساعده', 'salary:new:ADVANCE')],
        ])
      );
      return;
    }
    for (const item of data.items.slice(0, 8)) {
      const name = `${item.employee?.firstName || ''} ${item.employee?.lastName || ''}`.trim();
      const buttons = [];
      if (canApprove && item.status === 'PENDING') {
        buttons.push([
          Markup.button.callback('✅ تأیید', `salary:ok:${item.id}`),
          Markup.button.callback('❌ رد', `salary:no:${item.id}`),
        ]);
      }
      await ctx.reply(
        `<b>${item.type === 'ADVANCE' ? 'مساعده' : 'حقوق'}</b> — ${name}\n` +
          `مبلغ: ${Number(item.amount).toLocaleString('fa-IR')}\n` +
          `وضعیت: ${item.status}`,
        { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) }
      );
    }
    await ctx.reply(
      'عملیات:',
      Markup.inlineKeyboard([
        [Markup.button.callback('➕ درخواست حقوق', 'salary:new:SALARY')],
        [Markup.button.callback('➕ درخواست مساعده', 'salary:new:ADVANCE')],
      ])
    );
    })
  );

  bot.hears(/✅ وظایف/, (ctx) =>
    safe(ctx, async () => {
      const data = await botApi.tasks(tgId(ctx));
      const open = data.items.filter((t) => t.status !== 'COMPLETED').slice(0, 10);
      if (!open.length) {
        await ctx.reply('وظیفه بازی ندارید.');
        return;
      }
      for (const t of open) {
        await ctx.reply(`<b>${t.title}</b>\nاولویت: ${t.priority}\nوضعیت: ${t.status}`, {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([[Markup.button.callback('✔️ تکمیل', `task:done:${t.id}`)]]),
        });
      }
    })
  );

  bot.hears(/🔔 اعلان‌ها/, (ctx) =>
    safe(ctx, async () => {
      const data = await botApi.notifications(tgId(ctx));
      if (!data.items.length) {
        await ctx.reply('اعلانی نیست.');
        return;
      }
      await ctx.reply(`خوانده‌نشده: <b>${data.unreadCount}</b>`, { parse_mode: 'HTML' });
      for (const n of data.items.slice(0, 10)) {
        await ctx.reply(`${n.isRead ? '' : '🔵 '}<b>${n.title}</b>\n${n.body}`, {
          parse_mode: 'HTML',
        });
      }
      if (data.unreadCount > 0) {
        await ctx.reply(
          'پاکسازی:',
          Markup.inlineKeyboard([[Markup.button.callback('خواندن همه', 'notif:readall')]])
        );
      }
    })
  );

  bot.hears(/📢 اطلاعیه‌ها/, (ctx) =>
    safe(ctx, async () => {
      const data = await botApi.announcements(tgId(ctx));
      if (!data.items.length) {
        await ctx.reply('اطلاعیه‌ای نیست.');
        return;
      }
      for (const a of data.items.slice(0, 8)) {
        await ctx.reply(`${a.isPinned ? '📌 ' : ''}<b>${a.title}</b>\n${a.body}`, {
          parse_mode: 'HTML',
        });
      }
    })
  );

  bot.hears(/🏦 حساب بانکی/, (ctx) =>
    safe(ctx, async () => {
      const account = await botApi.bankMe(tgId(ctx));
      if (!account) {
        await ctx.reply('حساب بانکی ثبت نشده. از پنل وب تکمیل کنید.');
        return;
      }
      const iban = String(account.iban || '');
      const masked = iban.length > 8 ? `${iban.slice(0, 4)}****${iban.slice(-4)}` : '****';
      await ctx.reply(
        `<b>حساب بانکی</b>\nبانک: ${account.bankName}\nصاحب: ${account.accountHolder}\nشبا: <code>${masked}</code>`,
        { parse_mode: 'HTML' }
      );
    })
  );

  bot.hears(/👥 کارکنان/, (ctx) =>
    safe(ctx, async () => {
      const data = await botApi.employees(tgId(ctx));
      const lines = data.items
        .slice(0, 20)
        .map(
          (e) =>
            `• ${e.firstName} ${e.lastName}${e.jobTitle ? ` — ${e.jobTitle}` : ''}${
              e.telegramUserId ? ' 🔗' : ''
            }`
        );
      await ctx.reply(`<b>کارکنان</b>\n${lines.join('\n') || 'خالی'}`, { parse_mode: 'HTML' });
    })
  );

  bot.hears(/🏢 دپارتمان‌ها/, (ctx) =>
    safe(ctx, async () => {
      const data = await botApi.departments(tgId(ctx));
      const lines = data.items.map((d) => `• ${d.name}`);
      await ctx.reply(`<b>دپارتمان‌ها</b>\n${lines.join('\n') || 'خالی'}`, { parse_mode: 'HTML' });
    })
  );

  bot.hears(/📈 گزارش‌ها/, (ctx) =>
    safe(ctx, async () => {
      const r = await botApi.reports(tgId(ctx));
      await ctx.reply(
        `<b>خلاصه گزارش</b>\nکارکنان: ${r.employees}\nمرخصی تأییدشده: ${r.leaveApproved}\nوظایف انجام‌شده: ${r.tasksDone}`,
        { parse_mode: 'HTML' }
      );
    })
  );

  bot.hears(/👤 پروفایل/, (ctx) =>
    safe(ctx, async () => {
      const me = await botApi.me(tgId(ctx));
      await ctx.reply(
        `<b>پروفایل</b>\nنام: ${me.firstName} ${me.lastName}\nیوزرنیم: <code>${me.username}</code>\nمجوزها: ${me.permissions.length}`,
        { parse_mode: 'HTML' }
      );
    })
  );

  // ── Callbacks ──
  bot.action(/^leave:new:(DAILY|HOURLY)$/, async (ctx) => {
    const type = ctx.match[1] as 'DAILY' | 'HOURLY';
    wizards.set(ctx.from!.id, { kind: 'leave', step: 'date', type });
    await ctx.answerCbQuery();
    await ctx.reply(
      type === 'HOURLY'
        ? 'تاریخ مرخصی ساعتی را YYYY-MM-DD بفرستید (ساعت پیش‌فرض ۰۹:۰۰ تا ۱۳:۰۰):'
        : 'تاریخ مرخصی را به صورت YYYY-MM-DD بفرستید (مثال: 2026-11-01):'
    );
  });

  bot.action(/^leave:ok:(.+)$/, async (ctx) => {
    const id = ctx.match[1];
    await botApi.decideLeave(id, { telegramUserId: tgId(ctx), approve: true });
    await ctx.answerCbQuery('تأیید شد');
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    await ctx.reply('مرخصی تأیید شد ✅');
  });

  bot.action(/^leave:no:(.+)$/, async (ctx) => {
    wizards.set(ctx.from!.id, { kind: 'reject_leave', id: ctx.match[1] });
    await ctx.answerCbQuery();
    await ctx.reply('دلیل رد را بنویسید:');
  });

  bot.action(/^salary:new:(SALARY|ADVANCE)$/, async (ctx) => {
    const type = ctx.match[1] as 'SALARY' | 'ADVANCE';
    wizards.set(ctx.from!.id, { kind: 'salary', step: 'amount', type });
    await ctx.answerCbQuery();
    await ctx.reply('مبلغ را به عدد بفرستید (مثال: 5000000):');
  });

  bot.action(/^salary:ok:(.+)$/, async (ctx) => {
    await botApi.decideSalary(ctx.match[1], { telegramUserId: tgId(ctx), approve: true });
    await ctx.answerCbQuery('تأیید شد');
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    await ctx.reply('درخواست مالی تأیید شد ✅');
  });

  bot.action(/^salary:no:(.+)$/, async (ctx) => {
    wizards.set(ctx.from!.id, { kind: 'reject_salary', id: ctx.match[1] });
    await ctx.answerCbQuery();
    await ctx.reply('دلیل رد را بنویسید:');
  });

  bot.action(/^task:done:(.+)$/, async (ctx) => {
    await botApi.completeTask(ctx.match[1], tgId(ctx));
    await ctx.answerCbQuery('انجام شد');
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    await ctx.reply('وظیفه تکمیل شد ✔️');
  });

  bot.action('notif:readall', async (ctx) => {
    await botApi.readAllNotifications(tgId(ctx));
    await ctx.answerCbQuery('خوانده شد');
    await ctx.reply('همه اعلان‌ها خوانده شدند.');
  });

  // ── Text / wizards ──
  bot.on('text', async (ctx, next) => {
    const text = ctx.message.text?.trim() || '';
    if (text.startsWith('/')) return next();

    const w = wizards.get(ctx.from!.id);
    if (!w) return next();

    try {
      if (w.kind === 'login') {
        if (w.step === 'user') {
          wizards.set(ctx.from!.id, { kind: 'login', step: 'pass', username: text });
          await ctx.reply('رمز عبور را بفرستید:');
          return;
        }
        const linked = await botApi.link({
          username: w.username!,
          password: text,
          telegramUserId: tgId(ctx),
          telegramUsername: ctx.from?.username,
        });
        wizards.delete(ctx.from!.id);
        await ctx.reply(`اتصال موفق ✅\nخوش آمدید ${linked.displayName}`);
        await showMenu(ctx);
        return;
      }

      if (w.kind === 'leave') {
        if (w.step === 'date') {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
            await ctx.reply('فرمت تاریخ نامعتبر است. مثال: 2026-11-01');
            return;
          }
          wizards.set(ctx.from!.id, {
            kind: 'leave',
            step: 'reason',
            type: w.type,
            leaveDate: text,
          });
          await ctx.reply('دلیل/توضیح (یا - برای رد شدن):');
          return;
        }
        if (w.step === 'reason') {
          await botApi.createLeave({
            telegramUserId: tgId(ctx),
            type: w.type,
            leaveDate: w.leaveDate,
            reason: text === '-' ? undefined : text,
            ...(w.type === 'HOURLY' ? { startTime: '09:00', endTime: '13:00' } : {}),
          });
          wizards.delete(ctx.from!.id);
          await ctx.reply('درخواست مرخصی ثبت شد ✅');
          return;
        }
      }

      if (w.kind === 'reject_leave') {
        await botApi.decideLeave(w.id, {
          telegramUserId: tgId(ctx),
          approve: false,
          reason: text,
        });
        wizards.delete(ctx.from!.id);
        await ctx.reply('مرخصی رد شد.');
        return;
      }

      if (w.kind === 'reject_salary') {
        await botApi.decideSalary(w.id, {
          telegramUserId: tgId(ctx),
          approve: false,
          reason: text,
        });
        wizards.delete(ctx.from!.id);
        await ctx.reply('درخواست مالی رد شد.');
        return;
      }

      if (w.kind === 'salary') {
        if (w.step === 'amount') {
          const amount = Number(text.replace(/,/g, ''));
          if (!Number.isFinite(amount) || amount <= 0) {
            await ctx.reply('مبلغ نامعتبر است.');
            return;
          }
          wizards.set(ctx.from!.id, { kind: 'salary', step: 'desc', type: w.type, amount });
          await ctx.reply('توضیح (یا - ):');
          return;
        }
        if (w.step === 'desc') {
          await botApi.createSalary({
            telegramUserId: tgId(ctx),
            type: w.type,
            amount: w.amount,
            description: text === '-' ? undefined : text,
          });
          wizards.delete(ctx.from!.id);
          await ctx.reply('درخواست مالی ثبت شد ✅');
          return;
        }
      }
    } catch (e: any) {
      wizards.delete(ctx.from!.id);
      await ctx.reply(e?.message || 'خطا در انجام عملیات');
      return;
    }

    return next();
  });

  bot.catch((err) => {
    console.error('Bot error:', err);
  });

  return bot;
}
