const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const RECORDS_DIR = path.join(__dirname, 'records');
const RECORDS_FILE = path.join(RECORDS_DIR, 'records.json');

// Ensure records directory exists
if (!fs.existsSync(RECORDS_DIR)) {
  fs.mkdirSync(RECORDS_DIR, { recursive: true });
}

// Ensure records.json exists
if (!fs.existsSync(RECORDS_FILE)) {
  fs.writeFileSync(RECORDS_FILE, '[]', 'utf8');
}

// MIME types
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

// Helper: Read JSON from request
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) { // 5MB limit
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

// Helper: Sanitize filename
function sanitizeFilename(name) {
  return name.replace(/[\\/:*?"<>|\r\n\t]/g, '_').trim();
}

// Helper: Generate formatted Markdown content
function generateMarkdownRecord(data) {
  const {
    date = '',
    topic = '',
    querent = '',
    originalHexName = '',
    movingLinesNames = '',
    changedHexName = '',
    originalGuaci = '',
    originalGuayi = '',
    movingYaoci = '',
    movingYaoyi = '',
    changedGuaci = '',
    changedGuayi = '',
    notes = '',
    zhuxiRule = '',
    hexagramDiagram = ''
  } = data;

  return `# 易經占卜記錄表

---

### 1. 占卜日期:
${date || '未設定'}

### 2. 占卜主題:
${topic || '未填寫'}

### 3. 占卜者:
${querent || '未填寫'}

---

### 4. 本卦卦名:
${originalHexName || '無'}

### 5. 動爻:
${movingLinesNames || '無動爻（六爻安靜）'}

### 6. 之卦卦名:
${changedHexName || '無變卦'}

${hexagramDiagram ? `\n> **【卦象圖解】**\n>\n${hexagramDiagram.split('\n').map(l => '> ' + l).join('\n')}\n` : ''}
${zhuxiRule ? `> **【解卦方針】** ${zhuxiRule}\n` : ''}
---

### 7. 本卦卦詞:
${originalGuaci || '無'}

### 8. 本卦卦意:
${originalGuayi || '無'}

---

### 9. 動爻爻詞:
${movingYaoci || '六爻安靜，以本卦卦辭為主。'}

### 10. 動爻爻義:
${movingYaoyi || '六爻安靜，事態平穩或依循本卦之大勢發展，著重參酌本卦卦辭與卦意。'}

---

### 11. 之卦卦詞:
${changedGuaci || '（無動爻，無之卦）'}

### 12. 之卦卦意:
${changedGuayi || '（無動爻，無之卦）'}

---

### 13. 心得記錄:
${notes ? notes : '（尚無心得筆記）'}

---
*記錄建立時間: ${new Date().toLocaleString('zh-TW', { hour12: false })}*
`;
}

// Server handler
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    // API Routes
    if (pathname === '/api/hexagrams' && req.method === 'GET') {
      const dataPath = path.join(__dirname, 'data', 'hexagrams.json');
      if (fs.existsSync(dataPath)) {
        const data = fs.readFileSync(dataPath, 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(data);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Data not found' }));
      }
      return;
    }

    if (pathname === '/api/records' && req.method === 'GET') {
      let records = [];
      try {
        if (fs.existsSync(RECORDS_FILE)) {
          records = JSON.parse(fs.readFileSync(RECORDS_FILE, 'utf8'));
        }
      } catch (e) {
        records = [];
      }
      // Sort newest first
      records.sort((a, b) => (b.createdAt || b.date || '').localeCompare(a.createdAt || a.date || ''));
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(records));
      return;
    }

    if (pathname === '/api/records' && req.method === 'POST') {
      const recordData = await readJsonBody(req);
      
      // Assign ID and timestamp if not present
      if (!recordData.id) {
        recordData.id = 'rec_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      }
      recordData.updatedAt = new Date().toISOString();
      if (!recordData.createdAt) {
        recordData.createdAt = recordData.updatedAt;
      }

      // Read current records
      let records = [];
      try {
        if (fs.existsSync(RECORDS_FILE)) {
          records = JSON.parse(fs.readFileSync(RECORDS_FILE, 'utf8'));
        }
      } catch (e) {
        records = [];
      }

      // Generate filename: YYYY-MM-DD_HHmm_querent_topic_gua.md
      const datePart = (recordData.date || '').replace(/[- :]/g, '').slice(0, 12) || new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
      const safeQuerent = sanitizeFilename(recordData.querent || '無名').slice(0, 15);
      const safeTopic = sanitizeFilename(recordData.topic || '占事').slice(0, 20);
      const safeHex = sanitizeFilename(recordData.originalHexName || '卦') + (recordData.changedHexName && recordData.changedHexName !== '無變卦' ? '之' + sanitizeFilename(recordData.changedHexName) : '');
      const mdFilename = `${datePart}_${safeQuerent}_${safeTopic}_${safeHex}.md`;
      const mdFilePath = path.join(RECORDS_DIR, mdFilename);

      recordData.filename = mdFilename;

      // Write Markdown file
      const mdContent = generateMarkdownRecord(recordData);
      fs.writeFileSync(mdFilePath, mdContent, 'utf8');

      // Update records.json
      const existingIdx = records.findIndex(r => r.id === recordData.id);
      if (existingIdx >= 0) {
        records[existingIdx] = recordData;
      } else {
        records.unshift(recordData);
      }
      fs.writeFileSync(RECORDS_FILE, JSON.stringify(records, null, 2), 'utf8');

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, id: recordData.id, filename: mdFilename }));
      return;
    }

    if (pathname.startsWith('/api/records/') && req.method === 'DELETE') {
      const recordId = pathname.replace('/api/records/', '');
      let records = [];
      try {
        if (fs.existsSync(RECORDS_FILE)) {
          records = JSON.parse(fs.readFileSync(RECORDS_FILE, 'utf8'));
        }
      } catch (e) {
        records = [];
      }

      const recordToDelete = records.find(r => r.id === recordId);
      if (recordToDelete && recordToDelete.filename) {
        const mdPath = path.join(RECORDS_DIR, recordToDelete.filename);
        if (fs.existsSync(mdPath)) {
          try { fs.unlinkSync(mdPath); } catch (e) {}
        }
      }

      records = records.filter(r => r.id !== recordId);
      fs.writeFileSync(RECORDS_FILE, JSON.stringify(records, null, 2), 'utf8');

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    if (pathname === '/api/open-folder' && req.method === 'POST') {
      // Open records folder in Windows Explorer
      exec(`explorer.exe "${RECORDS_DIR}"`, (err) => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        }
      });
      return;
    }

    // Static File Serving
    let relPath = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
    let filePath = path.join(__dirname, relPath);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      filePath = path.join(PUBLIC_DIR, relPath);
    }

    // Prevent directory traversal
    if (!filePath.startsWith(__dirname)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    // Fallback 404
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('找不到此檔案 (404 Not Found)');
  } catch (error) {
    console.error('Server error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
});

// Start listening
server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`☯ 易經占卜與紀錄系統已成功啟動！`);
  console.log(`🌐 本地網址: http://localhost:${PORT}`);
  console.log(`📁 紀錄存檔目錄: ${RECORDS_DIR}`);
  console.log(`===============================================`);
});
