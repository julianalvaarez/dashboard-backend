import { getMonthRange } from '../helpers/getMonthRange.js';
import { getUsdRateForDate } from '../helpers/getUsdRateForDate.js';
import { supabase } from '../utils/Supabase.js';



export const addTransaction = async (req, res) => {
    try {
        const { player_id, type, description, amount, date, currency = "ARS", is_fixed = false, fixed_day = null, } = req.body;

        if (!player_id || !type || !amount || !date) {
            return res.status(400).json({ error: "Faltan datos obligatorios" });
        }

        // Si es movimiento fijo -> insertar en fixed_transactions
        if (is_fixed) {
            const toInsert = { player_id, type, description, amount, currency, day_of_month: fixed_day || new Date(date).getDate(), active: true, };
            const { data, error } = await supabase.from("fixed_transactions").insert([toInsert]).select();
            if (error) return res.status(500).json({ error: error.message });
            return res.status(201).json(data[0]);
        }

        // Si no es fijo -> crear transacción real
        // Obtener usd_rate para la fecha
        const usd_rate = await getUsdRateForDate(date);

        // Normalizar amount en pesos (en la base guardamos amount en ARS)
        let amountPesos = Number(amount);
        if (currency === "USD") {
            if (!usd_rate) {
                return res.status(400).json({ error: "No se pudo determinar el valor del dólar para esa fecha" });
            }
            amountPesos = Number(amount) * Number(usd_rate);
        }

        const insertObj = { player_id, type, description, amount: amountPesos, date: (new Date(date)).toISOString(), usd_rate: usd_rate ?? null, currency: "ARS", created_at: new Date().toISOString(), };

        const { data, error } = await supabase.from("transactions").insert([insertObj]).select();

        if (error) return res.status(500).json({ error: error.message });

        res.status(201).json(data[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error del servidor" });
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