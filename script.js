document.addEventListener("DOMContentLoaded", () => {
    const chatDisplay = document.getElementById("chatDisplay");
    const chatLeft = chatDisplay.querySelector('.chat-left'); // スクロール対象を .chat-left に
    const chatMessages = document.getElementById("chatMessages");
    const chatBlankSpace = document.getElementById("chatBlankSpace");
    const chatTitleText = document.getElementById("chatTitleText");
    const conversationInput = document.getElementById("conversationInput");
    const scrollSpeedInput = document.getElementById("scrollSpeed");
    const scrollSpeedValue = document.getElementById("scrollSpeedValue");
    const startRecordingButton = document.getElementById("startRecording");
    const stopRecordingButton = document.getElementById("stopRecording");
    const chatTitleInput = document.getElementById("chatTitleInput");
    const titleBlankPercentInput =
      document.getElementById("titleBlankPercent");
    const titleBlankPercentValue = document.getElementById(
      "titleBlankPercentValue"
    );
    const titleHorizontalPositionInput = document.getElementById("titleHorizontalPosition");
    const titleHorizontalPositionValue = document.getElementById("titleHorizontalPositionValue");
    const titleFontSizeInput = document.getElementById("titleFontSize");
    const titleFontSizeValue = document.getElementById("titleFontSizeValue");
  
    let mediaRecorder = null;
    let recordedChunks = [];
    let isRecording = false;
    let animationFrameId = null;
    let currentScrollSpeed = parseFloat(scrollSpeedInput.value);
    let recWinGlobal = null;
  
    let chatTitle = chatTitleInput.value;
    let titleBlankPercent = parseInt(titleBlankPercentInput.value, 10);
    let titleHorizontalPosition = parseInt(titleHorizontalPositionInput.value, 10);
    let titleFontSize = parseFloat(titleFontSizeInput.value);
    
    scrollSpeedValue.textContent = currentScrollSpeed;
    titleHorizontalPositionValue.textContent = titleHorizontalPosition + "px";
    titleFontSizeValue.textContent = titleFontSize + "em";
    chatTitleText.style.fontSize = titleFontSize + "em";
  
    const conversationEditor =
      document.getElementById("conversationEditor");
    const csvExportButton = document.getElementById("csvExportButton");
    const csvImportButton = document.getElementById("csvImportButton");
    const csvImportInput = document.getElementById("csvImportInput");
    let conversationRows = [];
    let draggedItemIndex = null;

    function parseCsvLine(line) {
      const result = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = i + 1 < line.length ? line[i + 1] : null;
        
        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            // エスケープされた引用符 ("") を単一の引用符として追加
            current += '"';
            i++; // 次の引用符をスキップ
          } else {
            // 引用符の開始/終了を切り替え
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          // フィールドの区切り
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
      // 前後の引用符を除去
      if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        return trimmed.slice(1, -1);
      }
      return trimmed;
    }

    function formatDateForSeparator(date) {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      return `${year}年${month}月${day}日`;
    }
  
    scrollSpeedInput.addEventListener("input", () => {
      currentScrollSpeed = parseFloat(scrollSpeedInput.value);
      scrollSpeedValue.textContent = currentScrollSpeed;
    });
  
    chatTitleInput.addEventListener("input", (e) => {
      chatTitle = e.target.value;
      syncEditorToCSV();
    });
    
    titleBlankPercentInput.addEventListener("input", (e) => {
      titleBlankPercent = parseInt(e.target.value, 10);
      titleBlankPercentValue.textContent = titleBlankPercent;
      syncEditorToCSV();
    });
  
    titleHorizontalPositionInput.addEventListener("input", (e) => {
        titleHorizontalPosition = parseInt(e.target.value, 10);
        titleHorizontalPositionValue.textContent = titleHorizontalPosition + "px";
        syncEditorToCSV();
    });
    
    titleFontSizeInput.addEventListener("input", (e) => {
        titleFontSize = parseFloat(e.target.value);
        titleFontSizeValue.textContent = titleFontSize + "em";
        syncEditorToCSV();
    });
  
  
    function parseAndDisplayConversation(text) {
      const lines = text.split("\n");
      let lastProcessedDateString = null;
      console.log("Processing CSV with", lines.length, "lines");
      chatBlankSpace.style.height = titleBlankPercent * 0.01 * 1000 + "px";
      chatTitleText.innerHTML = chatTitle ? chatTitle.replace(/\n/g, "<br>") : "";
      chatTitleText.style.transform = `translateX(${titleHorizontalPosition}px)`;
      chatTitleText.style.fontSize = titleFontSize + "em";
      chatMessages.innerHTML = "";
  
      const messagesWrapper = document.createElement("div");
      messagesWrapper.style.display = "flex";
      messagesWrapper.style.flexDirection = "column";
      messagesWrapper.style.justifyContent = "flex-start";
      messagesWrapper.style.width = "100%";
  
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
        
        console.log("Processing message:", { sender, type, content, date, timestamp });
  
        if (date) {
          const currentMessageDate = new Date(date);
          if (!isNaN(currentMessageDate.getTime())) {
            const currentMessageDateStr = currentMessageDate
              .toISOString()
              .split("T")[0];
            if (
              lastProcessedDateString === null ||
              lastProcessedDateString !== currentMessageDateStr
            ) {
              const dateSeparatorDiv = document.createElement("div");
              dateSeparatorDiv.classList.add("date-separator");
              dateSeparatorDiv.textContent = formatDateForSeparator(
                currentMessageDate
              );
              messagesWrapper.appendChild(dateSeparatorDiv);
            }
            lastProcessedDateString = currentMessageDateStr;
          }
        }
  
        const messageDiv = document.createElement("div");
        messageDiv.classList.add("message");
        let messageSenderForClass = sender.toLowerCase() === "電話" ? "男" : sender;
        messageDiv.classList.add(
          messageSenderForClass === "男" ? "sent" : "received"
        );
  
        let bubble;
        if (type === "image") {
          console.log("画像処理開始 - content検証:", {
            hasContent: !!content,
            contentLength: content ? content.length : 0,
            startsWithDataImage: content ? content.startsWith("data:image/") : false,
            hasComma: content ? content.includes(",") : false,
            splitLength: content ? content.split(",").length : 0,
            base64Length: content && content.includes(",") ? content.split(",")[1].length : 0,
            contentPreview: content ? content.substring(0, 100) + "..." : "null"
          });
          
          // より厳密な画像データ検証
          const isValidImageData = content && 
                                  content.startsWith("data:image/") && 
                                  content.includes(",") && 
                                  content.split(",").length === 2 &&
                                  content.split(",")[1].length > 10; // base64データが最低限ある
          
          if (!isValidImageData) {
            // 無効な画像データの場合はdivで表示
            bubble = document.createElement("div");
            bubble.style.width = "360px";
            bubble.style.height = "180px";
            bubble.style.backgroundColor = "#f5f5f5";
            bubble.style.display = "flex";
            bubble.style.alignItems = "center";
            bubble.style.justifyContent = "center";
            bubble.style.borderRadius = "16px";
            bubble.style.color = "#999";
            bubble.style.fontSize = "14px";
            bubble.textContent = "画像データが無効です";
          } else {
            // 有効な画像データの場合
            bubble = document.createElement("img");
            bubble.src = content;
            bubble.alt = "画像";
            bubble.style.width = "360px";
            bubble.style.height = "auto";
            bubble.style.borderRadius = "16px";
            bubble.style.display = "block";
            bubble.style.margin = "0";
            
            // 成功時のログ
            bubble.onload = () => {
              console.log("画像読み込み成功:", content.substring(0, 50) + "...");
            };
            
            // エラーハンドリング（無限ループを防ぐ）
            let hasErrored = false;
            bubble.onerror = (e) => {
              if (!hasErrored) {
                hasErrored = true;
                console.error("画像読み込みエラー詳細:", {
                  event: e,
                  src: bubble.src,
                  contentType: content.split(',')[0],
                  contentLength: content.length,
                  isValidDataUrl: content.startsWith('data:image/')
                });
                bubble.style.display = "none";
                const errorDiv = document.createElement("div");
                errorDiv.style.width = "360px";
                errorDiv.style.height = "180px";
                errorDiv.style.backgroundColor = "#f5f5f5";
                errorDiv.style.display = "flex";
                errorDiv.style.alignItems = "center";
                errorDiv.style.justifyContent = "center";
                errorDiv.style.borderRadius = "16px";
                errorDiv.style.color = "#999";
                errorDiv.style.fontSize = "14px";
                errorDiv.textContent = "画像を読み込めませんでした";
                bubble.parentNode.insertBefore(errorDiv, bubble.nextSibling);
              }
            };
          }
        } else if (type === "phone" || type === "call") {
          messageDiv.classList.add("call-log");
          bubble = document.createElement("div");
          bubble.classList.add("bubble");
  
          const callIconWrapper = document.createElement("div");
          callIconWrapper.classList.add("call-icon-wrapper");
          const callIcon = document.createElement("span");
          callIcon.classList.add("call-icon");
          callIcon.innerHTML = `<svg viewBox="0 0 24 24"><path d="M6.62,10.79C8.06,13.62 10.38,15.94 13.21,17.38L15.41,15.18C15.69,14.9 16.08,14.82 16.43,14.93C17.55,15.3 18.75,15.5 20,15.5A1,1 0 0,1 21,16.5V20A1,1 0 0,1 20,21A17,17 0 0,1 3,4A1,1 0 0,1 4,3H7.5A1,1 0 0,1 8.5,4C8.5,5.25 8.7,6.45 9.07,7.57C9.18,7.92 9.1,8.31 8.82,8.59L6.62,10.79Z"></path></svg>`;
          callIconWrapper.appendChild(callIcon);
  
          const callInfo = document.createElement("div");
          callInfo.classList.add("call-info");
          const callTypeText = document.createElement("div");
          callTypeText.classList.add("call-type");
          callTypeText.textContent = "音声通話";
          const callDurationText = document.createElement("div");
          callDurationText.classList.add("call-duration");
          callDurationText.textContent = content;
  
          callInfo.appendChild(callTypeText);
          callInfo.appendChild(callDurationText);
          bubble.appendChild(callIconWrapper);
          bubble.appendChild(callInfo);
        } else {
          bubble = document.createElement("div");
          bubble.classList.add("bubble");
          let processedContent = content || "";
          const japaneseOnlyRegex =
            /^[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uffef\u4e00-\u9faf\u3400-\u4dbf]+$/u;
          if (
            japaneseOnlyRegex.test(processedContent) &&
            processedContent.length > 15
          ) {
            processedContent =
              processedContent.substring(0, 15) +
              "\n" +
              processedContent.substring(15);
          }
          bubble.innerHTML = processedContent.replace(/\n/g, "<br>");
        }
  
        const metaDiv = document.createElement("div");
        metaDiv.classList.add("meta");
        if (messageSenderForClass === "男") {
          const readDiv = document.createElement("div");
          readDiv.classList.add("read-status");
          readDiv.textContent = "既読";
          metaDiv.appendChild(readDiv);
        }
        const timeDiv = document.createElement("div");
        timeDiv.classList.add("timestamp");
        timeDiv.textContent =
          timestamp ||
          new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
        metaDiv.appendChild(timeDiv);
  
        if (messageSenderForClass === "男") {
          messageDiv.appendChild(metaDiv);
          messageDiv.appendChild(bubble);
          const avatarDiv = document.createElement("div");
          avatarDiv.classList.add("avatar");
          messageDiv.appendChild(avatarDiv);
        } else {
          const avatarDiv = document.createElement("div");
          avatarDiv.classList.add("avatar");
          messageDiv.appendChild(avatarDiv);
          messageDiv.appendChild(bubble);
          messageDiv.appendChild(metaDiv);
        }
  
        messagesWrapper.appendChild(messageDiv);
      });
      chatMessages.appendChild(messagesWrapper);
    }
  
    // --- 録画機能関連 ---
    async function startScreenRecording() {
      try {
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
        for (const styleEl of document.querySelectorAll(
          'style,link[rel="stylesheet"]'
        )) {
          styles += styleEl.outerHTML;
        }
        styles += `<style>
                .chat-display.hide-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
                .chat-display.hide-scrollbar::-webkit-scrollbar { display: none; }
                .chat-display.disable-mouse { pointer-events: none !important; }
                .chat-display.hide-cursor { cursor: none !important; }
                body { margin: 0; }
              </style>`;
  
        recWinGlobal.document.write(
          `<html><head><title>録画対象</title>${styles}</head><body>${chatDisplay.outerHTML}</body></html>`
        );
        recWinGlobal.document.close();
  
        recWinGlobal.onload = async () => {
          const recChatDisplay = recWinGlobal.document.getElementById("chatDisplay");
          const recChatLeft = recChatDisplay.querySelector(".chat-left"); // 新しいウィンドウ内のスクロール対象
          
          if (!recChatDisplay || !recChatLeft) {
            alert("録画用ウィンドウの準備に失敗しました。");
            if(recWinGlobal && !recWinGlobal.closed) recWinGlobal.close();
            return;
          }
  
          recChatDisplay.classList.add("recording-mode");
          recChatLeft.classList.add("hide-scrollbar", "disable-mouse", "hide-cursor");
          recChatDisplay.style.height = `${recWinHeight}px`;
          recChatLeft.scrollTop = 0;
  
          alert(
            "録画用の新しいウィンドウが開きました。\n画面共有の選択ダイアログでこのウィンドウを選択してください。"
          );
  
          let stream;
          try {
            stream = await navigator.mediaDevices.getDisplayMedia({
              video: { frameRate: 30, cursor: "never" },
              audio: false,
            });
          } catch (err) {
            console.error("getDisplayMedia エラー:", err);
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
            } else if (err.name === 'NotSupportedError') {
              errorMessage += "⚠️ ブラウザが画面録画に対応していません。\n";
              errorMessage += "Chrome、Firefox、Edgeをお試しください。\n";
            }
            
            alert(errorMessage);
            recWinGlobal.close();
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
            a.download = "chat-recording.webm";
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
          
          autoScrollChatInWindow(recChatLeft); // スクロール対象を .chat-left に変更
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
      if (
        elementToScroll.scrollTop + elementToScroll.clientHeight <
        elementToScroll.scrollHeight
      ) {
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
    
    // --- ここまで録画機能関連 ---
  
  
    function renderConversationEditor() {
      conversationEditor.innerHTML = "";
      const table = document.createElement("table");
      table.style.width = "100%";
      table.style.marginBottom = "10px";
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
          tr.style.opacity = "0.5";
        });
        
        tr.addEventListener("dragend", () => {
          tr.style.opacity = "1";
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
  
        const speakerTd = document.createElement("td");
        // ... (話者ボタン)
        const manBtn = document.createElement("button"); manBtn.textContent = "男";
        manBtn.style.background = row.speaker === "男" ? "#00c300" : "#eee"; manBtn.style.color = row.speaker === "男" ? "#fff" : "#555";
        manBtn.style.borderRadius = "50%"; manBtn.style.width = "2.2em"; manBtn.style.height = "2.2em"; manBtn.style.marginRight = "2px";
        manBtn.style.border = row.speaker === "男" ? "2px solid #00c300" : "1.5px solid #bfe6c7";
        manBtn.onclick = () => { row.speaker = "男"; renderConversationEditor(); syncEditorToCSV(); };
        const womanBtn = document.createElement("button"); womanBtn.textContent = "女";
        womanBtn.style.background = row.speaker === "女" ? "#ff69b4" : "#eee"; womanBtn.style.color = row.speaker === "女" ? "#fff" : "#555";
        womanBtn.style.borderRadius = "50%"; womanBtn.style.width = "2.2em"; womanBtn.style.height = "2.2em";
        womanBtn.style.border = row.speaker === "女" ? "2px solid #ff69b4" : "1.5px solid #bfe6c7";
        womanBtn.onclick = () => { row.speaker = "女"; renderConversationEditor(); syncEditorToCSV(); };
        speakerTd.appendChild(manBtn);
        speakerTd.appendChild(womanBtn);
        tr.appendChild(speakerTd);
  
        const contentGroupTd = document.createElement("td");
        const contentGroup = document.createElement("div");
        contentGroup.className = "editor-col-group";
  
        const typeSelect = document.createElement("select");
        typeSelect.innerHTML = `<option value="text">テキスト</option><option value="image">画像</option><option value="phone">電話</option>`;
        typeSelect.value = row.type;
        typeSelect.onchange = (e) => {
          row.type = e.target.value;
          renderConversationEditor();
          syncEditorToCSV();
        };
        contentGroup.appendChild(typeSelect);
  
        if (row.type === "text") {
          const input = document.createElement("input");
          input.type = "text";
          input.value = row.content;
          input.oninput = (e) => {
            row.content = e.target.value;
            syncEditorToCSV();
          };
          contentGroup.appendChild(input);
        } else if (row.type === "image") {
          const fileInput = document.createElement("input");
          fileInput.type = "file";
          fileInput.accept = "image/*";
          fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
              console.log("FileReader結果:", {
                resultLength: ev.target.result ? ev.target.result.length : 0,
                resultPreview: ev.target.result ? ev.target.result.substring(0, 100) + "..." : "null",
                isValidDataUrl: ev.target.result ? ev.target.result.startsWith("data:image/") : false
              });
              row.content = ev.target.result;
              syncEditorToCSV();
              renderConversationEditor();
            };
            reader.onerror = (e) => {
              console.error("FileReader エラー:", e);
            };
            reader.readAsDataURL(file);
          };
          contentGroup.appendChild(fileInput);
          if (row.content && row.content.startsWith("data:image")) {
            const img = document.createElement("img");
            img.src = row.content;
            img.style.width = "60px";
            img.style.height = "auto";
            img.style.marginLeft = "8px";
            img.style.borderRadius = "8px";
            contentGroup.appendChild(img);
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
          contentGroup.appendChild(input);
        }
        contentGroupTd.appendChild(contentGroup);
        tr.appendChild(contentGroupTd);
        
        const datetimeTd = document.createElement("td");
        const datetimeGroup = document.createElement("div");
        datetimeGroup.className = "editor-col-group";
        
        const dateInput = document.createElement("input");
        dateInput.type = "text";
        dateInput.placeholder = "YYYY/MM/DD";
        dateInput.value = row.date || "";
        dateInput.oninput = (e) => {
          row.date = e.target.value;
          syncEditorToCSV();
        };
        datetimeGroup.appendChild(dateInput);
  
        const timestampInput = document.createElement("input");
        timestampInput.type = "text";
        timestampInput.placeholder = "HH:MM";
        timestampInput.value = row.timestamp || "";
        timestampInput.oninput = (e) => {
          row.timestamp = e.target.value;
          syncEditorToCSV();
        };
        datetimeGroup.appendChild(timestampInput);
        
        datetimeTd.appendChild(datetimeGroup);
        tr.appendChild(datetimeTd);
  
        const delTd = document.createElement("td");
        const delBtn = document.createElement("button");
        delBtn.textContent = "×";
        delBtn.className = "del-btn";
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
  
      const addBtn = document.createElement("button");
      addBtn.textContent = "＋追加";
      addBtn.className = "add-btn";
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
      conversationEditor.appendChild(addBtn);
    }
  
    function syncEditorToCSV() {
      let csv = "sender,type,content,date,timestamp\n";
      conversationRows.forEach((row) => {
        let content = row.content ? row.content.replace(/\n/g, " ") : "";
        let date = row.date || "";
        let timestamp = row.timestamp || "";
        
        // CSVでカンマや引用符を含むフィールドを適切にエスケープ
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
        const headerLineNormalized = line
          .replace(/\s+/g, ",")
          .toLowerCase();
        if (
          idx === 0 &&
          (headerLineNormalized.startsWith("sender,type,content,date,timestamp") ||
            headerLineNormalized.startsWith("sender,type,content,timestamp") ||
            headerLineNormalized.startsWith("sender,type,content") ||
            headerLineNormalized.startsWith("sender,text"))
        )
          return;
  
        const parts = parseCsvLine(line);
        console.log("CSV行解析:", { line: line.substring(0, 100) + "...", parts: parts.map(p => p.substring(0, 50) + "...") });
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
          
          if (
            timestamp &&
            timestamp.match(/\d{4}\/\d{1,2}\/\d{1,2}\s\d{1,2}:\d{2}:\d{2}/)
          ) {
            const dateTimeParts = timestamp.split(" ");
            if (dateTimeParts.length === 2) {
              const timeParts = dateTimeParts[1].split(":");
              if (timeParts.length >= 2) {
                timestamp = `${timeParts[0]}:${timeParts[1]}`;
              }
            }
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
  
    csvExportButton.addEventListener("click", () => {
      const blob = new Blob([conversationInput.value], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "chat.csv";
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
          // ファイル選択をリセットして、同じファイルでも再選択可能にする
          csvImportInput.value = '';
        };
        reader.readAsText(file, 'UTF-8');
      }
    });
    
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
  