import express from 'express';
import pool from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// System prompt for the AI assistant
const SYSTEM_PROMPT = `You are the AI business assistant for Industrial 3D Solution, a B2B industrial supply company based in Dhaka, Bangladesh.

Company details:
- Name: Industrial 3D Solution
- Website: https://www.industrial.com.bd
- Address: Level-6, B-63, Malibag, DIT Road, Dhaka-1217, Bangladesh
- Phone: +880 1918-138880
- Email: support@industrial.com.bd
- Currency: Bangladeshi Taka (৳), format as ৳X,XX,XXX (Indian-style number formatting)

Products: 3D printers (Bambu Lab P1S, X1C, H2S, H2C, A1), 3D filaments (PLA, PETG, TPU, ABS — Bambu Lab, Beelayers, SUNLU), industrial tools (Harden, Yato, Workpro), meters & testers (VICTOR, FNIRSI, Hantek, Siglent), soldering & BGA tools (BAKU), pneumatic parts, electrical components (ABB, Siemens, Schneider), CNC machines, laser engravers (xTool, LaserPecker), flow meters, microscopes, consumables.

Services: 3D printing, CNC machining, sourcing & procurement, group buys, RFQ, import requests, repair & maintenance, training, consultation.

Payment methods: Cash, bKash, Nagad, bank transfer, corporate credit account.

Preorder rules: Items below ৳1,00,000 → minimum 20% advance; above ৳1,00,000 → 25-30% advance.

VAT: 15% standard rate. NBR Bangladesh compliance required.

You help with:
- Low stock analysis and reorder advice
- Preorder summaries and reminders
- Sales insights and trend analysis
- Margin analysis and pricing recommendations
- VAT reminders and compliance tips
- Payment reminder drafting for overdue customers
- Supplier communication drafting
- Import cost calculations
- Group buy participant notifications
- General business advice for B2B industrial supply in Bangladesh

Be concise, professional, and practical. Format currency as ৳X,XX,XXX.`;

async function callAI(apiKey, provider, model, messages, maxTokens = 1000) {
  if (!apiKey) throw new Error('AI API key not configured. Please add your API key in Settings > AI Assistant.');

  if (provider === 'gemini') {
    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-2.0-flash'}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents,
          generationConfig: { maxOutputTokens: maxTokens }
        })
      }
    );
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from AI.';
  } else if (provider === 'anthropic') {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        system: SYSTEM_PROMPT,
        messages
      })
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.content?.[0]?.text || 'No response from AI.';
  } else if (provider === 'openai') {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        max_tokens: maxTokens,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages]
      })
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.choices?.[0]?.message?.content || 'No response from AI.';
  }
  throw new Error('Unknown AI provider');
}

// POST /api/ai/chat
router.post('/chat', authenticateToken, async (req, res) => {
  const { message, session_id, context } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  const sid = session_id || uuidv4();

  try {
    // Get AI settings
    const settings = await pool.query('SELECT key, value FROM settings WHERE category = $1', ['ai']);
    const aiConfig = {};
    for (const row of settings.rows) aiConfig[row.key] = row.value;

    if (aiConfig.enabled === 'false') return res.status(400).json({ error: 'AI Assistant is disabled in settings.' });

    // Get conversation history for this session
    const history = await pool.query(
      'SELECT role, content FROM ai_conversations WHERE session_id = $1 ORDER BY created_at ASC LIMIT 20',
      [sid]
    );

    const messages = history.rows.map(r => ({ role: r.role, content: r.content }));
    
    // Add context if provided (e.g., current order details)
    let userMessage = message;
    if (context) userMessage = `Context:\n${JSON.stringify(context, null, 2)}\n\nQuestion: ${message}`;
    
    messages.push({ role: 'user', content: userMessage });

    const maxTokens = { short: 200, medium: 500, long: 1000, full: 3000 }[aiConfig.max_length || 'medium'] || 500;
    const response = await callAI(aiConfig.api_key, aiConfig.provider || 'gemini', aiConfig.model, messages, maxTokens);

    // Save conversation
    await pool.query(
      'INSERT INTO ai_conversations (session_id, user_id, role, content) VALUES ($1,$2,$3,$4)',
      [sid, req.user.id, 'user', userMessage]
    );
    await pool.query(
      'INSERT INTO ai_conversations (session_id, user_id, role, content) VALUES ($1,$2,$3,$4)',
      [sid, req.user.id, 'assistant', response]
    );

    res.json({ response, session_id: sid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/quick - Quick action (no history)
router.post('/quick', authenticateToken, async (req, res) => {
  const { prompt, max_tokens } = req.body;
  try {
    const settings = await pool.query('SELECT key, value FROM settings WHERE category = $1', ['ai']);
    const aiConfig = {};
    for (const row of settings.rows) aiConfig[row.key] = row.value;

    if (aiConfig.enabled === 'false') return res.status(400).json({ error: 'AI Assistant is disabled.' });

    const response = await callAI(aiConfig.api_key, aiConfig.provider || 'gemini', aiConfig.model, [{ role: 'user', content: prompt }], max_tokens || 1000);
    res.json({ response });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ai/history/:session_id
router.get('/history/:session_id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT role, content, created_at FROM ai_conversations WHERE session_id = $1 ORDER BY created_at ASC',
      [req.params.session_id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/ai/history/:session_id
router.delete('/history/:session_id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM ai_conversations WHERE session_id = $1', [req.params.session_id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
