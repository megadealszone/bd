# bKash Premium Accounting Web App 🚀

এই প্রজেক্টটি একটি Enterprise Grade bKash Agent Management System, যা GitHub Pages এবং Google Sheets-এর সাহায্যে পরিচালিত হয়।

## ⚙️ ১. Google Sheet ও Google Apps Script Setup
1. আপনার Google Sheet ওপেন করুন: [Sheet Link](https://docs.google.com/spreadsheets/d/1SeELq58heEC-bZ3FTv9MuuiiR9ZvRcsN2DtSRINRdd4/edit)
2. মেনু থেকে `Extensions` -> `Apps Script` এ ক্লিক করুন।
3. আগের সব কোড মুছে ফেলে নিচের `Code.gs` এর কোড পেস্ট করুন এবং Save করুন।
4. প্রথমবার Run করার জন্য `setupSystem` ফাংশনটি সিলেক্ট করে `Run` বাটনে ক্লিক করুন। 
   *(এটি আপনার শিটে প্রয়োজনীয় সকল Sheet ও Column স্বয়ংক্রিয়ভাবে তৈরি করবে।)*
5. Google এর Permission চাইলে `Advanced` এ গিয়ে `Go to [Project Name]` এ ক্লিক করে Allow করুন।

## 🌐 ২. Deploy As Web App
1. Apps Script এর উপরে ডানদিকে `Deploy` -> `New deployment` এ ক্লিক করুন।
2. `Select type` এ **Web app** সিলেক্ট করুন।
3. Description: `v1.0`
4. Execute as: **Me (আপনার ইমেইল)**
5. Who has access: **Anyone**
6. `Deploy` বাটনে ক্লিক করুন এবং **Web app URL** টি কপি করে নিন।

## 🚀 ৩. GitHub Pages Configuration
1. `app.js` ফাইলের একদম উপরে `const GAS_URL = "এখানে_আপনার_WEB_APP_URL_দিন";` লাইনে কপি করা URL টি পেস্ট করুন।
2. `index.html`, `style.css` এবং `app.js` ফাইলগুলো GitHub Repository তে আপলোড করুন।
3. Repository Settings -> Pages এ গিয়ে `main` ব্রাঞ্চ সিলেক্ট করে Save করুন। 
4. কিছুক্ষণের মধ্যে আপনার App Live হয়ে যাবে!

## 🔒 Security Notes
- পাসওয়ার্ড প্লেইন টেক্সট হিসেবে সেভ হবে না, SHA-256 Hash হয়ে ডাটাবেসে যাবে।
- Apps Script Web App URL গোপন রাখবেন।