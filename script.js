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

    // 切換到 Tab 2 重新計算長寬
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

// 1. 計算 BMI 與 TDEE 及目標熱量 (已修正)
function calculateHealth() {
    const genderEl = document.querySelector('input[name="gender"]:checked');
    if (!genderEl) return;
    const gender = genderEl.value;
    
    const height = parseFloat(document.getElementById('height')?.value) || 0;
    const weight = parseFloat(document.getElementById('weight')?.value) || 0;
    const age = parseInt(document.getElementById('age')?.value) || 0;
    const activity = parseFloat(document.getElementById('activity')?.value) || 1.2;
    const goal = document.getElementById('goal')?.value || 'maintain'; // 取得目標選單的值

    if (!height || !weight || !age) return;

    // 計算 BMI
    const bmi = (weight / ((height / 100) ** 2)).toFixed(1);
    const bmiVal = document.getElementById('bmi-val');
    if (bmiVal) bmiVal.innerText = bmi;

    const bmiBadge = document.getElementById('bmi-badge');
    const bmiAdvice = document.getElementById('bmi-advice');

    if (bmiBadge && bmiAdvice) {
        if (bmi < 18.5) {
            bmiBadge.innerText = "體重過輕";
            bmiBadge.style.background = "#e74c3c";
            bmiAdvice.innerText = "建議適度增加熱量與蛋白質攝取，並搭配重量訓練。";
        } else if (bmi < 24) {
            bmiBadge.innerText = "健康體位";
            bmiBadge.style.background = "#2ecc71";
            bmiAdvice.innerText = "太棒了！你的體重處於理想範圍，請繼續保持均衡飲食與運動！";
        } else if (bmi < 27) {
            bmiBadge.innerText = "體重過重";
            bmiBadge.style.background = "#f39c12";
            bmiAdvice.innerText = "建議稍微控管每日總熱量，並增加每週運動頻率。";
        } else {
            bmiBadge.innerText = "肥胖";
            bmiBadge.style.background = "#e74c3c";
            bmiAdvice.innerText = "建議減少高熱量及加工食物攝取，並尋求專業醫師或營養師指引。";
        }
    }

    // 計算 BMR (Mifflin-St Jeor 公式)
    let bmr = (10 * weight) + (6.25 * height) - (5 * age);
    bmr += (gender === '男') ? 5 : -161;

    // 計算 TDEE
    const tdee = Math.round(bmr * activity);
    if (document.getElementById('tdee-val')) document.getElementById('tdee-val').innerText = tdee;

    // 根據個人目標設定建議卡路里 (此處已修正)
    let targetCal = tdee;
    if (goal === 'lose') {
        targetCal = tdee - 300;       // 溫和減脂
    } else if (goal === 'lose-fast') {
        targetCal = tdee - 500;       // 積極減脂
    } else if (goal === 'gain') {
        targetCal = tdee + 300;       // 溫和增肌
    } else if (goal === 'gain-fast') {
        targetCal = tdee + 500;       // 積極增肌
    }

    if (document.getElementById('target-cal')) document.getElementById('target-cal').innerText = Math.round(targetCal);

    // 三大營養素分配：蛋白質 25%, 碳水 45%, 脂肪 30%
    if (document.getElementById('target-p')) document.getElementById('target-p').innerText = Math.round((targetCal * 0.25) / 4);
    if (document.getElementById('target-c')) document.getElementById('target-c').innerText = Math.round((targetCal * 0.45) / 4);
    if (document.getElementById('target-f')) document.getElementById('target-f').innerText = Math.round((targetCal * 0.30) / 9);

    // 若圖表已渲染過，即時更新「攝取量 vs 目標值」長條圖
    renderCharts();
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
    if (!apiKey) return alert("請輸入 Gemini API Key！");
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

// 3. 渲染 Plotly 圖表 (自適應排版修正)
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
        legend: { orientation: 'h', y: -0.15 } // 圖例置於下方
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
        legend: { orientation: 'h', y: -0.25 } // 圖例置於下方
    };

    if (document.getElementById('bar-chart')) {
        Plotly.newPlot('bar-chart', barData, barLayout, { responsive: true, displayModeBar: false });
    }
}

// 4. AI 月度健康診斷
async function generateMonthlyDiagnosis(e) {
    const apiKey = document.getElementById('api-key').value.trim();
    if (!apiKey) return alert("請先於 Tab 2 輸入你的 Gemini API Key！");

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
