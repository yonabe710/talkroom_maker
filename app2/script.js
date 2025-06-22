document.addEventListener("DOMContentLoaded", () => {
    const chatDisplay = document.getElementById("chatDisplay");
    const chatMessages = document.getElementById("chatMessages");
    const chatBlankSpace = document.getElementById("chatBlankSpace");
    const chatTitleText = document.getElementById("chatTitleText");
    const conversationInput = document.getElementById("conversationInput");
    const scrollSpeedInput = document.getElementById("scrollSpeed");
    const scrollSpeedValue = document.getElementById("scrollSpeedValue");
    const startRecordingButton = document.getElementById("startRecording");
    const stopRecordingButton = document.getElementById("stopRecording");
    const chatTitleInput = document.getElementById("chatTitleInput");
    const titleBlankPercentInput = document.getElementById("titleBlankPercent");
    const titleBlankPercentValue = document.getElementById("titleBlankPercentValue");
    const titleHorizontalPositionInput = document.getElementById("titleHorizontalPosition");
    const titleHorizontalPositionValue = document.getElementById("titleHorizontalPositionValue");
    const titleFontSizeInput = document.getElementById("titleFontSize");
    const titleFontSizeValue = document.getElementById("titleFontSizeValue");
  
    // 録画関連の状態
    let mediaRecorder = null;
    let recordedChunks = [];
    let isRecording = false;
    let animationFrameId = null;
    let currentScrollSpeed = parseFloat(scrollSpeedInput.value);
    let recWinGlobal = null;
  
    // UI設定値
    let chatTitle = chatTitleInput.value;
    let titleBlankPercent = parseInt(titleBlankPercentInput.value, 10);
    let titleHorizontalPosition = parseInt(titleHorizontalPositionInput.value, 10);
    let titleFontSize = parseFloat(titleFontSizeInput.value);
    
    scrollSpeedValue.textContent = currentScrollSpeed;
    titleBlankPercentValue.textContent = titleBlankPercent + "%";
    titleHorizontalPositionValue.textContent = titleHorizontalPosition + "px";
    titleFontSizeValue.textContent = titleFontSize + "em";
    chatTitleText.textContent = chatTitle;

    // 会話エディタ関連
    const conversationEditor = document.getElementById("conversationEditor");
    const csvExportButton = document.getElementById("csvExportButton");
    const csvImportButton = document.getElementById("csvImportButton");
    const csvImportInput = document.getElementById("csvImportInput");
    let conversationRows = [];
    let draggedItemIndex = null;

    // ユーティリティ関数
    function createRecordingErrorMessage(err) {
      let errorMessage = "画面録画の許可が得られませんでした。\n\n";
      errorMessage += `プロトコル: ${location.protocol}\n`;
      errorMessage += `ホスト: ${location.hostname}\n`;
      errorMessage += `エラー名: ${err.name}\n`;
      errorMessage += `エラー詳細: ${err.message}\n\n`;
      
      if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        errorMessage += "⚠️ HTTPS接続が必要です。\n";
        errorMessage += "解決方法:\n";
        errorMessage += "1. ローカルサーバーで開く (npm start)\n";
        errorMessage += "2. HTTPS対応サーバーを使用\n";
      } else if (err.name === 'NotAllowedError') {
        errorMessage += "⚠️ ユーザーが画面共有を拒否しました。\n";
        errorMessage += "解決方法:\n";
        errorMessage += "1. Braveの🛡️アイコンからShieldsを無効化\n";
        errorMessage += "2. サイト設定で画面共有を許可\n";
        errorMessage += "3. 録画ボタンをもう一度クリック\n";
      } else if (err.name === 'AbortError') {
        errorMessage += "⚠️ 画面共有がキャンセルされました。\n";
        errorMessage += "解決方法:\n";
        errorMessage += "1. 少し待ってから再度お試しください\n";
        errorMessage += "2. ページを再読み込みしてから録画してください\n";
      } else if (err.name === 'NotSupportedError') {
        errorMessage += "⚠️ ブラウザが画面録画に対応していません。\n";
        errorMessage += "Chrome、Firefox、Edgeをお試しください。\n";
      }
      
      return errorMessage;
    }

    function parseCsvLine(line) {
      const result = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = i + 1 < line.length ? line[i + 1] : null;
        
        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(cleanCsvField(current));
          current = '';
        } else {
          current += char;
        }
      }
      
      result.push(cleanCsvField(current));
      return result;
    }
    
    function cleanCsvField(field) {
      const trimmed = field.trim();
      if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        return trimmed.slice(1, -1);
      }
      return trimmed;
    }

    function formatDateForSeparator(date) {
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
      return `${month}/${day}(${dayOfWeek})`;
    }
  
    scrollSpeedInput.addEventListener("input", () => {
      currentScrollSpeed = parseFloat(scrollSpeedInput.value);
      scrollSpeedValue.textContent = currentScrollSpeed;
    });
  
    chatTitleInput.addEventListener("input", (e) => {
      chatTitle = e.target.value;
      chatTitleText.textContent = chatTitle;
    });
    
    titleBlankPercentInput.addEventListener("input", (e) => {
      titleBlankPercent = parseInt(e.target.value, 10);
      titleBlankPercentValue.textContent = titleBlankPercent + "%";
      chatBlankSpace.style.height = titleBlankPercent * 0.01 * 300 + "px";
    });
  
    titleHorizontalPositionInput.addEventListener("input", (e) => {
        titleHorizontalPosition = parseInt(e.target.value, 10);
        titleHorizontalPositionValue.textContent = titleHorizontalPosition + "px";
    });
    
    titleFontSizeInput.addEventListener("input", (e) => {
        titleFontSize = parseFloat(e.target.value);
        titleFontSizeValue.textContent = titleFontSize + "em";
    });

    function parseAndDisplayConversation(text) {
      const lines = text.split("\n");
      let lastProcessedDateString = null;
      
      chatBlankSpace.style.height = titleBlankPercent * 0.01 * 300 + "px";
      chatMessages.innerHTML = "";

      lines.forEach((line, idx) => {
        if (!line.trim()) return;
        
        const headerLineNormalized = line.replace(/\s+/g, ",").toLowerCase();
        if (
          idx === 0 &&
          (headerLineNormalized.startsWith("sender,type,content,date,timestamp") ||
            headerLineNormalized.startsWith("sender,type,content,timestamp") ||
            headerLineNormalized.startsWith("sender,type,content") ||
            headerLineNormalized.startsWith("sender,text"))
        ) {
          return;
        }

        const parts = parseCsvLine(line);

        let sender, type, content, date, timestamp;
        
        if (parts.length >= 2) {
          sender = parts[0].trim();
          type = parts[1].trim().toLowerCase();
          content = parts.length >= 3 ? parts[2].trim() : "";
          date = parts.length >= 4 ? parts[3].trim() : null;
          timestamp = parts.length >= 5 ? parts[4].trim() : null;

          if (timestamp && timestamp.match(/^\d{1,2}:\d{2}:\d{2}$/)) {
            const timeParts = timestamp.split(":");
            timestamp = `${timeParts[0]}:${timeParts[1]}`;
          }
        } else {
          console.warn("Skipping invalid CSV line:", line);
          return;
        }

        if (sender.toLowerCase() === "電話") {
          type = "phone";
          content = parts.length >= 2 ? parts[1].trim() : "通話";
          date = parts.length >= 3 ? parts[2].trim() : null;
          timestamp = parts.length >= 4 ? parts[3].trim() : "";
          if (timestamp && timestamp.match(/^\d{1,2}:\d{2}:\d{2}$/)) {
            const timeParts = timestamp.split(":");
            timestamp = `${timeParts[0]}:${timeParts[1]}`;
          }
        }

        if (!sender) return;

        // 日付区切りの処理
        if (date) {
          const currentMessageDate = new Date(date);
          if (!isNaN(currentMessageDate.getTime())) {
            const currentMessageDateStr = currentMessageDate.toISOString().split("T")[0];
            if (lastProcessedDateString === null || lastProcessedDateString !== currentMessageDateStr) {
              const dateSeparatorDiv = document.createElement("div");
              dateSeparatorDiv.classList.add("date-separator");
              const span = document.createElement("span");
              span.textContent = formatDateForSeparator(currentMessageDate);
              dateSeparatorDiv.appendChild(span);
              chatMessages.appendChild(dateSeparatorDiv);
            }
            lastProcessedDateString = currentMessageDateStr;
          }
        }

        // メッセージアイテムの作成
        const messageItem = document.createElement("div");
        messageItem.classList.add("message-item");
        messageItem.classList.add(sender === "男" ? "sent" : "received");

        // アバター（受信メッセージのみ）
        if (sender !== "男") {
          const avatarDiv = document.createElement("div");
          avatarDiv.classList.add("message-avatar");
          const avatarImg = document.createElement("img");
          avatarImg.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%23ddd'/%3E%3Ctext x='16' y='21' text-anchor='middle' font-family='Arial' font-size='14' fill='%23666'%3EK%3C/text%3E%3C/svg%3E";
          avatarImg.alt = "プロフィール画像";
          avatarDiv.appendChild(avatarImg);
          messageItem.appendChild(avatarDiv);
        }

        // メッセージコンテンツ
        const messageContent = document.createElement("div");
        messageContent.classList.add("message-content");

        // メッセージバブル
        const bubble = document.createElement("div");
        bubble.classList.add("message-bubble");

        if (type === "image") {
          const isValidImageData = content && 
                                  content.startsWith("data:image/") && 
                                  content.includes(",") && 
                                  content.split(",").length === 2 &&
                                  content.split(",")[1].length > 10;
          
          if (!isValidImageData) {
            bubble.style.width = "360px";
            bubble.style.height = "180px";
            bubble.style.backgroundColor = "#f5f5f5";
            bubble.style.display = "flex";
            bubble.style.alignItems = "center";
            bubble.style.justifyContent = "center";
            bubble.style.color = "#999";
            bubble.style.fontSize = "14px";
            bubble.textContent = "画像データが無効です";
          } else {
            const img = document.createElement("img");
            img.src = content;
            img.alt = "画像";
            img.classList.add("message-image");
            bubble.appendChild(img);
            bubble.style.padding = "0";
            bubble.style.backgroundColor = "transparent";
          }
        } else if (type === "phone" || type === "call") {
          bubble.classList.add("phone-message");
          const phoneIcon = document.createElement("span");
          phoneIcon.classList.add("phone-icon");
          phoneIcon.textContent = "📞";
          bubble.appendChild(phoneIcon);
          const phoneText = document.createElement("span");
          phoneText.textContent = `音声通話 ${content}`;
          bubble.appendChild(phoneText);
        } else {
          let processedContent = content || "";
          const japaneseOnlyRegex = /^[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uffef\u4e00-\u9faf\u3400-\u4dbf]+$/u;
          if (japaneseOnlyRegex.test(processedContent) && processedContent.length > 16) {
            const lines = [];
            for (let i = 0; i < processedContent.length; i += 17) {
              lines.push(processedContent.substring(i, i + 17));
            }
            processedContent = lines.join("\n");
          }
          bubble.innerHTML = processedContent.replace(/\n/g, "<br>");
        }

        messageContent.appendChild(bubble);

        // タイムスタンプ
        if (timestamp) {
          const timestampDiv = document.createElement("div");
          timestampDiv.classList.add("message-timestamp");
          timestampDiv.textContent = timestamp;
          messageContent.appendChild(timestampDiv);
        }

        messageItem.appendChild(messageContent);
        chatMessages.appendChild(messageItem);
      });
    }

    // 録画機能
    async function startScreenRecording() {
      try {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
        
        if (recWinGlobal && !recWinGlobal.closed) {
          recWinGlobal.close();
        }

        const recWinWidth = chatDisplay.offsetWidth;
        const recWinHeight = 1040;
        recWinGlobal = window.open(
          "",
          "_blank",
          `width=${recWinWidth},height=${recWinHeight},resizable=yes,scrollbars=no,status=no,toolbar=no,menubar=no,location=no`
        );
        if (!recWinGlobal) {
          alert("録画用ウィンドウのポップアップがブロックされました。ブラウザの設定でポップアップを許可してください。");
          return;
        }
        recWinGlobal.document.title = "録画対象";

        let styles = "";
        for (const styleEl of document.querySelectorAll('style,link[rel="stylesheet"]')) {
          styles += styleEl.outerHTML;
        }
        styles += `<style>
                .chat-left.hide-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
                .chat-left.hide-scrollbar::-webkit-scrollbar { display: none; }
                .chat-display.disable-mouse { pointer-events: none !important; }
                .chat-display.hide-cursor { cursor: none !important; }
                body { margin: 0; }
              </style>`;

        const htmlContent = `<html><head><title>録画対象</title>${styles}</head><body>${chatDisplay.outerHTML}</body></html>`;
        recWinGlobal.document.open();
        recWinGlobal.document.write(htmlContent);
        recWinGlobal.document.close();

        recWinGlobal.onload = async () => {
          const recChatDisplay = recWinGlobal.document.getElementById("chatDisplay");
          const recChatLeft = recChatDisplay.querySelector(".chat-left");
          
          if (!recChatDisplay || !recChatLeft) {
            alert("録画用ウィンドウの準備に失敗しました。");
            if(recWinGlobal && !recWinGlobal.closed) recWinGlobal.close();
            return;
          }

          recChatDisplay.classList.add("recording-mode");
          recChatLeft.classList.add("hide-scrollbar", "disable-mouse", "hide-cursor");
          recChatDisplay.style.height = `${recWinHeight}px`;
          recChatLeft.scrollTop = 0;

          alert("録画用の新しいウィンドウが開きました。\n画面共有の選択ダイアログでこのウィンドウを選択してください。");

          let stream;
          try {
            stream = await navigator.mediaDevices.getDisplayMedia({
              video: { 
                frameRate: 30, 
                cursor: "never",
                displaySurface: "window"
              },
              audio: false,
            });
          } catch (err) {
            console.error("getDisplayMedia エラー:", err);
            alert(createRecordingErrorMessage(err));
            if (recWinGlobal && !recWinGlobal.closed) recWinGlobal.close();
            return;
          }
          
          if (!stream) {
            alert("画面共有が選択されませんでした。録画を中止します。");
            if (recWinGlobal && !recWinGlobal.closed) recWinGlobal.close();
            return;
          }

          mediaRecorder = new MediaRecorder(stream, {
            mimeType: "video/webm;codecs=vp9",
          });
          recordedChunks = [];
          mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) recordedChunks.push(e.data);
          };
          mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: "video/webm" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "pairs-chat-recording.webm";
            a.click();
            URL.revokeObjectURL(url);
            if (recWinGlobal && !recWinGlobal.closed) recWinGlobal.close();
            isRecording = false;
            startRecordingButton.disabled = false;
            stopRecordingButton.disabled = true;
          };

          mediaRecorder.start();
          isRecording = true;
          startRecordingButton.disabled = true;
          stopRecordingButton.disabled = false;
          
          autoScrollChatInWindow(recChatLeft);
        };
      } catch (err) {
        console.error("録画開始エラー:", err);
        alert("録画を開始できませんでした。");
      }
    }
  
    function stopScreenRecording() {
      if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
      }
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      isRecording = false;
      startRecordingButton.disabled = false;
      stopRecordingButton.disabled = true;
    }
  
    function autoScrollChatInWindow(elementToScroll) {
      if (!isRecording || !recWinGlobal || recWinGlobal.closed) {
        stopScreenRecording();
        return;
      }
      const scrollAmount = Number(scrollSpeedInput.value);
      elementToScroll.scrollTop += scrollAmount;
      if (elementToScroll.scrollTop + elementToScroll.clientHeight < elementToScroll.scrollHeight) {
        animationFrameId = recWinGlobal.requestAnimationFrame(() =>
          autoScrollChatInWindow(elementToScroll)
        );
      } else {
        setTimeout(() => {
          if (mediaRecorder && isRecording) stopScreenRecording();
        }, 3000);
      }
    }

    startRecordingButton.addEventListener("click", startScreenRecording);
    stopRecordingButton.addEventListener("click", stopScreenRecording);

    // 会話エディタ機能
    function renderConversationEditor() {
      conversationEditor.innerHTML = "";
      
      const table = document.createElement("table");
      table.classList.add("editor-table");
      
      const thead = document.createElement("thead");
      thead.innerHTML = `<tr><th>話者</th><th>タイプ・内容</th><th>日付・時刻</th><th></th></tr>`;
      table.appendChild(thead);
      
      const tbody = document.createElement("tbody");

      conversationRows.forEach((row, idx) => {
        const tr = document.createElement("tr");
        tr.draggable = true;
        tr.dataset.index = idx;
        
        tr.addEventListener("dragstart", (e) => {
          draggedItemIndex = idx;
          e.dataTransfer.effectAllowed = "move";
          tr.classList.add("dragging");
        });
        
        tr.addEventListener("dragend", () => {
          tr.classList.remove("dragging");
          draggedItemIndex = null;
        });
        
        tr.addEventListener("dragover", (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        });
        
        tr.addEventListener("drop", (e) => {
          e.preventDefault();
          if (draggedItemIndex !== null && draggedItemIndex !== idx) {
            const draggedItem = conversationRows.splice(draggedItemIndex, 1)[0];
            conversationRows.splice(idx, 0, draggedItem);
            renderConversationEditor();
            syncEditorToCSV();
          }
        });

        // 話者選択
        const speakerTd = document.createElement("td");
        const manBtn = document.createElement("button");
        manBtn.textContent = "男";
        manBtn.classList.add("editor-btn");
        if (row.speaker === "男") manBtn.classList.add("primary");
        manBtn.onclick = () => { 
          row.speaker = "男"; 
          renderConversationEditor(); 
          syncEditorToCSV(); 
        };
        
        const womanBtn = document.createElement("button");
        womanBtn.textContent = "女";
        womanBtn.classList.add("editor-btn");
        if (row.speaker === "女") womanBtn.classList.add("primary");
        womanBtn.onclick = () => { 
          row.speaker = "女"; 
          renderConversationEditor(); 
          syncEditorToCSV(); 
        };
        
        speakerTd.appendChild(manBtn);
        speakerTd.appendChild(womanBtn);
        tr.appendChild(speakerTd);

        // コンテンツ
        const contentTd = document.createElement("td");
        const typeSelect = document.createElement("select");
        typeSelect.innerHTML = `<option value="text">テキスト</option><option value="image">画像</option><option value="phone">電話</option>`;
        typeSelect.value = row.type;
        typeSelect.onchange = (e) => {
          row.type = e.target.value;
          renderConversationEditor();
          syncEditorToCSV();
        };
        contentTd.appendChild(typeSelect);

        if (row.type === "text") {
          const input = document.createElement("input");
          input.type = "text";
          input.value = row.content;
          input.oninput = (e) => {
            row.content = e.target.value;
            syncEditorToCSV();
          };
          contentTd.appendChild(input);
        } else if (row.type === "image") {
          const fileInput = document.createElement("input");
          fileInput.type = "file";
          fileInput.accept = "image/*";
          fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
              row.content = ev.target.result;
              syncEditorToCSV();
              renderConversationEditor();
            };
            reader.readAsDataURL(file);
          };
          contentTd.appendChild(fileInput);
          
          if (row.content && row.content.startsWith("data:image")) {
            const img = document.createElement("img");
            img.src = row.content;
            img.style.width = "60px";
            img.style.height = "auto";
            img.style.marginLeft = "8px";
            img.style.borderRadius = "8px";
            contentTd.appendChild(img);
          }
        } else if (row.type === "phone") {
          const input = document.createElement("input");
          input.type = "text";
          input.placeholder = "通話時間";
          input.value = row.content;
          input.oninput = (e) => {
            row.content = e.target.value;
            syncEditorToCSV();
          };
          contentTd.appendChild(input);
        }
        tr.appendChild(contentTd);
        
        // 日付・時刻
        const datetimeTd = document.createElement("td");
        const dateInput = document.createElement("input");
        dateInput.type = "text";
        dateInput.placeholder = "YYYY/MM/DD";
        dateInput.value = row.date || "";
        dateInput.style.marginBottom = "4px";
        dateInput.oninput = (e) => {
          row.date = e.target.value;
          syncEditorToCSV();
        };
        datetimeTd.appendChild(dateInput);

        const timestampInput = document.createElement("input");
        timestampInput.type = "text";
        timestampInput.placeholder = "HH:MM";
        timestampInput.value = row.timestamp || "";
        timestampInput.oninput = (e) => {
          row.timestamp = e.target.value;
          syncEditorToCSV();
        };
        datetimeTd.appendChild(timestampInput);
        tr.appendChild(datetimeTd);

        // 削除ボタン
        const delTd = document.createElement("td");
        const delBtn = document.createElement("button");
        delBtn.textContent = "×";
        delBtn.classList.add("editor-btn");
        delBtn.onclick = () => {
          conversationRows.splice(idx, 1);
          renderConversationEditor();
          syncEditorToCSV();
        };
        delTd.appendChild(delBtn);
        tr.appendChild(delTd);
        
        tbody.appendChild(tr);
      });
      
      table.appendChild(tbody);
      conversationEditor.appendChild(table);

      // 追加ボタン
      const controls = document.createElement("div");
      controls.classList.add("editor-controls");
      const addBtn = document.createElement("button");
      addBtn.textContent = "＋追加";
      addBtn.classList.add("editor-btn", "primary");
      addBtn.onclick = () => {
        conversationRows.push({
          speaker: "男",
          type: "text",
          content: "",
          date: "",
          timestamp: "",
        });
        renderConversationEditor();
        syncEditorToCSV();
      };
      controls.appendChild(addBtn);
      conversationEditor.appendChild(controls);
    }

    function syncEditorToCSV() {
      let csv = "sender,type,content,date,timestamp\n";
      conversationRows.forEach((row) => {
        let content = row.content ? row.content.replace(/\n/g, " ") : "";
        let date = row.date || "";
        let timestamp = row.timestamp || "";
        
        const escapeCsvField = (field) => {
          if (field.includes(",") || field.includes('"') || field.includes("\n")) {
            return '"' + field.replace(/"/g, '""') + '"';
          }
          return field;
        };
        
        csv += `${escapeCsvField(row.speaker)},${escapeCsvField(row.type)},${escapeCsvField(content)},${escapeCsvField(date)},${escapeCsvField(timestamp)}\n`;
      });
      conversationInput.value = csv;
      parseAndDisplayConversation(csv);
    }

    function syncCSVToEditor(csvText) {
      const lines = csvText.split(/\r?\n/);
      conversationRows = [];
      lines.forEach((line, idx) => {
        if (!line.trim()) return;
        const headerLineNormalized = line.replace(/\s+/g, ",").toLowerCase();
        if (
          idx === 0 &&
          (headerLineNormalized.startsWith("sender,type,content,date,timestamp") ||
            headerLineNormalized.startsWith("sender,type,content,timestamp") ||
            headerLineNormalized.startsWith("sender,type,content") ||
            headerLineNormalized.startsWith("sender,text"))
        ) return;

        const parts = parseCsvLine(line);
        if (parts.length >= 2) {
          let speaker = parts[0].trim();
          let type = parts[1].trim().toLowerCase();
          let content = parts.length >= 3 ? parts[2].trim() : "";
          let date = parts.length >= 4 ? parts[3].trim() : "";
          let timestamp = parts.length >= 5 ? parts[4].trim() : "";

          if (speaker.toLowerCase() === "電話") {
            type = "phone";
            content = parts.length >= 2 ? parts[1].trim() : "通話";
            date = parts.length >= 3 ? parts[2].trim() : "";
            timestamp = parts.length >= 4 ? parts[3].trim() : "";
          }

          conversationRows.push({
            speaker: speaker,
            type: type,
            content: content,
            date: date,
            timestamp: timestamp,
          });
        }
      });
      renderConversationEditor();
    }

    // CSVエクスポート・インポート
    csvExportButton.addEventListener("click", () => {
      const blob = new Blob([conversationInput.value], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "pairs-chat.csv";
      a.click();
      URL.revokeObjectURL(url);
    });

    csvImportButton.addEventListener("click", () => {
      csvImportInput.click();
    });
    
    csvImportInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const csvText = event.target.result;
          conversationInput.value = csvText;
          parseAndDisplayConversation(csvText);
          syncCSVToEditor(csvText);
          csvImportInput.value = '';
        };
        reader.readAsText(file, 'UTF-8');
      }
    });
    
    // 画像ペースト機能
    document.addEventListener("paste", (event) => {
      if (!event.clipboardData) return;
      const items = event.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf("image") !== -1) {
          const file = item.getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
              conversationRows.push({
                speaker: "男",
                type: "image",
                content: e.target.result,
                date: "",
                timestamp: ""
              });
              renderConversationEditor();
              syncEditorToCSV();
            };
            reader.readAsDataURL(file);
            event.preventDefault();
            break;
          }
        }
      }
    });

    // 初期表示
    if (conversationInput.value.trim() !== "") {
        syncCSVToEditor(conversationInput.value);
        parseAndDisplayConversation(conversationInput.value);
    } else {
        renderConversationEditor();
    }
});