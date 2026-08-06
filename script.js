// 初始化日期預設值
document.getElementById('record-date').valueAsDate = new Date();
document.getElementById('view-date').valueAsDate = new Date();
document.getElementById('diag-month').value = new Date().toISOString().slice(0, 7);

let base64Image = "";

// 切換 Tab
function switchTab(index) {
    document.querySelectorAll('.tab-btn').forEach((btn, i) => {
        btn.classList.toggle('active', i === index);
    });
    document.querySelectorAll('.tab-content').forEach((content, i) => {
        content.classList.toggle('active', i === index);
    });
    if (index === 2) renderCharts();
}

// 身體數據與卡路里試算
function calculateHealth() {
    const height = parseFloat(document.getElementById('height').value) || 170;
    const weight = parseFloat(document.getElementById('weight').value) || 65;
    const age = parseInt(document.getElementById('age').value) || 25;
    const gender = document.querySelector('input[name="gender"]:checked').value;
    const activity = parseFloat(document.getElementById('activity').value);

    const bmi = (weight / ((height / 100) ** 2)).toFixed(1);
    document.getElementById('bmi-val').innerText = bmi;

    let status = "健康體位", color = "#2E7D32", advice = "🎉 太棒了！請繼續維持均衡飲食與規律運動。", adjust = 1.0;
    if (bmi < 18.5) { status = "體重過輕"; color = "#4A90E2"; advice = "💡 建議適度增加熱量攝取與肌肉訓練。"; adjust = 1.15; }
    else if (bmi >= 24 && bmi < 27) { status = "體重過重"; color = "#F57C00"; advice = "💡 建議控制熱量赤字 300~500 kcal。"; adjust = 0.85; }
    else if (bmi >= 27) { status = "肥胖"; color = "#D32F2F"; advice = "⚠️ 建議規律運動與調整營養結構。"; adjust = 0.8; }

    const badge = document.getElementById('bmi-badge');
    badge.innerText = status;
    badge.style.backgroundColor = color;
    document.getElementById('bmi-advice').innerText = advice;

    const bmr = gender === "男" ? (10 * weight + 6.25 * height - 5 * age + 5) : (10 * weight + 6.25 * height - 5 * age - 161);
    const tdee = Math.round(bmr * activity);
    const targetCal = Math.round(tdee * adjust);

    document.getElementById('tdee-val').innerText = tdee;
    document.getElementById('target-cal').innerText = targetCal;
    document.getElementById('target-p').innerText = Math.round((targetCal * 0.25) / 4);
    document.getElementById('target-c').innerText = Math.round((targetCal * 0.45) / 4);
    document.getElementById('target-f').innerText = Math.round((targetCal * 0.30) / 9);
}
calculateHealth();

// 預覽照片並轉 Base64
function previewImage(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('image-preview').src = e.target.result;
            document.getElementById('image-preview-container').style.display = 'block';
            base64Image = e.target.result.split(',')[1];
        };
        reader.readAsDataURL(file);
    }
}

// 呼叫 Gemini 1.5 Flash 辨識食物
async function analyzeFoodImage() {
    const apiKey = document.getElementById('api-key').value;
    if (!apiKey) return alert("請輸入 Gemini API Key！");
    if (!base64Image) return alert("請選擇食物照片！");

    const prompt = "請分析照片中的食物，回傳 JSON：{\"food_name\":\"名稱\",\"calories\":數字,\"protein\":數字,\"carbs\":數字,\"fat\":數字,\"description\":\"說明\"}";

    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        { inline_data: { mime_type: "image/jpeg", data: base64Image } }
                    ]
                }]
            })
        });
        const data = await res.json();
        const textRes = data.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim();
        const food = JSON.parse(textRes);

        document.getElementById('food-name').value = food.food_name || "";
        document.getElementById('food-cal').value = food.calories || 0;
        document.getElementById('food-p').value = food.protein || 0;
        document.getElementById('food-c').value = food.carbs || 0;
        document.getElementById('food-f').value = food.fat || 0;
        document.getElementById('ai-desc').innerText = `💡 AI 評估：${food.description || ''}`;
        alert("✅ 辨識成功！");
    } catch (e) {
        alert("辨識失敗，請檢查 API Key 或連線問題：" + e.message);
    }
}

// 儲存至 LocalStorage (替代 Local SQLite)
function saveFoodLog() {
    const date = document.getElementById('record-date').value;
    const name = document.getElementById('food-name').value;
    if (!name) return alert("請填寫食物名稱！");

    const log = {
        date, name,
        calories: parseFloat(document.getElementById('food-cal').value) || 0,
        protein: parseFloat(document.getElementById('food-p').value) || 0,
        carbs: parseFloat(document.getElementById('food-c').value) || 0,
        fat: parseFloat(document.getElementById('food-f').value) || 0
    };

    let logs = JSON.parse(localStorage.getItem('food_logs') || '[]');
    logs.push(log);
    localStorage.setItem('food_logs', JSON.stringify(logs));
    alert("💾 成功儲存紀錄！");
}

// 渲染圖表
function renderCharts() {
    const selectedDate = document.getElementById('view-date').value;
    const logs = JSON.parse(localStorage.getItem('food_logs') || '[]').filter(l => l.date === selectedDate);

    let cal = 0, p = 0, c = 0, f = 0;
    logs.forEach(l => { cal += l.calories; p += l.protein; c += l.carbs; f += l.fat; });

    document.getElementById('m-cal').innerText = `${cal} kcal`;
    document.getElementById('m-p').innerText = `${p} g`;
    document.getElementById('m-c').innerText = `${c} g`;
    document.getElementById('m-f').innerText = `${f} g`;

    // 圓餅圖
    Plotly.newPlot('pie-chart', [{
        values: [p * 4, c * 4, f * 9],
        labels: ['蛋白質', '碳水', '脂肪'],
        type: 'pie',
        marker: { colors: ['#2D4A3E', '#8F9E8B', '#D8CBB5'] }
    }], { title: '當日三大營養素卡路里佔比', paper_bgcolor: 'transparent' });

    // 長條圖
    Plotly.newPlot('bar-chart', [{
        x: logs.map(l => l.name),
        y: logs.map(l => l.calories),
        type: 'bar',
        marker: { color: '#2D4A3E' }
    }], { title: '各食物熱量拆解', paper_bgcolor: 'transparent' });
}

// AI 月度診斷
async function generateMonthlyDiagnosis() {
    const apiKey = document.getElementById('api-key').value;
    const month = document.getElementById('diag-month').value;
    if (!apiKey) return alert("請輸入 API Key！");

    const logs = JSON.parse(localStorage.getItem('food_logs') || '[]').filter(l => l.date.startsWith(month));
    if (logs.length === 0) return alert("該月份尚無資料！");

    const prompt = `請以營養師角度分析 ${month} 月份飲食紀錄並提供建議：${JSON.stringify(logs)}`;

    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await res.json();
        document.getElementById('diag-content').innerText = data.candidates[0].content.parts[0].text;
        document.getElementById('diag-result').style.display = 'block';
    } catch (e) {
        alert("診斷生成失敗：" + e.message);
    }
}
