document.addEventListener('DOMContentLoaded', () => {
  // --- Local Database Structure ---
  const DEFAULT_DB = {
    userSettings: {
      authorName: "著者",
      geminiApiKey: "",
      activePersona: "normal"
    },
    stats: {
      totalXp: 0,
      level: 1,
      streakDays: 0,
      lastWritingDate: "",
      totalWordsWritten: 0
    },
    habitLogs: {},
    drills: {
      lastDrillDate: "",
      completedToday: false,
      currentDrill: null,
      history: []
    },
    notes: [],
    chatSessions: [
      {
        id: "default",
        title: "プロットの壁打ち",
        messages: [
          {
            sender: "editor",
            text: "執筆お疲れ様です！専属編集者のAIです。今日はどんなキャラクターやシーンについてブレストしますか？何でも聞かせてください！",
            timestamp: new Date().toISOString()
          }
        ]
      }
    ]
  };

  let db = null;

  // Initialize and load database from LocalStorage
  function loadDatabase() {
    const data = localStorage.getItem('novel_editor_db');
    if (data) {
      try {
        db = JSON.parse(data);
        // Ensure default structures are present if updated
        if (!db.drills) db.drills = DEFAULT_DB.drills;
        if (!db.notes) db.notes = DEFAULT_DB.notes;
        if (!db.chatSessions) db.chatSessions = DEFAULT_DB.chatSessions;
      } catch (e) {
        console.error('Failed to parse database, resetting to default', e);
        db = JSON.parse(JSON.stringify(DEFAULT_DB));
      }
    } else {
      db = JSON.parse(JSON.stringify(DEFAULT_DB));
      saveDatabase();
    }
  }

  function saveDatabase() {
    localStorage.setItem('novel_editor_db', JSON.stringify(db));
  }

  // --- UI Elements ---
  const menuItems = document.querySelectorAll('.menu-item');
  const panels = document.querySelectorAll('.content-panel');
  
  // Sidebar widgets
  const authorNameEl = document.getElementById('sidebar-author-name');
  const levelEl = document.getElementById('sidebar-level');
  const xpFillEl = document.getElementById('sidebar-xp-fill');
  const xpTextEl = document.getElementById('sidebar-xp-text');
  const streakCountEl = document.getElementById('sidebar-streak-count');
  
  // Dashboard panel elements
  const dashStreakNumber = document.getElementById('dash-streak-number');
  const quickWordCountInput = document.getElementById('quick-word-count');
  const btnLogWords = document.getElementById('btn-log-words');
  const statTotalWords = document.getElementById('stat-total-words');
  const statTotalNotes = document.getElementById('stat-total-notes');
  const calendarContainer = document.getElementById('calendar-days-container');
  
  // Drill elements
  const drillTypeEl = document.getElementById('drill-type');
  const drillTitleEl = document.getElementById('drill-title');
  const drillPromptEl = document.getElementById('drill-prompt');
  const drillInputContainer = document.getElementById('drill-input-container');
  const drillResponseText = document.getElementById('drill-response-text');
  const btnSubmitDrill = document.getElementById('btn-submit-drill');
  const drillFeedbackContainer = document.getElementById('drill-feedback-container');
  const drillFeedbackText = document.getElementById('drill-feedback-text');
  const btnNextDrill = document.getElementById('btn-next-drill');
  
  // Notebook panel elements
  const templateSelect = document.getElementById('template-select');
  const characterForm = document.getElementById('character-template-form');
  const worldForm = document.getElementById('world-template-form');
  const plotForm = document.getElementById('plot-template-form');
  const btnPreviewNote = document.getElementById('btn-preview-note');
  const btnSyncNote = document.getElementById('btn-sync-note');
  const notePreviewArea = document.getElementById('note-preview-area');
  const syncNotesList = document.getElementById('sync-notes-list');
  
  // Chat panel elements
  const chatPersonaSelect = document.getElementById('chat-persona-select');
  const customPersonaConfig = document.getElementById('custom-persona-config');
  const customPersonaPrompt = document.getElementById('custom-persona-prompt');
  const chatMessagesContainer = document.getElementById('chat-messages-container');
  const chatUserMessage = document.getElementById('chat-user-message');
  const btnSendMessage = document.getElementById('btn-send-message');
  
  // Editor panel elements
  const manuscriptInput = document.getElementById('manuscript-input');
  const editorCharCount = document.getElementById('editor-char-count');
  const btnClearManuscript = document.getElementById('btn-clear-manuscript');
  const btnAnalyzeManuscript = document.getElementById('btn-analyze-manuscript');
  const analysisOutputContainer = document.getElementById('analysis-output-container');
  
  // Settings elements
  const settingsAuthorName = document.getElementById('settings-author-name');
  const settingsGeminiKey = document.getElementById('settings-gemini-key');
  const btnSaveSettings = document.getElementById('btn-save-settings');

  // --- Initialize App ---
  function init() {
    loadDatabase();
    setupNavigation();
    setupNotebookTemplates();
    setupChatPanel();
    setupEditorPanel();
    setupDrills();
    setupHabitActions();
    setupSettingsPanel();
    
    // Sync UI with DB
    updateUI();
    fetchTodayDrill();
  }

  // Update UI components based on database state
  function updateUI() {
    if (!db) return;

    // Sidebar Widgets
    const authorName = db.userSettings?.authorName || '著者';
    authorNameEl.textContent = authorName;
    levelEl.textContent = `Lv. ${db.stats.level || 1}`;
    
    const xp = db.stats.totalXp || 0;
    const nextLevelXp = 200;
    const currentXpInLevel = xp % nextLevelXp;
    const fillPercent = (currentXpInLevel / nextLevelXp) * 100;
    xpFillEl.style.width = `${fillPercent}%`;
    xpTextEl.textContent = `${currentXpInLevel} / ${nextLevelXp} XP`;
    
    const streak = db.stats.streakDays || 0;
    streakCountEl.textContent = `${streak} 日連続`;
    
    // Dashboard Stats
    dashStreakNumber.textContent = streak;
    statTotalWords.textContent = db.stats.totalWordsWritten || 0;
    statTotalNotes.textContent = db.notes?.length || 0;

    // Settings Panel Values
    settingsAuthorName.value = db.userSettings.authorName || '';
    settingsGeminiKey.value = db.userSettings.geminiApiKey || '';
    const backupCodeEl = document.getElementById('settings-backup-code');
    if (backupCodeEl) {
      backupCodeEl.value = JSON.stringify(db);
    }

    // Render components
    renderCalendar();
    renderSyncedNotesList();
  }

  // Render last 7 days habit completion calendar
  function renderCalendar() {
    calendarContainer.innerHTML = '';
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() - i);
      const dateStr = targetDate.toISOString().split('T')[0];
      
      const log = db.habitLogs[dateStr];
      const hasWritten = log && log.words > 0;
      const formattedDate = `${targetDate.getMonth() + 1}/${targetDate.getDate()}`;
      
      const dayBox = document.createElement('div');
      dayBox.className = `calendar-day-box ${hasWritten ? 'completed' : ''}`;
      
      dayBox.innerHTML = `
        <span class="cal-date">${formattedDate}</span>
        <span class="cal-status">${hasWritten ? '✍️' : '⚪'}</span>
      `;
      calendarContainer.appendChild(dayBox);
    }
  }

  // Synchronized markdown note list history renderer
  function renderSyncedNotesList() {
    syncNotesList.innerHTML = '';
    if (!db.notes || db.notes.length === 0) {
      syncNotesList.innerHTML = '<li class="empty-sync-msg">まだダウンロードされた設定はありません。</li>';
      return;
    }

    // Sort by syncDate descending
    const sortedNotes = [...db.notes].sort((a, b) => new Date(b.syncDate) - new Date(a.syncDate));
    
    sortedNotes.slice(0, 5).forEach(note => {
      const li = document.createElement('li');
      const formattedDate = new Date(note.syncDate).toLocaleDateString('ja-JP', { hour: '2-digit', minute: '2-digit' });
      
      let categoryEmoji = '📝';
      if (note.category === 'character') categoryEmoji = '👥';
      if (note.category === 'world') categoryEmoji = '🗺️';
      if (note.category === 'plot') categoryEmoji = '🎬';

      li.innerHTML = `
        <span>${categoryEmoji} <b>${note.title}</b></span>
        <span class="sync-date">${formattedDate} 保存</span>
      `;
      syncNotesList.appendChild(li);
    });
  }

  // --- SPA Navigation ---
  function setupNavigation() {
    menuItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Remove active class
        menuItems.forEach(m => m.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));
        
        // Add active class to target
        item.classList.add('active');
        const targetId = item.getAttribute('data-target');
        document.getElementById(targetId).classList.add('active');

        // Scroll to top
        document.querySelector('.main-content').scrollTop = 0;
      });
    });
  }

  // Add experience points and manage levels
  function addExperiencePoints(xpGained) {
    db.stats.totalXp += xpGained;
    const oldLevel = db.stats.level;
    db.stats.level = Math.floor(db.stats.totalXp / 200) + 1;
    const leveledUp = db.stats.level > oldLevel;
    saveDatabase();
    updateUI();
    return { leveledUp, level: db.stats.level };
  }

  // Manage writing streaks
  function handleStreakUpdate(todayStr) {
    const lastWrite = db.stats.lastWritingDate;
    if (lastWrite && lastWrite !== todayStr) {
      const lastDate = new Date(lastWrite);
      const today = new Date(todayStr);
      const diffTime = Math.abs(today - lastDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        db.stats.streakDays += 1;
      } else if (diffDays > 1) {
        db.stats.streakDays = 1; // Reset to 1 if a day was skipped
      }
    } else if (!lastWrite) {
      db.stats.streakDays = 1;
    }
    db.stats.lastWritingDate = todayStr;
    saveDatabase();
    updateUI();
  }

  // --- Habit Tracker Logs word counts ---
  function setupHabitActions() {
    btnLogWords.addEventListener('click', () => {
      const words = parseInt(quickWordCountInput.value);
      if (isNaN(words) || words <= 0) {
        alert('正しい文字数を入力してください。');
        return;
      }

      const todayStr = new Date().toISOString().split('T')[0];

      db.stats.totalWordsWritten += words;
      
      // Update habit log entry
      if (!db.habitLogs[todayStr]) {
        db.habitLogs[todayStr] = { words: 0, completedDrill: false, xpGained: 0 };
      }
      db.habitLogs[todayStr].words += words;
      db.habitLogs[todayStr].xpGained += 10;

      handleStreakUpdate(todayStr);
      const lvUpInfo = addExperiencePoints(10); // +10 XP for quick logging

      quickWordCountInput.value = '';
      alert(`素晴らしい！今日の進捗に「${words}文字」を追加しました！ (+10 XP)`);
      
      if (lvUpInfo.leveledUp) {
        alert(`🎉 レベルアップしました！現在のレベル: Lv. ${lvUpInfo.level}`);
      }
    });
  }

  // --- Gemini API Call Broker (Direct from Browser!) ---
  async function callGemini(prompt, systemInstruction = '') {
    const apiKey = db.userSettings?.geminiApiKey;
    if (!apiKey) {
      throw new Error('API_KEY_MISSING');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: systemInstruction ? `${systemInstruction}\n\nUser Input:\n${prompt}` : prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.7,
        }
      })
    });

    const result = await response.json();
    if (result.candidates && result.candidates[0]?.content?.parts[0]?.text) {
      return result.candidates[0].content.parts[0].text;
    } else {
      throw new Error(JSON.stringify(result));
    }
  }

  // --- Daily Drill Section ---
  async function fetchTodayDrill() {
    if (!db) return;
    const todayStr = new Date().toISOString().split('T')[0];

    // If already generated or completed today, load it
    if (db.drills.lastDrillDate === todayStr && db.drills.currentDrill) {
      renderDrill(db.drills.currentDrill, db.drills.completedToday);
      return;
    }

    // Set temporary load state
    drillTypeEl.textContent = '読込中...';
    drillTitleEl.textContent = '今日のお題を生成中...';
    drillPromptEl.textContent = '専属編集者が今日のエクササイズを設計しています。';

    let drill = null;

    try {
      const systemPrompt = `あなたは小説執筆のプロコーチです。小説初心者向けの「5分で書ける超短編ライティングドリル（お題）」を1つ作成してください。
テーマは日替わりで、描写力向上、対話力向上、アイデア発想法、文章リズム改善などからランダムに設定してください。
必ず以下のJSON形式でのみ出力してください。余計なテキストやマークダウンのデコレーションは含めないでください。

JSON形式:
{
  "title": "ドリルのタイトル（例：情景描写編：色を使わない「夕焼け」）",
  "prompt": "具体的でワクワクするお題の指示と例文（例：『赤い』『オレンジ』などの色名を使わずに、夕焼けを見た主人公の心理を織り交ぜた3文の情景描写を書いてみましょう。）",
  "type": "テーマ（例：表現力ドリル）",
  "wordLimit": 150
}`;

      const rawResult = await callGemini("今日のドリルを作成してください", systemPrompt);
      const cleanJson = rawResult.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      drill = JSON.parse(cleanJson);
    } catch (err) {
      console.log('Using simulated drill:', err.message);
      const mockDrills = [
        {
          title: "隠喩ドリル：『焦り』を表現する",
          prompt: "「焦る」「パニック」という直接的な言葉を使わずに、キャラクターが内心極限まで焦っている様子を、周囲の「物」や「身体反応（手の動き、呼吸など）」だけで3文以内で表現してください。",
          type: "表現力ドリル",
          wordLimit: 150
        },
        {
          title: "キャラクター対話劇：隠された本音",
          prompt: "「ありがとう」と言いたいのに、素直になれずに全く別の冷たい態度を取ってしまうキャラクターと、その真意に気づかない主人公の会話を、動作描写を含めて4セリフ以内で書いてください。",
          type: "キャラクター対話",
          wordLimit: 200
        },
        {
          title: "フックのある一行目：最初の1文",
          prompt: "読者が「えっ、どういうこと？」と思わず次の行を読みたくなるような、強烈で意外性のある「小説の最初の一行（オープニング文）」を1文だけ作成してください。",
          type: "アイデアドリル",
          wordLimit: 50
        }
      ];
      drill = mockDrills[Math.floor(Math.random() * mockDrills.length)];
    }

    db.drills.lastDrillDate = todayStr;
    db.drills.completedToday = false;
    db.drills.currentDrill = drill;
    saveDatabase();

    renderDrill(drill, false);
  }

  function renderDrill(drill, completed) {
    drillTypeEl.textContent = drill.type || '創作トレーニング';
    drillTitleEl.textContent = drill.title || '今日のお題';
    drillPromptEl.textContent = drill.prompt || '';
    
    if (completed) {
      const historyLog = db.drills.history.find(h => h.date === db.drills.lastDrillDate);
      showDrillFeedback(historyLog?.feedback || '本日クリア済み！素晴らしい！');
    } else {
      resetDrillInput();
    }
  }

  function setupDrills() {
    btnSubmitDrill.addEventListener('click', async () => {
      const answerText = drillResponseText.value.trim();
      if (!answerText) {
        alert('回答を入力してください！');
        return;
      }

      btnSubmitDrill.textContent = '編集者による分析中... 🖋️';
      btnSubmitDrill.disabled = true;

      let reviewText = "";

      try {
        const systemPrompt = `あなたは小説執筆コーチです。初心者が取り組んだドリル「お題：${db.drills.currentDrill?.prompt}」に対する回答「${answerText}」を読み、温かく、かつプロの視点から良かった部分と、さらに良くなるアドバイスを2〜3文でフィードバックしてください。否定的な表現は一切使わず、モチベーションを極限まで高める言葉をかけてください。`;
        reviewText = await callGemini(answerText, systemPrompt);
      } catch (err) {
        reviewText = `素晴らしいですね！お題に対して的確に応えているだけでなく、言葉選びのセンスがキラリと光っています。特に「${answerText.substring(0, Math.min(25, answerText.length))}...」の部分の表現に瑞々しさがあり、その場の空気感がしっかりと想像できました。この表現の引き出しをぜひご自身の小説にも活かしてください！`;
      }

      const todayStr = new Date().toISOString().split('T')[0];

      db.drills.completedToday = true;
      db.drills.history.push({
        date: todayStr,
        drillTitle: db.drills.currentDrill?.title,
        userText: answerText,
        feedback: reviewText,
        xpGained: 50
      });

      // Daily habit status log
      if (!db.habitLogs[todayStr]) {
        db.habitLogs[todayStr] = { words: 0, completedDrill: true, xpGained: 0 };
      }
      db.habitLogs[todayStr].completedDrill = true;
      db.habitLogs[todayStr].words += answerText.length;
      db.habitLogs[todayStr].xpGained += 50;
      db.stats.totalWordsWritten += answerText.length;

      handleStreakUpdate(todayStr);
      const lvUpInfo = addExperiencePoints(50); // +50 XP for daily drill

      showDrillFeedback(reviewText);

      if (lvUpInfo.leveledUp) {
        alert(`🎉 レベルアップしました！現在のレベル: Lv. ${lvUpInfo.level}`);
      }
    });

    btnNextDrill.addEventListener('click', () => {
      // Allow regenerating to test multiple times (for beginner play)
      db.drills.lastDrillDate = "";
      fetchTodayDrill();
    });
  }

  function showDrillFeedback(feedbackText) {
    drillInputContainer.classList.add('hidden');
    drillFeedbackContainer.classList.remove('hidden');
    drillFeedbackText.textContent = feedbackText;
  }

  function resetDrillInput() {
    drillInputContainer.classList.remove('hidden');
    drillFeedbackContainer.classList.add('hidden');
    drillResponseText.value = '';
    btnSubmitDrill.textContent = '回答を提出する (+50 XP)';
    btnSubmitDrill.disabled = false;
  }

  // --- NotebookLM Markdown note generator ---
  function setupNotebookTemplates() {
    templateSelect.addEventListener('change', () => {
      const value = templateSelect.value;
      characterForm.classList.add('hidden');
      worldForm.classList.add('hidden');
      plotForm.classList.add('hidden');

      if (value === 'character') characterForm.classList.remove('hidden');
      if (value === 'world') worldForm.classList.remove('hidden');
      if (value === 'plot') plotForm.classList.remove('hidden');
    });

    btnPreviewNote.addEventListener('click', () => {
      const { title, markdown } = generateNoteMarkdown();
      notePreviewArea.textContent = markdown || 'プレビューを表示するにはフォームに入力してください。';
    });

    btnSyncNote.addEventListener('click', () => {
      const { title, markdown, category } = generateNoteMarkdown();
      if (!title || !markdown) {
        alert('タイトルと必要な項目を入力してください。');
        return;
      }

      // 1. Download file directly as local sync method
      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `${title}.md`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // 2. Add to Local Notes Database List
      const newNote = {
        id: Date.now().toString(),
        title: title,
        category: category || 'note',
        syncDate: new Date().toISOString()
      };
      
      db.notes.push(newNote);
      saveDatabase();
      updateUI();

      alert(`設定ノート「${title}.md」をダウンロードしました！\nNotebookLMのソース画面にドラッグ＆ドロップして資料登録してください。`);
      
      // Clear inputs
      clearNoteInputs();
      notePreviewArea.textContent = '保存完了！新しい設定ファイルを作成しましょう。';
    });
  }

  function generateNoteMarkdown() {
    const category = templateSelect.value;
    let title = '';
    let markdown = '';

    if (category === 'character') {
      const name = document.getElementById('char-name').value.trim();
      const role = document.getElementById('char-role').value.trim();
      const traits = document.getElementById('char-traits').value.trim();
      const motivation = document.getElementById('char-motivation').value.trim();

      if (!name) return {};
      title = `${name}_キャラクター設定`;
      markdown = `# キャラクター設定シート: ${name}

## 📊 基本属性
* **名前/ルビ**: ${name}
* **物語の役割**: ${role || '未定'}

## 👥 性格・特徴・外観
${traits || '未記載'}

## 🎯 目的・モチベーション（葛藤）
${motivation || '未記載'}

---
*Generated by Novel Editor Partner - ${new Date().toLocaleDateString('ja-JP')}*`;
    } 
    
    else if (category === 'world') {
      const name = document.getElementById('world-name').value.trim();
      const overview = document.getElementById('world-overview').value.trim();
      const rules = document.getElementById('world-rules').value.trim();

      if (!name) return {};
      title = `${name}_設定資料`;
      markdown = `# 世界観設定シート: ${name}

## 🗺️ 基本概要
${overview || '未記載'}

## ⚖️ ルール・制約・詳細設定
${rules || '未記載'}

---
*Generated by Novel Editor Partner - ${new Date().toLocaleDateString('ja-JP')}*`;
    } 
    
    else if (category === 'plot') {
      const plotTitle = document.getElementById('plot-title').value.trim();
      const ki = document.getElementById('plot-ki').value.trim();
      const sho = document.getElementById('plot-sho').value.trim();
      const ten = document.getElementById('plot-ten').value.trim();
      const ketsu = document.getElementById('plot-ketsu').value.trim();

      if (!plotTitle) return {};
      title = `${plotTitle}_プロット構成`;
      markdown = `# 起承転結プロット構成: ${plotTitle}

## 🚀 【起】日常と事件の始まり
${ki || '未記載'}

## 📉 【承】試練と葛藤
${sho || '未記載'}

## 💥 【転】最大の危機と決意
${ten || '未記載'}

## 🏁 【結】結末と新たな課題
${ketsu || '未記載'}

---
*Generated by Novel Editor Partner - ${new Date().toLocaleDateString('ja-JP')}*`;
    }

    return { title, markdown, category };
  }

  function clearNoteInputs() {
    // Character inputs
    document.getElementById('char-name').value = '';
    document.getElementById('char-role').value = '';
    document.getElementById('char-traits').value = '';
    document.getElementById('char-motivation').value = '';

    // World inputs
    document.getElementById('world-name').value = '';
    document.getElementById('world-overview').value = '';
    document.getElementById('world-rules').value = '';

    // Plot inputs
    document.getElementById('plot-title').value = '';
    document.getElementById('plot-ki').value = '';
    document.getElementById('plot-sho').value = '';
    document.getElementById('plot-ten').value = '';
    document.getElementById('plot-ketsu').value = '';
  }

  // --- Plot Chat Panel Handler ---
  function setupChatPanel() {
    // Show custom persona config if custom selected
    chatPersonaSelect.addEventListener('change', () => {
      if (chatPersonaSelect.value === 'custom') {
        customPersonaConfig.classList.remove('hidden');
      } else {
        customPersonaConfig.classList.add('hidden');
      }
    });

    btnSendMessage.addEventListener('click', sendChatMessage);
    chatUserMessage.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendChatMessage();
      }
    });

    // Populate initial chat bubbles
    renderChatMessages();
  }

  function renderChatMessages() {
    chatMessagesContainer.innerHTML = '';
    const defaultSession = db.chatSessions.find(s => s.id === 'default');
    if (!defaultSession) return;

    defaultSession.messages.forEach(msg => {
      appendChatBubble(msg.sender, msg.text);
    });
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
  }

  function appendChatBubble(sender, text) {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${sender === 'user' ? 'user' : 'editor'}`;
    bubble.textContent = text;
    chatMessagesContainer.appendChild(bubble);
  }

  async function sendChatMessage() {
    const text = chatUserMessage.value.trim();
    if (!text) return;

    appendChatBubble('user', text);
    chatUserMessage.value = '';
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;

    // Append to local DB messages list
    const defaultSession = db.chatSessions.find(s => s.id === 'default');
    defaultSession.messages.push({
      sender: 'user',
      text: text,
      timestamp: new Date().toISOString()
    });
    saveDatabase();

    // Show typing status indicator
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'chat-bubble editor';
    typingIndicator.textContent = '編集者がアドバイスを検討中... 🖋️';
    chatMessagesContainer.appendChild(typingIndicator);
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;

    let selectedPersona = chatPersonaSelect.value;
    let personaPrompt = '';

    if (selectedPersona === 'normal') {
      personaPrompt = '親しみやすく論理的で、ユーザーの書くものを丁寧に導くプロの文芸編集者。';
    } else if (selectedPersona === 'supportive') {
      personaPrompt = '作家を肯定的に褒めちぎり、とにかく執筆への情熱を燃え上がらせてモチベーションを高める情熱的な応援型コーチ。';
    } else if (selectedPersona === 'logical') {
      personaPrompt = '物語のロジカルな破綻、キャラクターの感情の矛盾点、プロットの整合性をしっかりと検証し、建設的なツッコミを入れてくれる客観的な物語構造アナリスト。';
    } else if (selectedPersona === 'custom') {
      personaPrompt = customPersonaPrompt.value.trim() || 'ユーザーのお気に入りキャラクターの性格・口調';
    }

    let replyText = '';

    try {
      const historyLogs = defaultSession.messages.slice(-6).map(m => `${m.sender === 'user' ? '作家（ユーザー）' : 'あなた（編集者）'}: ${m.text}`).join('\n');
      
      const systemInstruction = `あなたはプロの小説編集者です。初心者の作家であるユーザーの相談相手（壁打ちパートナー）となり、親身かつ肯定的に寄り添いつつ、物語を深めるための具体的で面白い提案をしてください。
現在のあなたの特徴・口調・ペルソナ:
${personaPrompt}

これまでの会話ログ:
${historyLogs}

上記の会話を踏まえ、ユーザーの最新の相談に返答してください。
返答は、あなたのペルソナの口調を徹底し、ユーザーを応援しつつ、次のステップに向けた具体的な質問やアイデアのきっかけを1〜2個投げかける構成にしてください。`;

      replyText = await callGemini(text, systemInstruction);
    } catch (err) {
      console.log('Using simulated offline responder:', err.message);
      const offlineResponses = [
        `なるほど！それは魅力的な切り口ですね。その設定があることで、主人公の行動に説得力が増しそうです。ところで、そのアイデアをさらに膨らませるために、もう一つお聞きしたいのですが、その出来事が起きた時、周囲の人物はどういう反応をするでしょうか？`,
        `面白いですね！ストーリーの転換点（ミッドポイント）として素晴らしい緊張感が生まれそうです。この展開の中で、主人公が失うもの、あるいは新しく得る覚悟は何でしょうか？`,
        `そのプロット、とてもワクワクします！そのアイディアを読者に最も効果的に伝えるために、あらかじめ伏線として「どんな小さな出来事」を前半に仕込んでおくと面白いと思いますか？`,
        `キャラクターの掘り下げがとても素敵です！そのキャラクターの「一見矛盾するような意外な一面（ギャップ）」をひとつ加えるとしたら、どんな欠点や弱点を持たせると愛らしさが増すでしょうか？`
      ];
      replyText = offlineResponses[Math.floor(Math.random() * offlineResponses.length)];
    }

    // Remove typing status
    typingIndicator.remove();
    appendChatBubble('editor', replyText);
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;

    // Save reply to database
    defaultSession.messages.push({
      sender: 'editor',
      text: replyText,
      timestamp: new Date().toISOString()
    });
    saveDatabase();
    updateUI();
  }

  // --- Proofreader / Editor Panel Handler ---
  function setupEditorPanel() {
    manuscriptInput.addEventListener('input', () => {
      const count = manuscriptInput.value.length;
      editorCharCount.textContent = count;
    });

    btnClearManuscript.addEventListener('click', () => {
      manuscriptInput.value = '';
      editorCharCount.textContent = '0';
      resetAnalysisOutput();
    });

    btnAnalyzeManuscript.addEventListener('click', async () => {
      const text = manuscriptInput.value.trim();
      if (!text) {
        alert('原稿テキストを入力してください！');
        return;
      }

      analysisOutputContainer.innerHTML = `
        <div class="analysis-placeholder">
          <span class="placeholder-icon">🖋️</span>
          <p>編集者が原稿を精読（添削を実行）しています。少々お待ちください...</p>
        </div>
      `;

      btnAnalyzeManuscript.textContent = '添削中...';
      btnAnalyzeManuscript.disabled = true;

      let resultJson = null;

      try {
        const systemPrompt = `あなたは優秀な文芸誌の編集者です。以下の小説の本文を分析し、誤字脱字、表現・リズムの改善、総合的な創作アドバイスを提供してください。
必ず以下のJSON形式でのみ出力してください。他の挨拶やMarkdownマークアップ等は一切含めないでください。

JSONの形式:
{
  "grammar": [
    {"target": "誤字脱字・不自然な文法表現の文字列", "suggestion": "修正案", "reason": "理由説明"}
  ],
  "style": [
    {"target": "単調な文章、リズムが悪い元の部分", "suggestion": "洗練された文章への代替案", "reason": "テンポや情緒がどう良くなるかの説明"}
  ],
  "feedback": "構成、感情描写、演出に関する具体的で優しいプロからの講評（150文字程度）"
}`;

        const rawResult = await callGemini(text, systemPrompt);
        const cleanJson = rawResult.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
        resultJson = JSON.parse(cleanJson);
      } catch (err) {
        console.log('Using simulated analysis:', err.message);
        resultJson = {
          grammar: [
            {
              target: "彼は驚いて目を見開いたが、しかし声はでなかった。",
              suggestion: "彼は驚いて目を見開いたが、しかし声は出なかった。",
              reason: "「でなかった」は一般的に漢字で「出なかった」と表記すると、文章全体が引き締まります。"
            }
          ],
          style: [
            {
              target: "雨が激しく降っていた。彼は走った。息が苦しかった。",
              suggestion: "激しい雨を衝き、彼は走った。肺が焼けるように苦しい。",
              reason: "短い文が連続してやや単調なリズムになっています。動詞の繋ぎ方や比喩表現を使うことで、必死な緊迫感をさらに強調できます。"
            }
          ],
          feedback: "素晴らしい執筆のスタートです！主人公の焦燥感が非常によく伝わってきます。情景描写（雨）を主人公の心理状態とシンクロさせて描くと、より情緒あふれるシーンになりそうです。この調子でどんどん進めていきましょう！"
        };
      }

      renderAnalysisResult(resultJson);
      
      btnAnalyzeManuscript.textContent = '編集者添削を実行する 🔍';
      btnAnalyzeManuscript.disabled = false;
    });
  }

  function resetAnalysisOutput() {
    analysisOutputContainer.innerHTML = `
      <div class="analysis-placeholder">
        <span class="placeholder-icon">📖</span>
        <p>左側のエディタに原稿を入力し、「編集者添削を実行する」ボタンを押すと、誤字・文体の改善提案、総合アドバイスがここにカード表示されます。</p>
      </div>
    `;
  }

  function renderAnalysisResult(result) {
    analysisOutputContainer.innerHTML = '';

    // 1. General Editorial Feedback Card
    if (result.feedback) {
      const card = document.createElement('div');
      card.className = 'feedback-card-group general';
      card.innerHTML = `
        <h4>📝 編集者からの講評・アドバイス</h4>
        <div class="general-feedback-text">${result.feedback}</div>
      `;
      analysisOutputContainer.appendChild(card);
    }

    // 2. Grammar Corrections
    if (result.grammar && result.grammar.length > 0) {
      const group = document.createElement('div');
      group.className = 'feedback-card-group grammar';
      group.innerHTML = '<h4>🚨 誤字脱字・不自然な表現</h4>';
      
      result.grammar.forEach(item => {
        const div = document.createElement('div');
        div.className = 'feedback-item';
        div.innerHTML = `
          <div><span class="feedback-target">${escapeHtml(item.target)}</span></div>
          <div><span class="feedback-suggestion">👉 ${escapeHtml(item.suggestion)}</span></div>
          <div class="feedback-reason">💬 <b>解説:</b> ${escapeHtml(item.reason)}</div>
        `;
        group.appendChild(div);
      });
      analysisOutputContainer.appendChild(group);
    }

    // 3. Style Improvements
    if (result.style && result.style.length > 0) {
      const group = document.createElement('div');
      group.className = 'feedback-card-group style';
      group.innerHTML = '<h4>💡 文体・表現の改善提案</h4>';
      
      result.style.forEach(item => {
        const div = document.createElement('div');
        div.className = 'feedback-item';
        div.innerHTML = `
          <div><span class="feedback-target">${escapeHtml(item.target)}</span></div>
          <div><span class="feedback-suggestion">👉 ${escapeHtml(item.suggestion)}</span></div>
          <div class="feedback-reason">💬 <b>解説:</b> ${escapeHtml(item.reason)}</div>
        `;
        group.appendChild(div);
      });
      analysisOutputContainer.appendChild(group);
    }

    // Fallback if everything clear
    if ((!result.grammar || result.grammar.length === 0) && (!result.style || result.style.length === 0)) {
      const successDiv = document.createElement('div');
      successDiv.className = 'feedback-card-group general';
      successDiv.innerHTML = `
        <h4>✨ 完璧な文章です！</h4>
        <div class="general-feedback-text">
          誤字脱字や単調なリズム表現は見つかりませんでした。文法的に極めてクリアで、このまま安心して続きを書き進めていただけます！
        </div>
      `;
      analysisOutputContainer.appendChild(successDiv);
    }
  }

  function escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // --- Settings Panel Handler ---
  function setupSettingsPanel() {
    btnSaveSettings.addEventListener('click', () => {
      const authorName = settingsAuthorName.value.trim();
      const geminiKey = settingsGeminiKey.value.trim();

      if (!authorName) {
        alert('著者名（ペンネーム）を入力してください。');
        return;
      }

      db.userSettings.authorName = authorName;
      db.userSettings.geminiApiKey = geminiKey;
      
      saveDatabase();
      updateUI();
      
      alert('システム設定を保存しました！');
      
      // Instantly refresh today drill if Gemini key was added to let them fetch a real AI drill
      fetchTodayDrill();
    });

    const btnExportData = document.getElementById('btn-export-data');
    const btnImportData = document.getElementById('btn-import-data');
    const backupCodeEl = document.getElementById('settings-backup-code');

    if (btnExportData && backupCodeEl) {
      btnExportData.addEventListener('click', () => {
        const code = JSON.stringify(db);
        backupCodeEl.value = code;
        
        navigator.clipboard.writeText(code)
          .then(() => {
            alert('同期コードを生成し、クリップボードにコピーしました！\n移行先の端末（スマホなど）の設定画面で「貼り付け」して同期してください。');
          })
          .catch(err => {
            console.error('Failed to copy', err);
            alert('クリップボードへのコピーに失敗しました。表示されたテキストをすべて手動でコピーしてください。');
          });
      });
    }

    if (btnImportData && backupCodeEl) {
      btnImportData.addEventListener('click', () => {
        const code = backupCodeEl.value.trim();
        if (!code) {
          alert('同期コードを入力欄に貼り付けてください。');
          return;
        }

        try {
          const parsed = JSON.parse(code);
          if (!parsed.stats || !parsed.userSettings) {
            alert('無効なデータ形式です。正しい同期コードを貼り付けてください。');
            return;
          }

          if (confirm('データを上書きして同期しますか？（インポート元の進捗や設定が反映され、現在の端末のデータは上書きされます）')) {
            db = parsed;
            saveDatabase();
            updateUI();
            alert('データを正常に読み込み、同期しました！');
          }
        } catch (e) {
          console.error(e);
          alert('同期コードの解析に失敗しました。コピーしたデータが完全に貼り付けられているか確認してください。');
        }
      });
    }
  }

  // --- Run Initialization ---
  init();
});
