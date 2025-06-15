# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Start development server with hot reload
npm start

# Install dependencies
npm install
```

## Project Architecture

This is a **LINE-style Chat Recorder** web application for creating and recording animated chat conversations for video content. The application has three main architectural layers:

### Core Components

1. **Chat Display System** (`index.html` + `style.css`)
   - LINE-style visual interface with fixed 540px chat width
   - `.chat-left` container handles scrolling during recording
   - Dynamic message bubble rendering with avatars and timestamps
   - Japanese text optimization with auto line-breaking for strings >15 characters

2. **Conversation Editor** (`script.js` - lines 400-600)
   - Interactive table-based editor with drag-and-drop reordering
   - Real-time preview updates in chat display
   - Supports text, image (base64), and phone call message types
   - Speaker toggle between "男" (male) and "女" (female)

3. **Recording System** (`script.js` - lines 200-400)
   - Opens dedicated popup window for recording
   - Uses `getDisplayMedia()` for screen capture
   - Auto-scroll functionality with configurable speed (0.5-5.0)
   - Outputs WebM video files to `/output/` directory

### Data Format

The application uses CSV format with structure:
```
sender,type,content,date,timestamp
```

- **Text messages**: Standard sender name, "text" type
- **Images**: Base64 data URLs, displayed at 360px width  
- **Phone calls**: Special "電話" sender creates call log UI
- **CSV files**: Stored in `/csv_files/` directory for templates

### Key File Relationships

- `script.js` contains all application logic (715 lines)
- `style.css` implements LINE-style visual design (570 lines)
- `index.html` provides semantic structure with accessibility features
- `/csv_files/` contains conversation templates
- `sample_chat.csv` demonstrates data format

### Recording Workflow

1. Create/import conversation data via CSV or editor
2. Configure recording settings (scroll speed, title, positioning)
3. Start recording opens popup window
4. Auto-scroll plays through conversation
5. Stop recording downloads WebM file

### Development Notes

- Uses vanilla JavaScript, no build process required
- `reload` package provides development server
- Media APIs: MediaRecorder, getDisplayMedia, FileReader
- Japanese language optimized with Noto Sans JP font
- Responsive design with fixed chat width, flexible control panel