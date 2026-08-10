// 全域變數
let base64Image = "";
let imageMimeType = "image/jpeg";

// 初始化
window.onload = function() {
    const today = new Date().toISOString().split('T')[0];
    if (document.getElementById('record-date')) document.getElementById('record-date').value = today;
    if (document.getElementById('view-date')) document.getElementById('view-date').value = today;
    
    const currentMonth = new Date().toISOString().slice(0, 7);
    if (document.getElementById('diag-month')) document.getElementById('diag-month').value = currentMonth;

    calculateHealth();
    renderFoodList();
    renderWater();
    
    setTimeout(() => {
        renderCharts();
    }, 150);
};

// Tab 切換邏輯（包含圖表大小修正）
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

    // 當切換到「Tab 3: 營養與水份圖表」時，重新計算寬度與渲染
    if (index === 2) {
        setTimeout(() => {
            renderCharts();
            if (window.Plotly) {
                Plotly.Plots.resize('pie-chart');
                Plotly.Plots.resize('bar-chart');
                Plotly.Plots.resize('weight-chart');
            }
        }, 100);
    }
}

// 1. 計算 BMI 與 TDEE
function calculateHealth() {
    const genderEl = document.querySelector('input[name="gender"]:checked');
    if (!genderEl) return;
    const gender = genderEl.value;
    
    const height = parseFloat(document.getElementById('height')?.value) || 0;
    const weight = parseFloat(document.getElementById('weight')?.value) || 0;
    const age = parseInt(document.getElementById('age')?.value) || 0;
    const activity = parseFloat(document.getElementById('activity')?.value) || 1.2;

    if (height < 50 || height > 250 || age <= 0 || !weight) return;

    const bmi = parseFloat((weight / ((height / 100) ** 2)).toFixed(1));
    if (document.getElementById('bmi-val')) document.getElementById('bmi-val').innerText = bmi;

    const bmiBadge = document.getElementById('bmi-badge');
    const bmiAdvice = document.getElementById('bmi-advice');

    let bmr = (10 * weight) + (6.25 * height) - (5 * age);
    bmr += (gender === '男') ? 5 : -161;
    const tdee = Math.round(bmr * activity);

    if (document.getElementById('tdee-val')) document.getElementById('tdee-val').innerText = tdee;

    let targetCal = tdee;

    if (bmi < 18.5) {
        if (bmiBadge) { bmiBadge.innerText = "體重過輕"; bmiBadge.style.background = "#3498db"; }
        if (bmiAdvice) bmiAdvice.innerText = "建議適度增加熱量與蛋白質攝取 (+300 kcal)。";
        targetCal = tdee + 300;
    } else if (bmi < 24) {
        if (bmiBadge) { bmiBadge.innerText = "健康體位"; bmiBadge.style.background = "#2ecc71"; }
        if (bmiAdvice) bmiAdvice.innerText = "太棒了！你的體重處於理想範圍，請繼續保持！";
        targetCal = tdee;
    } else if (bmi < 27) {
        if (bmiBadge) { bmiBadge.innerText = "體重過重"; bmiBadge.style.background = "#f39c12"; }
        if (bmiAdvice) bmiAdvice.innerText = "建議控管每日總熱量，已為您規劃溫和減脂 (-300 kcal)。";
        targetCal = tdee - 300;
    } else {
        if (bmiBadge) { bmiBadge.innerText = "肥胖"; bmiBadge.style.background = "#e74c3c"; }
        if (bmiAdvice) bmiAdvice.innerText = "建議控管每日總熱量，已為您規劃積極減脂 (-500 kcal)。";
        targetCal = tdee - 500;
    }

    if (document.getElementById('target-cal')) document.getElementById('target-cal').innerText = Math.round(targetCal);
    if (document.getElementById('target-p')) document.getElementById('target-p').innerText = Math.round((targetCal * 0.25) / 4);
    if (document.getElementById('target-c')) document.getElementById('target-c').innerText = Math.round((targetCal * 0.45) / 4);
    if (document.getElementById('target-f')) document.getElementById('target-f').innerText = Math.round((targetCal * 0.30) / 9);

    renderCharts();
}

// 紀錄體重歷程
function saveWeightLog() {
    const date = new Date().toISOString().split('T')[0];
    const weight = parseFloat(document.getElementById('weight').value) || 0;
    if (!weight) return alert("請輸入有效體重！");

    let weights = JSON.parse(localStorage.getItem('weight_logs') || '[]');
    weights = weights.filter(item => item.date !== date);
    weights.push({ date, weight });
    weights.sort((a, b) => new Date(a.date) - new Date(b.date));

    localStorage.setItem('weight_logs', JSON.stringify(weights));
    alert("⚖️ 今日體重已成功存檔！");
    renderCharts();
}

// 一日菜單生成
async function generateDailyMenu(e) {
    const apiKey = document.getElementById('api-key')?.value.trim();
    if (!apiKey) {
        alert("⚠️ 請先前往「2. AI 照片辨識與紀錄」輸入你的 Gemini API Key！");
        switchTab(1);
        return;
    }

    const targetCal = document.getElementById('target-cal')?.innerText;
    const targetP = document.getElementById('target-p')?.innerText;
    const targetC = document.getElementById('target-c')?.innerText;
    const targetF = document.getElementById('target-f')?.innerText;

    const btn = e ? e.target : document.querySelector("button[onclick*='generateDailyMenu']");
    const originalText = btn.innerText;
    btn.innerText = "⏳ 正在設計專屬菜單...";
    btn.disabled = true;

    const prompt = `設計一份一日健康飲食菜單（早餐、午餐、晚餐、點心）。
目標熱量：${targetCal} kcal，蛋白質 ${targetP}g、碳水 ${targetC}g、脂肪 ${targetF}g。
食材請均衡多樣且不重複。請用 Markdown 表格與標題輸出，語氣親切專業。`;

    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);

        const menuText = data.candidates[0].content.parts[0].text;
        const menuResult = document.getElementById('menu-result');
        const menuContent = document.getElementById('menu-content');
        
        menuContent.innerHTML = typeof marked !== 'undefined' ? marked.parse(menuText) : menuText;
        menuResult.style.display = 'block';
        menuResult.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
        alert(`生成失敗: ${err.message}`);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// 照片預覽與辨識
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

async function analyzeFoodImage(e) {
    const apiKey = document.getElementById('api-key').value.trim();
    if (!apiKey) return alert("請先輸入 Gemini API Key！");
    if (!base64Image) return alert("請先上傳照片！");

    const btn = e ? e.target : document.querySelector("button[onclick*='analyzeFoodImage']");
    btn.innerText = "⏳ AI 分析中...";
    btn.disabled = true;

    const prompt = `分析照片食物，回傳純 JSON 格式（不要包含 markdown）：
{ "food_name": "名稱", "calories": 數字, "protein": 數字, "carbs": 數字, "fat": 數字, "description": "簡評" }`;

    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: imageMimeType, data: base64Image } }] }]
            })
        });
        const data = await res.json();
        let rawText = data.candidates[0].content.parts[0].text.replace(/```json/gi, '').replace(/```/g, '').trim();
        const food = JSON.parse(rawText);

        document.getElementById('food-name').value = food.food_name || "";
        document.getElementById('food-cal').value = food.calories || 0;
        document.getElementById('food-p').value = food.protein || 0;
        document.getElementById('food-c').value = food.carbs || 0;
        document.getElementById('food-f').value = food.fat || 0;
        document.getElementById('ai-desc').innerText = `💡 AI 評估：${food.description || '成功'}`;
        alert("✨ 辨識成功！");
    } catch (err) {
        alert(`辨識失敗: ${err.message}`);
    } finally {
        btn.innerText = "✨ 開始 AI 自動分析";
        btn.disabled = false;
    }
}

// ⚡ 常用食物快速帶入功能
function quickFillFood(name, cal, p, c, f) {
    document.getElementById('food-name').value = name;
    document.getElementById('food-cal').value = cal;
    document.getElementById('food-p').value = p;
    document.getElementById('food-c').value = c;
    document.getElementById('food-f').value = f;
    
    if (document.getElementById('ai-desc')) {
        document.getElementById('ai-desc').innerText = `⚡ 已自動帶入常用食物數據：${name}`;
    }
}

// 儲存與管理飲食清單
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
    
    renderFoodList();
    renderCharts();
}

// 渲染當日食物列表與刪除
function renderFoodList() {
    const date = document.getElementById('record-date')?.value;
    const container = document.getElementById('food-list-container');
    if (!container || !date) return;

    const logs = JSON.parse(localStorage.getItem('food_logs') || '[]');
    const dayLogs = logs.filter(item => item.date === date);

    if (dayLogs.length === 0) {
        container.innerHTML = `<p style="color:#777;">${date} 尚無飲食紀錄。</p>`;
        return;
    }

    let html = `<table style="width:100%; border-collapse:collapse;">
        <thead>
            <tr style="text-align:left; border-bottom:2px solid #ddd;">
                <th style="padding:8px;">食物</th><th style="padding:8px;">熱量</th><th style="padding:8px;">P/C/F (g)</th><th style="padding:8px;">操作</th>
            </tr>
        </thead><tbody>`;

    dayLogs.forEach(item => {
        html += `<tr style="border-bottom:1px solid #eee;">
            <td style="padding:8px; font-weight:bold;">${item.name}</td>
            <td style="padding:8px;">${item.cal} kcal</td>
            <td style="padding:8px; font-size:0.85rem; color:#555;">${item.p} / ${item.c} / ${item.f}</td>
            <td style="padding:8px;"><button style="background:#e74c3c; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;" onclick="deleteFoodLog(${item.id})">🗑️ 刪除</button></td>
        </tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
}

function deleteFoodLog(id) {
    if (!confirm("確定要刪除這筆紀錄嗎？")) return;
    let logs = JSON.parse(localStorage.getItem('food_logs') || '[]');
    logs = logs.filter(item => item.id !== id);
    localStorage.setItem('food_logs', JSON.stringify(logs));
    renderFoodList();
    renderCharts();
}

// 飲水管理
function addWater(amount) {
    const date = document.getElementById('view-date')?.value || new Date().toISOString().split('T')[0];
    let waterLogs = JSON.parse(localStorage.getItem('water_logs') || '{}');
    waterLogs[date] = (waterLogs[date] || 0) + amount;
    localStorage.setItem('water_logs', JSON.stringify(waterLogs));
    renderWater();
}

function resetWater() {
    const date = document.getElementById('view-date')?.value || new Date().toISOString().split('T')[0];
    let waterLogs = JSON.parse(localStorage.getItem('water_logs') || '{}');
    waterLogs[date] = 0;
    localStorage.setItem('water_logs', JSON.stringify(waterLogs));
    renderWater();
}

function renderWater() {
    const date = document.getElementById('view-date')?.value || new Date().toISOString().split('T')[0];
    const waterLogs = JSON.parse(localStorage.getItem('water_logs') || '{}');
    const val = waterLogs[date] || 0;
    if (document.getElementById('water-val')) document.getElementById('water-val').innerText = val;
}

// 剩餘熱量 AI 建議
async function getLateNightAdvice(e) {
    const apiKey = document.getElementById('api-key')?.value.trim();
    if (!apiKey) return alert("⚠️ 請先在 Tab 2 輸入 API Key！");

    const date = document.getElementById('view-date').value;
    const logs = JSON.parse(localStorage.getItem('food_logs') || '[]');
    const dayLogs = logs.filter(item => item.date === date);

    let totalCal = 0, totalP = 0, totalC = 0, totalF = 0;
    dayLogs.forEach(i => { totalCal += i.cal; totalP += i.p; totalC += i.c; totalF += i.f; });

    const targetCal = parseFloat(document.getElementById('target-cal')?.innerText) || 2000;
    const targetP = parseFloat(document.getElementById('target-p')?.innerText) || 125;
    const targetC = parseFloat(document.getElementById('target-c')?.innerText) || 225;
    const targetF = parseFloat(document.getElementById('target-f')?.innerText) || 67;

    const diffCal = targetCal - totalCal;
    const diffP = targetP - totalP;

    const btn = e.target;
    btn.innerText = "⏳ 分析補餐建議中...";
    btn.disabled = true;

    const prompt = `使用者今日已攝取 ${totalCal} kcal（蛋白質 ${totalP}g），目標是 ${targetCal} kcal（蛋白質 ${targetP}g）。
目前熱量剩餘 ${diffCal} kcal，蛋白質還差 ${diffP}g。
請給予 150 字左右的補餐/宵夜技巧建議（若超標請給予消化或明日調整建議）。請簡明扼要。`;

    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await res.json();
        const advice = data.candidates[0].content.parts[0].text;

        const adviceRes = document.getElementById('advice-result');
        document.getElementById('advice-content').innerHTML = typeof marked !== 'undefined' ? marked.parse(advice) : advice;
        adviceRes.style.display = 'block';
    } catch (err) {
        alert("分析失敗，請檢查 API Key。");
    } finally {
        btn.innerText = "💡 剩餘熱量/補餐 AI 建議";
        btn.disabled = false;
    }
}

// 複製到剪貼簿
function copyToClipboard(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    navigator.clipboard.writeText(el.innerText).then(() => {
        alert("📋 已成功複製內容到剪貼簿！");
    });
}

// 3. 圖表渲染 (修正自適應)
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

    const pCal = totalP * 4, cCal = totalC * 4, fCal = totalF * 9;
    const hasData = (pCal + cCal + fCal) > 0;

    // 圓餅圖
    Plotly.newPlot('pie-chart', [{
        values: hasData ? [pCal, cCal, fCal] : [1, 1, 1],
        labels: ['蛋白質', '碳水化合物', '脂肪'],
        type: 'pie',
        marker: { colors: hasData ? ['#7A8B7B', '#A3B18A', '#E0A96D'] : ['#E2E8E0', '#E2E8E0', '#E2E8E0'] }
    }], {
        title: { text: `${viewDate} 熱量比例`, font: { size: 15 } },
        height: 300, margin: { t: 40, b: 30, l: 10, r: 10 },
        autosize: true
    }, { responsive: true, displayModeBar: false });

    // 長條圖
    const targetCal = parseFloat(document.getElementById('target-cal')?.innerText) || 2000;
    const targetP = parseFloat(document.getElementById('target-p')?.innerText) || 125;
    const targetC = parseFloat(document.getElementById('target-c')?.innerText) || 225;
    const targetF = parseFloat(document.getElementById('target-f')?.innerText) || 67;

    Plotly.newPlot('bar-chart', [
        { x: ['熱量(kcal)', '蛋白質(g)', '碳水(g)', '脂肪(g)'], y: [totalCal, totalP, totalC, totalF], name: '實際', type: 'bar', marker: { color: '#2D3B2D' } },
        { x: ['熱量(kcal)', '蛋白質(g)', '碳水(g)', '脂肪(g)'], y: [targetCal, targetP, targetC, targetF], name: '目標', type: 'bar', marker: { color: '#CBD5C8' } }
    ], {
        title: { text: '攝取量 vs 目標', font: { size: 15 } },
        barmode: 'group', height: 300, margin: { t: 40, b: 30, l: 30, r: 10 },
        autosize: true
    }, { responsive: true, displayModeBar: false });

    // 體重趨勢折線圖
    const weights = JSON.parse(localStorage.getItem('weight_logs') || '[]');
    const xDates = weights.map(w => w.date);
    const yWeights = weights.map(w => w.weight);

    Plotly.newPlot('weight-chart', [{
        x: xDates,
        y: yWeights,
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#556B2F', width: 3 },
        marker: { size: 8 }
    }], {
        title: { text: '📈 歷史體重變化趨勢 (kg)', font: { size: 15 } },
        height: 280, margin: { t: 40, b: 40, l: 35, r: 15 },
        autosize: true
    }, { responsive: true, displayModeBar: false });
}

// 4. 月度診斷
async function generateMonthlyDiagnosis(e) {
    const apiKey = document.getElementById('api-key').value.trim();
    if (!apiKey) return alert("⚠️ 請先至 Tab 2 輸入 API Key！");

    const month = document.getElementById('diag-month').value;
    const logs = JSON.parse(localStorage.getItem('food_logs') || '[]');
    const monthLogs = logs.filter(item => item.date.startsWith(month));

    if (monthLogs.length === 0) return alert("該月份尚無飲食紀錄！");

    const btn = e.target;
    btn.innerText = "🤖 AI 分析中...";
    btn.disabled = true;

    const prompt = `身為營養師，分析使用者 ${month} 月飲食數據：\n${JSON.stringify(monthLogs, null, 2)}\n請給予 300 字月度健康診斷與建議，並用 Markdown 格式。`;

    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await res.json();
        const report = data.candidates[0].content.parts[0].text;

        const diagContent = document.getElementById('diag-content');
        diagContent.innerHTML = typeof marked !== 'undefined' ? marked.parse(report) : report;
        document.getElementById('diag-result').style.display = 'block';
    } catch (err) {
        alert("產生失敗，請確認 API Key。");
    } finally {
        btn.innerText = "✨ 產生健康診斷報告";
        btn.disabled = false;
    }
}
