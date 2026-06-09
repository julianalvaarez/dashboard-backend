import { Router } from "express";
import { supabase } from "../../utils/Supabase.js";
import Groq from "groq-sdk";

export const aiRoutes = Router();

// Inicializar Groq
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

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

// Construcción del contexto desde Supabase
// ─────────────────────────────────────────────
async function buildContext(question, explicitPlayerId = null) {
    const intent = detectIntent(question);
    const context = { fetchedAt: new Date().toISOString() };

    try {
        // Siempre traer la lista de jugadores
        const { data: players, error: playersError } = await supabase
            .from('players')
            .select('id, name')
            .order('name');

        if (playersError) throw playersError;
        context.players = players || [];

        // Si hay jugador explícito (desde el frontend), priorizar ese
        let targetPlayerIds = explicitPlayerId ? [explicitPlayerId] : [];

        // Si no hay jugador explícito pero tampoco pide "todos", buscar nombre en pregunta
        if (!explicitPlayerId && !intent.needsAllPlayers && players) {
            for (const player of players) {
                const firstName = player.name.split(' ')[0].toLowerCase();
                if (question.toLowerCase().includes(firstName)) {
                    targetPlayerIds.push(player.id);
                    intent.needsSpecificPlayer = true;
                    intent.playerName = player.name;
                }
            }
        }

        // Si pide todos o no encontró jugador específico, traer resúmenes de todos
        if (intent.needsAllPlayers || targetPlayerIds.length === 0) {
            // Resumen por jugador (últimos 6 meses)
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

            const { data: allTransactions } = await supabase
                .from('transactions')
                .select('player_id, type, amount, currency, usd_rate, date, description')
                .gte('date', sixMonthsAgo.toISOString().split('T')[0])
                .order('date', { ascending: false });

            context.allTransactions = allTransactions || [];

            // Calcular resumen por jugador
            context.playerSummaries = players.map((player) => {
                const playerTxs = (allTransactions || []).filter(
                    (t) => t.player_id === player.id
                );
                const earnings = playerTxs.filter((t) => t.type === 'earning');
                const expenses = playerTxs.filter((t) => t.type === 'expense');

                return {
                    player: player.name,
                    totalIncome: earnings.reduce((s, t) => s + (t.amount || 0), 0),
                    totalExpenses: expenses.reduce((s, t) => s + (t.amount || 0), 0),
                    transactionCount: playerTxs.length,
                };
            });
        }

        // Traer transacciones de jugador(es) específico(s)
        if (targetPlayerIds.length > 0) {
            let txQuery = supabase
                .from('transactions')
                .select('id, player_id, type, amount, currency, usd_rate, date, description')
                .in('player_id', targetPlayerIds)
                .order('date', { ascending: false });

            // Filtrar por mes si se detectó
            if (intent.needsMonthly && intent.month) {
                const year = intent.year || new Date().getFullYear();
                const monthStr = String(intent.month).padStart(2, '0');
                const nextMonth = intent.month === 12 ? 1 : intent.month + 1;
                const nextYear = intent.month === 12 ? year + 1 : year;
                const nextMonthStr = String(nextMonth).padStart(2, '0');

                txQuery = txQuery
                    .gte('date', `${year}-${monthStr}-01`)
                    .lt('date', `${nextYear}-${nextMonthStr}-01`);
            } else {
                // Sin filtro de mes: traer los últimos 100 movimientos
                txQuery = txQuery.limit(100);
            }

            const { data: transactions, error: txError } = await txQuery;
            if (txError) throw txError;

            context.transactions = transactions || [];

            // Calcular balance histórico si se pide
            if (intent.needsBalance) {
                const { data: allHistory } = await supabase
                    .from('transactions')
                    .select('type, amount, currency, usd_rate')
                    .in('player_id', targetPlayerIds);

                if (allHistory) {
                    const income = allHistory.filter((t) => t.type === 'earning');
                    const expenses = allHistory.filter((t) => t.type === 'expense');
                    context.historicalBalance = {
                        totalIncome: income.reduce((s, t) => s + (t.amount || 0), 0),
                        totalExpenses: expenses.reduce((s, t) => s + (t.amount || 0), 0),
                        net:
                            income.reduce((s, t) => s + (t.amount || 0), 0) -
                            expenses.reduce((s, t) => s + (t.amount || 0), 0),
                    };
                }
            }
        }

        // Resumen mensual si se pide mes específico sin jugador
        if (intent.needsMonthly && intent.month && targetPlayerIds.length === 0) {
            const year = intent.year || new Date().getFullYear();
            const monthStr = String(intent.month).padStart(2, '0');
            const nextMonth = intent.month === 12 ? 1 : intent.month + 1;
            const nextYear = intent.month === 12 ? year + 1 : year;
            const nextMonthStr = String(nextMonth).padStart(2, '0');

            const { data: monthlyTxs } = await supabase
                .from('transactions')
                .select('player_id, type, amount, currency, usd_rate, description')
                .gte('date', `${year}-${monthStr}-01`)
                .lt('date', `${nextYear}-${nextMonthStr}-01`);

            context.monthlyBreakdown = {
                period: `${monthStr}/${year}`,
                transactions: monthlyTxs || [],
                totalIncome: (monthlyTxs || [])
                    .filter((t) => t.type === 'earning')
                    .reduce((s, t) => s + (t.amount || 0), 0),
                totalExpenses: (monthlyTxs || [])
                    .filter((t) => t.type === 'expense')
                    .reduce((s, t) => s + (t.amount || 0), 0),
            };
        }
    } catch (err) {
        console.error('Error building context:', err);
        context.error = 'Error al obtener algunos datos de la base de datos.';
    }

    return context;
}

// ─────────────────────────────────────────────
// System prompt
// ─────────────────────────────────────────────
function buildSystemPrompt(context) {
    return `Eres un asistente financiero especializado para un representante de jugadores de fútbol profesional.
 
REGLAS ESTRICTAS:
1. SOLO respondés preguntas relacionadas con los datos financieros y de gestión de los jugadores.
2. Si te preguntan algo fuera de este ámbito (política, tecnología, recetas, etc.), respondé: "Solo puedo ayudarte con información financiera y de los jugadores representados."
3. Respondé SIEMPRE en español argentino, de forma clara y profesional.
4. Cuando menciones montos, especificá siempre la moneda (ARS o USD).
5. Si no tenés datos suficientes para responder con precisión, decilo claramente.
6. Formateá los números con separadores de miles (ej: $1.500.000 ARS).
7. Podés hacer cálculos, comparaciones y análisis con los datos disponibles.
8. Nunca inventes datos que no estén en el contexto proporcionado.
 
CONTEXTO ACTUAL DE LA BASE DE DATOS:
${JSON.stringify(context, null, 2)}
 
Fecha y hora actual: ${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}`;
}

// ─────────────────────────────────────────────
// POST /api/ai/ask
// ─────────────────────────────────────────────
aiRoutes.post('/ai/ask', async (req, res) => {
    try {
        const { question, history = [], playerId = null } = req.body;

        if (!question || question.trim().length === 0) {
            return res.status(400).json({ success: false, error: 'La pregunta no puede estar vacía.' });
        }

        if (question.length > 500) {
            return res.status(400).json({ success: false, error: 'La pregunta es demasiado larga (máx. 500 caracteres).' });
        }

        // Construir contexto dinámico
        const context = await buildContext(question, playerId);

        // Armar historial de conversación para Groq
        const messages = [
            { role: 'system', content: buildSystemPrompt(context) }
        ];

        // Agregar historial previo
        history.slice(-10).forEach((msg) => {
            messages.push({
                role: msg.role,
                content: msg.content,
            });
        });

        // Agregar la nueva pregunta
        messages.push({ role: 'user', content: question });

        // Llamar a Groq (Llama 3 70B es excelente para esto)
        const response = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: messages,
            temperature: 0.5,
            max_tokens: 1024,
        });

        const answer = response.choices?.[0]?.message?.content?.trim();

        return res.json({
            success: true,
            answer,
            contextUsed: {
                playerCount: context.players?.length || 0,
                transactionCount: context.transactions?.length || context.allTransactions?.length || 0,
                hasBalance: !!context.historicalBalance,
            },
        });
    } catch (err) {
        console.error('AI endpoint error:', err);
        return res.status(500).json({
            success: false,
            error: 'Hubo un error al procesar tu consulta. Intentá de nuevo.',
        });
    }
});
