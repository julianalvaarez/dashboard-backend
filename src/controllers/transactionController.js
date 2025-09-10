import { getMonthRange } from '../helpers/getMonthRange.js';
import { supabase } from '../utils/Supabase.js';

export const addTransaction = async (req, res) => {
    const { description, amount, type, playerId, dates } = req.body

    if (!description || !amount || !type || !playerId || !dates?.length) {
        return res.status(400).json({ error: "Faltan parámetros" })
    }

    try {
        // Generar array de transacciones
        const txs = dates.map((dateStr) => {
            const d = new Date(dateStr)
            return {
                description,
                amount,
                type,
                player_id: playerId,
                date: new Date(d.getFullYear(), d.getMonth(), 1).toISOString(), // 👈 día 1 del mes
            }
        })

        const { data, error } = await supabase.from("transactions").insert(txs)

        if (error) return res.status(400).json({ error })

        res.status(201).json({ message: "Transacciones creadas", data })
    } catch (err) {
        res.status(500).json({ error: "Error del servidor" })
    }
}


export const updateTransaction = async (req, res) => {
    const { id } = req.params;
    const transactionData = req.body;
    try {
        const { error } = await supabase.from("transactions").update([{ ...transactionData }]).eq("id", id);

        if (error) res.status(404).json({ error: "Error al actualizar la transacción" });

        res.status(200).json({ message: "Transacción actualizada correctamente" });
    } catch (error) {
        res.status(500).json({ error: "Error del Servidor" })
    }
}


export const deleteTransaction = async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await supabase.from("transactions").delete().eq("id", id);

        if (error) res.status(404).json({ error: "Error al eliminar la transacción" });

        res.status(200).json({ message: "Transacción eliminada correctamente" });
    } catch (error) {
        res.status(500).json({ error: "Error del Servidor" })
    }
}

export const deleteTransactions = async (req, res) => {
    const { ids } = req.body; // array de IDs
    try {
        const { error } = await supabase.from("transactions").delete().in("id", ids); // 👈 elimina todos los que coincidan

        if (error) return res.status(400).json({ error: "Error al eliminar transacciones" });

        res.status(200).json({ message: "Transacciones eliminadas correctamente" });
    } catch (error) {
        res.status(500).json({ error: "Error del Servidor" });
    }
};


// controllers/transactionController.js
export const getTransactions = async (req, res) => {
    const { month, year, type } = req.query;

    if (!month || !year || !type) {
        return res
            .status(400)
            .json({ error: "Faltan parámetros: month, year y type son obligatorios" });
    }

    const { startDate, endDate } = getMonthRange(month, year);

    try {
        const { data, error } = await supabase
            .from("transactions")
            .select("id, description, amount, type, date, player:player_id ( id, name )") // 👈 join con player
            .eq("type", type)
            .gte("date", startDate.toISOString())
            .lte("date", endDate.toISOString());

        if (error) {
            return res
                .status(404)
                .json({ error: "Error al obtener las transacciones" });
        }

        res.status(200).json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error del Servidor" });
    }
};


export const getTransactionsByPlayer = async (req, res) => {
    const { playerId } = req.params;
    const { month, year } = req.query;

    const { startDate, endDate } = getMonthRange(month, year);

    try {
        const { data, error } = await supabase.from("transactions").select().eq("player_id", playerId).gte("date", startDate.toISOString()).lte("date", endDate.toISOString());
        if (error) {
            return res.status(404).json({ error: "Error al obtener las transacciones" });
        }

        // Separar ingresos y gastos
        const earnings = data.filter(tx => tx.type === "earning");
        const expenses = data.filter(tx => tx.type === "expense");

        res.status(200).json({
            earnings,
            expenses
        });


    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Error del Servidor" })
    }
}