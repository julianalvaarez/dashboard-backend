import { Router } from "express";
import { supabase } from "../../utils/Supabase.js";
import { groq } from "../../utils/groq.js";

export const aiRoutes = Router();

// Detección inteligente de contexto
// ─────────────────────────────────────────────
function detectIntent(question) {
    const q = question.toLowerCase();

    const intent = {
        needsAllPlayers: false,
        needsSpecificPlayer: false,
        playerName: null,
        needsMonthly: false,
        month: null,
        year: null,
        needsBalance: false,
        needsTransactions: false,
        needsComparison: false,
    };

    // ¿Habla de todos los jugadores?
    if (
        q.includes('todos') ||
        q.includes('total') ||
        q.includes('general') ||
        q.includes('resumen') ||
        q.includes('comparar') ||
        q.includes('comparación') ||
        q.includes('ranking')
    ) {
        intent.needsAllPlayers = true;
        intent.needsComparison = true;
    }

    // ¿Pregunta por balance/historial?
    if (
        q.includes('balance') ||
        q.includes('saldo') ||
        q.includes('historial') ||
        q.includes('acumulado')
    ) {
        intent.needsBalance = true;
    }

    // ¿Pregunta por gastos/ingresos/movimientos?
    if (
        q.includes('gasto') ||
        q.includes('ingreo') || // typo common
        q.includes('ingreso') ||
        q.includes('pago') ||
        q.includes('cobro') ||
        q.includes('movimiento') ||
        q.includes('transacción') ||
        q.includes('cuánto')
    ) {
        intent.needsTransactions = true;
    }

    // Detectar mes mencionado
    const meses = {
        enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
        julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
    };
    for (const [nombre, num] of Object.entries(meses)) {
        if (q.includes(nombre)) {
            intent.needsMonthly = true;
            intent.month = num;
            break;
        }
    }

    // Detectar año
    const yearMatch = q.match(/20\d{2}/);
    if (yearMatch) {
        intent.year = parseInt(yearMatch[0]);
    }

    return intent;
}

// Construcción del contexto desde Supabase (Optimizado con Totales)
// ─────────────────────────────────────────────
async function buildContext(question, explicitPlayerId = null) {
    const intent = detectIntent(question);
    const context = { fetchedAt: new Date().toISOString() };

    try {
        // 1. Obtener todos los jugadores
        const { data: players } = await supabase.from('players').select('id, name');
        context.players = players || [];

        // 2. Obtener TOTALES HISTÓRICOS (Esto asegura precisión en preguntas generales)
        // Traemos el agregado de todas las transacciones de la historia
        const { data: allTotals } = await supabase
            .from('transactions')
            .select('player_id, type, amount');

        // Agregamos métricas globales al contexto
        const globalEarnings = allTotals.filter(t => t.type === 'earning').reduce((acc, t) => acc + (t.amount || 0), 0);
        const globalExpenses = allTotals.filter(t => t.type === 'expense').reduce((acc, t) => acc + (t.amount || 0), 0);

        context.globalStats = {
            totalIncome: globalEarnings,
            totalExpenses: globalExpenses,
            balance: globalEarnings - globalExpenses,
            totalTransactions: allTotals.length
        };

        // Resumen por jugador (TODOS los jugadores, TODA la historia)
        context.playerStats = players.map(p => {
            const pTxs = allTotals.filter(t => t.player_id === p.id);
            const ingresos = pTxs.filter(t => t.type === 'earning').reduce((acc, t) => acc + (t.amount || 0), 0);
            const gastos = pTxs.filter(t => t.type === 'expense').reduce((acc, t) => acc + (t.amount || 0), 0);
            return { nombre: p.name, ingresos, gastos, balance: ingresos - gastos };
        });

        // 3. DETALLES RECIENTES (Contexto para preguntas específicas de últimos movimientos)
        let targetPlayerIds = explicitPlayerId ? [explicitPlayerId] : [];

        // Buscar si menciona a alguien si no hay ID explícito
        if (!explicitPlayerId && !intent.needsAllPlayers) {
            for (const player of players) {
                if (question.toLowerCase().includes(player.name.split(' ')[0].toLowerCase())) {
                    targetPlayerIds.push(player.id);
                }
            }
        }

        // Traer solo las 15 transacciones más relevantes para no saturar tokens
        let txQuery = supabase
            .from('transactions')
            .select('player_id, type, amount, currency, date, description')
            .order('date', { ascending: false })
            .limit(15);

        if (targetPlayerIds.length > 0) {
            txQuery = txQuery.in('player_id', targetPlayerIds);
        }

        const { data: recentTxs } = await txQuery;
        context.recentTransactions = (recentTxs || []).map(t => ({
            p_id: t.player_id,
            type: t.type,
            amt: t.amount,
            cur: t.currency,
            date: t.date,
            desc: t.description
        }));

    } catch (err) {
        console.error('Context Error:', err);
        context.error = "Limit data";
    }

    return context;
}

// ─────────────────────────────────────────────
// System prompt
// ─────────────────────────────────────────────
function buildSystemPrompt(context) {
    return `Eres un asistente financiero. 
CONTEXTO: ${JSON.stringify(context)}

REGLAS:
1. Sé conciso y directo. NO expliques tu razonamiento ni muestres correcciones.
2. Si preguntan por totales o rankings, usá 'playerStats'.
3. Si preguntan por transacciones específicas, usá 'recentTransactions'.
4. Respondé solo la información solicitada en español argentino.
Actual: ${new Date().toLocaleDateString('es-AR')}`;
}

// ─────────────────────────────────────────────
// POST /api/ai/ask
// ─────────────────────────────────────────────
aiRoutes.post('/ai/ask', async (req, res) => {
    console.log('=== PETICIÓN AI ===', req.body.question);
    try {
        const { question, history = [], playerId = null } = req.body;

        if (!question?.trim()) {
            return res.status(400).json({ success: false, error: 'Pregunta vacía.' });
        }

        const context = await buildContext(question, playerId);

        const messages = [
            { role: 'system', content: buildSystemPrompt(context) }
        ];

        history.slice(-5).forEach((msg) => {
            messages.push({ role: msg.role, content: msg.content });
        });

        messages.push({ role: 'user', content: question });

        const response = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: messages,
            temperature: 0.3, // Menos creativo, más preciso
            max_tokens: 400,   // Respuestas más cortas
        });

        const answer = response.choices?.[0]?.message?.content?.trim() || "No pude generar respuesta.";

        return res.json({
            success: true,
            answer,
            contextUsed: {
                players: context.players?.length,
                hasGlobalStats: !!context.globalStats,
                recentTxs: context.recentTransactions?.length
            },
        });
    } catch (err) {
        console.error('AI Error:', err);
        const isRateLimit = err.message?.includes('Limit');
        return res.status(isRateLimit ? 429 : 500).json({
            success: false,
            error: isRateLimit ? 'Límite de tokens alcanzado. Esperá un momento.' : 'Error interno.'
        });
    }
});
