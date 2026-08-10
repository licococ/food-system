// 全域變數
let base64Image = "";
let imageMimeType = "image/jpeg";

// 頁面載入初始化
window.onload = function() {
    const today = new Date().toISOString().split('T')[0];
    if (document.getElementById('record-date')) document.getElementById('record-date').value = today;
    if (document.getElementById('view-date')) document.getElementById('view-date').value = today;
    
    const currentMonth = new Date().toISOString().slice(0, 7);
    if (document.getElementById('diag-month')) document.getElementById('diag-month').value = currentMonth;

    // 初次計算健康指標
    calculateHealth();
    
    // 延遲繪製初始圖表
    setTimeout(() => {
        renderCharts();
    }, 150);
};

// Tab 切換邏輯 (防止 Plotly 寬度爆破)
function switchTab(index) {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach((btn, i) => {
        if (i === index) {
            btn.classList.add('active');
            contents[i].classList.add('active');
        } else {
            btn.classList.remove('active');
            contents[i].classList.remove('active');
        }
    });

    // 切換到 Tab 2 (索引 2 的營養攝取圖表) 重新計算長寬
    if (index === 2) {
        requestAnimationFrame(() => {
            renderCharts();
            const pieChart = document.getElementById('pie-chart');
            const barChart = document.getElementById('bar-chart');
            if (pieChart && pieChart.data) Plotly.Plots.resize(pieChart);
            if (barChart && barChart.data) Plotly.Plots.resize(barChart);
        });
    }
}

// 1. 計算 BMI 與 TDEE，並根據 BMI 自動判定給予熱量建議（含防呆驗證）
function calculateHealth() {
    const genderEl = document.querySelector('input[name="gender"]:checked');
    if (!genderEl) return;
    const gender = genderEl.value;
    
    const heightInput = document.getElementById('height');
    const weightInput = document.getElementById('weight');
    const ageInput = document.getElementById('age');

    const height = parseFloat(heightInput?.value) || 0;
    const weight = parseFloat(weightInput?.value) || 0;
    const age = parseInt(ageInput?.value) || 0;
    const activity = parseFloat(document.getElementById('activity')?.value) || 1.2;

    // 身高限制：50 ~ 250 公分
    if (height < 50 || height > 250) {
        if (heightInput && heightInput.value !== "") resetOutputs();
        return;
    }

    // 年齡限制：1 ~ 120 歲
    if (age <= 0 || age > 120) {
        if (ageInput && ageInput.value !== "") resetOutputs();
        return;
    }

    if (!weight) {
        resetOutputs();
        return;
    }

    // 1. 計算 BMI
    const bmi = parseFloat((weight / ((height / 100) ** 2)).toFixed(1));
    const bmiVal = document.getElementById('bmi-val');
    if (bmiVal) bmiVal.innerText = bmi;

    const bmiBadge = document.getElementById('bmi-badge');
    const bmiAdvice = document.getElementById('bmi-advice');

    // 2. 計算 BMR 與 TDEE
    let bmr = (10 * weight) + (6.25 * height) - (5 * age);
    bmr += (gender === '男') ? 5 : -161;
    const tdee = Math.round(bmr * activity);

    if (document.getElementById('tdee-val')) {
        document.getElementById('tdee-val').innerText = tdee;
    }

    // 3. 根據 BMI 自動判定建議熱量
    let targetCal = tdee;

    if (bmi < 18.5) {
        if (bmiBadge) { bmiBadge.innerText = "體重過輕"; bmiBadge.style.background = "#3498db"; }
        if (bmiAdvice) bmiAdvice.innerText = "建議適度增加熱量與蛋白質攝取，已為您自動規劃溫暖增肌目標 (+300 kcal)。";
        targetCal = tdee + 300;
    } else if (bmi < 24) {
        if (bmiBadge) { bmiBadge.innerText = "健康體位"; bmiBadge.style.background = "#2ecc71"; }
        if (bmiAdvice) bmiAdvice.innerText = "太棒了！你的體重處於理想範圍，請繼續保持均衡飲食與運動！";
        targetCal = tdee;
    } else if (bmi < 27) {
        if (bmiBadge) { bmiBadge.innerText = "體重過重"; bmiBadge.style.background = "#f39c12"; }
        if (bmiAdvice) bmiAdvice.innerText = "建議稍微控管每日總熱量，已為您自動規劃溫和減脂目標 (-300 kcal)。";
        targetCal = tdee - 300;
    } else {
        if (bmiBadge) { bmiBadge.innerText = "肥胖"; bmiBadge.style.background = "#e74c3c"; }
        if (bmiAdvice) bmiAdvice.innerText = "建議控管每日總熱量，已為您自動規劃積極減脂目標 (-500 kcal)。";
        targetCal = tdee - 500;
    }

    // 4. 更新畫面上的建議熱量與三大營養素
    if (document.getElementById('target-cal')) {
        document.getElementById('target-cal').innerText = Math.round(targetCal);
    }

    // 三大營養素分配：蛋白質 25%, 碳水 45%, 脂肪 30%
    if (document.getElementById('target-p')) document.getElementById('target-p').innerText = Math.round((targetCal * 0.25) / 4);
    if (document.getElementById('target-c')) document.getElementById('target-c').innerText = Math.round((targetCal * 0.45) / 4);
    if (document.getElementById('target-f')) document.getElementById('target-f').innerText = Math.round((targetCal * 0.30) / 9);

    renderCharts();
}

// 防呆重置顯示區域
function resetOutputs() {
    if (document.getElementById('bmi-val')) document.getElementById('bmi-val').innerText = "--";
    if (document.getElementById('tdee-val')) document.getElementById('tdee-val').innerText = "--";
    if (document.getElementById('target-cal')) document.getElementById('target-cal').innerText = "--";
    if (document.getElementById('target-p')) document.getElementById('target-p').innerText = "--";
    if (document.getElementById('target-c')) document.getElementById('target-c').innerText = "--";
    if (document.getElementById('target-f')) document.getElementById('target-f').innerText = "--";
    if (document.getElementById('bmi-badge')) document.getElementById('bmi-badge').innerText = "數據無效";
    if (document.getElementById('bmi-advice')) document.getElementById('bmi-advice').innerText = "請輸入有效的年齡 (1~120) 與身高 (50~250 cm)。";
}

// 🥗 依熱量目標生成一日菜單（附自動跳轉導引）
async function generateDailyMenu(e) {
    const apiKey = document.getElementById('api-key')?.value.trim();
    
    // 防呆：如果沒填寫 API Key，自動提示並跳轉到 Tab 2
    if (!apiKey) {
        alert("⚠️ 請先前往「2. AI 照片辨識與紀錄」分頁輸入你的 Gemini API Key！");
        switchTab(1); // 切換到 Tab 2
        const keyInput = document.getElementById('api-key');
        if (keyInput) keyInput.focus();
        return;
    }

    const targetCal = document.getElementById('target-cal')?.innerText;
    const targetP = document.getElementById('target-p')?.innerText;
    const targetC = document.getElementById('target-c')?.innerText;
    const targetF = document.getElementById('target-f')?.innerText;

    if (!targetCal || targetCal === "--") {
        return alert("請先輸入正確的身高、體重與年齡！");
    }

    const btn = e ? e.target : document.querySelector("button[onclick*='generateDailyMenu']");
    const originalText = btn.innerText;
    btn.innerText = "⏳ 正在為您設計專屬食譜...";
    btn.disabled = true;

    // 隨機 Seed 避免每次生成的菜單重複
    const randomSeed = Math.floor(Math.random() * 100000);

    const prompt = `你是一位專業的營養師。請為使用者設計一份「一日健康飲食菜單」（包含早餐、午餐、晚餐、點心）。
要求如下：
1. 每日總目標熱量：約 ${targetCal} kcal。
2. 三大營養素目標：蛋白質 ${targetP}g、碳水化合物 ${targetC}g、脂肪 ${targetF}g。
3. 菜單食材必須均衡多樣，且每一餐的食材【嚴禁重複】。
4. 請列出每餐的：餐點名稱、估算熱量(kcal)、蛋白質(g)、碳水(g)、脂肪(g) 以及簡短備餐說明。
5. 隨機風格參數：${randomSeed}（每次生成請給予不同的菜餚搭配組合）。

請直接輸出條列式結果，語氣親切專業。`;

    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await res.json();
        
        if (data.error) {
            alert(`API 錯誤：${data.error.message}`);
            return;
        }

        const menuText = data.candidates[0].content.parts[0].text;
        
        const menuResult = document.getElementById('menu-result');
        const menuContent = document.getElementById('menu-content');
        
        if (menuResult && menuContent) {
            menuContent.innerText = menuText;
            menuResult.style.display = 'block';
            menuResult.scrollIntoView({ behavior: 'smooth' });
        }
    } catch (err) {
        console.error(err);
        alert("菜單生成失敗，請確認網路連線與 API Key 是否正確。");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// 2. 照片預覽與 Base64 轉換
function previewImage(event) {
    const file = event.target.files[0];
    if (file) {
        imageMimeType = file.type || "image/jpeg";
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('image-preview').src = e.target.result;
            document.getElementById('image-preview-container').style.display = 'block';
            base64Image = e.target.result.split(',')[1];
        };
        reader.readAsDataURL(file);
    }
}

// 呼叫 Gemini 辨識食物
async function analyzeFoodImage(e) {
    const apiKey = document.getElementById('api-key').value.trim();
    if (!apiKey) return alert("請先輸入 Gemini API Key！");
    if (!base64Image) return alert("請先選擇或上傳食物照片！");

    const btn = e ? e.target : document.querySelector("button[onclick*='analyzeFoodImage']");
    const originalText = btn.innerText;
    btn.innerText = "⏳ AI 分析中...";
    btn.disabled = true;

    const prompt = `請分析這張照片中的食物，並嚴格只回傳純 JSON 格式，不要包含任何 markdown 標籤（如 \`\`\`json）：
{
  "food_name": "食物名稱",
  "calories": 數字,
  "protein": 數字,
  "carbs": 數字,
  "fat": 數字,
  "description": "簡短評語"
}`;

    const models = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash'];
    let lastErrorMsg = "";

    for (const model of models) {
        try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: prompt },
                            { inline_data: { mime_type: imageMimeType, data: base64Image } }
                        ]
                    }]
                })
            });

            const data = await res.json();

            if (data.error) {
                lastErrorMsg = `[${model}] ${data.error.message}`;
                continue;
            }

            if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
                lastErrorMsg = `[${model}] 無法解析此照片內容`;
                continue;
            }

            let rawText = data.candidates[0].content.parts[0].text;
            rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

            const food = JSON.parse(rawText);

            document.getElementById('food-name').value = food.food_name || "";
            document.getElementById('food-cal').value = food.calories || 0;
            document.getElementById('food-p').value = food.protein || 0;
            document.getElementById('food-c').value = food.carbs || 0;
            document.getElementById('food-f').value = food.fat || 0;
            document.getElementById('ai-desc').innerText = `💡 AI 評估：${food.description || '辨識成功'}`;

            alert(`✨ 辨識成功！(採用模型: ${model})`);
            btn.innerText = originalText;
            btn.disabled = false;
            return;
        } catch (err) {
            lastErrorMsg = err.message;
        }
    }

    btn.innerText = originalText;
    btn.disabled = false;
    alert(`🚨 辨識失敗！請檢查 API Key 是否正確。\n詳細錯誤訊息：${lastErrorMsg}`);
}

// 儲存紀錄至 LocalStorage
function saveFoodLog() {
    const date = document.getElementById('record-date').value;
    const name = document.getElementById('food-name').value.trim();
    const cal = parseFloat(document.getElementById('food-cal').value) || 0;
    const p = parseFloat(document.getElementById('food-p').value) || 0;
    const c = parseFloat(document.getElementById('food-c').value) || 0;
    const f = parseFloat(document.getElementById('food-f').value) || 0;

    if (!date || !name) return alert("請填寫日期與食物名稱！");

    const logItem = { id: Date.now(), date, name, cal, p, c, f };
    let logs = JSON.parse(localStorage.getItem('food_logs') || '[]');
    logs.push(logItem);
    localStorage.setItem('food_logs', JSON.stringify(logs));

    alert("💾 紀錄已儲存！");
    document.getElementById('food-name').value = "";
    
    if (document.getElementById('view-date')) {
        document.getElementById('view-date').value = date;
    }
    renderCharts();
}

// 3. 渲染 Plotly 圖表
function renderCharts() {
    const viewDateEl = document.getElementById('view-date');
    if (!viewDateEl) return;
    const viewDate = viewDateEl.value;
    const logs = JSON.parse(localStorage.getItem('food_logs') || '[]');
    const dayLogs = logs.filter(item => item.date === viewDate);

    let totalCal = 0, totalP = 0, totalC = 0, totalF = 0;
    dayLogs.forEach(item => {
        totalCal += item.cal;
        totalP += item.p;
        totalC += item.c;
        totalF += item.f;
    });

    if (document.getElementById('m-cal')) document.getElementById('m-cal').innerText = `${totalCal} kcal`;
    if (document.getElementById('m-p')) document.getElementById('m-p').innerText = `${totalP} g`;
    if (document.getElementById('m-c')) document.getElementById('m-c').innerText = `${totalC} g`;
    if (document.getElementById('m-f')) document.getElementById('m-f').innerText = `${totalF} g`;

    // 1. 圓餅圖
    const pCal = totalP * 4;
    const cCal = totalC * 4;
    const fCal = totalF * 9;
    const hasData = (pCal + cCal + fCal) > 0;

    const pieData = [{
        values: hasData ? [pCal, cCal, fCal] : [1, 1, 1],
        labels: ['蛋白質', '碳水化合物', '脂肪'],
        type: 'pie',
        marker: { colors: hasData ? ['#7A8B7B', '#A3B18A', '#E0A96D'] : ['#E2E8E0', '#E2E8E0', '#E2E8E0'] },
        hoverinfo: hasData ? 'label+percent+value' : 'none',
        textinfo: hasData ? 'percent' : 'none'
    }];

    const pieLayout = {
        title: { text: `${viewDate} 熱量來源比例`, font: { size: 15, color: '#2D3B2D' } },
        autosize: true,
        height: 320,
        margin: { t: 40, b: 40, l: 10, r: 10 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        legend: { orientation: 'h', y: -0.15 }
    };

    if (document.getElementById('pie-chart')) {
        Plotly.newPlot('pie-chart', pieData, pieLayout, { responsive: true, displayModeBar: false });
    }

    // 2. 長條圖
    const targetCal = parseFloat(document.getElementById('target-cal')?.innerText) || 2000;
    const targetP = parseFloat(document.getElementById('target-p')?.innerText) || 125;
    const targetC = parseFloat(document.getElementById('target-c')?.innerText) || 225;
    const targetF = parseFloat(document.getElementById('target-f')?.innerText) || 67;

    const barData = [
        {
            x: ['熱量(kcal)', '蛋白質(g)', '碳水(g)', '脂肪(g)'],
            y: [totalCal, totalP, totalC, totalF],
            name: '實際攝取',
            type: 'bar',
            marker: { color: '#2D3B2D' }
        },
        {
            x: ['熱量(kcal)', '蛋白質(g)', '碳水(g)', '脂肪(g)'],
            y: [targetCal, targetP, targetC, targetF],
            name: '建議目標',
            type: 'bar',
            marker: { color: '#CBD5C8' }
        }
    ];

    const barLayout = {
        title: { text: '攝取量 vs 目標值', font: { size: 15, color: '#2D3B2D' } },
        autosize: true,
        barmode: 'group',
        height: 320,
        margin: { t: 40, b: 40, l: 35, r: 10 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        legend: { orientation: 'h', y: -0.25 }
    };

    if (document.getElementById('bar-chart')) {
        Plotly.newPlot('bar-chart', barData, barLayout, { responsive: true, displayModeBar: false });
    }
}

// 4. AI 月度健康診斷
async function generateMonthlyDiagnosis(e) {
    const apiKey = document.getElementById('api-key').value.trim();
    if (!apiKey) {
        alert("⚠️ 請先前往「2. AI 照片辨識與紀錄」分頁輸入你的 Gemini API Key！");
        switchTab(1);
        return;
    }

    const month = document.getElementById('diag-month').value;
    if (!month) return alert("請選擇分析月份！");

    const logs = JSON.parse(localStorage.getItem('food_logs') || '[]');
    const monthLogs = logs.filter(item => item.date.startsWith(month));

    if (monthLogs.length === 0) {
        return alert("該月份尚無任何飲食紀錄，無法進行 AI 診斷！");
    }

    const btn = e ? e.target : document.querySelector("button[onclick*='generateMonthlyDiagnosis']");
    const originalText = btn.innerText;
    btn.innerText = "🤖 AI 診斷分析中...";
    btn.disabled = true;

    const prompt = `你是一位專業的營養師。以下是使用者在 ${month} 月份的飲食紀錄數據：
${JSON.stringify(monthLogs, null, 2)}

請分析其飲食習慣，給予 300 字左右的月度健康診斷報告，包含優點、改進建議與下個月的飲食目標調整建議。`;

    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await res.json();
        
        if (data.error) {
            alert(`API 錯誤：${data.error.message}`);
            return;
        }

        const report = data.candidates[0].content.parts[0].text;
        document.getElementById('diag-content').innerText = report;
        document.getElementById('diag-result').style.display = 'block';
    } catch (err) {
        console.error(err);
        alert("產生診斷報告失敗，請確認網路連線與 API Key。");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}
