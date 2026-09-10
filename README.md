# my-ai-site

## الملفات
- `index.html` + `style.css` + `script.js` → واجهة الشات (الجزء الظاهر للزوار)
- `api/chat.js` → Serverless Function تشتغل على Vercel، فيها الاتصال بـ Ollama، والمفتاح مخفي تماماً

## خطوات الرفع (من الهاتف عبر GitHub + Vercel)

### 1. ارفع الملفات على GitHub
في مشروعك `my-ai-site` على GitHub:
- أضف الملفات: `index.html`, `style.css`, `script.js`, `package.json`
- أنشئ مجلد `api` وبداخله ملف `chat.js` بنفس المحتوى

### 2. اربط المشروع بـ Vercel
- ادخل vercel.com → Add New Project → اختر نفس الـ Repository → Deploy

### 3. الأهم: أضف المفتاح كـ Environment Variable (وليس داخل الكود)
في لوحة تحكم Vercel لمشروعك:
1. اذهب إلى **Settings → Environment Variables**
2. أضف متغير باسم:
   - **Key:** `OLLAMA_API_KEY`
   - **Value:** ضع مفتاحك الحقيقي هنا
3. احفظ، ثم اذهب لتبويب **Deployments** واضغط **Redeploy** على آخر نسخة (لازم تعيد النشر عشان يقرأ المتغير الجديد)

### 4. تخصيص اسم البوت
غيّر السطر التالي داخل `api/chat.js` للاسم اللي تبيه:
```js
const systemPrompt = 'اسمك هو RedFoxiq'; // غيّره لاسم موقعك
```

### 5. تخصيص النموذج
لو تبي تغيّر النموذج المستخدم من Ollama، عدّل هذا السطر في `api/chat.js`:
```js
const targetModel = 'gemma4:31b';
```

## ملاحظة أمان مهمة
- المفتاح **لا يوضع أبداً** داخل أي ملف يُرفع لـ GitHub (لا في `chat.js` ولا غيره)
- يبقى فقط داخل إعدادات Vercel (Environment Variables) — بهذا الشكل حتى لو شاهد أحد الكود على GitHub، ما يقدر يشوف المفتاح
- أي زائر يفتح "Network Tab" بمتصفحه يشوف فقط طلبات إلى `/api/chat` الخاص بموقعك — بدون أي أثر لـ ollama.com أو المفتاح
