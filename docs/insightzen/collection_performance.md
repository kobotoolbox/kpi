# Collection Performance — Spec کامل برای پیاده‌سازی

## 0) هدف و دامنه

* ارائه‌ی **داشبورد عملکرد گردآوری** (Collection) برای یک یا چند پروژه با قابلیت فیلتر، نمودارهای تعاملی و جداول تحلیلی.
* **محدودسازی دسترسی**: کاربر فقط پروژه‌هایی را می‌بیند که برای آن‌ها «دسترسی Collection Performance» دارد.
* **خروجی اکسل**: شامل شیت خلاصه KPIها + شیت دیتای کامل سطری (با `start_form` و `end_form` و تمام فیلدهای کلیدی).

---

## 1) مدل داده و اسکیمای پایگاه‌داده (PostgreSQL 17)

> فرض: موجودیت‌های پروژه، کاربر، تخصیص تماس، مصاحبه، نتایج تماس قبلاً وجود دارد. اگر نبود، طبق زیر ایجاد شود.

### 1.1 جداول هسته

```python
# core_project (موجود)
# user (موجود)

class CoreInterviewer(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    display_name = models.CharField(max_length=128)
    team = models.CharField(max_length=64, blank=True)

class CoreInterview(models.Model):
    project = models.ForeignKey(CoreProject, on_delete=models.CASCADE, db_index=True)
    interviewer = models.ForeignKey(CoreInterviewer, on_delete=models.PROTECT, db_index=True)
    phone_number = models.CharField(max_length=32, db_index=True)
    outcome_code = models.CharField(max_length=16, db_index=True)  # نمونه: COMP, FAIL, BUSY, NA, REF, NOANS ...
    call_attempts = models.PositiveSmallIntegerField(default=1)
    # از قبل اضافه شده:
    start_form = models.DateTimeField(null=True, blank=True)  # زمان نمایش شماره/شروع فرم
    end_form   = models.DateTimeField(null=True, blank=True)  # زمان submit
    # محاسبه‌پذیر:
    duration_sec = models.IntegerField(null=True, blank=True) # می‌توان با سیگنال/SQL محاسبه و ذخیره کرد
    extra = models.JSONField(default=dict, blank=True)        # فیلدهای جانبی (استان، جنسیت هدف، ...)

    class Meta:
        indexes = [
            models.Index(fields=['project', 'interviewer']),
            models.Index(fields=['project', 'outcome_code']),
            models.Index(fields=['start_form']),
            models.Index(fields=['end_form']),
        ]
```

### 1.2 ستون‌های محاسبه‌ای (اختیاری ولی توصیه‌شده)

* در PostgreSQL 17 می‌توانید یک **generated column** برای مدت تماس نگه دارید:

```sql
ALTER TABLE core_interview
ADD COLUMN duration_sec_gen int GENERATED ALWAYS AS
    (GREATEST(0, EXTRACT(EPOCH FROM (end_form - start_form)))::int) STORED;
```

> اگر از `duration_sec_gen` استفاده شد، ستون `duration_sec` لازم نیست. شاخص روی `duration_sec_gen` برای کوئری‌های عملکردی مفید است.

### 1.3 ایندکس‌ها و بهینه‌سازی

* ایندکس ترکیبی برای بازه‌ی زمانی:

```sql
CREATE INDEX IF NOT EXISTS ix_interview_project_end_form
ON core_interview(project_id, end_form DESC);
```

* ایندکس فیلترشده برای رکوردهای کامل‌شده (مثلاً outcome_code = 'COMP'):

```sql
CREATE INDEX IF NOT EXISTS ix_interview_project_comp
ON core_interview(project_id, end_form)
WHERE outcome_code = 'COMP';
```

### 1.4 نما/ماتریالایزد ویو برای تجمیع‌های سریع

برای داشبورد سریع، یک ماتریالایزد ویو روزانه بسازید:

```sql
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_collection_daily AS
SELECT
  project_id,
  interviewer_id,
  date_trunc('day', COALESCE(end_form, start_form))::date AS day,
  count(*) FILTER (WHERE outcome_code IS NOT NULL)                  AS attempts,
  count(*) FILTER (WHERE outcome_code = 'COMP')                     AS completes,
  count(*) FILTER (WHERE outcome_code IN ('BUSY','NOANS','NA'))     AS non_contacts,
  avg(NULLIF(EXTRACT(EPOCH FROM (end_form - start_form)),0))::int   AS avg_duration_sec
FROM core_interview
GROUP BY 1,2,3;

CREATE INDEX IF NOT EXISTS ix_mv_daily_proj_day
ON mv_collection_daily(project_id, day DESC);
```

> **به‌روزرسانی**: با Celery Beat هر 5–15 دقیقه `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_collection_daily;`

---

## 2) تعریف KPIها و منطق محاسبات

### 2.1 شاخص‌ها (در بازه‌ی فیلترشده)

* **Attempts** = تعداد ردیف‌های `core_interview` (یا outcome_code not null)
* **Completes** = شمار `outcome_code = 'COMP'`
* **Success Rate (SR)** = `Completes / Attempts`
* **Avg Duration** = میانگین `duration_sec` (یا generated) برای رکوردهای دارای `end_form`
* **Interviewer Share** (برای نمودار دایره‌ای) = `Completes_by_interviewer / sum(Completes_all_interviewers)`

### 2.2 فیلترها

* پروژه (اجباری: فقط پروژه‌های مجاز)
* بازه‌ی تاریخ (پیش‌فرض 7 روز گذشته)
* مصاحبه‌گر (اختیاری، Multi-select)
* کد نتیجه (اختیاری، Multi-select)
* گروه/تیم مصاحبه‌گر (اختیاری)
* منبع نمونه/سلول سهمیه (اختیاری)

---

## 3) لایه دسترسی/امنیت

* **Policy**: کاربر فقط پروژه‌هایی را در فیلتر پروژه می‌بیند که برای آن‌ها **permission: view_collection_perf** دارد.
* Backend پیش از اجرای هر کوئری، لیست project_idهای مجاز را از **UserProjectPermission** (یا مدل مشابه) می‌گیرد و روی پارامترهای ورودی، اعتبارسنجی می‌کند.

---

## 4) API طراحی (Django/DRF)

Base path: `/api/performance/collection/`

### 4.1 خلاصه KPI

`GET /summary?project=ID&from=YYYY-MM-DD&to=YYYY-MM-DD&interviewer=...&outcomes=...`

**Response:**

```json
{
  "project": 12,
  "range": {"from": "2025-10-01", "to": "2025-10-12"},
  "totals": {
    "attempts": 3204,
    "completes": 1240,
    "success_rate": 0.3875,
    "avg_duration_sec": 312
  },
  "by_day": [
    {"day":"2025-10-10","attempts":420,"completes":160,"sr":0.381},
    ...
  ]
}
```

> برای سرعت، از `mv_collection_daily` استفاده کنید؛ اگر بازه‌ی خیلی کوچک بود می‌توانید مستقیم از `core_interview` بخوانید.

### 4.2 نمودار میله‌ای (Interviewer × Completes)

`GET /bar?project=ID&group_by=interviewer&metric=completes&from=...&to=...&limit=30`

**Response:**

```json
[
  {"interviewer_id": 7, "label": "Ali M.", "completes": 92, "attempts": 210, "sr": 0.438},
  {"interviewer_id": 13,"label": "Sara K.","completes": 88, ...},
  ...
]
```

### 4.3 نمودار دایره‌ای سهم مصاحبه‌گران

`GET /pie?project=ID&metric=completes&from=...&to=...`

**Response:**

```json
[
  {"interviewer_id": 7, "label": "Ali M.", "value": 92},
  {"interviewer_id": 13,"label": "Sara K.","value": 88},
  ...
]
```

### 4.4 جدول Top 5 (قابل سورت)

`GET /top?project=ID&sort=success|attempts|sr&direction=desc&from=...&to=...&limit=5`

**Response:**

```json
[
  {"rank":1,"interviewer_id":13,"label":"Sara K.","attempts":210,"completes":88,"sr":0.419,"avg_duration_sec":305},
  ...
]
```

### 4.5 دیتای سطری برای جدول (Paginated)

`GET /table?project=ID&from=...&to=...&page=1&page_size=50&cols=...`

**Response:**

```json
{
  "count": 12034,
  "results": [
    {
      "date":"2025-10-11",
      "project":"A2",
      "interviewer":"Ali M.",
      "phone_number":"+98912***",
      "outcome_code":"COMP",
      "start_form":"2025-10-11T09:32:14Z",
      "end_form":"2025-10-11T09:42:10Z",
      "duration_sec":596
    },
    ...
  ]
}
```

### 4.6 خروجی اکسل (Streaming)

`POST /export/xlsx` (body = فیلترها)

* **Sheets**:

  * `Summary`: KPIها و Pivotهای روزانه
  * `Interviewer Share`: جدول سهم هر مصاحبه‌گر
  * `Top 5`: جدول برترین‌ها
  * `Raw Data`: دیتای کامل سطری با ستون‌های: `date, project, interviewer, phone_number, outcome_code, start_form, end_form, duration_sec, call_attempts, ...`
* پیاده‌سازی: `openpyxl` در حالت `write_only` + `StreamingHttpResponse` برای حجم بالا.

---

## 5) SQL نمونه برای API (روی MV یا جدول اصلی)

### 5.1 خلاصه KPI‌ها (MV)

```sql
SELECT
  SUM(attempts) AS attempts,
  SUM(completes) AS completes,
  CASE WHEN SUM(attempts)>0 THEN SUM(completes)::float / SUM(attempts) ELSE 0 END AS success_rate,
  AVG(avg_duration_sec) AS avg_duration_sec
FROM mv_collection_daily
WHERE project_id = %(pid)s AND day BETWEEN %(from)s AND %(to)s
  -- محدودیت‌های دسترسی: project_id IN (allowed_ids)
;
```

### 5.2 توزیع روزانه

```sql
SELECT day,
       SUM(attempts) attempts,
       SUM(completes) completes,
       CASE WHEN SUM(attempts)>0 THEN SUM(completes)::float / SUM(attempts) ELSE 0 END sr
FROM mv_collection_daily
WHERE project_id = %(pid)s AND day BETWEEN %(from)s AND %(to)s
GROUP BY day
ORDER BY day;
```

### 5.3 رتبه‌بندی مصاحبه‌گران

```sql
SELECT interviewer_id,
       SUM(attempts) attempts,
       SUM(completes) completes,
       CASE WHEN SUM(attempts)>0 THEN SUM(completes)::float / SUM(attempts) ELSE 0 END sr,
       AVG(avg_duration_sec) avg_duration_sec
FROM mv_collection_daily
WHERE project_id = %(pid)s AND day BETWEEN %(from)s AND %(to)s
GROUP BY interviewer_id
ORDER BY
  CASE WHEN %(sort)s='success'  THEN SUM(completes)
       WHEN %(sort)s='attempts' THEN SUM(attempts)
       WHEN %(sort)s='sr'       THEN CASE WHEN SUM(attempts)>0 THEN SUM(completes)::float / SUM(attempts) ELSE 0 END
  END DESC
LIMIT %(limit)s;
```

> برای بازه‌های بسیار کوچک، می‌توانید به‌جای MV مستقیم از `core_interview` با ایندکس‌های مناسب بخوانید:

```sql
SELECT date_trunc('day', COALESCE(end_form, start_form))::date AS day,
       COUNT(*) attempts,
       COUNT(*) FILTER (WHERE outcome_code='COMP') completes
FROM core_interview
WHERE project_id=%(pid)s AND COALESCE(end_form, start_form) BETWEEN %(from_ts)s AND %(to_ts)s
GROUP BY 1
ORDER BY 1;
```

---

## 6) فرانت‌اند (React یا Django Template + Alpine/HTMX)

### 6.1 Layout و تم

* تم تاریک با پس‌زمینه‌ی واقعاً مشکی (`#000` / `#0A0A0A`) و متون روشن؛ دکمه‌ها/منوها مینیمال (تیره/روشن بدون گرادیانت).
* **منوی جمع‌شونده** با انیمیشن نرم؛ در حالت بسته فقط آیکون‌ها، در حالت باز آیکون+برچسب. فقط یک گروه منو باز باشد.
* هدر مینیمال: لوگو سمت بالا، سوییچر زبان (FA/EN) و خروج در سمت دیگر.
* اجزای ورودی (Select, MultiSelect, DateRange, Tags) یکپارچه و مدرن؛ Hover با هایلایت ظریف حاشیه.

### 6.2 صفحه Collection Performance

* **فیلترها** (بالا):

  * Project (فقط پروژه‌های مجاز کاربر)
  * Date Range (Quick: Today / 7D / 30D / Custom)
  * Interviewer (Multi)
  * Outcome Codes (Multi)
  * Team (اختیاری)
  * دکمه‌ی `Apply`
* **KPI Cards**: Attempts, Completes, SR%, Avg Duration
* **Bar Chart (قابل فیلتر/کلیک)**:

  * محور X: Interviewer (یا روز، سوئیچ‌پذیر)
  * محور Y: Completes (قابل تغییر به Attempts/SR)
  * کلیک روی ستون → فیلتر جدول پایین روی همان interviewer/day
* **Pie Chart**: سهم Completes هر مصاحبه‌گر از کل
* **Top 5 Table**: بر اساس Attempts/Completes/SR قابل سورت؛ دکمهٔ تغییر معیار
* **Data Table (مجازی‌سازی + اسکرول افقی مستقل)**:

  * ستون‌های کلیدی: Date, Interviewer, Phone, Outcome, Start, End, Duration, Attempts
  * **Header چسبان**، **Pagination**، **Export XLSX**
  * اسکرول افقی فقط روی جدول (نه کل صفحه) برای ستون‌های زیاد
* **Empty State**: پیام شفاف + پیشنهاد تغییر فیلتر

> کتابخانه‌های پیشنهادی:
>
> * نمودار: Recharts / ECharts
> * جدول: AG Grid / MUI DataGrid (Virtualized + Column Pinning + RTL-friendly)
> * تاریخ: react-day-picker / MUI Date Range

### 6.3 تعاملات

* تغییر هر فیلتر → debounce و fetch مجدد `/summary`, `/bar`, `/pie`, `/top`, `/table`.
* کلیک روی یک بار/سِکتور → افزودن فیلتر interviewer همان مورد.
* Export از همان فیلترهای فعال استفاده می‌کند؛ درخواست POST به `/export/xlsx`.

---

## 7) خروجی اکسل (دقیق طبق نیاز)

* **Sheet: Summary**

  * Range، KPIهای کل، Pivot روزانه
* **Sheet: Interviewer Share**

  * نام مصاحبه‌گر، Attempts, Completes, SR%
* **Sheet: Top 5**

  * لیست برترین‌ها با معیار انتخاب‌شده
* **Sheet: Raw Data (کامل)** — مهم

  * ستون‌ها:
    `date, project, project_id, interviewer, interviewer_id, phone_number, outcome_code, call_attempts, start_form, end_form, duration_sec, ...`
  * برای حجم بالا: `openpyxl.Workbook(write_only=True)` و stream

---

## 8) کش، کارایی و مقیاس‌پذیری

* **MV روزانه** + ایندکس‌ها → پاسخ بلادرنگ برای بازه‌های ۳۰–۹۰ روز.
* **Redis cache** برای نتایج /summary و /pie و /top (کلید ← فیلترها + user_id + نسخه‌ MV).
* Celery Beat:

  * هر 10 دقیقه: `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_collection_daily;`
  * در صورت تغییر شدید داده‌ها، رنج‌های جدید را فقط incrementally بسازید (اختیاری: جدول snapshot روزانه و upsert).

---

## 9) سکیوریتی، i18n, RTL

* **Permission check** روی هر endpoint: project ∈ allowed_projects(user).
* Sanitization پارامترها (outcome_code whitelist و …).
* i18n: کلیدهای متنی (FA/EN)، RTL در فارسی؛ اعداد و تاریخ جلالی در UI (اختیاری) ولی در DB یکتا ISO.

---

## 10) تست‌ها (الزامی برای تحویل)

* **Unit (Backend)**:

  * Aggregation روی سناریوهای edge (بدون end_form، با start_form تنها، attempts=0).
  * فیلترهای مرکب (چند interviewer + outcomes).
  * Permission denial برای پروژه غیرمجاز.
* **Unit (Frontend)**:

  * رندر KPI/Bar/Pie با mock API.
  * تعامل کلیک روی Bar→ فیلتر جدول.
  * Export با فیلترهای فعال.
* **Integration**:

  * تولید MV روی دیتای نمونه و تطابق نتایج با مستقیم از جدول.
  * Load test سبک (مثلاً 100k رکورد interview).

---

## 11) نمونه اسکلت ویو/سرویس (Django)

```python
# services/perf.py
from django.db import connection

def kpi_summary(project_id, date_from, date_to, allowed_projects):
    assert project_id in allowed_projects
    with connection.cursor() as cur:
        cur.execute("""
            SELECT
              SUM(attempts)::int,
              SUM(completes)::int,
              CASE WHEN SUM(attempts)>0 THEN SUM(completes)::float / SUM(attempts) ELSE 0 END,
              AVG(avg_duration_sec)::int
            FROM mv_collection_daily
            WHERE project_id=%s AND day BETWEEN %s AND %s
        """, [project_id, date_from, date_to])
        attempts, completes, sr, avgdur = cur.fetchone() or (0,0,0,0)
    return {"attempts": attempts or 0, "completes": completes or 0,
            "success_rate": float(sr or 0), "avg_duration_sec": avgdur or 0}
```

---

## 12) خط‌مشی نام‌گذاری

* مدل‌ها: `CoreInterview`, `CoreInterviewer`، MV: `mv_collection_daily`
* API: `/api/performance/collection/*`
* React route: `/performance/collection`

---

## 13) چک‌لیست پذیرش (Acceptance)

* [ ] کاربر فقط پروژه‌های مجاز را در فیلتر می‌بیند.
* [ ] نمودارها و جدول‌ها با فیلترهای فعال همگام هستند.
* [ ] کلیک روی بار/پای → فیلتر پایین اعمال می‌شود.
* [ ] Export با همان فیلترها و **Raw Data** شامل `start_form` و `end_form`.
* [ ] جدول با ستون‌های زیاد فقط خودش اسکرول افقی دارد (صفحه ثابت می‌ماند).
* [ ] تم تاریک مینیمال + انیمیشن hover حاشیه‌ی دکمه‌ها.
* [ ] کارایی روی ۱۰۰هزار+ رکورد قابل قبول؛ MV هر ۱۰ دقیقه رفرش می‌شود.
