/*************************************************************************************************/
/********************************** KHU VỰC ĐIỀU KHIỂN GIAO DIỆN **********************************/
/*************************************************************************************************/

/**
 * Hiển thị khu vực viết nhật ký và ẩn các khu vực khác.
 */
function showWriteDiary() {
    document.getElementById("writeDiary").classList.remove("hidden");
    document.getElementById("viewDiary").classList.add("hidden");
    document.getElementById("diaryPopup").classList.add("hidden");
    document.getElementById("popupDiaryContent").innerHTML = "";
}

/**
 * Hiển thị khu vực xem nhật ký và bắt đầu tải dữ liệu.
 */
function showViewDiary() {
    document.getElementById("viewDiary").classList.remove("hidden");
    document.getElementById("writeDiary").classList.add("hidden");
    document.getElementById("diaryPopup").classList.add("hidden");
    document.getElementById("popupDiaryContent").innerHTML = "";
    loadDiary();
}

/**
 * Đóng cửa sổ popup xem chi tiết nhật ký.
 */
function closePopup() {
    const popup = document.getElementById("diaryPopup");
    if (popup) {
        popup.classList.add("hidden");
        document.getElementById("popupDiaryContent").innerHTML = "";
    }
}

/**
 * Hiển thị chi tiết các mục nhật ký trong một cửa sổ popup.
 * @param {Array} entries - Mảng các mục nhật ký cho một ngày cụ thể.
 */
function showDiaryEntry(entries) {
    const popup = document.getElementById("diaryPopup");
    const popupContent = document.getElementById("popupDiaryContent");

    if (popup && popupContent) {
        let contentHtml = '';
        entries.forEach(entry => {
            const entryIndex = diaryList.findIndex(item => item.timestamp === entry.timestamp);
            const timeString = new Date(entry.timestamp).toLocaleTimeString('de-DE', {
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            });

            if (entryIndex !== -1) {
                contentHtml += `
                    <div class="diary-entry">
                        <p><strong>Uhrzeit: ${timeString}</strong></p>
                        <p>${entry.content.replace(/\n/g, "<br>")}</p>
                        <button class="delete-button" onclick="deleteDiary(${entryIndex})">Löschen</button>
                    </div>
                `;
            }
        });
        popupContent.innerHTML = contentHtml;
        popup.classList.remove("hidden");
    }
}

/**
 * Hiển thị lịch dựa trên dữ liệu nhật ký đã tải.
 */
function renderCalendar() {
    const calendarDiv = document.getElementById("calendar");
    const diaryContentDiv = document.getElementById("diaryContent");
    calendarDiv.innerHTML = "";
    diaryContentDiv.innerHTML = "";

    const today = new Date();
    today.setHours(0, 0, 0, 0); 
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    let startingDay = firstDayOfMonth.getDay();
    startingDay = (startingDay === 0) ? 6 : startingDay - 1;

    for (let i = 0; i < startingDay; i++) {
        const emptyDiv = document.createElement("div");
        emptyDiv.className = "day disabled";
        calendarDiv.appendChild(emptyDiv);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(year, month, day);
        const dateStr = currentDate.toLocaleDateString("de-DE");
        const entriesForDay = diaryList.filter(e => new Date(e.timestamp).toLocaleDateString("de-DE") === dateStr);
        const hasEntry = entriesForDay.length > 0;
        const dayDiv = document.createElement("div");
        dayDiv.className = 'day';
        dayDiv.textContent = day;

        if (hasEntry) {
            dayDiv.classList.add('has-entry');
            dayDiv.onclick = () => showDiaryEntry(entriesForDay);
        } else if (currentDate > today) {
             dayDiv.classList.add('disabled');
        }
        calendarDiv.appendChild(dayDiv);
    }

    if (diaryList.length === 0) {
        diaryContentDiv.innerHTML = "<p>Keine Tagebucheinträge vorhanden.</p>";
    }
}

/**
 * Chuyển tới tháng trước hoặc tháng sau và tải lại nhật ký.
 */
function changeMonth(offset) {
    currentMonth.setMonth(currentMonth.getMonth() + offset);
    loadDiary();
}

/**
 * NÂNG CẤP: Quản lý trạng thái "bận" của giao diện.
 * Vô hiệu hóa các nút bấm khi đang có thao tác xử lý.
 * @param {boolean} isBusy - True nếu đang bận, false nếu đã xong.
 */
function setUIBusy(isBusy) {
    const buttons = document.querySelectorAll('#writeDiary button');
    buttons.forEach(button => {
        button.disabled = isBusy;
    });
}

/**
 * Hàm khởi tạo khi trang được tải xong.
 */
window.onload = function() {
    showWriteDiary();
};

/*************************************************************************************************/
/********************************** KHU VỰC LOGIC DỮ LIỆU & API **********************************/
/*************************************************************************************************/

// --- Thông tin cấu hình ---
const GITHUB_OWNER = "tranduchai1";
const GITHUB_REPO = "tuvung";
const GITHUB_PATH = "diary.json";
const API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}`;
const SECRET_KEY = 'mysecretkey';
const ENCODED_KEY = 'ChEDOiA1DCJaVioiOzkBURApOBIyLTQwRAsxHCgbClwbO0lDEQQoFg==';
const ENCODED_GEMINI_KEY = 'QxADNwA9DCJaVio5OQNHEDopEhMyLTcBQgwBGgUfDBwPPUlDEQQoFg4DBBspMwMyLw==';

// NÂNG CẤP: Tách câu lệnh prompt ra thành hằng số cho dễ quản lý
const GEMINI_PROMPT_TEMPLATE = (text) => `Kiểm tra ngữ pháp cho văn bản tiếng Đức sau: "${text}". Hãy chỉ ra các lỗi ngữ pháp (nếu có), giải thích lỗi bằng tiếng Việt, đưa ra gợi ý câu viết đúng, và cung cấp 2-3 câu ví dụ đúng bằng tiếng Đức. Trả về ĐÚNG MỘT KHỐI MÃ JSON duy nhất, không có giải thích hay định dạng thừa. Ví dụ định dạng:
{
    "errors": [
        { "error": "Mô tả lỗi", "incorrect": "Câu sai", "suggestion": "Câu đúng", "explanation": "Giải thích", "examples": ["Ví dụ 1", "Ví dụ 2"] }
    ],
    "correctedText": "Văn bản đã sửa"
}`;

let diaryList = [];
let currentMonth = new Date();

// --- Các hàm xử lý dữ liệu ---
function xorDecode(str, key) {
    return Array.from(str)
        .map((char, i) => String.fromCharCode(char.charCodeAt(0) ^ key.charCodeAt(i % key.length)))
        .join('');
}

function loadApiKey() {
    try {
        const decodedBase64 = atob(ENCODED_KEY);
        return xorDecode(decodedBase64, SECRET_KEY);
    } catch (error) {
        console.error('Lỗi giải mã API key GitHub:', error.message);
        return null;
    }
}

function loadGeminiApiKey() {
    try {
        const decodedBase64 = atob(ENCODED_GEMINI_KEY);
        return xorDecode(decodedBase64, SECRET_KEY);
    } catch (error) {
        console.error('Lỗi giải mã API key Gemini:', error.message);
        return null;
    }
}

function encodeBase64(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    return btoa(String.fromCharCode(...data));
}

function decodeBase64(str) {
    try {
        const binary = atob(str);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return new TextDecoder('utf-8').decode(bytes);
    } catch (error) {
        console.error("Lỗi giải mã base64:", error);
        return "";
    }
}

async function loadDiary() {
    const githubToken = loadApiKey();
    const calendarDiv = document.getElementById("calendar");
    const currentMonthSpan = document.getElementById("currentMonth");

    if (!githubToken) {
        calendarDiv.innerHTML = "<p style='color:red;'>GitHub-Token konnte nicht dekodiert werden!</p>";
        return;
    }
    
    calendarDiv.innerHTML = "<p>Kalender wird geladen...</p>";
    currentMonthSpan.textContent = currentMonth.toLocaleString("de-DE", { month: "long", year: "numeric" });
    
    try {
        const response = await fetch(API_URL, {
            cache: "no-cache",
            headers: { "Authorization": `Bearer ${githubToken}`, "Accept": "application/vnd.github.v3+json", "User-Agent": "diary-app" }
        });

        if (response.ok) {
            const data = await response.json();
            const decodedContent = data.content ? decodeBase64(data.content) : '';
            try {
                diaryList = decodedContent ? JSON.parse(decodedContent) : [];
                if (!Array.isArray(diaryList)) diaryList = [];
            } catch (e) {
                diaryList = [];
            }
        } else if (response.status === 404) {
            diaryList = [];
        } else {
            const errorData = await response.json();
            throw new Error(`Lỗi HTTP: ${response.status} - ${errorData.message}`);
        }
        renderCalendar();
    } catch (error) {
        console.error("Lỗi nghiêm trọng khi tải nhật ký (loadDiary):", error);
        calendarDiv.innerHTML = `<p style='color:red;'>Fehler beim Laden des Tagebuchs: ${error.message}</p>`;
    }
}

async function saveDiary() {
    const diaryEntry = document.getElementById("diaryEntry").value;
    const status = document.getElementById("status");
    const githubToken = loadApiKey();

    if (!diaryEntry || !githubToken) {
        status.textContent = !diaryEntry ? "Bitte geben Sie einen Tagebucheintrag ein!" : "GitHub-Token konnte nicht dekodiert werden!";
        return;
    }

    setUIBusy(true); // Vô hiệu hóa UI
    status.textContent = "Tagebuch wird gespeichert...";
    
    try {
        let sha = null;
        let remoteDiaryList = [];
        
        const getResponse = await fetch(API_URL, { headers: { "Authorization": `Bearer ${githubToken}` } });
        if (getResponse.ok) {
            const data = await getResponse.json();
            sha = data.sha;
            try {
                const decodedContent = data.content ? decodeBase64(data.content) : '[]';
                remoteDiaryList = JSON.parse(decodedContent);
                if (!Array.isArray(remoteDiaryList)) remoteDiaryList = [];
            } catch (e) {
                remoteDiaryList = [];
            }
        } else if (getResponse.status !== 404) {
            throw new Error('Không thể lấy phiên bản file hiện tại từ GitHub.');
        }

        const timestamp = new Date().toISOString();
        const date = new Date().toLocaleString("de-DE", { timeZone: "Asia/Ho_Chi_Minh" });
        const newEntry = { timestamp, date, content: diaryEntry };
        remoteDiaryList.push(newEntry);
        const jsonString = JSON.stringify(remoteDiaryList, null, 2);

        const updateResponse = await fetch(API_URL, {
            method: "PUT",
            headers: { "Authorization": `Bearer ${githubToken}`, "Accept": "application/vnd.github.v3+json", "Content-Type": "application/json; charset=utf-8", "User-Agent": "diary-app" },
            body: JSON.stringify({ message: `Update diary.json at ${timestamp}`, content: encodeBase64(jsonString), sha: sha })
        });

        if (!updateResponse.ok) throw await updateResponse.json();

        status.textContent = "Tagebuch erfolgreich gespeichert!";
        document.getElementById("diaryEntry").value = "";
        document.getElementById("grammarResult").innerHTML = "";
        diaryList = remoteDiaryList;
    } catch (error) {
        console.error("Lỗi khi lưu nhật ký:", error);
        status.textContent = `Fehler beim Speichern des Tagebuchs: ${error.message || 'Unknown error'}`;
    } finally {
        setUIBusy(false); // Kích hoạt lại UI
    }
}

async function deleteDiary(index) {
    if (index < 0 || index >= diaryList.length || !confirm("Sind Sie sicher, dass Sie diesen Eintrag löschen möchten?")) {
        return;
    }
    const githubToken = loadApiKey();
    const status = document.getElementById("status");
    if (!githubToken) { status.textContent = "GitHub-Token konnte nicht dekodiert werden!"; return; }

    status.textContent = "Tagebucheintrag wird gelöscht...";
    
    try {
        const getResponse = await fetch(API_URL, { headers: { "Authorization": `Bearer ${githubToken}` } });
        if (!getResponse.ok) throw new Error('Không thể lấy file để xóa.');
        
        const data = await getResponse.json();
        const sha = data.sha;
        let remoteDiaryList = JSON.parse(decodeBase64(data.content));
        remoteDiaryList.splice(index, 1);
        const jsonString = JSON.stringify(remoteDiaryList, null, 2);

        const updateResponse = await fetch(API_URL, {
            method: "PUT",
            headers: { "Authorization": `Bearer ${githubToken}`, "Accept": "application/vnd.github.v3+json", "Content-Type": "application/json; charset=utf-8", "User-Agent": "diary-app" },
            body: JSON.stringify({ message: `Delete diary entry at ${new Date().toISOString()}`, content: encodeBase64(jsonString), sha: sha })
        });

        if (!updateResponse.ok) throw await updateResponse.json();
        status.textContent = "Tagebucheintrag erfolgreich gelöscht!";
        closePopup();
        loadDiary();
    } catch (error) {
        console.error("Lỗi khi xóa nhật ký:", error);
        status.textContent = `Fehler beim Löschen des Tagebuchs: ${error.message || 'Unknown error'}`;
    }
}

async function checkGrammar() {
    const diaryEntry = document.getElementById("diaryEntry").value;
    const grammarResult = document.getElementById("grammarResult");
    const status = document.getElementById("status");
    const geminiApiKey = loadGeminiApiKey();

    if (!diaryEntry || !geminiApiKey) {
        status.textContent = !diaryEntry ? "Bitte geben Sie einen Tagebucheintrag ein!" : "Không thể tải API key của Gemini.";
        return;
    }

    setUIBusy(true); // Vô hiệu hóa UI
    status.textContent = "Grammatik wird überprüft...";
    grammarResult.innerHTML = "";

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: GEMINI_PROMPT_TEMPLATE(diaryEntry) }]
                }]
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("Lỗi HTTP từ Gemini API:", errorBody);
            throw new Error(`Lỗi HTTP! Status: ${response.status}`);
        }

        const data = await response.json();
        if (!data.candidates || data.candidates.length === 0) {
            throw new Error("API không trả về kết quả nào.");
        }
        
        const rawTextFromApi = data.candidates[0].content.parts[0].text;
        const jsonMatch = rawTextFromApi.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
            grammarResult.innerHTML = `<p><strong>Gợi ý từ AI:</strong><br>${rawTextFromApi.replace(/\n/g, '<br>')}</p>`;
        } else {
            const jsonString = jsonMatch[0];
            const result = JSON.parse(jsonString);
            if (!result.errors || result.errors.length === 0) {
                grammarResult.innerHTML = `<p style='color: #2e7d32;'>Keine Grammatikfehler gefunden!</p><p><strong>Văn bản đúng:</strong> ${result.correctedText}</p>`;
            } else {
                result.errors.forEach(err => {
                    grammarResult.innerHTML += `
                        <div>
                            <p><strong>Lỗi:</strong> ${err.error}</p>
                            <p><span class="error-text">${err.incorrect}</span> → <span class="suggestion-text">${err.suggestion}</span></p>
                            <p><strong>Giải thích:</strong> ${err.explanation}</p>
                            <p><strong>Ví dụ đúng:</strong></p>
                            <ul>${err.examples.map(example => `<li>${example}</li>`).join('')}</ul>
                        </div><hr>`;
                });
                grammarResult.innerHTML += `<p><strong>Văn bản đã sửa:</strong> ${result.correctedText}</p>`;
            }
        }
        status.textContent = "Grammatikprüfung abgeschlossen!";
    } catch (error) {
        console.error("Lỗi khi kiểm tra ngữ pháp:", error);
        status.textContent = `Fehler bei der Grammatikprüfung: ${error.message}`;
        grammarResult.innerHTML = `<p style='color:red;'>Lỗi khi kết nối hoặc xử lý phản hồi từ API. Vui lòng kiểm tra lại API Key và thử lại.</p>`;
    } finally {
        setUIBusy(false); // Kích hoạt lại UI
    }
}
