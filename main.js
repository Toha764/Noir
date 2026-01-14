const { app, BrowserWindow, ipcMain, globalShortcut, clipboard, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto'); // generating uid for photos

// --- File Paths ---
const userDataPath = app.getPath('userData');
const notesPath = path.join(userDataPath, 'notes');
const settingsPath = path.join(userDataPath, 'settings.json');
const remindersPath = path.join(userDataPath, 'reminders.json');
const imagesPath = path.join(userDataPath, 'images');
fs.mkdirSync(notesPath, { recursive: true });
fs.mkdirSync(imagesPath, { recursive: true });


// --- Settings Management ---
function getSettings() {
    try {
        if (fs.existsSync(settingsPath)) {
            return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        }
    } catch (error) {
        console.error("Error reading settings:", error);
    }
    // Default settings
    return {
        apiKey: '',
        quizPrompt: `You are an AI that transforms raw daily notes into active recall questions in the style of Anki flashcards. 
                    Rules:
                    - Output questions and answers in separate sections (in order 1, 2, 3...) so that answers can't be seen directly when self quizzing.
                    - Extract key concepts, people, places, dates, numbers, cause/effect, or definitions from the notes. 
                    - Phrase each as a clear, focused recall question (avoid yes/no, avoid giving away context in the question).
                    - Use formats like: "What...", "Who...", "When...", "Where...", "Why...", "How..."
                    - Keep each question short, unambiguous, and memory-focused.
                    - Output as a simple bulleted list.`,
        fontSize: 'base',
        fontFamily: 'mono'
    };
}

// --- Reminder Management ---
function getReminders() {
    try {
        if (fs.existsSync(remindersPath)) {
            return JSON.parse(fs.readFileSync(remindersPath, 'utf-8'));
        }
    } catch (error) {
        console.error("Error reading reminders:", error);
    }
    return {};
}

function saveReminders(reminders) {
    try {
        fs.writeFileSync(remindersPath, JSON.stringify(reminders, null, 2));
    } catch (error) {
        console.error("Error saving reminders:", error);
    }
}

let mainWindow; // Make mainWindow accessible

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        icon: path.join(__dirname, 'noir_app_icon.jpg'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        frame: false,
        titleBarStyle: 'hidden',
        trafficLightPosition: { x: 15, y: 15 },
    });

    mainWindow.loadFile('index.html');

    // Global shortcut to capture selected text
    globalShortcut.register('CommandOrControl+Shift+C', () => {
        const selectedText = clipboard.readText();
        if (selectedText) {
            mainWindow.webContents.send('capture-text', selectedText);
        }
    });
}

app.whenReady().then(() => {
    createWindow();

    // --- window controls --- 
    ipcMain.on('window-minimize', () => mainWindow.minimize());
    ipcMain.on('window-maximize', () => {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    });
    ipcMain.on('window-close', () => mainWindow.close());

    // opening path of images 
    ipcMain.on('open-user-data-path', () => {
        shell.openPath(userDataPath);
    });

    // --- saving pasted images ---
    ipcMain.handle('save-pasted-image', (event, { buffer, mimeType }) => {
        try {
            const extension = mimeType.split('/')[1];
            const fileName = `${crypto.randomUUID()}.${extension}`;
            const filePath = path.join(imagesPath, fileName);
            fs.writeFileSync(filePath, Buffer.from(buffer));
            return fileName;
        } catch (error) {
            console.error('Failed to save image:', error);
            return null;
        }
    });

    ipcMain.handle('get-images-path', () => imagesPath);

    // --- [NEW] Handler to get all note content for client-side search ---
    ipcMain.handle('get-all-notes', () => {
        const notes = [];
        try {
            const files = fs.readdirSync(notesPath);
            for (const file of files) {
                if (path.extname(file) === '.md') {
                    const dateString = file.replace('.md', '');
                    const filePath = path.join(notesPath, file);
                    const content = fs.readFileSync(filePath, 'utf-8');
                    notes.push({ dateString, content });
                }
            }
        } catch (error) {
            console.error('Failed to get all notes:', error);
        }
        return notes;
    });


    // --- Other IPC Handlers ---
    ipcMain.handle('get-settings', () => getSettings());
    ipcMain.handle('save-settings', (event, settings) => {
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    });
    ipcMain.handle('load-note', (event, dateString) => {
        const filePath = path.join(notesPath, `${dateString}.md`);
        return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
    });
    ipcMain.handle('save-note', (event, { dateString, content }) => {
        const filePath = path.join(notesPath, `${dateString}.md`);
        fs.writeFileSync(filePath, content);
    });
    ipcMain.handle('delete-note', (event, dateString) => {
        const filePath = path.join(notesPath, `${dateString}.md`);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        const reminders = getReminders();
        if (reminders[dateString]) {
            delete reminders[dateString];
            saveReminders(reminders);
        }
    });
    ipcMain.handle('get-notes-for-month', (event, { year, month }) => {
        const files = fs.readdirSync(notesPath);
        const monthString = (month + 1).toString().padStart(2, '0');
        return files
            .filter(file => file.startsWith(`${year}-${monthString}`))
            .map(file => file.replace('.md', ''));
    });
    ipcMain.handle('get-note-title', (event, dateString) => {
        const filePath = path.join(notesPath, `${dateString}.md`);
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n');
            const firstNonEmptyLine = lines.find(line => line.trim() !== '');
            return firstNonEmptyLine ? firstNonEmptyLine.replace(/^#+\s*/, '').trim() : '';
        }
        return '';
    });
    ipcMain.handle('get-reminders-for-month', (event, { year, month }) => {
        const reminders = getReminders();
        const monthString = (month + 1).toString().padStart(2, '0');
        const filtered = {};
        for (const noteDate in reminders) {
            if (noteDate.startsWith(`${year}-${monthString}`)) {
                filtered[noteDate] = reminders[noteDate];
            }
        }
        return filtered;
    });
    ipcMain.handle('set-reminder', (event, { noteDate, delayInDays }) => {
        const reminders = getReminders();
        const reviewDate = new Date();
        reviewDate.setDate(reviewDate.getDate() + delayInDays);
        const reviewDateString = reviewDate.toISOString().split('T')[0];

        reminders[noteDate] = reviewDateString;
        saveReminders(reminders);
        return { success: true, message: 'Reminder set!' };
    });
    ipcMain.handle('delete-reminder', (event, noteDate) => {
        const reminders = getReminders();
        if (reminders[noteDate]) {
            delete reminders[noteDate];
            saveReminders(reminders);
        }
    });
    ipcMain.handle('get-due-reminders', (event) => {
        const reminders = getReminders();
        const today = new Date().toISOString().split('T')[0];
        const dueNotes = [];
        for (const noteDate in reminders) {
            if (reminders[noteDate] <= today) {
                const filePath = path.join(notesPath, `${noteDate}.md`);
                let title = 'Untitled Note';
                if (fs.existsSync(filePath)) {
                    const content = fs.readFileSync(filePath, 'utf-8');
                    title = content.split('\n')[0].replace(/^#+\s*/, '').trim() || 'Untitled Note';
                }
                dueNotes.push({ noteDate, reviewDate: reminders[noteDate], title });
            }
        }
        return dueNotes;
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});