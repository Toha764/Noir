const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // --- Settings ---
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

    // --- Notes ---
    loadNote: (dateString) => ipcRenderer.invoke('load-note', dateString),
    saveNote: (note) => ipcRenderer.invoke('save-note', note),
    deleteNote: (dateString) => ipcRenderer.invoke('delete-note', dateString),
    getNotesForMonth: (date) => ipcRenderer.invoke('get-notes-for-month', date),
    getNoteTitle: (dateString) => ipcRenderer.invoke('get-note-title', dateString),

    // --- Reminders ---
    setReminder: (reminder) => ipcRenderer.invoke('set-reminder', reminder),
    getRemindersForMonth: (date) => ipcRenderer.invoke('get-reminders-for-month', date),
    getDueReminders: () => ipcRenderer.invoke('get-due-reminders'),

    // --- Window Controls ---
    minimizeWindow: () => ipcRenderer.send('window-minimize'),
    maximizeWindow: () => ipcRenderer.send('window-maximize'),
    closeWindow: () => ipcRenderer.send('window-close'),

    // --- System ---
    onCapture: (callback) => ipcRenderer.on('capture-text', (event, text) => callback(text)),
});
